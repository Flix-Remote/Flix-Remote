# صفحة ريموت FLIX الأصلية — iPhone وAndroid — 0.5.5

الصفحة الأصلية `local_apps/flix-s/tools/tv-remote.html` هي واجهة التطبيق الافتراضية. أدوات الاقتران والحزم وحساب FLIX تفتح من داخلها وتعود لنفس الشاشة المختارة. مطابقة كل أداة وحدود التلفزيونات والأدلة في [ORIGINAL_REMOTE_PARITY_AR.md](ORIGINAL_REMOTE_PARITY_AR.md).

الهاتف يتصل بالتلفزيون مباشرة على Wi-Fi، دون كمبيوتر أو Node أو adb server في البيت. الحساب وقناة الدعم يستخدمان خدمة FLIX عبر HTTPS. تطبيق الهاتف ينفذ الاتصال محليا بنفسه؛ صفحة المتصفح تستخدم خدمة LAN الأصلية عندما تكون مهيأة، ولا تجعل الكمبيوتر وسيطا لمسار تطبيق الهاتف.

## التسليم والاستخدام

- Android 0.5.5/build11: `releases/home-remote-android-debug.apk`، 20,130,038 بايت، SHA-256 `96be8292c3d08b6745687035e8285271162a16033621d1206087e21b77b4ca52`، buildId `b452759a83cd5975a428f47e`. نسخة تطوير موقعة؛ الدليل `evidence/android.json`.
- iPhone 0.5.5/build11: `releases/public-ios-build-8/HomeRemote-unsigned.ipa`، 3,250,435 بايت، SHA-256 `f603d3a2cba154941cda2893c7f042e063969161f98ed6096a3d1020442d14fc`، buildId `a61de197f43504f7ef54970e`. [بناء Xcode 27.1 رقم8](https://github.com/Ahmedzx054/flix-home-remote/actions/runs/40007125467) من المصدر `a03489f9a3b25a86994e31d166ba3ef0a3f5f8e6`، ARM64 وiOS17+. الملف غير موقع ويحتاج توقيع المستخدم؛ الدليل `evidence/ios-public-original-v055.json`.
- تطابق كود واجهة البناءين كاملا باستثناء buildId المسجل، مع تطابق 25 ملف ويب آخر. اختلاف Go 1.25.0 في السحابة و1.25.1 محليا وبيانات VCS يفسر اختلاف WASM ومعرف البناء؛ لا يستخدم اسم الإصدار وحده لإثبات تطابق المصدر.

- [صفحة التنزيل](https://flix-admin-tan.vercel.app/home-remote.html) · [Android](https://flix-admin-tan.vercel.app/home-remote/android.apk) · [ملف iPhone للتوقيع](https://flix-admin-tan.vercel.app/home-remote/ios-unsigned.ipa).
- أدلة النشر والقبول وحدوده في [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md) و[VERIFICATION.md](VERIFICATION.md).

ثبّت التطبيق واسمح بالشبكة المحلية، ثم اختر التلفزيون واقترن به على Wi-Fi نفسه دون عزل عملاء. تعرض الصفحة تطبيقات الجهاز المختار وأيقوناتها المتاحة تلقائيا، وتعيد القراءة بعد الاتصال وتبديل الجهاز وعند طلب التحديث. يظهر خطأ القراءة مع إعادة المحاولة بدلا من قائمة تطبيقات مخمنة. الأيقونة غير المدعومة لا تخفي اسم التطبيق.

الاقتران والحزم وحساب FLIX نوافذ داخل الصفحة الأصلية. سجّل بحساب FLIX القائم؛ زر «فيه مشكلة» يطلب موافقة مشاركة التشخيص ويربط البلاغ بالحساب والجهاز دون كتابة رسالة. التحكم عن بعد يحتاج إذنا مؤقتا من صاحب الهاتف؛ لا يحتاج AI أو مفتاح OpenAI. من مكتبة الإصدارات اختر حزمة نظام التلفزيون وراجع البصمة ومتطلبات المطور وأكد التثبيت؛ لا تثبيت تلقائي لحزمة غير متوافقة.

## تعديل واحد للصفحة ونسختَي الجوال

المرجع الواحد هو `local_apps/flix-s/tools/tv-remote.html`. أمر البناء يجدد نسخة المتصفح والنسخة المضمنة للهاتف وملفات التحديث المشترك. نشر HTML وبيان UI يتم معا؛ التعديل المحلي وحده ليس نشرا. العقد للمطورين في [REMOTE_DEVELOPMENT.md](REMOTE_DEVELOPMENT.md) وتعليمات `AGENTS.md`، لذلك طلب تعديل الريموت يشمل الصفحة وiPhone وAndroid دون تكرار الطلب.

من 0.5.5 يتحقق الهاتف عند الفتح وكل دقيقة خمول في المقدمة من بيان HTTPS موثوق، وحجم HTML وبصمة SHA-256 ومساره وإصدار الجسر. يحتفظ بآخر واجهة سليمة عند انقطاع الشبكة أو فساد الملف. المتصفح يتحقق من نسخة صفحته ويحدثها أثناء الخمول. التحرير واللمس والنوافذ ومشاركة التشخيص تؤجل التحديث؛ لا ضمان لوصوله إلى كل الأجهزة في الثانية نفسها. الإصدارات الأقدم تحتاج تحديث التطبيق مرة واحدة لتفعيل هذه القناة.

تعديلات HTML والتصميم والوظائف المتوافقة مع الجسر تستخدم القناة المشتركة. تغيير إضافات النظام أو الأذونات أو بروتوكول أصلي أو كود غلاف التطبيق يحتاج إصدار Android/iPhone جديدا؛ تحديث HTML لا يمنح صلاحية محمية ولا يغير مكونات النظام.

## تثبيت LG من الهاتف

1. على LG افتح Developer Mode وسجّل بحساب LG Developer وفعّل Dev Mode وKey Server. المالك ينفذ التمكين وأي إعادة تشغيل مطلوبة.
2. اختر LG ثم «تجهيز تثبيت التطبيقات» واكتب Passphrase الظاهر في الشاشة **داخل التطبيق**، دون إرساله في المحادثة.
3. يقرأ الهاتف مفتاح المطور من التلفزيون على 9991 ويتصل SSH على 9922 باسم prisoner. أول اتصال يعرض بصمة SHA-256؛ تحقق من عنوان الشاشة وقارن البصمة إن كانت متاحة، ثم وافق. تغير البصمة المحفوظة يوقف الاتصال.
4. بعد التفويض تحفظ بيانات المطور في خزنة الهاتف. أضف IPK صالحا وراجعه وثبته. ينقل الهاتف الحزمة ويطلب التثبيت عبر خدمة webOS وينتظر تأكيد النظام وينظف الملف المؤقت.

Key Server مطلوب عند التجهيز؛ التثبيت اللاحق يستخدم المفتاح المحفوظ ما دامت جلسة المطور صالحة. مدة Developer Mode وصلاحياته تحددهما LG؛ التطبيق لا يتجاوزهما.

## تثبيت Samsung من الهاتف

1. فعّل Developer Mode في Apps وحدد عنوان IP المحلي **للهاتف** جهازا مسموحا للمطور. المالك ينفذ أي إعادة تشغيل مطلوبة.
2. جهّز WGT موقعة بشهادة Samsung التي تسمح بالتلفزيون، وتصريح DUID عندما تتطلبه الشهادة. التطبيق لا يولد شهادة Samsung أو توقيعا دون حسابك ومواد التوقيع.
3. اختر Samsung ثم «تجهيز تثبيت التطبيقات». منفذ SDB الافتراضي 26101 قابل للتغيير؛ يختبر الهاتف الاتصال والقدرات قبل إتاحة التثبيت.
4. أضف WGT ومعرف التطبيق الكامل المطابق لـ`config.xml`، مثل `PACKAGEID.AppName`. يفحص التطبيق التعريف ووجود ملفات توقيع المؤلف والموزع؛ التلفزيون يتحقق من **صحة التوقيع**.
5. راجع وأكد. ينقل SDB الحزمة ويطلب `vd_appinstall` ويفحص النتيجة وينظف الملف المؤقت؛ الرفض يظهر في الإيصال والتشخيص.

## اقتران TCL / Android / Google TV برمز

TCL علامة تجارية؛ اختر Android إذا كان نظام الشاشة Android/Google TV، وRoku إذا كان نظامها Roku.

1. على الشاشة فعّل Wireless Debugging وافتح «Pair device with pairing code». هذا الإذن المحمي يحتاج المالك أولا.
2. أدخل العنوان و**منفذ الاتصال** من صفحة Wireless Debugging، ثم **منفذ الاقتران** والرمز الحالي ذي الست خانات من نافذة الاقتران. المنفذان مختلفان وقد يتغيران؛ تقبل الواجهة الأرقام العربية والفارسية.
3. ينفذ Java/Swift اقتران ADB TLS داخل الهاتف دون حفظ الرمز، ثم يستخدم منفذ الاتصال. تدعم أجهزة ADB TCP القديمة مع موافقة RSA أيضا.
4. تظهر صفحات الإعدادات التي يحلها الجهاز فعليا: الشبكة وBluetooth والعرض والصوت والتطبيقات والمطور. APK ينقل مباشرة عبر ADB sync وpm install مع تأكيد ونتيجة.

## التوافق وحدوده

| النظام | التحكم والتطبيقات | الإعدادات | حزمة من الهاتف |
|---|---|---|---|
| LG webOS | SSAP/WebSocket وتفويض الشاشة؛ التطبيقات وأيقوناتها المتاحة وفتحها | صوت/كتم/مداخل إن أعادها الجهاز وفتح الإعدادات | IPK عبر SSH/WASM بعد تجهيز المطور |
| Samsung Tizen | WebSocket وتفويض الشاشة؛ قائمة التطبيقات إن أتاحها الموديل | فتح القائمة والتنقل فيها | WGT موقعة عبر SDB بعد السماح للهاتف |
| Android / Google TV / TCL المتوافق | ADB TCP أو TLS برمز؛ LEANBACK وفتحها، معرفات وأيقونات بديلة | صفحات يحلها النظام فعليا، لا كل القيم المحمية | APK عبر ADB sync |
| Roku TV | ECP إن سمحت الشاشة؛ تطبيقات وأيقونات وفتح | أزرار وتنقل، لا واجهة عامة لكل الإعدادات | لا APK/IPK/WGT |
| غير معروف | تحديد النظام مطلوب | لا قدرات مفترضة | غير متاح |

وجود شاشة على Wi-Fi لا يضمن دعم البروتوكول. لا تتحول حزمة iPhone إلى تطبيق تلفزيون، ولا يعمل APK على LG/Tizen؛ يلزم بناء TV لكل نظام. الإرشادات لا تتجاوز موافقات المطور والتوقيع والقيود المحمية.

## الدعم والتحكم عن بعد عبر الهاتف

الهاتف هو منفذ أوامر التلفزيون داخل شبكة البيت. لوحة FLIX وCLI يقرآن التشخيص ويرسلان إجراءات محددة إلى الهاتف عبر HTTPS؛ الهاتف ينفذها مباشرة على LAN ويرجع النتيجة. أبق التطبيق في الواجهة. لا يحتاج كمبيوتر منزليا أو مفتاح مزود AI أو اشتراك API. المحادثة الحالية ليست خدمة مراقبة دائمة؛ يقرأ المشغل/Codex البلاغ عند تشغيل جسر الدعم بجلسة إدارة مأذونة.

- `/api/home-remote/account/*` يعيد استخدام AccountService القائم. البريد ومعرف الحساب يأتيان من الجلسة الموثقة. البلاغ ونتائج الأوامر معزولة لكل حساب. سجل الإدارة يجمع مستخدمي المتصفح وiPhone وAndroid مع مرشح المنصة وسياسة وصول للحساب أو التثبيت؛ لا يغير اشتراك المشاهدة. النسخ القديمة تحتاج تحديثا قبل الاعتماد على بوابة الوصول.
- مشاركة التشخيص اختيارية وتشمل الأجهزة وآخر فحص والأخطاء والتطبيقات والإعدادات والحزم وإيصالات التثبيت. النشاط الجاري يرسل فقط إذا كشفه التلفزيون: Android قد يكشف اسم المحتوى، LG يكشف التطبيق، Samsung قد لا يكشف النشاط. الحالة غير المتاحة تظهر صراحة.
- كلمة المرور ومفاتيح الشاشة ورمز الاقتران وملفات الحزم وملفات dumpsys الخام لا ترسل إلى الدعم.
- موافقة التحكم من الهاتف لمدة 15 دقيقة لشاشة واحدة. أوامر الأزرار وفتح تطبيق مبلغ عنه وتغيير إعداد متاح والفحص يمكن تنفيذها خلالها. ينتهي الإذن بالخروج للخلفية أو إعادة تشغيل التطبيق أو زر الإلغاء. انقطاع الهاتف يوقف التنفيذ وتصبح حالة الخادم قديمة خلال 90 ثانية.
- الاقتران والتثبيت والإطفاء تحتاج مراجعة مستقلة. التثبيت يستخدم حزمة متوافقة محفوظة على الهاتف ويعرض تأكيدا ثانيا؛ لا يرسل المشغل shell عاما ولا يتجاوز صلاحيات المطور.
- الإجراءات تحمل صلاحية ونتيجة استلام ونتيجة نهائية؛ يسجل الهاتف استهلاك الإجراء قبل التنفيذ ويعيد إرسال الإيصال عند عودة الشبكة لمنع التكرار. حالة `sent` تعني نجاح طلب البروتوكول، ولا تثبت تغير الصورة فعليا. نتيجة التثبيت منفصلة في الإيصالات.
- المزامنة كل 5 ثوان أثناء الواجهة مع تشخيص دوري؛ حفظ القوائم في التخزين المشترك يستخدم read/modify/write، وليس ضمانا ذريّا لتزامن عدة مشغلين. إصلاح مصدر التطبيق يحتاج بناء وتوزيع إصدار جديد.

لوحة المشغل: https://flix-admin-tan.vercel.app/home-remote-support.html . تتطلب جلسة FLIX Admin القائمة؛ لا تفتح للعامة.

```powershell
# جلسة الإدارة المأذونة في FLIX_SUPPORT_ADMIN_COOKIE؛ لا تطبعها ولا ترسلها في الدردشة
node scripts/support-client.mjs list --email user@example.com
node scripts/support-client.mjs report --id REPORT_UUID
node scripts/support-client.mjs propose --id REPORT_UUID --type inspect --tv TV_UUID --message "فحص الاتصال"
node scripts/support-client.mjs propose --id REPORT_UUID --type command --tv TV_UUID --command ok --message "اختبار الزر"
node scripts/support-client.mjs propose --id REPORT_UUID --type install --tv TV_UUID --package PACKAGE_UUID --message "مراجعة الحزمة"
```

## المعمارية والبيانات

`src/direct/engine.ts` يدير الأجهزة والحزم والقدرات؛ `adapters.ts` بروتوكولات الشاشة؛ `socket.ts` WebSocket؛ `adb.ts` ADB المباشر؛ `sdb.ts` SDB؛ `webos-install.ts` يستدعي Go/WASM في `sshcore/`. Java يوفر DirectLan/DirectAdb وSwift يوفرهما في `HomeDiscoveryPlugin.swift`. ADB TLS يستخدم libadb-android وADBCore المثبت على revision محدد. `hub/` مرجع تطوير لا يدخل حزمة الهاتف أو مسار المستخدم.

قناة التلفزيون تقبل IPv4 محليا خاصا أو link-local؛ لا DNS عام أو تحويل HTTP. استثناء شهادة التلفزيون ذاتية التوقيع محصور بالقناة المحلية وHTTPS السحابة عادي. تحفظ الأسرار في Android Keystore/AES-GCM أو iOS Keychain، وبيانات الأجهزة في Preferences والحزم حتى 64 MB في Filesystem الخاص. حذف مكتبة الشاشات يمحو رموزها ومفاتيح LG وبصماتها؛ تبقى هوية ADB الخاصة **بالهاتف** ثابتة لتفويض عدة شاشات. لإبطالها على التلفزيون استخدم إلغاء تفويضات المطور فيه.

التراخيص والإشعارات في `public/THIRD_PARTY_NOTICES.txt` و`public/licenses/` وتدخل الحزمة، بما فيها مصدر spake2 المطابق للمكتبة.

## البناء والتوزيع

يلزم Node وGo 1.25 أو أحدث متوافق وAndroid SDK/JDK. Windows يستخدم `.toolchain/go/bin/go.exe`؛ يمكن ضبط `FLIX_GO` لمسار Go المثبت. Mac يستخدم `go`.

```powershell
npm ci
npm run typecheck
npm test
powershell -NoProfile -File scripts/build-android.ps1
powershell -NoProfile -File scripts/verify-native.ps1
node scripts/stage-release.mjs
```

`verify-native` يفحص توقيع APK وهويته وDEX وWASM، وXML ومراجع iOS فقط. `stage-release` ينسخ APK وIPA الموثق وrelease.json وملفات UI المشتركة إلى `../flix-s/public/home-remote/` محليا دون نشر. APK مستثنى من Git ويعاد تجهيزه قبل النشر المعتمد. ينشر flix-admin للحساب والدعم والتنزيل ومدخل /remote؛ لا يلزم نشر FLIX S لتوزيع الهاتف. مرشح الإنتاج يستعيد مصدر Admin الحي ويتحقق من بصماته قبل إضافة الدعم حفاظا على إصلاحات الحسابات. تفاصيل النشر الحالي في PUBLIC_RELEASE.md.

دون Mac محلي: نفذ `python scripts/stage-ios-cloud.py` لتجهيز مصدر مستقل دون بيانات المستخدمين ثم اتبع `IOS_CLOUD.md`. Workflow GitHub يبني جهاز ARM64 غير موقع على `xcode-27` للتوقيع عبر Windows بحساب Apple عادي. عند تعذر multicast يستخدم iOS Bonjour ووصف HTTP محدودا بالشبكة الفعلية، مع إضافة IPv4 يدوية. يلزم إذن الشبكة المحلية. لا يمثل تجهيز المصدر أو `cap sync ios` نجاح تجميع Swift.

على Mac محلي أو سحابي يمكن تشغيل `bash scripts/build-ios.sh unsigned` لبناء IPA يحتاج توقيع المستخدم، أو `simulator` للتحقق من التجميع فقط، أو `FLIX_APPLE_TEAM=TEAM_ID bash scripts/build-ios.sh archive` بعد تجهيز التوقيع. لتصدير الأرشيف الموقع اضبط `FLIX_IOS_EXPORT_OPTIONS` على ملف ExportOptions.plist الخاص بفريقك. السكربت يفحص Swift6.4 ولا يرفع إلى المتجر. [بناء0.5.5/build8](https://github.com/Ahmedzx054/flix-home-remote/actions/runs/40007125467) نجح؛ لم يثبت هذا الإصدار على هاتف فعلي بعد.

القبول على هاتف وشاشات حقيقية مستقل عن نجاح البناء واختبارات البروتوكولات الاصطناعية. راجع `VERIFICATION.md` و`PUBLIC_RELEASE.md` لهوية النسخة والقيود الحالية.

## المصادر الأساسية

- [LG Developer Mode](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app)
- [Samsung TV certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html)
- [Apple local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Android ADB](https://developer.android.com/tools/adb)
- [Android binary resources](https://android.googlesource.com/platform/frameworks/base/+/master/libs/androidfw/include/androidfw/ResourceTypes.h)
- [Android VectorDrawable](https://developer.android.com/reference/android/graphics/drawable/VectorDrawable)
- [Roku ECP](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md)
