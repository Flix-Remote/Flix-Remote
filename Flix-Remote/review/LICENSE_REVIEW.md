# Dependency and asset license review — 2026-10-24

## Collected evidence

`dependencies.json` inventories the exact locked Cargo all-feature/build-host graph
and npm runtime graph, including per-component license expressions and hashes of
actual license/notice texts. `public/licenses/day-transitive-notices.txt` bundles
those documents. Packages that omit license files from their published archive
are supplemented from the **exact** Cargo VCS or npm gitHead revision, with source
archive/document hashes in `public/licenses/upstream-index.json`. The collector
does not substitute a generic license for missing upstream copyright notices.

The LGPL spake2 2.2.1 source archive previously named in the notices was absent.
It is now included at `public/licenses/spake2-2.2.1-source.zip`, from upstream
revision `7615ddd680b990e14513ebb66eac4cb0dbf82464`, SHA-256
`7c8cf3220d9b528a21093b4cc78bd2b4616fba3c3209877d7194aa9e6c149434`.
The public 2.2.1 tag resolves to that revision. This repairs source availability;
it does not establish a reproduced Maven binary or LGPL compliance in a store.

MIT on FLIX code does not replace dependencies' licenses. Cargo expressions include
MIT/Apache alternatives, MPL-2.0, Unicode-3.0, Zlib and dual-license options. Select
permissive alternatives where permitted; preserve conjunctive Unicode obligations.
Day's modified Android shim remains MPL-2.0 and source/hashes are disclosed in
`public/THIRD_PARTY_NOTICES.txt`. LGPL spake2 remains LGPL, with rebuilding/relinking
instructions. Signing/store restrictions still require compatibility review.

`scripts/day-native-review.py` and the Gradle `flixDependencyReview` task capture
the **resolved release** Android artifact coordinates, SHA-256, dependency graph,
cached POM license/source metadata, SwiftPM pins and Go module sums alongside
native build artifacts. POM claims are evidence inputs, not a compatibility verdict.
Exact Maven source revisions, build environments, reproduced outputs and matching
binary verification must be supplied before App Fair submission.

The current `ec9ba1f` build (CI `40105116949`) supplies `native/review-android-mdc.json`:
79 external Maven files with SHA-256 and POM metadata, plus the full 88-node
resolved graph. `libadb-android` calls its license "Other" and `ionfilesystem-android`
calls it "License"; those labels are not a license grant. The new candidate
repairs those two grants using exact upstream source: libadb-android 3.1.1 at
`c849886ebc6d48e7b46d967e78a6bb65c90c3b74` (Apache-2.0 alternative to GPL),
and ionfilesystem-android 1.1.1 at
`ad4c23981b63fdf60627e23a94187076997fc82b` (MIT). Their complete source ZIPs,
the actual license/copyright documents and hashes are bundled under
`public/licenses/native/`. This preserves upstream notices, including embedded
BSD/MIT documents; it does not relabel every file Apache or prove reproduction. Zero Maven files have
verified source-to-binary reproduction. `native/review-ios-uikit.json` supplies
the exact three SwiftPM pins and lock hash, alongside the six-entry Go module
lists (including the main module). CI `40105116949` establishes module and
go.mod content sums for all five downloaded locked modules on both platforms.
The resolved Android runtime records actual Gradle `9.6.1`, JDK `21.0.12.1`
(Eclipse Adoptium) and Go `1.25.0`; iOS records Go `1.27.3`.
Upstream Day buildinfo still has an empty Gradle-version field; the separate
runtime report supplies that missing measurement without rewriting buildinfo.
These inputs do not prove matching source-to-binary reproduction.
`native/NATIVE_SUMMARY.json` and the copied buildinfo files preserve this evidence;
all three APK/AAB/unsigned IPA hashes were checked against their buildinfo.

`scripts/day-maven-source-evidence.py` also resolves all 74 distinct Maven
coordinates covering those 79 measured binary files to their versioned source
JARs on Google Maven, Maven Central or the publishing JitPack repository.
All 74 downloaded JARs passed CRC and SHA-256 checks (14,319,569 bytes total).
`native/MAVEN_REPRODUCTION_WORKLIST.json` links each binary's measured hash to
the source URL/hash and POM evidence. Eighteen original embedded notice documents
are preserved verbatim in `public/licenses/native/maven-embedded-notices.txt`.
The local source JARs are evidence downloads, not additional runtime dependencies.
These source JARs do not establish exact VCS revisions or reproduced binaries:
the worklist deliberately leaves revision, build and reproduction approvals false.
This worklist and its eighteen embedded notices were collected after the measured
runtime build; the new notice asset is not claimed to be present in that IPA/APK.

## Assets and content

`public/icon.svg` and `Flix-Remote/resource/icon.svg` are identical FLIX source SVGs
covered by the owner's approved MIT source publication. The project has no bundled
font/audio/photo assets in its Day resource tree. CSS font-family names reference
device-installed fonts; they do not bundle those fonts. Day template/platform code
keeps upstream MPL notices.

The shared page can fetch TMDB artwork and link/download other FLIX applications.
No media/artwork redistribution rights or licenses for every catalog application
are inferred from this remote's MIT license. Those runtime contents and each
platform package need their own rights/notice review. Source zip validation scans
filenames and four high-confidence secret patterns; it is not a complete legal or
secret audit.

## Decision

The license source review and notice repair are complete for the inventoried
Cargo/npm graph, and the resolved native graphs have been collected. **Release
approval remains blocked** on native source/license completeness, Maven
reproduction, LGPL/store compatibility and rights for submitted content.
Neither SPDX metadata nor passing App Fair lint closes these obligations.

## Additional native repair in the current candidate

The supplement now includes the exact three SwiftPM wrapper/source repositories, the separate Capacitor implementation, and all five locked Go modules: six Git source ZIPs, fifteen real license documents, and Go-verified module and go.mod content sums. Unknown Go modules/versions fail the collector rather than inheriting an assumed license. The pinned `capacitor-swift-pm` package is explicitly a binary wrapper: its two XCFramework checksums are recorded, and the separate Capacitor implementation source is archived at 8.5.3 commit `06e3e1984337f836a4c28b2afc92faa977dea315`. Its wrapper archive is not claimed to be that implementation. Reproduction of these binary frameworks, Maven artifacts and transitive notice completeness remain gates.
