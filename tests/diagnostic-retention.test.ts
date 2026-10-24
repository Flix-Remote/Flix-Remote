import test from 'node:test';
import assert from 'node:assert/strict';
import { recentDiagnostics, DIAGNOSTIC_RETENTION_MS as ttl } from '../src/diagnostic-retention.ts';

test('local diagnostic retention drops expired, future and invalid records, including the exact boundary', () => {
  const now = 1800000000000;
  const values = [now-ttl-1, now-ttl, now-ttl+1, now, now+1, NaN, Infinity].map(at=>({at}));
  assert.deepEqual(recentDiagnostics(values, now).map(x=>x.at), [now-ttl+1, now]);
});
