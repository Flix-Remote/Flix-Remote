// The transport boundary is on the phone: never serialize raw protocol objects.
// A field allowlist limits collection; free text redaction is best effort, not DLP.
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export function diagnosticText(value: unknown, limit = 250): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[url redacted]')
    .replace(/((?:password|passwd|sessionToken|accessToken|refreshToken|clientKey|secret|authorization|cookie|pin)\s*["']?\s*[:=]\s*["']?)[^\s,;}"']+/gi, '$1[redacted]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]').slice(0, limit);
}
export function diagnosticSnapshot(input: unknown, events: unknown[]) {
  const raw = row(input);
  let truncated = false;
  const text = (value: unknown) => { const result = diagnosticText(value); if (String(value ?? '').length > 250) truncated = true; return result; };
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const list = (value: unknown, limit: number, tail = false): unknown[] => {
    if (!Array.isArray(value)) return [];
    if (value.length > limit) truncated = true;
    return tail ? value.slice(-limit) : value.slice(0, limit);
  };
  const app = (value: unknown) => { const a = row(value); return { id: text(a.id), label: text(a.label) }; };
  const setting = (value: unknown) => {
    const s = row(value);
    return { id: text(s.id), label: text(s.label), kind: text(s.kind),
      value: typeof s.value === 'boolean' || typeof s.value === 'number' && Number.isFinite(s.value) ? s.value : text(s.value),
      min: typeof s.min === 'number' && Number.isFinite(s.min) ? s.min : undefined,
      max: typeof s.max === 'number' && Number.isFinite(s.max) ? s.max : undefined,
      options: list(s.options, 30).map(app) };
  };
  const settings = (value: unknown) => list(value, 30)
    .filter(s => !/password|passwd|secret|token|credential|client.?key|private.?key|certificate|authorization|cookie|(?:^|[._ -])pin(?:$|[._ -])/i.test(String(row(s).id ?? '') + ' ' + String(row(s).label ?? ''))).map(setting);
  const devices = list(raw.devices, 30).map(value => {
    const d = row(value), activity = row(d.activity), caps = row(d.capabilities);
    const available = (value: unknown) => typeof value === 'boolean' ? value : row(value).available === true;
    return { id: text(d.id), name: text(d.name), host: text(d.host), platform: text(d.platform), model: text(d.model), paired: d.paired === true,
      seenAt: number(d.seenAt), checkedAt: number(d.checkedAt), status: text(d.status), error: text(d.error),
      activity: { available: activity.available === true, appId: text(activity.appId), label: text(activity.label), title: text(activity.title), state: text(activity.state), reason: text(activity.reason), checkedAt: number(activity.checkedAt) },
      apps: list(d.apps, 100).map(app), settings: settings(d.settings), port: number(d.port) || undefined, appCount: number(d.appCount),
      capabilities: { control: available(caps.control), apps: available(caps.apps), install: available(caps.install), reason: text(row(caps.install).reason ?? caps.reason), commands: list(caps.commands, 30).map(text), steps: list(caps.steps, 10).map(text) } };
  });
  const result = { directConnected: raw.directConnected === true, connectionMode: raw.connectionMode === 'phone-direct' ? 'phone-direct' : 'unknown',
    deviceCount: Math.min(100, Math.max(0, number(raw.deviceCount))), selectedDeviceId: text(raw.selectedDeviceId), devices,
    apps: list(raw.apps, 100).map(app), settings: settings(raw.settings),
    packages: list(raw.packages, 50).map(value => { const p = row(value); return { id: text(p.id), name: text(p.name), platform: text(p.platform), appId: text(p.appId), version: text(p.version), sha256: typeof p.sha256 === 'string' && /^[a-f0-9]{64}$/.test(p.sha256) ? p.sha256 : '' }; }),
    receipts: list(raw.receipts, 30, true).map(value => { const r = row(value); return { id: text(r.id), deviceId: text(r.deviceId), packageId: text(r.packageId), status: text(r.status), message: text(r.message), startedAt: number(r.startedAt), endedAt: number(r.endedAt) }; }),
    events: list(events, 80, true).map(value => { const e = row(value); return { at: number(e.at), stage: text(e.stage), outcome: text(e.outcome), deviceId: text(e.deviceId), message: text(e.message) }; }), truncated: false };
  result.truncated = truncated;
  return result;
}
