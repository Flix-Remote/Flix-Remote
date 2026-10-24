# Dependency and publication review

This directory records review inputs. It is not an approval or a reproducible-build certificate.

`dependencies.json` records exact Cargo/npm identities, declared license fields and
hashes of the collected upstream license documents. `LICENSE_REVIEW.md` records
the remaining native reproduction/store obligations. `PRIVACY_REVIEW.md` and
`../PRIVACY.md` disclose actual data paths and the repaired client transport boundary.
`release-gates.json` intentionally blocks publication independently of a green CI.
Regenerate from `cargo metadata --all-features --format-version 1 --locked` saved as
`../evidence/day-cargo-metadata.json`, then run `python scripts/day-dependency-inventory.py`
from the client repository root. No local absolute source paths are included in the output.

Native dependencies also include Capacitor SwiftPM 8.5.3, four Capacitor plugins from
the npm lockfile, ADBCore from `h33h/iadb-ios` revision
`22902f6231c413f2d90accee68f0e59f1c9ea360`, and the Gradle dependencies in `Cargo.toml`
and `scripts/stage-day.mjs`. Their full resolved graphs must be retained from successful
native SDK builds. A Maven source JAR alone does not prove binary reproducibility.

The Android build mirrors the resolved Day Java shim and changes only DayActivity's
superclass to AppCompatActivity (itself a FragmentActivity), preserving Cordova's API.
The app Gradle script verifies and records before/after hashes; the original Cargo
and npm sources remain unchanged. The modified Day file retains MPL-2.0. See `public/THIRD_PARTY_NOTICES.txt` and bundled
license texts for notices. Compatibility and reproduction review remains open.

App Fair must also review the custom Day/native bridge, cloud JavaScript updates,
account integration, package library and user-requested diagnostics. No analytics
SDK is intentionally added by this migration. This statement does not replace a
full review of existing code and transitive dependencies.
