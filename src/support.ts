import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { request } from './api.ts';
import { VERSION, BUILD_ID } from './build-info.ts';
import { AccessGate } from './access.ts';
import { diagnosticSnapshot, diagnosticText } from './diagnostics.ts';
import { recentDiagnostics, DIAGNOSTIC_RETENTION_MS } from './diagnostic-retention.ts';
export interface AccountSession { url: string; sessionToken: string; account: { id: string; email: string } }
interface Vault { saveSession(input: { value: string }): Promise<void>; readSession(): Promise<{ value?: string }>; clearSession(): Promise<void> }
const vault = registerPlugin<Vault>('HomeDiscovery');
export interface SupportAction { id: string; type: 'rescan' | 'refresh' | 'inspect' | 'pair' | 'settings' | 'install' | 'command' | 'launch' | 'setSetting'; deviceId: string; packageId: string; message: string; at: number; expiresAt?: number; grantId?: string; command?: string; appId?: string; settingId?: string; value?: string | number | boolean }
export interface ControlGrant { id: string; deviceId: string; expiresAt: number }
type Outcome = 'running' | 'sent' | 'failed' | 'declined' | 'review-opened';
interface Result { id: string; outcome: Outcome; message: string; at: number }
export interface DiagnosticEvent { at: number; stage: string; outcome: string; deviceId: string; message: string }
export let account: AccountSession | undefined;
export let reportId = '', sharing = false, supportMessage = '', actions: SupportAction[] = [];
export let messages: { role: 'user' | 'support'; text: string; at: number }[] = [];
// Memory-only: reopening the app never restores control permission.
export let control: ControlGrant | undefined;
let installationId = '', problem = '', problemAt = 0;
export const accessGate = new AccessGate(async () => {
  if (!account) throw new Error('سجّل دخول حساب FLIX لاستخدام الريموت.');
  const session = account;
  const reply = await request<{ access: { enabled: boolean; reason: string; checkedAt: number } }>(session.url, '/api/home-remote/access', session.sessionToken, 'POST', { installationId, platform: Capacitor.getPlatform(), version: VERSION, buildId: BUILD_ID });
  if (account !== session) throw new Error('تغير حساب FLIX.');
  return reply.access;
});
let syncQueue: Promise<void> = Promise.resolve();
let events: DiagnosticEvent[] = [], resolved: string[] = [], pendingResults: Result[] = [];
const clean = (v: string) => diagnosticText(v, 300);
export function record(stage: string, outcome: string, message: string, deviceId = '') { events.push({ at: Date.now(), stage, outcome, message: clean(message), deviceId }); events = events.slice(-80); void persist(); }
async function persist() {
  events = recentDiagnostics(events).slice(-80);
  pendingResults = recentDiagnostics(pendingResults).slice(-100);
  if (!problemAt || Date.now() - problemAt >= DIAGNOSTIC_RETENTION_MS) { problem = ''; problemAt = 0; }
  await Preferences.set({ key: 'home-remote-diagnostics', value: JSON.stringify({ installationId, reportId, problem, problemAt, sharing, events, resolved, pendingResults }) });
}
export async function clearLocalDiagnostics() {
  await stopSharing();
  events = []; pendingResults = []; resolved = []; problem = ''; problemAt = 0; reportId = ''; messages = [];
  await persist();
}
export function accountUrl(value: string) { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('خدمة حساب FLIX يجب أن تستخدم HTTPS.'); return url.origin; }
export async function initSupport() {
  try { const { value } = await Preferences.get({ key: 'home-remote-diagnostics' }); if (value) { const saved = JSON.parse(value); ({ installationId = '', reportId = '', problem = '', problemAt = 0, events = [], resolved = [], pendingResults = [] } = saved); } } catch { /* local recovery */ }
  sharing = false; control = undefined; installationId ||= crypto.randomUUID();
  try { const value = Capacitor.isNativePlatform() ? (await vault.readSession())?.value : sessionStorage.getItem('home-remote-account'); if (value) { account = JSON.parse(value); account!.url = accountUrl(account!.url); await verifyAccount(); } } catch { account = undefined; }
  accessGate.reset();
  if(account) { try { const current=await household('status') as any; if(current.profiles?.some((p:any)=>p.id===current.selectedProfileId&&p.locked)) await household('lock'); } catch { /* Never restore a manager grant from local storage. */ } }
  await persist();
}
export async function login(url: string, email: string, password: string) {
  url = accountUrl(url);
  const result = await request<{ sessionToken: string; account: AccountSession['account'] }>(url, '/api/home-remote/account/login', '', 'POST', { email, password }, 20000);
  if (!result.sessionToken || !result.account?.email) throw new Error('لم تعد خدمة FLIX جلسة دخول صالحة.');
  if (account?.account.id !== result.account.id || account?.url !== url) { reportId = ''; sharing = false; control = undefined; actions = []; resolved = []; pendingResults = []; problem = ''; events = []; messages = []; }
  account = { url, sessionToken: result.sessionToken, account: result.account };
  accessGate.reset();
  const value = JSON.stringify(account); if (Capacitor.isNativePlatform()) await vault.saveSession({ value }); else sessionStorage.setItem('home-remote-account', value);
  await persist();
  await accessGate.refresh().catch(() => undefined);
}
export async function verifyAccount() { if (!account) return; const result = await request<{ account: AccountSession['account'] }>(account.url, '/api/home-remote/account/session', account.sessionToken); if (!result.account?.email) throw new Error('تحقق الحساب غير متاح.'); account.account = result.account; }
/** Fixed operations only; downloaded HTML never receives the native session credential. */
export async function household(operation: string, data: Record<string, unknown> = {}) {
  if(operation === 'login') { await login('https://flix-admin-tan.vercel.app', String(data.email || ''), String(data.password || '')); return household('status'); }
  if(operation === 'logout') { await logout(); return { signedIn: false }; }
  if(!account) return { signedIn: false };
  const routes: Record<string, [string,string]> = {
    status:['profiles/status','GET'], select:['profiles/select','POST'], lock:['profiles/lock','POST'], overview:['manager/overview','GET'],
    'profile-add':['manager/profile-add','POST'], 'profile-access':['manager/profile-access','POST'], 'profile-remove':['manager/profile-remove','POST'],
    'account-access':['manager/account-access','POST'], 'installation-access':['manager/installation-access','POST'], 'subscription-grant':['manager/subscription-grant','POST'], 'subscription-stop':['manager/subscription-stop','POST'],
  };
  const route=routes[operation]; if(!route) throw Error('عملية غير مسموحة.');
  const result = await request<Record<string, unknown>>(account.url, '/api/home-remote/'+route[0], account.sessionToken, route[1], route[1]==='POST'?data:undefined);
  if(['select','lock'].includes(operation)) { accessGate.reset(); await accessGate.refresh(); revokeControl(); }
  return { ...result, signedIn: true };
}
export async function logout() {
  accessGate.reset();
  await stopSharing(); const previous = account; account = undefined; actions = []; reportId = ''; resolved = []; pendingResults = []; problem = ''; events = []; messages = [];
  if (Capacitor.isNativePlatform()) await vault.clearSession(); else sessionStorage.removeItem('home-remote-account'); await persist();
  if (previous) await request(previous.url, '/api/home-remote/account/logout', previous.sessionToken, 'POST', {}).catch(() => undefined);
}
export function revokeControl() { control = undefined; }
export function connectionError(message: string) { supportMessage = message; }
export function grantControl(deviceId: string) {
  if (!account || !sharing || !deviceId) throw new Error('افتح الدعم وحدد التلفزيون أولًا.');
  control = { id: crypto.randomUUID(), deviceId, expiresAt: Date.now() + 15 * 60000 };
  record('control-grant', 'started', '15 minutes', deviceId);
}
export function actionFresh(a: SupportAction) { return (a.expiresAt || a.at + 86400000) > Date.now() && a.at <= Date.now() + 10000; }
export function autoAllowed(a: SupportAction) {
  return !!(sharing && control && control.expiresAt > Date.now() && a.grantId === control.id && a.deviceId === control.deviceId && actionFresh(a) && Date.now() - a.at < 60000 && ['command', 'launch', 'setSetting', 'inspect', 'refresh'].includes(a.type) && a.command !== 'powerOff');
}
export async function stopSharing() {
  sharing = false; revokeControl(); actions = []; await persist();
  if (account && reportId) await request(account.url, '/api/home-remote/support/' + reportId + '/close', account.sessionToken, 'POST', {}).catch(() => undefined);
  supportMessage = 'توقفت مشاركة التشخيص والتحكم. عند انقطاع الإنترنت ينتهي اتصال الدعم خلال 90 ثانية.';
}
export function diagnostics(data: unknown) {
  const diagnostics = diagnosticSnapshot(data, events);
  const body = { app: 'home-remote', version: VERSION, buildId: BUILD_ID, platform: Capacitor.getPlatform(), installationId, id: reportId || undefined, problem: diagnosticText(problem, 1200), sharing, control: sharing && control && control.expiresAt > Date.now() ? control : undefined, diagnostics };
  const bytes = () => new TextEncoder().encode(JSON.stringify(body)).byteLength;
  for (const key of ['events', 'apps', 'settings', 'packages', 'receipts', 'devices'] as const) {
    while (bytes() > 60000 && diagnostics[key].length) { const list = diagnostics[key], keep = Math.floor(list.length * .7); list.splice(key === 'events' ? 0 : keep, list.length - keep); diagnostics.truncated = true; }
  }
  return body;
}
async function flushResults() {
  if (!account || !reportId) return;
  for (const result of pendingResults.slice()) {
    await request(account.url, '/api/home-remote/support/' + reportId + '/result', account.sessionToken, 'POST', { ...result, actionId: result.id });
    pendingResults = pendingResults.filter(r => r.id !== result.id || r.at !== result.at); await persist();
  }
}
export async function pollSupport() {
  if (!account || !reportId || !sharing) return;
  await flushResults().catch(() => undefined);
  const response = await request<{ active?: boolean; actions: SupportAction[]; messages?: typeof messages }>(account.url, '/api/home-remote/support/' + reportId, account.sessionToken);
  if (!sharing) return;
  messages = response.messages || [];
  actions = response.actions.filter(a => !resolved.includes(a.id) && actionFresh(a));
}
export async function syncSupport(data: unknown, start?: { problem: string }) {
  if (!account || (!sharing && !start)) return;
  if (start) { problem = start.problem.slice(0, 1200); problemAt = Date.now(); sharing = true; await persist(); }
  const task = syncQueue.catch(() => undefined).then(async () => {
    if (!account || !sharing) return;
    try {
      const payload = diagnostics(data);
      const reply = await request<{ id: string; control?: ControlGrant }>(account.url, '/api/home-remote/support', account.sessionToken, 'POST', payload, 20000);
      if (payload.control && reply.control?.id !== payload.control.id) { revokeControl(); throw new Error('لم يؤكد الخادم إذن التحكم؛ أعد الموافقة من الهاتف.'); }
      if (control && reply.control?.id === control.id) control.expiresAt = Math.min(control.expiresAt, reply.control.expiresAt);
      reportId = reply.id; await persist();
      if (!sharing) { await stopSharing(); return; }
      await pollSupport();
      supportMessage = 'وصل التشخيص إلى دعم FLIX. آخر مزامنة ' + new Date().toLocaleTimeString('ar');
    } catch (error) { supportMessage = error instanceof Error ? error.message : 'تعذر إرسال التشخيص؛ محفوظ على الهاتف.'; throw error; }
  });
  syncQueue = task; return task;
}
export async function sendMessage(data: unknown, text: string) {
  if (!account) throw new Error('سجّل دخول FLIX أولًا.');
  await syncSupport(data, { problem: text });
  const reply = await request<{ messages: typeof messages }>(account.url, '/api/home-remote/support/' + reportId + '/message', account.sessionToken, 'POST', { message: text });
  messages = reply.messages;
}
export async function resolveAction(id: string, outcome: Outcome, message = '') {
  // Consume persistently before issuing a TV command; a crash must never replay a button.
  resolved = [...new Set([...resolved, id])].slice(-200); actions = actions.filter(a => a.id !== id);
  pendingResults = [...pendingResults.filter(r => r.id !== id), { id, outcome, message: clean(message), at: Date.now() }].slice(-100);
  await persist(); record('support-action', outcome, message || id);
  await flushResults().catch(() => undefined);
}
export async function exportDiagnostics(data: unknown) {
  const text = JSON.stringify(diagnostics(data), null, 2);
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: 'home-remote-diagnostics.json', directory: Directory.Cache, data: text, encoding: Encoding.UTF8 });
    await Share.share({ title: 'تشخيص ريموت البيت', files: [file.uri], dialogTitle: 'حفظ أو مشاركة التشخيص' }); return;
  }
  const blob = new Blob([text], { type: 'application/json' }), href = URL.createObjectURL(blob), a = document.createElement('a'); a.href = href; a.download = 'home-remote-diagnostics.json'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 30000);
}
