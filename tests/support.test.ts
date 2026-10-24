import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnostics } from '../src/support.ts';
import { diagnosticSnapshot } from '../src/diagnostics.ts';

test('support envelope excludes unrelated fields and stays within the UTF-8 API budget', () => {
  const result = diagnostics({ hubConnected: false, deviceCount: 30, selectedDeviceId: 'selected', password: 'synthetic-secret', sessionToken: 'not-allowed', devices: Array.from({ length: 30 }, (_, i) => ({ id: i, name: 'شاشة '.repeat(2000) })), apps: Array.from({ length: 200 }, (_, i) => ({ id: i, label: 'تطبيق '.repeat(50) })) });
  const text = JSON.stringify(result);
  assert.ok(new TextEncoder().encode(text).byteLength <= 60000);
  assert.equal(result.diagnostics.truncated, true);
  assert.equal(text.includes('synthetic-secret'), false); assert.equal(text.includes('not-allowed'), false);
  assert.equal(result.diagnostics.deviceCount, 30); // total remains truthful when details are truncated
});

test('diagnostic transport allowlists nested TV data before upload and export', () => {
  const privateValue = 'never-send-this-value';
  const result = diagnosticSnapshot({ directConnected: true, connectionMode: 'phone-direct', deviceCount: 1,
    devices: [{ id: 'tv', name: 'TV', host: '192.0.2.2', paired: true, clientKey: privateValue, certificate: privateValue,
      activity: { available: true, title: 'A user-consented title', raw: privateValue },
      apps: [{ id: 'app', label: 'Player', icon: 'data:image/png;base64,' + privateValue }],
      settings: [{ id: 'volume', value: 10 }, { id: 'clientKey', value: privateValue }, { id: 'parental.pin', value: privateValue }],
      capabilities: { control: { available: true }, install: { available: false, response: privateValue }, raw: privateValue } }],
    packages: [{ id: 'pkg', sha256: 'a'.repeat(64), data: privateValue, path: privateValue, releaseUrl: privateValue }],
    receipts: [{ id: 'receipt', message: 'password=short-secret https://user:pass@example.invalid/path?token=private', raw: privateValue }],
    sessionToken: privateValue }, [{ stage: 'error', message: 'Bearer short-token clientKey=abc123' }]);
  const serialized = JSON.stringify(result);
  for (const secret of [privateValue, 'short-secret', 'short-token', 'abc123', 'example.invalid']) assert.equal(serialized.includes(secret), false, secret);
  assert.equal(result.devices[0].host, '192.0.2.2');
  assert.equal(result.devices[0].activity.title, 'A user-consented title');
  assert.deepEqual(result.devices[0].settings.map(s => s.id), ['volume']);
  assert.equal(result.devices[0].capabilities.control, true);
  assert.equal(result.packages[0].sha256, 'a'.repeat(64));
});

test('diagnostic boundary tolerates malformed snapshots and non-finite values', () => {
  assert.equal(diagnostics(null).diagnostics.deviceCount, 0);
  const result = diagnosticSnapshot({ deviceCount: Infinity, devices: [null, 'invalid'], settings: [{ id: 'volume', value: NaN, options: [null] }] }, []);
  assert.equal(result.deviceCount, 0);
  assert.equal(JSON.stringify(result).includes('null'), false);
});
