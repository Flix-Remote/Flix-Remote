/** Local diagnostics are for repair, never an indefinite usage history. */
export const DIAGNOSTIC_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export function recentDiagnostics<T extends { at: number }>(items: T[], now = Date.now()): T[] {
  return (Array.isArray(items) ? items : []).filter(item => item && Number.isFinite(item.at) && item.at <= now && item.at > now - DIAGNOSTIC_RETENTION_MS);
}
