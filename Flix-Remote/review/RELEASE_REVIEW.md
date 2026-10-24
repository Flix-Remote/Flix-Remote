# Release qualification — 2026-10-24

Status: **candidate only; no store approval or family install URL**.
Build success is separate from every gate in `release-gates.json`.

## Current candidate

Runtime source: `bc5ba23c018c55b4272e0c1d46fd7b1e95e44c9c`, tree
`65136edf515ba6a2f9a01a42689ee22f23f1eac3`.
The organization branch `08525dd3d865d6297320e32e17947c4fb1ce9a91` has the
identical tree (GitHub API comparison). Source CI:
https://github.com/Ahmedzx054/flix-home-remote/actions/runs/40095957553 .
Lint, Rust preflight, web and Android builds passed. Both native packages were
produced. The downloaded matrix contains 20 cases: **19/20 latest attempts pass,
15/20 first attempts pass, six failed attempts are retained**. iPhone light fails
native readiness on both attempts. This candidate is **not qualified**.
`native/MATRIX_SUMMARY.json` preserves every attempt, failure and report hash.

| Profile | First attempt | Latest attempt | Failed attempts |
| --- | --- | --- | --- |
| Web DOM | 4/4 | 4/4 | 0 |
| Android phone | 1/4 | 4/4 | 3 |
| Android tablet | 4/4 | 4/4 | 0 |
| iPad | 3/4 | 4/4 | 1 |
| iPhone | 3/4 | 3/4 | 2 |

Android phone light-ar fails `native enabled false`; light/dark-ar initially fail
the screenshot render checkpoint. iPad light fails native enabled on its first
attempt and passes the runner's retry. iPhone light fails native enabled twice.
The Day runner's built-in retries are not evidence of a clean matrix. The native
probe still requires actual original iframe layout; it was not weakened. Inspection
found a five-second assertion budget versus a native page probe that can wait up
to 30 seconds, but timing alone does not prove the root cause. No sleep, assertion
removal, threshold reduction or rerun-until-green was used to qualify this result.

This candidate filters nested diagnosis before upload/export, collects locked
license notices, repairs strict resolved-Gradle evidence collection and renders
the bundled original page before cloud traffic. Updates start after native
initialization and retain existing interaction/dialog guards and account policy.

Local types/build and 57 unit tests passed. A held-cloud fixture proves the original
page renders while the manifest request is pending (2 checks). The original-page
fixture passed 12 checks: layout, simulated pairing/control/apps, verified local
package download, profiles and support. The fixture was corrected to return the
existing profiles/status contract and follow the actual account -> help UI. Its
earlier timeout was retained in local evidence; no account requirement was removed.
These fixtures do not exercise household devices or production account records.
The exported standalone source passed its own typecheck/build and 52 tests using
the explicit bundled Go path. The private-workspace-only server tests are excluded
from that standalone source rather than replaced with dummy server implementations.

## Current package and visual evidence

The 13 GitHub artifact ZIP digests were checked before extraction. APK, AAB and
unsigned IPA hashes match their buildinfo; `native/NATIVE_SUMMARY.json` records:
- APK: `87159a763ff9b13697230f4159f489aaba1dfff98344f1e775a2f3fb690173c5`.
- AAB: `e657b7c028b76aac8399d7982893a5c19388c339745ea0a8012fc5fa44883cd1`.
- IPA: `0074d4b640efe5ba323c7416d6903f5d52435d02440fb78c8b433b5fa2cfab54`.

The IPA is 0.6.0/build 1, iOS 17 minimum, with no embedded provisioning profile.
It is not a signed family install package. SwiftPM pins, 79 external Maven files
and an 88-node resolved graph were collected, not reproduced or license-approved.

Representative actual iPhone/iPad/Android screenshots were inspected: the original
FLIX page or its login modal renders. iPhone has an in-app capture, not a full-device
simctl capture. Current web automatic images show the original page; the actual
web distribution also renders at 390 and 1280 widths with external HTTPS/WebSockets
blocked and no page errors. English/light test variants still show the Arabic/dark
original page; no translation/theme completeness is claimed.

## Previous revision: evidence and failures

Source `922daad7554575b24ed88a9ca07bc3e8417a3055`, CI `40094773836`:
- Android phone built/packed, then failed the dependency-evidence task because
  local Gradle projects exposed ambiguous secondary artifacts. The new task strictly
  hashes external Maven files and retains local projects in the complete graph.
- Android tablet and iPad failed native layout readiness in one locale/theme case.
  Delayed cloud startup was repaired, but only the new matrix can establish recovery.
- Web reported 4/4; its automatic screenshots captured the preview/blank surface
  prematurely. Those screenshots do not qualify the original UI. Separately, the
  actual CI web distribution rendered the original controls at 390 and 1280 widths,
  with outbound HTTPS/WebSockets blocked and no script errors.
- An unsigned iOS package and native dependency review were collected. IPA SHA-256:
  `32cdeba600b1df3c992636150245c92e46f409505ecc712179be339b1df6f8a8`.
  SwiftPM lock SHA-256:
  `9cd23c0533f728a69e91fffd2b8dedbd15c5570187362e982c93e8b163e2a9ae`.
  These are revision-specific evidence, not signed distribution or reproduction proof.

Earlier CI `40091187000` qualified phone-only source `39abbbd28048b232c2965fce851bc6d516a7a0d8`.
It does not cover the new privacy fix, tablet profiles or current release.

## Acceptance boundaries

The new matrix requests ar/en, light/dark, phone/tablet on both native platforms.
An English test locale does not translate the Arabic original page. The native
walkthrough checks rendering/bridge readiness, not login, pairing, permissions,
TV installation, physical compatibility or cloud-update receipt on a real phone.
Rust preflight defines zero Rust tests; a green cargo test is not behavioral coverage.

All tests use isolated fixtures/simulators. No owner's phone, TV, LAN discovery,
video service, signing account, payment or deployment was exercised. Signing,
App Fair eligibility, required Pages, tagged pre-release and catalog submission
remain separate gates. Never convert a green build into an asserted install URL.

App Fair discussion: https://github.com/orgs/appfair/discussions/7 . The checked
thread had one participant, our existing follow-up, zero replies and no acceptance.
Connected Outlook searches found only our sent requests and automated GitHub mail,
not an App Fair maintainer reply. Publisher installation is not approval.
Criteria: https://appfair.org/docs/inclusion-criteria/ .
