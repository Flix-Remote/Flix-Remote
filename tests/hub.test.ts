import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import { Store } from '../hub/store.ts';
import { identify, readDescription } from '../hub/discovery.ts';
import { isLanHost, decodeXml } from '../hub/network.ts';
import { validatePackage, Packages } from '../hub/packages.ts';
import { safeAppId, safeTarget } from '../hub/tools.ts';
import { createHub } from '../hub/server.ts';
import { Adapters } from '../hub/adapters.ts';
import { capabilities } from '../hub/capabilities.ts';
import { localHost, localUrl } from '../src/direct/native.ts';
import type { Device, TvApp, Setting } from '../src/model.ts';
function fixture(t: test.TestContext) { const root = mkdtempSync(path.join(os.tmpdir(), 'home-remote-test-')); t.after(() => rmSync(root, { recursive: true, force: true })); return root; }
function device(store: Store, platform: Device['platform'] = 'android', host = '192.168.1.50') { const d = store.upsert({ name: 'Test TV', host, platform, seenAt: Date.now() }); d.paired = true; return d; }
test('TCL is classified by operating system, never by brand alone', () => { assert.equal(identify('TCL Roku TV'), 'roku'); assert.equal(identify('TCL Google TV'), 'android'); assert.equal(identify('TCL'), 'unknown'); assert.equal(identify('LG webOS'), 'webos'); assert.equal(identify('Samsung Tizen'), 'tizen'); });
test('LAN targets reject public IPs, loopback, IPv6 and shell/URL input', () => { for (const bad of ['127.0.0.1', '8.8.8.8', '192.168.1.1.evil.com', '192.168.1.1;pwd', '::1']) assert.equal(isLanHost(bad), false); for (const good of ['10.0.0.4', '172.16.1.2', '192.168.1.9']) assert.equal(isLanHost(good), true); });
test('direct phone transport refuses public hosts, credentials and alternate icon hosts', () => { for (const bad of ['example.com','127.0.0.1','192.168.01.2','8.8.8.8']) assert.throws(() => localHost(bad)); assert.equal(localHost('192.168.1.2'), '192.168.1.2'); assert.throws(()=>localUrl('http://me:pw@192.168.1.2')); assert.throws(()=>localUrl('http://192.168.1.3/icon','192.168.1.2')); });
test('XML descriptions reject entities and cannot proxy a URL from another host', async t => { assert.throws(() => decodeXml('<!DOCTYPE root><root/>')); const store = new Store(fixture(t)); await readDescription('http://127.0.0.1/private', '192.168.1.5', store); assert.equal(store.data.devices.length, 0); });
test('discovery preserves pairing and developer target and refines unknown platform', t => { const store = new Store(fixture(t)); const d = device(store, 'unknown'); d.developerTarget = 'livingroom'; const updated = store.upsert({ host: d.host, name: 'Discovered', platform: 'webos', seenAt: 1 }); assert.equal(updated.id, d.id); assert.equal(updated.paired, true); assert.equal(updated.developerTarget, 'livingroom'); assert.equal(updated.platform, 'webos'); });
test('corrupt persistent state fails closed rather than overwriting paired devices', t => { const root = fixture(t); writeFileSync(path.join(root, 'state.json'), 'broken'); assert.throws(() => new Store(root), /غير صالح/); });
test('unknown and unpaired TVs expose no actionable controls', t => { const store = new Store(fixture(t)); const d = device(store, 'unknown'); assert.equal(capabilities(d).control.available, false); assert.deepEqual(capabilities(d).commands, []); d.platform = 'webos'; d.paired = false; assert.equal(capabilities(d).install.available, false); });
test('package validation rejects mismatched system, renamed binaries and injection IDs', () => { const zip = Buffer.from('PK\x03\x04testing'); validatePackage('android', 'ok.apk', zip); assert.throws(() => validatePackage('webos', 'wrong.apk', zip)); assert.throws(() => validatePackage('android', 'fake.apk', Buffer.from('not a zip'))); assert.throws(() => safeAppId('com.foo;reboot')); assert.throws(() => safeTarget('tv & reboot')); });
test('install requires confirmation, compatible OS and unchanged SHA-256', async t => {
  const store = new Store(fixture(t)), d = device(store, 'webos'), catalog = new Packages(store);
  const p = catalog.add({ name: 'Example', appId: 'com.example.tv', version: '1', platform: 'android', filename: 'app.apk', data: Buffer.from('PK\x03\x04testing').toString('base64') });
  await assert.rejects(catalog.install(d, p.id, false), /وافق/);
  await assert.rejects(catalog.install(d, p.id, true), /مختلف/);
  d.platform = 'android'; process.env.HOME_REMOTE_ADB = process.execPath;
  t.after(() => delete process.env.HOME_REMOTE_ADB);
  writeFileSync(path.join(store.packagesDir, p.filename), 'tampered');
  await assert.rejects(catalog.install(d, p.id, true), /تغيرت/);
});
test('Android installation executes for selected TV and reports actual tool failure', async t => {
  const store = new Store(fixture(t)), d = device(store), catalog = new Packages(store);
  process.env.HOME_REMOTE_ADB = process.execPath; t.after(() => delete process.env.HOME_REMOTE_ADB);
  const p = catalog.add({ name: 'Example', appId: 'com.example.tv', version: '1', platform: 'android', filename: 'app.apk', data: Buffer.from('PK\x03\x04testing').toString('base64') });
  const called: string[][] = [];
  const good = await catalog.install(d, p.id, true, async (_tool, args) => { called.push(args); return 'Success'; });
  assert.equal(called[0][1], '192.168.1.50:5555'); assert.equal(good.status, 'installed');
  const bad = await catalog.install(d, p.id, true, async () => { throw new Error('rejected by TV'); }); assert.equal(bad.status, 'failed'); assert.equal(bad.message, 'rejected by TV');
});
test('LG installation rejects a developer alias pointing at another television', async t => {
  const store = new Store(fixture(t)), d = device(store, 'webos'), catalog = new Packages(store); d.developerTarget = 'livingroom';
  process.env.HOME_REMOTE_ARES_INSTALL = process.execPath; process.env.HOME_REMOTE_ARES_SETUP_DEVICE = process.execPath;
  t.after(() => { delete process.env.HOME_REMOTE_ARES_INSTALL; delete process.env.HOME_REMOTE_ARES_SETUP_DEVICE; });
  const p = catalog.add({ name: 'Example', appId: 'com.example.tv', version: '1', platform: 'webos', filename: 'app.ipk', data: Buffer.from('!<arch>\ntesting').toString('base64') });
  let installCalled = false;
  const result = await catalog.install(d, p.id, true, async (tool) => { if (tool === 'ares-install') installCalled = true; return 'livingroom developer@192.168.1.99:9922 ssh tv'; });
  assert.equal(result.status, 'failed'); assert.equal(installCalled, false);
});
test('Android remote uses discovered port and returns system launcher applications', async t => {
  const store = new Store(fixture(t)), d = device(store); d.port = 37123;
  const calls: string[][] = [];
  const adapter = new Adapters(store, async (_tool, args) => { calls.push(args); return 'com.android.settings/.Settings\ncom.netflix.ninja/.MainActivity\n'; });
  await adapter.command(d, 'left'); assert.equal(calls[0][1], '192.168.1.50:37123'); assert.equal(calls[0].at(-1), '21');
  const apps = await adapter.apps(d); assert.deepEqual(apps.map(a => a.id), ['com.android.settings', 'com.netflix.ninja']);
  d.paired = false; await assert.rejects(adapter.command(d, 'home'), /اقترن/);
});
class MockAdapters extends Adapters {
  commands: { id: string; command: string }[] = [];
  override async pair(d: Device) { d.paired = true; }
  override async command(d: Device, command: any) { if (command === 'fail') throw new Error('TV rejected'); this.commands.push({ id: d.id, command }); }
  override async apps(): Promise<TvApp[]> { return [{ id: 'com.example.tv', label: 'Example' }]; }
  override async settings(): Promise<Setting[]> { return [{ id: 'open', label: 'Settings', kind: 'action' }]; }
}
test('HTTP flow authenticates, pairs, lists apps, targets exact device and propagates rejection', async t => {
  const root = fixture(t), web = path.join(root, 'web'); mkdirSync(web); writeFileSync(path.join(web, 'index.html'), '<h1>Test</h1>');
  const adapter = new MockAdapters(new Store(path.join(root, 'adapter')));
  const hub = createHub({ root: path.join(root, 'hub'), webRoot: web, pin: '123456', adapters: adapter });
  await new Promise<void>(resolve => hub.server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => { hub.server.closeAllConnections(); hub.server.close(() => resolve()); }));
  const base = `http://127.0.0.1:${(hub.server.address() as AddressInfo).port}`;
  const call = (route: string, method = 'GET', data?: unknown, token = '') => fetch(base + route, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: data === undefined ? undefined : JSON.stringify(data) });
  assert.equal((await call('/api/devices')).status, 401);
  const health = await (await call('/api/health')).json(); assert.equal(health.token, undefined);
  const pair = await (await call('/api/pair', 'POST', { pin: '123456' })).json(), token = pair.token;
  const one = await (await call('/api/devices', 'POST', { name: 'A', host: '192.168.1.31', platform: 'webos' }, token)).json();
  const two = await (await call('/api/devices', 'POST', { name: 'B', host: '192.168.1.32', platform: 'webos' }, token)).json();
  await call(`/api/devices/${two.device.id}/pair`, 'POST', {}, token);
  assert.equal((await (await call(`/api/devices/${two.device.id}/apps`, 'GET', undefined, token)).json()).apps.length, 1);
  await call(`/api/devices/${two.device.id}/command`, 'POST', { command: 'left' }, token);
  assert.equal(adapter.commands[0].id, two.device.id); assert.notEqual(adapter.commands[0].id, one.device.id);
  assert.equal((await call(`/api/devices/${two.device.id}/command`, 'POST', { command: 'fail' }, token)).status, 400);
  const evil = await fetch(base + '/api/pair', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) }); assert.equal(evil.status, 403);
  const rebind = await new Promise<number>(resolve => { const req = http.get(base + '/api/health', { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode!); }); req.on('error', () => resolve(0)); }); assert.equal(rebind, 403);
  for (let i = 0; i < 5; i++) assert.equal((await call('/api/pair', 'POST', { pin: '000000' })).status, 401);
  assert.equal((await call('/api/pair', 'POST', { pin: '000000' })).status, 429);
});
