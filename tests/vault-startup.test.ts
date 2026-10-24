import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeFixture, installNativeBoundary } from './native-fixture.ts';

const fixture = nativeFixture();
fixture.vault.clear();
fixture.preferences.clear();
fixture.vault.set('session', JSON.stringify({account:{email:'fixture@example.invalid'}}));
(globalThis as any).fixtureNative = async (plugin:string,method:string,args:any = {}) => {
  // This is what the shipped iOS plugin returned for errSecItemNotFound.
  if (plugin === 'HomeDiscovery' && method === 'readSession' && !fixture.vault.has(args.key || 'session')) return undefined;
  return fixture.invoke(plugin,method,args);
};
installNativeBoundary();
const { initDirect, directApi } = await import('../src/direct/engine.ts');
const { loadSecrets, getSecrets } = await import('../src/direct/adb.ts');

test('fresh iPhone reaches discovery when the native vault returns no object',async () => {
  await initDirect();
  const result = await directApi<any>('/api/scan','POST',{});
  assert.ok(result);
  assert.ok(fixture.calls.some(c=>c.plugin==='DirectLan' && c.method==='discover'));
  assert.deepEqual(getSecrets(),{});
  assert.ok(fixture.vault.get('session')?.includes('fixture@example.invalid'));
});

test('existing TV ADB identity migrates to its own slot and account remains untouched',async () => {
  const account = fixture.vault.get('session');
  fixture.vault.set('tv-secrets',JSON.stringify({adb:'legacy-adb-key',tv:'tv-token'}));
  await loadSecrets();
  assert.equal(fixture.vault.get('phone-adb-identity'),'legacy-adb-key');
  assert.equal(fixture.vault.get('session'),account);
  fixture.vault.set('phone-adb-identity','stable-phone-key');
  await loadSecrets();
  assert.equal(getSecrets().adb,'stable-phone-key');
  assert.equal(fixture.vault.get('session'),account);
});
