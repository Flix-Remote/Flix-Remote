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
Cargo/npm graph. **Release approval remains blocked** on the final native graph,
Maven reproduction, LGPL/store compatibility and rights for submitted content.
Neither SPDX metadata nor passing App Fair lint closes these obligations.
