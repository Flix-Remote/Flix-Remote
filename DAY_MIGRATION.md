# Day migration and App Fair review

Status: source candidate, not a published or physically qualified mobile release.

Public review: https://github.com/Ahmedzx054/flix-home-remote/pull/1 (draft).
App Fair introduction submitted: https://github.com/orgs/appfair/discussions/7 .
This is an introduction and architecture/privacy review request, not catalog acceptance.

## Shared interface and native bridge

`Flix-Remote/` is a real Day 0.6.0 project generated with the official CLI. One custom
Day Piece hosts the original remote page. `npm run build` stages the same `dist/`
into Capacitor and the Day resource bundle. The native LAN, ADB pairing/installation,
secure storage and speech sources remain the original three plugins. UIKit embeds
the existing bridge controller. Android uses an AppCompatActivity subclass for Day's
host (preserving FragmentActivity semantics), with a recorded single-file adaptation
in a generated copy. Capacitor and Cordova sources remain unmodified.

The original `src/remote-page/updates.ts` channel is retained. Compatible remote-page
changes are fetched through the existing trusted HTTPS bridge-1 manifest, verified
by length/hash/path/bridge checks and cached with fallback. Native code or permission
changes require a new signed mobile binary. A browser target cannot supply native
socket/ADB functions merely by displaying the same page.

## Qualification

Logs under `evidence/day-*` distinguish Rust/mock checks, web build, original shared
page fixture tests, CI/native builds and physical-device acceptance. A staged hash
receipt is evidence of exact input bytes only. Do not call it a mobile build or a
successful television interaction. No owner phone or household TV is launched by
the verification workflow. No production service is restarted or deployed.

The full workspace has 55 isolated checks. The standalone phone repository has 50:
two private browser-server test files (five checks) stay in the full workspace,
because they exercise server sources outside this public client repository.
They are not replaced by fixtures or counted as passing in the standalone suite.

## App Fair gates

The matching public organization/repository `Flix-Remote/Flix-Remote` has been created
and the sanitized client history imported, including `codex/day-appfair`.
The original source-review PR remains available in `Ahmedzx054/flix-home-remote`.
App Fair Publisher was installed with the owner's explicit permission on 2026-10-24,
installation 174784228, limited to this repository (metadata read, code read/write).
The `appfair` flavor's application ID is a proposal and must be confirmed before release.

App Fair must explicitly review this hybrid Day/custom native Piece and the retained
cloud JavaScript updates, opt-in support/diagnostics, FLIX accounts and app package library.
The remote must remain free, without ads or paid feature unlocks. Its source license
does not license third-party video content or authorize distributing other apps.
The official App Fair lint passes all five source/identity/license-presence rules.
This is not a determination of license compatibility or eligibility.
The full dependency/asset license inventory and reproducible Maven source builds remain
release gates. The source privacy audit, nested diagnostic filtering fix, license
document bundle and exact LGPL source repair are recorded under `Flix-Remote/review/`.
The audit found automatic account inventory, media-subscription coupling and missing
remote retention/erasure behavior. These are explicit blocked publication gates,
not resolved by the supplied disclosure or a successful build. CI now requests
phone/tablet, Arabic/English and light/dark coverage with native dependency receipts.

CI pre-release packages, successful mobile/web builds and screenshot walkthroughs are
required before a catalog PR. App Fair's review and Apple's store review are separate.
No paid Apple account or payment is initiated by this work. No installation URL is
claimed until an actual approved distribution channel exists.

Sources: https://appfair.org/docs/inclusion-criteria/ and
https://appfair.org/docs/getting-started/ .
