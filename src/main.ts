import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { platformNames, type Device, type Capabilities, type TvApp, type Setting, type PackageEntry, type InstallReceipt, type TvActivity, type Command } from './model.ts';
import { directApi, initDirect, forgetDirect, discoveryDiagnostics } from './direct/engine.ts';
import { mountOriginalRemote } from './remote-page/mount.ts';
import { originalSurface, connectOriginalHost } from './remote-page/bootstrap.ts';
import type { PageHost } from './remote-page/bridge.ts';
import './style.css';
import * as support from './support.ts';
import { VERSION, BUILD_ID } from './build-info.ts';
import { fetchCatalog, downloadRelease, catalogState, type CatalogRelease } from './catalog.ts';
type Television = Device & { capabilities: Capabilities };
type Tab = 'remote' | 'apps' | 'settings' | 'library' | 'support';
const root = document.querySelector<HTMLDivElement>('#app')!;
let online = Capacitor.isNativePlatform(), devices: Television[] = [], selected = '', tab: Tab = 'remote';
let apps: TvApp[] = [], settings: Setting[] = [], packages: PackageEntry[] = [], receipts: InstallReceipt[] = [];
let appError = '', settingsError = '', busy = false, scanning = false, reconnecting = false, detailSequence = 0;
const details = new Map<string, { checkedAt: number; status: string; error: string; apps: TvApp[]; settings: Setting[]; activity?: TvActivity }>();
let supportPolling = false, lastHeartbeat = 0, lastInspection = 0;
let statusMessage = '', statusError = false;
let sheetOpen = false;
let catalog:CatalogRelease[]=[],catalogError='',catalogCheckedAt=0;
async function refreshCatalog(){if(!support.account){catalog=[];catalogError='ادخل بحساب FLIX لعرض مكتبة تطبيقاتكم.';return;}const session=support.account;try{const result=await fetchCatalog(session);if(support.account===session){catalog=result;catalogCheckedAt=Date.now();catalogError='';}}catch(error){catalogError=error instanceof Error?error.message:'تعذر تحديث المكتبة';}}
function catalogPanel(d:Television){return `<h3>مكتبة FLIX المركزية</h3>${button('refresh-catalog','تحديث المكتبة','class="quiet"')}<p class="fine">${escape(catalogError|| (catalogCheckedAt?'آخر تحديث '+new Date(catalogCheckedAt).toLocaleTimeString('ar'):'تُحدّث عند فتح هذه النافذة.'))}</p>${catalog.filter(r=>r.platform===d.platform).map(r=>{const state=catalogState(r,packages);return `<article class="package"><div><strong>${escape(r.name)} ${escape(r.version)}</strong><small>${escape(state.label)} · ${(r.bytes/1048576).toFixed(1)} MB</small><p class="fine">${escape(r.notes)}</p></div>${state.package?'<span>✓</span>':`<button data-catalog="${escape(r.id)}">تنزيل النسخة</button>`}</article>`;}).join('')||'<p class="fine">لا نسخ منشورة لهذا النظام حتى الآن.</p>'}<p class="fine">التنزيل يحفظ الحزمة بعد فحص بصمتها؛ اختر «تثبيت» أدناه لمراجعة نقلها للتلفزيون. لا يُثبّت تحديث تلقائيًا. ظهور تطبيق على الشاشة لا يثبت رقم نسخته ما لم يُعده النظام.</p>`;}
let originalRemote: Awaited<ReturnType<typeof mountOriginalRemote>> | undefined;
const icons = new Map<string, string>();
const escape = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const television = () => devices.find(d => d.id === selected);
const button = (action: string, text: string, extra = '') => `<button type="button" data-action="${action}" ${extra}>${text}</button>`;
const tvPath = (id = selected) => '/api/devices/' + encodeURIComponent(id);
function snapshot() { return { directConnected: online, connectionMode: 'phone-direct', discovery: discoveryDiagnostics, deviceCount: devices.length, selectedDeviceId: selected, apps, settings, devices: devices.map(d => ({ ...d, ...details.get(d.id), appCount: details.get(d.id)?.apps.length || 0 })), packages, receipts }; }
function supportPanel() {
  const grant = support.control && support.control.expiresAt > Date.now() ? support.control : undefined;
  return `<section class="panel support-panel"><div class="section-heading"><h2>حساب FLIX</h2>${button(support.account ? 'logout' : 'login', support.account ? 'خروج' : 'دخول FLIX', 'class="quiet"')}</div>
  <p>${support.account ? `<bdi>${escape(support.account.account.email)}</bdi>` : 'ادخل بحساب FLIX نفسه ليظهر هذا الجوال في إدارة الريموت.'}</p>
  <p class="fine">يظهر للمسؤول الحساب ونوع الجوال والإصدار وآخر اتصال. يمكنه إيقاف صلاحية الريموت وإعادتها. فحص الصلاحية يحتاج الإنترنت؛ أوامر التلفزيون تنتقل من الجوال مباشرة.</p>
  ${support.accessGate.current()?.enabled === false ? `<p class="notice">${escape(support.accessGate.current()?.reason)}</p>` : ''}
  <h3>فيه مشكلة؟</h3><p>ضغطة واحدة ترسل هوية هذا الجوال والشاشات والأخطاء والتطبيقات والإعدادات والنشاط المتاح. اشرح المشكلة في محادثتك مع المسؤول؛ لا تحتاج كتابة رسالة هنا.</p>
  ${button(support.account ? 'report-problem' : 'login', support.account ? 'فيه مشكلة · مشاركة التشخيص' : 'تسجيل الدخول بحساب FLIX', 'class="primary full"')}
  ${support.sharing ? `<p class="notice">التشخيص متصل أثناء بقاء التطبيق مفتوحًا. ${grant ? 'التحكم مسموح على الشاشة المختارة لمدة محدودة.' : 'إرسال التشخيص لا يمنح إذن تغيير التلفزيون.'}</p>${grant ? button('revoke-control','إيقاف التحكم فورًا','class="quiet full"') : television()?.paired ? button('grant-control','السماح بإصلاح الشاشة 15 دقيقة','class="quiet full"') : ''}${button('poll-support','تحديث التشخيص','class="text-button full"')}${button('stop-support','إيقاف مشاركة التشخيص','class="text-button full"')}` : ''}
  <p class="fine" role="status">${escape(support.supportMessage)}</p>
  <p class="fine">تُحذف سجلات التشخيص المحلية الأقدم من 7 أيام عند فتح التطبيق أو حفظ تشخيص جديد. المسح أدناه يوقف المشاركة ويمسح نسخة الجوال؛ البلاغ الذي أُرسل للخادم يبقى لدى الدعم. الإملاء في نسخة الآيفون محلي فقط؛ إن لم يتوفر استخدم الكتابة.</p>
  ${button('clear-local-diagnostics','مسح التشخيص المحفوظ على الجوال','class="text-button full"')}
  ${support.actions.map(a => `<article class="support-action"><p>${escape(a.message)}</p><button data-support="${escape(a.id)}" class="primary">مراجعة الإجراء</button><button data-dismiss="${escape(a.id)}" class="quiet">رفض</button></article>`).join('')}
  <p class="fine">إغلاق التطبيق أو نقله للخلفية ينهي إذن التحكم. التثبيت والاقتران وإطفاء الشاشة تحتاج موافقة مستقلة.</p></section>`;
}
function showLogin() { dialog('دخول حساب FLIX', `<form data-form="login"><details><summary>إعدادات اتصال الحساب</summary><label>خدمة حساب FLIX<input name="service" type="url" dir="ltr" value="${escape(support.account?.url || import.meta.env.VITE_FLIX_ACCOUNT_URL || 'https://flix-admin-tan.vercel.app')}" required></label></details><label>البريد الإلكتروني<input type="email" name="email" dir="ltr" autocomplete="username" required></label><label>كلمة المرور<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">دخول بنفس حساب FLIX</button><p class="fine">يستخدم نفس نظام الحسابات الحالي في FLIX.</p></form>`); }
function reviewSupport(id: string) {
  const a = support.actions.find(a => a.id === id); if (!a) return;
  const d = devices.find(d => d.id === a.deviceId);
  if (!['rescan', 'refresh'].includes(a.type) && !d) throw new Error('التلفزيون المقصود غير موجود في هذا البيت.');
  dialog('مراجعة اقتراح الدعم', `<p>${escape(a.message)}</p><p>الإجراء: ${escape(a.type)} · ${escape(d?.name || 'البيت')}</p><p class="fine">قد تظهر نافذة اقتران أو إعدادات على الشاشة. تثبيت التطبيقات يفتح مراجعة أخرى باسم الحزمة والشاشة.</p><form data-form="support-action"><input name="id" type="hidden" value="${escape(id)}"><button class="primary">موافقة على هذا الإجراء</button></form>`);
}
const api = async <T>(route: string, method = 'GET', data?: unknown, timeout?: number): Promise<T> => {
  const stage = route.split('?')[0];
  if (!(stage === '/api/devices' && method === 'GET') && stage !== '/api/packages' && stage !== '/api/receipts') {
    // The original page also polls this bridge during startup. Authentication
    // failures must not open a modal over the remote without a user action.
    // Account controls still open login explicitly; every operation stays gated.
    await support.accessGate.assertAllowed();
  }
  try { if (!online) throw new Error('افتح التطبيق المثبت واسمح له بالشبكة المحلية.'); const reply = await directApi<T>(route, method, data); if (!route.endsWith('/icon')) support.record(stage, 'ok', method, selected); return reply; }
  catch (error) { support.record(stage, 'failed', error instanceof Error ? error.message : 'network error', selected); throw error; }
};
function status(message: string, error = false) { statusMessage=message;statusError=error;originalRemote?.notify(message);const toast = document.querySelector<HTMLElement>('#status'); if(toast){toast.textContent = message; toast.dataset.error = String(error);} }
function disable(disabled: boolean) {
  const d = television();
  root.querySelectorAll<HTMLButtonElement>('[data-command], [data-launch], [data-install]').forEach(b => {
    const allowed = b.dataset.command ? d?.capabilities.commands.includes(b.dataset.command as Command) : b.dataset.install ? d?.capabilities.install.available : d?.capabilities.apps.available;
    b.disabled = disabled || !online || !allowed;
  });
}
function render() {
  if (document.querySelector('dialog[open]')) return;
  const d = television();
  if (originalRemote) {
    document.body.classList.toggle('native-sheet-open', sheetOpen);
    const title = tab === 'support' ? 'حساب FLIX' : tab === 'library' ? 'تثبيت التطبيقات' : tab === 'settings' ? 'إعدادات الشاشة' : tab === 'apps' ? 'تطبيقات الشاشة' : 'شاشات البيت';
    root.innerHTML = `<section class="native-sheet" role="dialog" aria-label="${title}"><header><h2>${title}</h2>${button('original-remote','×','class="quiet" aria-label="إغلاق النافذة"')}</header><main><div id="status" role="status" class="status" data-error="${statusError}">${escape(statusMessage)}</div>${tab === 'support' ? supportPanel() : tab === 'remote' ? `<div class="devices">${devices.map(x=>button('select-tv',escape(x.name)+(x.paired?' · مقترن':' · اقتران'),`data-device="${escape(x.id)}" class="device"`)).join('')}</div>${button('scan','بحث','class="primary"')} ${button('manual','إضافة بالعنوان','class="quiet"')}${d?button('pair',d.paired?'إعادة الاقتران':'اقتران بالتلفزيون','class="primary full"'):''}` : d ? content(d) : `<p>اختر التلفزيون من زر الشاشة في الريموت أولًا.</p>${button('manual','إضافة تلفزيون','class="primary"')}`}</main><footer>ريموت FLIX ${escape(VERSION)}</footer></section><dialog id="dialog"></dialog>`;
    disable(busy || !d?.capabilities.control.available); return;
  }
  root.innerHTML = `${originalRemote?button('original-remote','↩ العودة لصفحة الريموت','class="primary original-back"'):''}<header><a class="wordmark" href="#" aria-label="ريموت البيت"><span class="logo" aria-hidden="true">⌁</span><span>ريموت <b>FLIX</b></span></a>${button('connection', `<span class="dot ${online ? 'connected' : ''}"></span>${online ? 'اتصال مباشر' : 'نسخة الهاتف'}`, 'class="connection"')}<button class="quiet" data-action="support">الحساب والمساعدة</button></header>
    <main><div class="eyebrow">كل شاشات البيت · في مكان واحد</div><div class="title-row"><h1>${d ? escape(d.name) : 'اختر تلفزيونك'}</h1>${button('scan', scanning ? 'يبحث…' : '↻ بحث', `class="quiet" ${!online || scanning ? 'disabled' : ''}`)}</div>
    <p class="subtitle">${d ? escape(platformNames[d.platform]) : 'اتصل بواي فاي البيت؛ هاتفك يتصل بالتلفزيون مباشرة.'}</p>
    <div id="status" class="status" data-error="${statusError}" role="status" aria-live="polite">${escape(statusMessage || (online ? 'اتصال مباشر من الهاتف · اختر الشاشة أو ابحث في الشبكة.' : 'معاينة الواجهة. ثبّت نسخة Android أو iPhone للاتصال المباشر.'))}</div>
    ${online ? `<div class="devices" aria-label="تلفزيونات البيت">${devices.map(x => `<button class="device ${x.id === selected ? 'selected' : ''}" data-device="${escape(x.id)}"><span aria-hidden="true">▣</span><span>${escape(x.name)}<small>${escape(platformNames[x.platform])} · ${x.paired ? 'مقترن' : 'يحتاج اقتران'}</small></span></button>`).join('')}${button('manual', '+ إضافة', 'class="device add"')}</div>` : `<section class="welcome"><div class="welcome-tv" aria-hidden="true">▣</div><h2>هاتفك، ريموت لكل شاشة متوافقة</h2><p>تحكم وافتح تطبيقاتك، واعرف ما يستطيع كل تلفزيون تنفيذه.</p>${button('connection', 'نسخ الهاتف والاتصال', 'class="primary"')}<p class="fine">لا تحتاج كمبيوترًا وسيطًا. البحث والتحكم ونقل الحزم تتم من الهاتف مباشرة.</p></section>`}
    ${tab === 'support' && (!online || !d) ? supportPanel() : ''}${online && d ? `<div class="target-info"><span>${d.paired ? '◉ مقترن' : '○ غير مقترن'} <bdi>${escape(d.host)}</bdi></span>${button('pair', d.paired ? 'إعادة الاقتران' : 'اقتران بالتلفزيون', 'class="text-button"')}</div><nav class="tabs" aria-label="أقسام الريموت">${(['remote', 'apps', 'settings', 'library', 'support'] as Tab[]).map((t, i) => `<button data-tab="${t}" class="${t === tab ? 'active' : ''}" aria-current="${t === tab ? 'page' : 'false'}">${['الريموت', 'التطبيقات', 'الإعدادات', 'تطبيقاتي', 'المساعدة'][i]}</button>`).join('')}</nav>${content(d)}` : online && tab !== 'support' ? `<section class="panel"><h2>لنبحث عن شاشاتك</h2><p>شغّل التلفزيون وتأكد أن الهاتف والتلفزيون على شبكة واحدة. شبكة الضيوف قد تمنع اكتشاف الأجهزة.</p>${button('scan', 'بحث عن تلفزيونات', 'class="primary"')} ${button('manual', 'إضافة بالعنوان', 'class="quiet"')}</section>` : ''}
    </main><footer>ريموت البيت ${escape(VERSION)} <span title="${escape(BUILD_ID)}">iPhone · Android</span></footer><dialog id="dialog"></dialog>`;
  disable(busy || !d?.capabilities.control.available);
}
function key(d: Television, c: Command, label: string, className = '') { return `<button type="button" class="${className}" data-command="${c}" aria-label="${label}" ${!d.capabilities.commands.includes(c) ? 'disabled' : ''}>${label}</button>`; }
function content(d: Television) {
  if (tab === 'support') return supportPanel();
  if (tab === 'remote') return `<section class="remote-panel" aria-label="أزرار التحكم"><div class="remote-top">${key(d, 'settings', '⚙ الإعدادات')}${key(d, 'powerOff', '⏻ إطفاء', 'power')}</div><div class="dpad" dir="ltr">${key(d, 'up', '▲', 'up')}${key(d, 'left', '◀', 'left')}${key(d, 'ok', 'OK', 'ok')}${key(d, 'right', '▶', 'right')}${key(d, 'down', '▼', 'down')}</div><div class="quick-row">${key(d, 'back', '↩ رجوع')}${key(d, 'home', '⌂ الرئيسية')}${key(d, 'playPause', '▷Ⅱ تشغيل / إيقاف')}</div><div class="volume"><span>الصوت</span>${key(d, 'volumeDown', '−')}${key(d, 'mute', 'كتم')}${key(d, 'volumeUp', '+')}</div></section><p class="fine">${escape(d.capabilities.control.reason || 'تُرسل الأوامر إلى الشاشة المختارة فقط. التشغيل من الإطفاء يعتمد على إعدادات الشبكة في التلفزيون.')}</p>${button('guide', 'دليل الاتصال لهذا التلفزيون', 'class="text-button guide-link"')}`;
  if (tab === 'apps') return `<section class="panel"><div class="section-heading"><h2>تطبيقات التلفزيون <span class="count">${apps.length}</span></h2>${button('refresh', '↻ تحديث', 'class="quiet"')}</div>${appError ? `<p class="notice" role="alert">${escape(appError)}</p>` : ''}${apps.length ? `<div class="app-grid">${apps.map(a => `<button class="tv-app" data-launch="${escape(a.id)}"><span class="app-icon" data-icon="${escape(a.id)}">${icons.has(d.id + ':' + a.id) ? `<img src="${icons.get(d.id + ':' + a.id)}" alt="">` : escape(a.label.slice(0, 2).toUpperCase())}</span><span>${escape(a.label)}</span></button>`).join('')}</div>` : `<div class="empty">ستظهر هنا التطبيقات التي يعيدها التلفزيون بعد الاقتران والتحديث.</div>`}<p class="fine">الأيقونات الأصلية تظهر عندما يتيحها الجهاز. يظهر رمز بالاسم عندما تكون الأيقونة محلية أو غير متاحة.</p></section>`;
  if (tab === 'settings') return `<section class="panel"><div class="section-heading"><h2>إعدادات هذه الشاشة</h2>${button('refresh', '↻ تحديث', 'class="quiet"')}</div>${settingsError ? `<p class="notice">${escape(settingsError)}</p>` : ''}${settings.map(s => s.kind === 'action' ? button('setting', escape(s.label) + ' ↗', `class="setting-action" data-setting="${escape(s.id)}"`) : `<form data-form="setting" class="setting"><input type="hidden" name="id" value="${escape(s.id)}"><label for="setting-${escape(s.id)}">${escape(s.label)}</label>${s.kind === 'number' ? `<input id="setting-${escape(s.id)}" name="value" type="number" min="${s.min}" max="${s.max}" value="${s.value}">` : s.kind === 'boolean' ? `<select id="setting-${escape(s.id)}" name="value"><option value="true" ${s.value ? 'selected' : ''}>مفعل</option><option value="false" ${!s.value ? 'selected' : ''}>غير مفعل</option></select>` : `<select id="setting-${escape(s.id)}" name="value">${s.options?.map(o => `<option value="${escape(o.id)}">${escape(o.label)}</option>`).join('')}</select>`}<button class="quiet">تطبيق</button></form>`).join('')}<p class="fine">${escape(d.capabilities.note)}</p>${button('developer', 'إعداد المطوّر والتثبيت', 'class="primary"')}</section>`;
  const compatible = packages.filter(p => p.platform === d.platform);
  return `<section class="panel"><div class="section-heading"><div><h2>تطبيقاتي على التلفزيون</h2><p class="fine">أضف تطبيقك مرة، واختر الشاشة المتوافقة لتثبيته.</p></div>${button('upload', '+ إضافة', 'class="quiet"')}</div>${!d.capabilities.install.available ? `<p class="notice">${escape(d.capabilities.install.reason)} ${button('developer', 'طريقة التجهيز', 'class="text-button"')}</p>` : ''}${catalogPanel(d)}${compatible.map(p => `<article class="package"><span class="package-icon">▧</span><div><strong>${escape(p.name)}</strong><small>${escape(p.version || 'نسخة غير محددة')} · ${(p.bytes / 1048576).toFixed(1)} MB</small></div><button data-install="${escape(p.id)}" ${!d.capabilities.install.available ? 'disabled' : ''}>تثبيت</button></article>`).join('') || '<div class="empty">لا توجد حزم لهذا النظام. أضف APK أو IPK أو WGT المناسب.</div>'}<p class="fine">${packages.length - compatible.length ? `${packages.length - compatible.length} حزم لأنظمة أخرى محفوظة على الهاتف.` : 'حزمك محفوظة على الهاتف، وتُنقل مباشرة للتلفزيون.'}</p><h3>سجل التثبيت</h3>${receipts.filter(r => r.deviceId === d.id).slice(0, 5).map(r => `<p class="receipt ${r.status}">${r.status === 'installed' ? '✓' : r.status === 'failed' ? '!' : '…'} ${escape(packages.find(p => p.id === r.packageId)?.name || 'تطبيق')}<small>${escape(r.message)}</small></p>`).join('') || '<p class="fine">لا عمليات تثبيت سابقة على هذه الشاشة.</p>'}</section>`;
}
function dialog(title: string, body: string) {
  const el = document.querySelector<HTMLDialogElement>('#dialog')!; el.onclose=()=>document.body.classList.remove('native-dialog-open');
  el.innerHTML = `<div class="dialog-head"><h2>${title}</h2>${button('close', '×', 'aria-label="إغلاق" class="quiet"')}</div>${body}<p id="dialog-status" role="status" aria-live="polite"></p>`; document.body.classList.add('native-dialog-open'); el.showModal();
}
function showInstall(d: Television, p: PackageEntry) {
  dialog('مراجعة التثبيت', `<p>تثبيت <strong>${escape(p.name)} ${escape(p.version)}</strong> على <strong>${escape(d.name)}</strong>؟</p><p class="fine">${escape(platformNames[p.platform])} · <bdi>${escape(d.host)}</bdi></p><details><summary>بصمة الحزمة SHA-256</summary><code>${escape(p.sha256)}</code></details><p>قد يطلب التلفزيون موافقة إضافية. أبقِ التطبيق مفتوحًا والهاتف متصلًا بنفس Wi-Fi أثناء النقل المباشر.</p><form data-form="install"><input type="hidden" name="deviceId" value="${escape(d.id)}"><input type="hidden" name="packageId" value="${escape(p.id)}"><button class="primary">تأكيد التثبيت على هذه الشاشة</button></form>`);
}
function closeDialog() { document.querySelector<HTMLDialogElement>('#dialog')?.close(); document.body.classList.remove('native-dialog-open'); }
function showConnection() {
  dialog('الاتصال المباشر', `<p>يتصل iPhone أو Android بالتلفزيون مباشرة على Wi-Fi؛ لا يحتاج كمبيوترًا أو وسيطًا في البيت.</p><ol class="steps"><li>ثبّت تطبيق ريموت البيت على الهاتف.</li><li>صل الهاتف والتلفزيون بالشبكة نفسها واسمح بإذن الشبكة المحلية.</li><li>ابحث أو أضف عنوان التلفزيون ثم وافق على الاقتران على الشاشة.</li></ol>${Capacitor.isNativePlatform() ? button('scan', 'بحث مباشر عن التلفزيونات', 'class="primary full"') + button('forget', 'مسح مكتبة ومفاتيح التلفزيونات من الهاتف', 'class="text-button full"') : '<p>تُوزّع نسخ الهاتف من صفحة FLIX بعد إعداد النشر. متصفح الويب يعرض الواجهة ولا يملك اتصال التلفزيون الأصلي.</p>'}<p class="fine">التحكم محلي؛ التحقق الدوري من صلاحية الحساب والتشخيص يحتاجان الإنترنت. على iPhone يجمع البحث Bonjour ووصف التلفزيون عبر الشبكة المحلية؛ ويمكن إضافة عنوان التلفزيون يدويًا إذا حجبه الراوتر.</p>`);
}
function showPair() {
 const d=television();if(!d)return;
 dialog('اقتران · '+escape(d.name), `<p>${d.platform==='android'?'افتح تصحيح الأخطاء اللاسلكي ثم «إقران باستخدام رمز». أدخل الرمز ومنفذ الاقتران الظاهر معه، ومنفذ الاتصال من صفحة التصحيح الرئيسية. إذا كان جهازك يتيح TCP فقط، اترك الرمز فارغًا ووافق على الشاشة.':d.platform==='roku'?'سنفحص سماح التلفزيون بالتحكم من الشبكة.':'اضغط بدء ثم وافق على طلب ريموت البيت على التلفزيون.'}</p><form data-form="pair"><label>منفذ الاتصال<input name="port" type="number" min="1024" max="65535" value="${d.port||(d.platform==='webos'?3001:d.platform==='tizen'?8002:d.platform==='roku'?8060:5555)}" required></label>${d.platform==='android'?`<label>رمز الاقتران (6 أرقام)<input name="code" inputmode="numeric" pattern="[0-9٠-٩۰-۹]{6}" maxlength="6" autocomplete="off"></label><label>منفذ الاقتران<input name="pairPort" type="number" min="1024" max="65535" value="${d.pairPort||''}"></label><p class="fine">منفذ الاقتران يختلف عن منفذ الاتصال. لا نحفظ الرمز أو نرسله إلى الدعم.</p>`:'<p class="fine">LG القديم قد يستخدم 3000 وسامسونغ القديم 8001.</p>'}<button class="primary">بدء الاقتران</button></form>${button('guide','خطوات التجهيز','class="text-button full"')}`);
}
function showDeveloper(){
 const d=television();if(!d)return;if(!d.paired){showPair();return;}
 if(d.platform!=='webos'&&d.platform!=='tizen'){guide(true);return;}
 dialog('تجهيز تثبيت · '+escape(d.name),`<p>${d.platform==='webos'?'ثبّت Developer Mode من متجر LG وسجّل بحساب LG Developer ثم فعّل Dev Mode وKey Server. أدخل Passphrase المعروضة؛ سيجلب الهاتف المفتاح من نفس عنوان التلفزيون.':'فعّل Developer Mode في Apps على سامسونغ، وضع عنوان Wi-Fi لهذا الهاتف في خانة الجهاز المسموح. جهّز حزمة WGT موقعة بشهادة يقبلها هذا التلفزيون.'}</p><form data-form="developer">${d.platform==='webos'?'<label>Passphrase من شاشة LG<input type="password" name="passphrase" maxlength="64" autocomplete="off" required></label>':'<label>منفذ SDB<input type="number" name="port" min="1024" max="65535" value="26101" required></label>'}<div id="developer-trust"></div><button class="primary">فحص اتصال المطوّر</button></form><p class="fine">المفتاح وPassphrase محفوظان في مخزن الهاتف الآمن؛ لا يخرجان إلى حسابك أو الدعم. إذن المطوّر يتم على التلفزيون.</p>`);
}
function guide(developer = false) {
  const d = television(); if (!d) return; const c = d.capabilities;
  dialog(developer ? 'تجهيز تثبيت تطبيقاتك' : 'دليل · ' + escape(platformNames[d.platform]), `<ol class="steps">${c.steps.map(s => `<li>${escape(s)}</li>`).join('')}</ol>${c.docs ? `<a class="external" href="${escape(c.docs)}" target="_blank" rel="noopener">دليل الشركة ↗</a>` : ''}${d.paired && d.platform !== 'roku' && d.platform !== 'unknown' ? button('setting', 'فتح إعدادات التلفزيون للمساعدة', 'class="quiet full" data-setting="open"') : ''}<p class="fine">يمكن فتح الإعدادات بعد الاقتران. تفعيل وضع المطوّر وموافقات الأمان يتم على التلفزيون نفسه؛ لا يمكن تجاوزها من الهاتف.</p>`);
}
async function refreshDevices() { const result = await api<{ devices: Television[] }>('/api/devices'); devices = result.devices; if (!devices.some(d => d.id === selected)) selected = devices[0]?.id || ''; }
async function loadDetails() {
  const d = television(); if (!d) return;
  const sequence = ++detailSequence, id = d.id; apps = []; settings = []; appError = ''; settingsError = '';
  if (!d.paired) { const p = await api<{ packages: PackageEntry[] }>('/api/packages'); packages = p.packages; render(); return; }
  const result = await Promise.allSettled([api<{ apps: TvApp[] }>(tvPath(id) + '/apps', 'GET', undefined, 30000), api<{ settings: Setting[] }>(tvPath(id) + '/settings', 'GET', undefined, 30000), api<{ packages: PackageEntry[] }>('/api/packages'), api<{ receipts: InstallReceipt[] }>('/api/receipts')]);
  if (id !== selected || sequence !== detailSequence) return;
  const [a, s, p, r] = result;
  let activity: TvActivity | undefined; try { activity = (await api<{ activity: TvActivity }>(tvPath(id) + '/activity')).activity; } catch (error) { activity = { available: false, reason: error instanceof Error ? error.message : 'تعذر قراءة النشاط', checkedAt: Date.now() }; }
  if (id !== selected || sequence !== detailSequence) return;
  if (a.status === 'fulfilled') apps = a.value.apps; else appError = a.reason.message;
  if (s.status === 'fulfilled') settings = s.value.settings; else settingsError = s.reason.message;
  if (p.status === 'fulfilled') packages = p.value.packages;
  if (r.status === 'fulfilled') receipts = r.value.receipts;
  details.set(id, { checkedAt: Date.now(), status: a.status === 'fulfilled' && s.status === 'fulfilled' ? 'reachable' : a.status === 'fulfilled' || s.status === 'fulfilled' ? 'partial' : 'unavailable', error: [appError, settingsError].filter(Boolean).join(' · '), apps, settings, activity });
  render();
  // Enrich Android apps without holding up remote controls or the initial app list.
  if (d.platform === 'android') {
    void loadAndroidMetadata(id, detailSequence, apps.slice());
  }
  // TV-provided file:// resources keep a readable fallback initial.
  const queue = apps.filter(a => /^https?:/i.test(a.icon || '') && !icons.has(id + ':' + a.id)).slice(0, 24);
  for (let i = 0; i < queue.length; i += 3) await Promise.allSettled(queue.slice(i, i + 3).map(async a => {
    const data = await api<{ icon: string }>(tvPath(id) + '/icon?appId=' + encodeURIComponent(a.id)); icons.set(id + ':' + a.id, data.icon);
    if (selected === id && tab === 'apps') { const target = [...root.querySelectorAll<HTMLElement>('[data-icon]')].find(e => e.dataset.icon === a.id); if (target) { const image = new Image(); image.alt = ''; image.src = data.icon; target.replaceChildren(image); } }
  }));
}
async function loadAndroidMetadata(id: string, sequence: number, listed: TvApp[]) {
  for (const app of listed.slice(0, 100)) {
    if (selected !== id || detailSequence !== sequence) return;
    try {
      const response = await api<{app: TvApp}>(tvPath(id) + '/app-metadata?appId=' + encodeURIComponent(app.id), 'GET', undefined, 120000);
      if (selected !== id || detailSequence !== sequence) return;
      const current = apps.find(a => a.id === app.id); if (!current) continue;
      current.label = response.app.label;
      if (/^data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(response.app.icon || '')) icons.set(id + ':' + app.id, response.app.icon!);
      if (tab === 'apps') render();
    } catch { /* Protected/split/vector-only resources retain their visible package fallback. */ }
  }
}
async function scan() { if (scanning || !online) return; scanning = true; render(); status('يبحث في شبكة البيت…'); try { await api('/api/scan', 'POST', {}, 15000); await refreshDevices(); render(); await loadDetails(); status(devices.length ? `عُثر على ${devices.length} أجهزة محفوظة أو متاحة.` : 'لم تظهر شاشات بعد. يمكنك إضافة العنوان يدويًا.'); } finally { scanning = false; render(); } }
async function reconnect() {
  if (reconnecting || !Capacitor.isNativePlatform()) return; reconnecting = true;
  try { await initDirect(); online = true; await refreshDevices(); render(); }
  catch (error) { online = false; render(); support.record('phone-lan', 'failed', error instanceof Error ? error.message : 'تعذر تهيئة اتصال الهاتف'); }
  finally { reconnecting = false; }
}
async function run(action: () => Promise<void>) {
  if (busy) return; busy = true; disable(true);
  try { await action(); }
  catch (e) { const message = e instanceof Error ? e.message : 'تعذر إكمال الطلب.'; support.record('interface', 'failed', message, selected); const dialogStatus = document.querySelector<HTMLDialogElement>('#dialog')?.open ? document.querySelector('#dialog-status') : null; if (dialogStatus) dialogStatus.textContent = message; else status(message, true); }
  finally { busy = false; disable(!television()?.capabilities.control.available); root.querySelectorAll<HTMLButtonElement>('form button').forEach(button => button.disabled = false); }
}
root.addEventListener('click', event => {
  const target = (event.target as Element).closest<HTMLElement>('button, a'); if (!target) return;
  if (target instanceof HTMLButtonElement && target.disabled) return;
  const action = target.dataset.action;
  if (action === 'original-remote') { closeDialog(); sheetOpen=false; render(); originalRemote?.show(television()?.host);return; }
  if (action === 'close') { closeDialog(); return; }
  if (action === 'support') { tab = 'support'; sheetOpen=true; render(); return; }
  if (action === 'login') { showLogin(); return; }
  if (action === 'clear-local-diagnostics') { void run(async()=>{await support.clearLocalDiagnostics();render();}); return; }
  if (action === 'grant-control') { const d = television(); if (!d?.paired) return; dialog('السماح بالتحكم عن بُعد', `<p>السماح للدعم لمدة 15 دقيقة بالتحكم في <strong>${escape(d.name)}</strong>، وفتح تطبيقاتها وتغيير إعداداتها المتاحة. قد تتغير الصورة والصوت أثناء الجلسة. أبقِ الجوال مفتوحًا على نفس Wi-Fi.</p><form data-form="grant-control"><input type="hidden" name="deviceId" value="${escape(d.id)}"><input type="hidden" name="consent" value="on"><p>بالضغط على بدء الجلسة توافق على هذا التحكم؛ يمكنك إيقافه فورًا.</p><button class="primary">بدء جلسة التحكم</button></form>`); return; }
  if (action === 'revoke-control' || action === 'stop-support') { support.revokeControl(); if (action === 'stop-support') { void support.stopSharing().then(render); } else { void support.syncSupport(snapshot()).catch(() => undefined); render(); } return; }
  if (target.dataset.support) { void run(async () => reviewSupport(target.dataset.support!)); return; }
  if (target.dataset.dismiss) { void support.resolveAction(target.dataset.dismiss, 'declined').then(render); return; }
  if (action === 'connection') { showConnection(); return; }
  if (action === 'pair') { showPair(); return; }
  if (action === 'developer') { closeDialog(); showDeveloper(); return; }
  if (action === 'guide') { closeDialog(); guide(); return; }
  if (action === 'manual') { dialog('إضافة تلفزيون', `<form data-form="manual"><label>اسم الشاشة<input name="name" placeholder="تلفزيون الصالة"></label><label>عنوان التلفزيون<input name="host" dir="ltr" placeholder="192.168.1.30" required></label><label>النظام<select name="platform">${Object.entries(platformNames).map(([v, name]) => `<option value="${v}">${name}</option>`).join('')}</select></label><button class="primary">إضافة التلفزيون</button></form>`); return; }
  if (action === 'upload') { dialog('إضافة تطبيقك', `<form data-form="upload"><label>اسم التطبيق<input name="name" required></label><label>معرف التطبيق<input name="appId" dir="ltr" placeholder="com.example.tv" required></label><label>الإصدار<input name="version" dir="ltr" placeholder="1.0.0"></label><label>نظام الحزمة<select name="platform"><option value="android">Android · APK</option><option value="webos">LG · IPK</option><option value="tizen">Samsung · WGT</option></select></label><label>ملف التطبيق (حتى 64 MB)<input name="file" type="file" accept=".apk,.ipk,.wgt" required></label><p class="fine">لكل نظام حزمته. أضف نسخ التطبيق الثلاث بالمعرف والاسم المناسبين. تتطلب WGT شهادة صالحة للتلفزيون.</p><button class="primary">حفظ في تطبيقاتي</button></form>`); return; }
  if (target.dataset.tab) { tab = target.dataset.tab as Tab; render(); if(tab==='library')void refreshCatalog().then(render); return; }
  if (target.dataset.device) { if (busy) return; selected = target.dataset.device; apps = []; settings = []; appError = ''; settingsError = ''; render(); void run(loadDetails); return; }
  if (target.dataset.install) {
    const p = packages.find(p => p.id === target.dataset.install), d = television(); if (!p || !d) return;
    showInstall(d, p); return;
  }
  void run(async () => {
    if(target.dataset.catalog){const release=catalog.find(r=>r.id===target.dataset.catalog);if(!release)return;await support.accessGate.assertAllowed();status('جارٍ تنزيل النسخة والتحقق من بصمتها…');const data=await downloadRelease(release);await api('/api/packages','POST',{...release,data});packages=(await api<{packages:PackageEntry[]}>('/api/packages')).packages;render();status('حُفظت النسخة المتحقق منها؛ راجع التثبيت على الشاشة المختارة.');return;}
    if(action==='refresh-catalog'){await refreshCatalog();render();return;}
    if (action === 'report-problem') { if (!support.account) { showLogin(); return; } await support.syncSupport(snapshot(), {problem:'ضغط صاحب الجوال: فيه مشكلة'}); status('وصل التشخيص؛ اشرح المشكلة في محادثتك مع المسؤول.'); if(sheetOpen)render(); return; }
    if (action === 'logout') { await support.logout(); catalog=[];catalogCheckedAt=0; render(); return; }
    if (action === 'poll-support') { await support.syncSupport(snapshot()); render(); return; }
    if (action === 'export-support') { await support.exportDiagnostics(snapshot()); return; }
    if (action === 'scan') { closeDialog(); await scan(); }
    else if (action === 'refresh') { status('جارٍ تحديث بيانات التلفزيون…'); await loadDetails(); status('تم تحديث البيانات المتاحة.'); }
    else if (action === 'setting') { await api(tvPath() + '/settings', 'POST', { id: target.dataset.setting }); status('أُرسل طلب فتح الإعدادات.'); }
    else if (action === 'forget') { await forgetDirect(); devices = []; packages = []; receipts = []; apps = []; settings = []; icons.clear(); closeDialog(); render(); }
    else if (target.dataset.command) { await api(tvPath() + '/command', 'POST', { command: target.dataset.command }); status('أُرسل الأمر إلى ' + television()?.name); }
    else if (target.dataset.launch) { await api(tvPath() + '/launch', 'POST', { appId: target.dataset.launch }); status('أُرسل طلب فتح التطبيق.'); }
  });
});
root.addEventListener('submit', event => {
  event.preventDefault(); if (busy) return;
  const form = event.target as HTMLFormElement, data = new FormData(form); const values = Object.fromEntries(data); const name = form.dataset.form;
  const submit = form.querySelector<HTMLButtonElement>('button'); if (submit) submit.disabled = true;
  void run(async () => {
    if (name === 'login') { await support.login(String(values.service), String(values.email), String(values.password)); form.reset(); closeDialog(); tab = 'support'; sheetOpen=true; render(); return; }
    
    if (name === 'grant-control') {
      if (!values.consent || !devices.some(d => d.id === values.deviceId && d.paired)) throw new Error('راجع موافقة الشاشة.');
      support.grantControl(String(values.deviceId));
      try { await support.syncSupport(snapshot()); } catch (error) { support.revokeControl(); throw error; }
      closeDialog(); render(); return;
    }

    if (name === 'support-action') {
      const a = support.actions.find(a => a.id === values.id); if (!a) throw new Error('انتهى الإجراء.');
      closeDialog(); await executeSupportAction(a, false); return;
    }
    if (name === 'manual') { await api('/api/devices', 'POST', values); closeDialog(); await refreshDevices(); selected = devices.find(d => d.host === values.host)?.id || selected; render(); }
    else if (name === 'pair') {
      const id = selected; if (values.port) await api(tvPath(id), 'PATCH', { port: Number(values.port) });
      document.querySelector('#dialog-status')!.textContent = 'بانتظار التلفزيون… وافق على شاشة التلفزيون إذا ظهر طلب.';
      await api(tvPath(id) + '/pair', 'POST', { code: values.code ? String(values.code).replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632))) : undefined, pairPort: values.pairPort ? Number(values.pairPort) : undefined }, 150000);
      closeDialog(); await refreshDevices(); await loadDetails(); originalRemote?.show(television()?.host); status('التلفزيون مقترن.');
    } else if(name==='developer'){
      if(values.fingerprint&&values.trust!=='on')throw new Error('راجع البصمة ووافق عليها أولًا.');
      const result=await api<{needsTrust?:boolean;fingerprint?:string;message?:string}>(tvPath()+'/developer','POST',{passphrase:values.passphrase,port:values.port?Number(values.port):undefined,fingerprint:values.fingerprint},190000);
      if(result.needsTrust){document.querySelector('#developer-trust')!.innerHTML=`<p>هذه أول مرة تتصل فيها بمفتاح SSH لهذه الشاشة. تحقّق أن العنوان <bdi>${escape(television()!.host)}</bdi> يعود لتلفزيونك، وقارن البصمة إن كانت متاحة لديك.</p><code>${escape(result.fingerprint)}</code><input type="hidden" name="fingerprint" value="${escape(result.fingerprint)}"><label><input type="checkbox" name="trust" required> أثق بهذه الشاشة وهذه البصمة</label>`;status('راجع بصمة LG داخل نافذة التجهيز.');return;}
      closeDialog();await refreshDevices();render();status(result.message||'اتصال المطوّر جاهز.');
    } else if (name === 'setting') { const setting = settings.find(s => s.id === values.id); const value = setting?.kind === 'number' ? Number(values.value) : setting?.kind === 'boolean' ? values.value === 'true' : values.value; await api(tvPath() + '/settings', 'POST', { id: values.id, value }); status('أُرسل تغيير الإعداد.'); }
    else if (name === 'upload') {
      const file = data.get('file') as File; if (!file?.size || file.size > 64 * 1024 * 1024) throw new Error('اختر حزمة صالحة لا تتجاوز 64 MB.');
      document.querySelector('#dialog-status')!.textContent = 'جارٍ حفظ الحزمة على الهاتف…';
      const bytes = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('تعذرت قراءة الملف.')); reader.readAsDataURL(file); });
      await api('/api/packages', 'POST', { name: values.name, appId: values.appId, version: values.version, platform: values.platform, filename: file.name, data: bytes }, 180000);
      packages = (await api<{ packages: PackageEntry[] }>('/api/packages')).packages; closeDialog(); render(); status('أُضيف التطبيق إلى مكتبتك.');
    } else if (name === 'install') {
      document.querySelector('#dialog-status')!.textContent = 'جارٍ التثبيت… قد يستغرق بضع دقائق.';
      await api(tvPath(String(values.deviceId)) + '/install', 'POST', { packageId: values.packageId, confirmed: true }, 210000);
      closeDialog(); receipts = (await api<{ receipts: InstallReceipt[] }>('/api/receipts')).receipts; render(); status('نظام التلفزيون أكد التثبيت عبر اتصال الهاتف المباشر. حدّث التطبيقات وافتح النسخة للتحقق.');
    }
  });
});
async function inspectDevice(id: string) {
  const d = devices.find(d => d.id === id); if (!d?.paired) return;
  const result = await Promise.allSettled([api<{ apps: TvApp[] }>(tvPath(id) + '/apps'), api<{ settings: Setting[] }>(tvPath(id) + '/settings'), api<{ activity: TvActivity }>(tvPath(id) + '/activity')]);
  const [a, s, activity] = result;
  const errors = [a, s].filter(r => r.status === 'rejected').map(r => String((r as PromiseRejectedResult).reason?.message || 'تعذر الفحص'));
  details.set(id, { checkedAt: Date.now(), status: errors.length === 0 ? 'reachable' : errors.length === 1 ? 'partial' : 'unavailable', error: errors.join(' · '), apps: a.status === 'fulfilled' ? a.value.apps : [], settings: s.status === 'fulfilled' ? s.value.settings : [], activity: activity.status === 'fulfilled' ? activity.value.activity : { available: false, reason: String(activity.reason?.message || 'النشاط غير متاح'), checkedAt: Date.now() } });
}
async function executeSupportAction(a: support.SupportAction, automatic: boolean) {
  if (!support.sharing || !support.actionFresh(a) || automatic && (!support.autoAllowed(a) || document.hidden)) throw new Error('انتهت موافقة التحكم أو صلاحية الإجراء.');
  const d = devices.find(d => d.id === a.deviceId);
  if (!['rescan', 'refresh'].includes(a.type) && !d) throw new Error('التلفزيون غير موجود في هذا الهاتف.');
  await support.resolveAction(a.id, 'running', 'استلم الهاتف الإجراء');
  try {
    // Recheck after the network acknowledgement; owner revocation always wins.
    if (!support.sharing || automatic && (!support.autoAllowed(a) || document.hidden)) throw new Error('أوقف صاحب الهاتف الجلسة.');
    if (a.type === 'rescan') await scan();
    else if (a.type === 'inspect' || a.type === 'refresh') { await refreshDevices(); if (a.deviceId) await inspectDevice(a.deviceId); else await loadDetails(); }
    else if (a.type === 'command') {
      if (!d?.paired || !d.capabilities.commands.includes(a.command as Command)) throw new Error('زر غير متاح على هذه الشاشة.');
      await api(tvPath(d.id) + '/command', 'POST', { command: a.command });
    } else if (a.type === 'launch') {
      const listed = await api<{ apps: TvApp[] }>(tvPath(d!.id) + '/apps');
      if (!listed.apps.some(app => app.id === a.appId)) throw new Error('التطبيق غير موجود على الشاشة.');
      if (automatic && !support.autoAllowed(a)) throw new Error('انتهت الجلسة.');
      await api(tvPath(d!.id) + '/launch', 'POST', { appId: a.appId });
    } else if (a.type === 'setSetting') {
      const listed = await api<{ settings: Setting[] }>(tvPath(d!.id) + '/settings'), s = listed.settings.find(s => s.id === a.settingId);
      if (!s || s.kind === 'action' || s.kind === 'number' && (typeof a.value !== 'number' || !Number.isFinite(a.value) || a.value < (s.min ?? 0) || a.value > (s.max ?? 100)) || s.kind === 'boolean' && typeof a.value !== 'boolean' || s.kind === 'choice' && !s.options?.some(o => o.id === a.value)) throw new Error('إعداد أو قيمة غير متاحة على الشاشة.');
      if (automatic && !support.autoAllowed(a)) throw new Error('انتهت الجلسة.');
      await api(tvPath(d!.id) + '/settings', 'POST', { id: a.settingId, value: a.value });
    } else {
      selected = d!.id; render();
      if (a.type === 'pair') showPair();
      else if (a.type === 'settings') await api(tvPath() + '/settings', 'POST', { id: 'open' });
      else if (a.type === 'install') {
        packages = (await api<{ packages: PackageEntry[] }>('/api/packages')).packages;
        const p = packages.find(p => p.id === a.packageId);
        if (!p || p.platform !== d!.platform || !d!.capabilities.install.available) throw new Error('الحزمة غير متاحة أو غير متوافقة.');
        tab = 'library'; render(); showInstall(d!, p);
      }
    }
    await support.resolveAction(a.id, ['pair', 'install'].includes(a.type) ? 'review-opened' : 'sent', ['pair', 'install'].includes(a.type) ? 'فتحت المراجعة؛ لم يؤكد التثبيت أو الاقتران بعد' : 'اكتمل طلب الهاتف دون خطأ؛ راجع حالة التلفزيون');
    if (!document.querySelector('dialog[open]')) render();
    await support.syncSupport(snapshot());
  } catch (error) { await support.resolveAction(a.id, 'failed', error instanceof Error ? error.message : 'تعذر التنفيذ'); throw error; }
}
async function serviceSupport() {
  if (document.hidden || busy || supportPolling || !support.sharing || document.querySelector('dialog[open]')) return;
  supportPolling = true;
  try {
    if (support.control && support.control.expiresAt <= Date.now()) support.revokeControl();
    if (Date.now() - lastHeartbeat > 30000) { await support.syncSupport(snapshot()); lastHeartbeat = Date.now(); } else await support.pollSupport();
    if (!support.sharing || document.hidden || busy) return;
    const action = support.actions.find(a => support.autoAllowed(a));
    if (action) await run(() => executeSupportAction(action, true));
    else if (Date.now() - lastInspection > 30000) {
      const d = devices.filter(d => d.paired).sort((a, b) => (details.get(a.id)?.checkedAt || 0) - (details.get(b.id)?.checkedAt || 0))[0];
      if (d) await run(() => inspectDevice(d.id)); lastInspection = Date.now();
    }
    if (tab === 'support' && !document.querySelector('dialog[open]') && !document.querySelector('input:focus,textarea:focus,select:focus')) render();
  } catch (error) { support.connectionError(error instanceof Error ? error.message : 'تعذر اتصال الدعم'); }
  finally { supportPolling = false; }
}
render();
// Mount the bundled remote before native storage, account verification or LAN
// initialization. None of those asynchronous services is a rendering dependency.
if (!new URLSearchParams(location.search).has('utility')) {
  const pageHost:PageHost={api,household:support.household,selected:()=>selected,select:id=>{selected=id;},record:(stage,ok,message,id)=>support.record(stage,ok?'ok':'failed',message,id),open:(action,host)=>{
    void run(async()=>{if(action==='problem'){if(!support.account){showLogin();return;}await support.syncSupport(snapshot(),{problem:'ضغط صاحب الجوال: فيه مشكلة'});status('وصل تشخيص هذا الجوال. اشرح المشكلة في محادثتك مع المسؤول.');return;}if(online&&action!=='support')await refreshDevices();if(host){const d=devices.find(d=>d.host===host);if(d)selected=d.id;}
    sheetOpen=!['pair','manual'].includes(action);tab=action==='support'?'support':action==='library'?'library':action==='settings'?'settings':'remote';if(action!=='support')await loadDetails();if(action==='library')await refreshCatalog();render();
    if(action==='pair')showPair();else if(action==='manual'){root.querySelector<HTMLButtonElement>('[data-action="manual"]')?.click();const input=root.querySelector<HTMLInputElement>('input[name="host"]');if(input&&host)input.value=host;}});
  }};
  connectOriginalHost(pageHost);
  originalRemote=originalSurface||await mountOriginalRemote(pageHost);
  render();
}
await support.initSupport();
render();
await reconnect();
if (Capacitor.isNativePlatform()) {
  closeDialog(); if(!originalRemote)void run(scan);
  void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void reconnect().then(() => run(scan)); else { support.revokeControl(); void support.stopSharing(); } });
}
if(originalRemote)void originalRemote.update();
window.addEventListener('online', () => { void reconnect(); });

document.addEventListener('visibilitychange', () => { if (document.hidden) { support.revokeControl(); void support.stopSharing(); } });
setInterval(() => { void serviceSupport(); }, 5000);

setInterval(() => { if(support.account && !document.hidden) void support.accessGate.refresh().catch(()=>undefined); },30000);
setInterval(()=>{if(originalRemote&&!document.hidden&&!busy&&!sheetOpen&&!support.sharing&&!document.querySelector('dialog[open]'))void originalRemote.update();},60000);
