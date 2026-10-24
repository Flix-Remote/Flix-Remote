# Release qualification — 2026-10-24

Status: **candidate only; not approved for publication or family installation**.
`release-gates.json` lists unresolved gates independently of build/test success.
No App Store/TestFlight URL or permanently signed package has been produced.

The previous exact source commit `39abbbd28048b232c2965fce851bc6d516a7a0d8`
passed CI run `40091187000`: Android 16 medium-phone emulator 4/4 and iOS 27.1
iPhone simulator 4/4, with original remote page and native bridge enabled. Those
results qualify that source only. They do not cover this revision's privacy fix.
iOS used an in-process screenshot after full-device simctl screenshot failed.

This candidate adds client diagnostic filtering and license notices. CI now
requests Arabic/English, light/dark and phone/tablet profiles on both platforms,
retaining strict failures and resolved native dependency evidence. The original
page is Arabic; an English test locale does not prove a translated original page.
The walkthrough proves unauthenticated page rendering/native bridge readiness,
not login, pairing, package installation, permissions, TV compatibility or receipt
of the UI update on a real phone.

All tests must use isolated fixtures/simulators. The owner's TV, phone, home
discovery and video services are excluded. Package signing, App Fair review,
tagged pre-release, required Day Pages and catalog submission remain separate
gates. Do not publish a release or assert a family install link from a green build.

App Fair discussion: https://github.com/orgs/appfair/discussions/7 . The live check
on 24 October found one participant (the maintainer), the existing self-authored
follow-up, zero replies and no acceptance. Connected Outlook search found no mail
from contact@appfair.org. Automated GitHub notifications are not an App Fair reply.

Current criteria: https://appfair.org/docs/inclusion-criteria/ . Public source and
Publisher installation are necessary inputs, not distribution approval.
