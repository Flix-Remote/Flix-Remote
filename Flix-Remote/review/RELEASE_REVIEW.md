# Release qualification — 2026-10-24

Status: **failed strict qualification; no store approval or family install URL**.
Runtime source `ec9ba1f1d59ba3fa013789d22f4a7d7850485d96`, tree
`d48662b9e2cb64a3fb903cd8d749f0d9e9ff388c`.
CI: https://github.com/Ahmedzx054/flix-home-remote/actions/runs/40105116949 .
All jobs completed; Android phone/tablet failed; store/sign/upload stages skipped.
Lint, preflight and package builds succeeded, separately from qualification.

## Strict matrix

| Profile | First attempt | Latest attempt | Failed attempts |
| --- | --- | --- | --- |
| Web DOM | 4/4 | 4/4 | 0 |
| Android phone | 2/4 | 3/4 | 3 |
| Android tablet | 3/4 | 3/4 | 2 |
| iPad | 3/4 | 4/4 | 1 |
| iPhone | 3/4 | 4/4 | 1 |

Total: **15/20 first, 18/20 latest, seven failed attempts**. No missing or
unexpected cases. Native readiness fails cold; an eventual ready probe or the
runner's successful retry does not cure a failed assertion. On iPhone light-ar,
the failed probe had zero original controls and a default 980px DOM viewport;
the original page became ready later. Android tablet probes became ready just
after their assertion deadlines. Timing does not establish a complete root cause.
No assertions, predicates, deadlines or thresholds were weakened. No rerun-until-
green or old successful run was substituted. All attempt hashes remain in
`native/MATRIX_SUMMARY.json`.

The bootstrap renders the bundled original page before dynamic protocol imports
and cloud work, while real host requests wait for initialization. This improves
startup but has **not** resolved cold native readiness. Local shared types/build
and 58 tests passed; standalone types/build and 53 tests passed. Startup fixture
5/5 and original-page fixture 12/12 passed in isolation. Fixtures are not physical
pairing, production account, installation, support or update-delivery acceptance.

## Packages and visual evidence

All 15 artifact ZIPs passed API SHA-256 and CRC verification. APK/AAB/unsigned IPA
match buildinfo (`native/NATIVE_SUMMARY.json`):
- APK: `96ad3285124fa48c2c375b33b5ae4985593b17d439541d8aefb21bac74ff21e3`.
- AAB: `2e87cad9796d90d65cfc9cb6462999790cc9c9e2bbf5fece9335b8bc54298b08`.
- IPA: `968c923f35b882b8ced6e03183d04f2340f69e89cdb6357855b7ad283782efb8`.

IPA 0.6.0/build 1 is unsigned, without an embedded provisioning profile; it is
not an install link. Its nine declared data types and privacy manifest match the
measured source. UserDefaults CA92.1 and FileTimestamp C617.1 are retained.

All 20 gallery images match their hashes; five light-ar representatives were
visually inspected. The original Arabic/dark remote renders eventually on web,
iPhone/iPad and Android phone/tablet. **iPad OK overlaps adjacent controls**;
this remains an unresolved visual issue. iPhone is an in-app capture because
simctl full-device capture failed. No completed localization/theme or physical-
device visual acceptance is claimed. See `native/VISUAL_REVIEW.json`.

## Privacy, licenses and publishing

Privacy remains blocked on automatic account-linked inventory, remote subscription
gating, verified server retention/erasure/processors and executable cloud UI review.
No account policy was bypassed and no server/production policy changed.
197 Cargo/npm dependency entries and 85 notices were collected. Six native Git
source archives and five Go modules have source/checksum evidence. 74 versioned
Maven source JARs cover 79 binary files; 18 embedded notice documents were added
after this build. They are not claimed to be present in the measured IPA/APK.
Exact native VCS/build environments and binary reproduction remain unverified:
0/79 Maven and 0/2 XCFrameworks reproduced. LGPL/store compatibility and asset
rights remain open. Source JAR availability is not legal approval.

Earlier failed runs `40102532546`, `40104009723`, `40095957553` and the rejected
retry/visual result `40100727708` are retained in local evidence. A documentation-
only follow-up does not change this measured runtime or qualify its packages.

App Fair discussion: https://github.com/orgs/appfair/discussions/7 . Publisher
installation is not acceptance or signing. Generated Pages, tagged pre-release,
catalog submission and actual App Fair/store acceptance remain separate gates.
Criteria: https://appfair.org/docs/inclusion-criteria/ .

No owner's phone, TV, LAN discovery, video service, signing account or payment was
exercised. No genuine signed family installation URL exists in this review.
