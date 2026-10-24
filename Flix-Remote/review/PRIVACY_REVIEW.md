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
5. **Speech/external services.** Speech is not forced on-device. Search, artwork,
   selected package hosts, account presence and exports require accurate processor
   and store data disclosures. The policy now describes those actual paths.

The source audit is completed; release privacy approval is blocked. Resolving these
gates needs actual service/privacy behavior and App Fair review. Wording changes or
passing builds cannot close them. See `../PRIVACY.md` for the candid disclosure.
