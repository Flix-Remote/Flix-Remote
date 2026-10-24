# One remote page for browser, iPhone and Android

The canonical interface is `local_apps/flix-s/tools/tv-remote.html` in the parent FLIX workspace. Edit it once. Do not maintain a separate phone copy or edit the generated `src/remote-page/source.html` manually. This standalone public repository contains the generated, sanitized page; the private account server and household configuration are excluded.

`npm run build` refreshes the browser account block and revision, synchronizes the original page and shared rules, checks TypeScript, and builds the native shell. It also stages `../flix-s/public/home-remote/ui/release.json` and its content-addressed HTML. Publish both together with the account/download site. A build alone is not publication.

The browser checks its own page revision every minute and reloads while idle. Phone shells from 0.5.5 onward check the trusted HTTPS UI manifest at startup and every minute while idle. They verify the exact byte count, SHA-256, fixed download path, and bridge compatibility before caching or executing a page. Offline or damaged updates retain the last verified page or bundled fallback. Updating pauses during editing, gestures, account dialogs and diagnostic sharing. Foreground, connectivity and idle time determine delivery; devices do not update at exactly the same second. Earlier phone shells need a one-time binary update to enable this channel.

Shared HTML, layout, installed-app display and compatible original-page interactions use this channel. Changes to native plugins, permissions, protocol adapters, bundled companion rule modules or shell code still require new Android/iOS binaries. Bump the bridge version/cache namespace when an HTML release cannot safely run in an older shell. Never claim that HTML delivery upgrades native permissions or adds unsupported TV capabilities.

No USB cable is required to receive compatible shared-page or catalog changes. The phone needs Internet access and the app must be open and idle for its next check. Reading the installed app's cache over an already trusted USB connection is an optional verification method, not the update transport. A successful public deployment or isolated IPA test must not be reported as proof that the physical phone received that exact page.

## Release checks

Run `npm run typecheck`, `npm test`, and `npm run build`. Run the original-page, browser-apps, browser-account, UI-delivery and browser-UI-update fixtures; they must intercept all TV/network calls. Build and verify Android, build iOS in the pinned cloud workflow, and match its artifact digest/source receipt. Stage the packages and hashed UI, then verify the candidate and public download endpoints before declaring publication. Use the canonical parent's admin source pin rather than overwriting the production account service from an arbitrary checkout.

Physical TV testing is a separate acceptance gate. Follow the owner's current household restriction. Never change input, playback, volume, apps, settings or power to satisfy a test while background-only work is required.

Run `npm run verify:ui-channel` to repeat the release delivery proof for the owner's verified 0.5.6/build12 IPA. It reads the local installation receipt and exact released IPA, checks the live public manifest and HTML, runs the real single-source generators in a disposable workspace, then executes the unchanged IPA's web assets in an isolated iOS bridge fixture. The fixture tests automatic delivery of a new working shared feature, preserved controls/apps/account/package entry points, idle protection, offline cache, damaged downloads and incompatible bridge releases. It also proves the same generated feature reaches the browser automatically. All TV/native calls are substituted in memory; the probe is never published. This is release-asset verification, not proof of receipt in the physical iPhone's running WebView. Do not open the owner's app for that final gate while startup TV traffic is prohibited.

## Family distribution and wireless native updates

The owner's 0.5.6/build12 installation is independently verified in `evidence/ios-v056-device-install.json`. Do not reinstall the app for ordinary shared-page, account UI, or catalog changes. Native bridge/permission changes still need a signed native release; never label a cloud HTML publication as native installation or Apple signature renewal.

For each new reviewed native iOS release, stage its actual IPA and release receipt first, then run `python scripts/stage-altstore-source.py`. The script validates the IPA hash, version, minimum OS and actual privacy/entitlement declarations and produces the family's AltStore source; publish it with the corresponding IPA and manifest. For changes to the three family web-app/APK distribution entries, run `node scripts/stage-family-apps.mjs`, then stage the AltStore source and verify `tests/family-apps-distribution.ts` and `scripts/verify-family-production.mjs` against the candidate/public output. Keep all assets under `/home-remote/apps/` in the same source-pinned admin deployment as the hashed UI. Preserve unsigned Samsung packages outside the installable catalog.

