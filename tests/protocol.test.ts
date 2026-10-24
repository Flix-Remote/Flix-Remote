import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { Store } from '../hub/store.ts';
import { Adapters } from '../hub/adapters.ts';
import { TvSocket } from '../hub/socket.ts';

async function setup(t: test.TestContext, platform: 'webos' | 'tizen', denied = false) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'home-protocol-')), store = new Store(root);
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise<void>(resolve => server.once('listening', resolve));
  const messages: any[] = [];
  server.on('connection', socket => {
    if (platform === 'tizen') socket.send(JSON.stringify({ event: denied ? 'ms.channel.unauthorized' : 'ms.channel.connect', data: { token: 'test-key' } }));
    socket.on('message', raw => {
      const m = JSON.parse(String(raw)); messages.push(m);
      if (m.type === 'register') socket.send(JSON.stringify(denied ? { id: 'pair', type: 'error', error: 'permission denied' } : { type: 'registered', payload: { 'client-key': 'test-key' } }));
      if (m.type === 'request') socket.send(JSON.stringify({ id: m.id, type: 'response', payload: m.uri.includes('listLaunchPoints') ? { launchPoints: [{ id: 'com.test.tv', title: 'Test' }] } : m.uri.includes('getVolume') ? { volumeStatus: { mute: true } } : { returnValue: m.uri.includes('setVolume') ? false : true, errorText: 'not allowed' } }));
      if (m.params?.event === 'ed.installedApp.get') socket.send(JSON.stringify({ event: 'ed.installedApp.get', data: { data: [{ appId: '123', name: 'Test' }] } }));
    });
  });
  const adapters = new Adapters(store, undefined, () => new TvSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}`));
  t.after(async () => { adapters.close(); for (const c of server.clients) c.terminate(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(root, { recursive: true, force: true }); });
  const device = store.upsert({ host: '192.168.1.70', name: 'Synthetic TV', platform, seenAt: 0 });
  return { adapters, device, messages };
}
for (const platform of ['webos', 'tizen'] as const) {
  test(`${platform} wire pairing, app enumeration and launch target the selected TV`, async t => {
    const f = await setup(t, platform); await f.adapters.pair(f.device);
    assert.equal(f.device.paired, true); const apps = await f.adapters.apps(f.device); assert.equal(apps[0].label, 'Test');
    await f.adapters.launch(f.device, apps[0].id); await new Promise(resolve => setTimeout(resolve, 15));
    assert.ok(f.messages.some(m => m.payload?.id === apps[0].id || m.params?.data?.appId === apps[0].id));
    if (platform === 'webos') { await assert.rejects(f.adapters.setSetting(f.device, 'volume', 50), /not allowed/); await f.adapters.command(f.device, 'mute'); assert.ok(f.messages.some(m => m.uri === 'ssap://audio/setMute' && m.payload.mute === false)); }
  });
  test(`${platform} refuses rejected pairing without marking the device paired`, async t => { const f = await setup(t, platform, true); await assert.rejects(f.adapters.pair(f.device)); assert.equal(f.device.paired, false); });
}
