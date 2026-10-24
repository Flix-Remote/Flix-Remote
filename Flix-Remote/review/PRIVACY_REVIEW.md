# Privacy review — 2026-10-24

Scope: source-only Day client and local server route implementations, read without
credentials/customer records. No device connection, live support action, TV command,
service change or production deployment.

## Fixed in this candidate

`src/support.ts` copied entire nested TV/app/package objects before transport;
server filtering happened after the network boundary. It now uses
`src/diagnostics.ts` for upload **and** export. This preserves documented scalar
fields and bounded lists; drops raw credentials, certificates, icons, package
data/paths/URLs and unknown fields; omits credential-shaped settings; redacts
credential-shaped text/URLs; preserves deliberately shared activity/context.
The final 60,000-byte envelope limit remains. `tests/support.test.ts` checks nested
secrets, malformed inputs, short credentials, useful retained fields and UTF-8
size. Free-text filtering cannot prove the absence of every possible secret.

The current repair also enforces on-device speech in the iOS plugin, rejecting
voice input if local recognition is unavailable, and adds seven-day pruning of
local events, pending results and problem text. The clear-local-diagnostics
control stops sharing and removes the phone copy. It does not erase the server
report. Retention tests reject expired, future and non-finite timestamps. These
source changes need the new native build; they are not claims about the old IPA.

The reviewed source privacy manifest now declares account/profile name, email,
user/installation IDs, interaction/search data, support content and diagnostics,
all linked to the account for app functionality. On-device audio is not uploaded
by this client. `day-native-review.py` compares the actual IPA's main-app manifest
to this source and fails packaging evidence collection on a mismatch. A fresh
build must prove delivery; a source edit alone does not repair the old IPA.
Apple format reference:
https://developer.apple.com/documentation/technotes/tn3184-adding-data-collection-details-to-your-privacy-manifest .

## Findings blocking store qualification

1. **Automatic account inventory.** `support.ts:accessGate` sends installation,
   platform, version and build on foreground checks. `main.ts` refreshes access
   periodically. Server `homeRemoteAccess.ts:registerRemoteClient` associates
   account/email/profile and first/last-seen times. It is separate from support
   consent. App Fair must assess its custom-telemetry prohibition.
2. **Subscription coupling.** The remote server route calls `AccountService.session`
   before access/catalog/support. Its authenticator checks subscription expiry and
   can return 402. Thus media subscription state can gate remote app features.
   App Fair prohibits subscriptions to unlock app features. No account policy was
   bypassed or silently changed in this review.
3. **Retention/erasure.** `homeRemoteSupport.ts:saveReport` stores account-linked
   diagnosis; close marks inactive. `db.ts:kvWrite` uses SET without expiry. No
   deletion route or retention scheduler for remote inventory/reports was found
   in the reviewed implementation. Presence expiry is not erasure. Deployed logs,
   storage region and backup retention remain unverified.
4. **Cloud execution boundary.** `updates.ts` checks manifest hashes/compatibility,
   not an independent signature. `mount.ts` permits scripts and same-origin. That
   iframe is not a security isolation boundary. Eligibility remains unresolved.
5. **Speech/external services.** Both native hosts now require on-device speech in this candidate. Android uses `createOnDeviceSpeechRecognizer` on API 31+, checks availability, requests microphone permission only for voice input, cancels/destroys recognition after 20 seconds or destruction, and rejects unavailable recognition instead of using a generic provider. This source repair still needs a matching native build and real-device speech acceptance. Search, artwork,
   selected package hosts, account presence and exports require accurate processor
   and store data disclosures. The policy now describes those actual paths.

The actual unsigned IPA from source `ec9ba1f1d59ba3fa013789d22f4a7d7850485d96`,
CI `40105116949`, was inspected after checking its artifact ZIP against GitHub's
SHA-256 digest and CRC. IPA SHA-256:
`968c923f35b882b8ced6e03183d04f2340f69e89cdb6357855b7ad283782efb8`.
Its main manifest matches the source byte-for-byte (SHA-256
`1f5ef577e97adb3b72e91f86d8e0d71c722149e3227c965205a239196739d236`),
including all nine collected-data types, linked for app functionality. It declares
UserDefaults/file-timestamp reasons, no tracking domains and
`NSPrivacyTracking=false`. This repairs the previous `0074d4b6…cfab54` package's
missing collected-data declarations; it does not resolve the service behavior or
store review findings above. The package was not installed or signed for a user.

The source audit is completed; release privacy approval is blocked. Resolving these
gates needs actual service/privacy behavior and App Fair review. Wording changes or
passing builds cannot close them. See `../PRIVACY.md` for the candid disclosure.