AltStore2.3.1 is installed on the owner's iPhone. The source URL is `https://flix-admin-tan.vercel.app/home-remote/apps/altstore-source.json`. Adding this source and setting up Settings → Set up Remote AltServer require the owner's interaction inside AltStore. The source's publication alone does not configure renewal. Classic2.3+ supports renewal over Wi-Fi without a computer after that setup; free Apple signing remains time-limited, and successful renewal on this particular phone must be verified separately. Never record Apple passwords, verification codes or pairing secrets.

Apple iPad uses the same Safari Web Apps/three-WebClip profile as iPhone; a Huawei tablet that accepts Android APK uses the Android packages. Installation approval remains on the receiving device. These family Apple apps are web apps, not three native IPA releases.

## Own-app library and diagnostics

The authenticated admin registry combines phone installations and browser installations, with platform filters and separate installation/account remote-access policies. It does not disable the FLIX viewing subscription. Updated clients poll policy; old clients must update before relying on this gate.

Publish each own-app release in the admin library with its app ID, version, TV platform, public HTTPS package URL, exact bytes and SHA-256. The phone filters compatibility, verifies downloads and saves them locally. Installing still requires explicit device/package review and the TV's developer prerequisites. APK, IPK and WGT are different packages; Samsung requires an accepted signed WGT, LG requires Developer Mode/Key Server, and Android requires authorized ADB. Do not infer arbitrary TV installation rights from Wi-Fi access.

On 2026-10-23, the production registry was populated with the existing public LG packages: FLIX S 2.0.131, FLIX F 1.1.92 and FLIX IPTV 2.0.278. `evidence/lg-library-published.json` records public package byte/digest checks and authenticated admin readback. `tests/published-library-delivery.ts` executes the exact released 0.5.5 IPA/APK assets with isolated native/account/TV boundaries and real HTTPS package downloads; four checks cover catalog downloads and the add-file form. This does not prove a physical phone or LG installation.

On 2026-10-24 Riyadh time, the owner explicitly allowed activating browser uploads during viewing. Only remote port7797 was restarted with `--background-only=1`; video3100 and admin7798 retained their process IDs. This mode suppresses the automatic network-power/address watcher, audio repair, night settings and keep-awake writers. `tests/remote-background.test.ts` executes the actual guarded function/startup/timer snippets against trapping dependencies, with an optional `REMOTE_SERVER_SOURCE` for the canonical service copy. `tests/live-browser-upload.ts` sends only package-upload requests to live7797, checks the saved IPK and cross-origin rejection, intercepts all TV requests, and removes its own test entry. Evidence is in `remote-upload-activation.json` and `live-browser-upload.json`. This is upload/storage verification; no physical TV installation is implied.

To install from a phone, connect it to the TV's Wi-Fi, sign into FLIX, select the LG and open «تثبيت التطبيقات». In the TV's Developer Mode app, enable Developer Mode and Key Server; enter its Passphrase in the phone's preparation dialog and review the SSH fingerprint. Download a compatible IPK from the library, then review and confirm «تثبيت». The phone transfers it directly over the LAN. A new Android phone can install the published remote APK; another iPhone still needs its own Apple signing/distribution path.

To report health from an app you own, integrate `sdk/flix-device-link.mjs` in that app's code:

```js
const link = createDeviceLink({
  serviceUrl: 'https://your-account-service.example',
  appId: 'com.example.tv', platform: 'webos', version: '1.0.0',
  installationId: persistedUUID, deviceName: userVisibleName,
  getSession: async () => currentFlixSessionToken,
  hasConsent: () => diagnosticSharingEnabled
});
await link.report({ state: 'ready', code: 'startup', message: 'Started' });
const release = await link.latest();
```

Import `createDeviceLink` from the module. Supply the existing FLIX session and explicit consent; never embed an account token in a binary. Check the module's exact types/validation before integration. This SDK reports bounded health/version data and reads releases. It provides no arbitrary shell or automatic TV control. Merely publishing the SDK does not integrate it into existing TV app binaries. The real catalog can remain empty until actual compatible packages are published.

Android supports direct APK installation. The supplied unsigned iPhone IPA requires the owner's signing tool/account; a regular Apple account does not provide general public TestFlight distribution. TestFlight requires the owner's Apple Developer membership and Apple's process. Do not purchase membership or claim unsigned IPA downloads install themselves.
