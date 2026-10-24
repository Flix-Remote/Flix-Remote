import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnostics } from '../src/support.ts';

test('support envelope excludes unrelated fields and stays within the UTF-8 API budget', () => {
  const result = diagnostics({ hubConnected: false, deviceCount: 30, selectedDeviceId: 'selected', password: 'synthetic-secret', sessionToken: 'not-allowed', devices: Array.from({ length: 30 }, (_, i) => ({ id: i, name: 'شاشة '.repeat(2000) })), apps: Array.from({ length: 200 }, (_, i) => ({ id: i, label: 'تطبيق '.repeat(50) })) });
  const text = JSON.stringify(result);
  assert.ok(new TextEncoder().encode(text).byteLength <= 60000);
  assert.equal(result.diagnostics.truncated, true);
  assert.equal(text.includes('synthetic-secret'), false); assert.equal(text.includes('not-allowed'), false);
  assert.equal(result.diagnostics.deviceCount, 30); // total remains truthful when details are truncated
});
