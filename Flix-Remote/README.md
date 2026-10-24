# FLIX Remote — Day migration candidate

This is an experimental Day 0.6.0 host for the original FLIX single-page remote.
It is not an approved App Fair app or an installed replacement for the Capacitor release.

The editable UI is `local_apps/flix-s/tools/tv-remote.html` in the private parent workspace.
A sanitized, hash-checked snapshot is included at `../src/remote-page/source.html` for standalone builds.
Edit the canonical page once; `npm run build` in the parent directory stages the same Vite output
for Capacitor and Day. Do not maintain a second remote page here.

Day owns the application lifecycle and renders one custom Piece. UIKit embeds the existing
Capacitor bridge controller; Android embeds a Capacitor Fragment inside Day's Activity.
The three original native plugins and four standard Capacitor plugins remain source inputs.
The web target embeds the same page but does not gain native LAN/ADB abilities in a browser.

The existing HTTPS `bridge-1` UI channel, compatibility checks, per-file SHA256 checks and
cached rollback remain in the page bundle. Compatible UI updates need no cable; native plugin
or permission changes still need a newly signed app. Hash checks do not replace store approval
or constitute a detached developer signature.

## Reproduce

At the parent: `npm ci`, `npm run build`, `npm run typecheck`, `npm test`.
Go 1.25.x is required; set `FLIX_GO` to the executable if it is not on PATH.
Then in this directory: `cargo fmt --all -- --check`, `cargo test`,
`cargo clippy --all-targets -- -D warnings`, `day lint --strict`,
`day build -t web-dom`, `day build -t android-mdc`, `day build -t ios-uikit`.
iOS builds require Apple's supported Xcode host. Day's generated native projects are checked
in intentionally; derived UI, adapted dependency sources and build outputs are ignored.
`scripts/stage-day.mjs` in the parent records exact input hashes. The Android build adapts
the generated DayActivity superclass to AppCompatActivity (a FragmentActivity subclass)
and records before/after hashes under build/bridge; Capacitor and Cordova sources stay unmodified.

## Review boundaries

Do not use the smoke dayscript as evidence of discovery, pairing, installation or TV control.
Feature tests use isolated fixtures; no household television or video server is contacted.
See `../DAY_MIGRATION.md` for status, unresolved native qualification and App Fair gates,
and `PRIVACY.md` for networking and optional diagnostics.
