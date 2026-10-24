# FLIX Remote privacy disclosure — source review, 24 October 2026

Maintainer contact: pro_1415@outlook.com. This describes the reviewed candidate
source, not a verified deployed storage configuration or store approval. No
customer's records were accessed for this review.

## Connections and data

| Feature / destination | Data and trigger | Storage / control |
| --- | --- | --- |
| Direct local discovery and TV protocols | LAN names, IPs, ports, model/OS, capabilities; discovery or reconnect. Compatible TVs may return installed apps, settings and activity/title. | Device lists, packages and receipts are stored locally. Pairing requires target approval. LAN traffic may use HTTP/WebSocket where required by its TV protocol. No Internet relay is required for TV transport. |
| FLIX account service, normally `flix-admin-tan.vercel.app` over HTTPS | Login email/password; later bearer session, installation UUID, platform, app/build version, selected profile and first/last-seen times. Server associates account ID/email. Foreground access checks occur about every 30 seconds, independently of diagnostic sharing. | Inventory enables owner access controls. Login passwords are sent to the service, not saved as a phone password. Remote features currently require FLIX authentication; the access API also applies the media subscription check. |
| Optional operator support, same account origin | After starting sharing: account association, report/installation IDs, problem text, LAN addresses and available activity titles, app names/IDs, setting values, package identities/hashes, receipts and redacted errors. | Client and server allowlists limit nested fields; the client envelope is bounded to 60,000 UTF-8 bytes. Redaction is best effort: do not type passwords into problem text. Stop/background revokes the control grant. Server presence expires after 90 seconds; this is **not deletion**. |
| Support actions | Commands/outcomes associated with the report. Temporary control is restricted to one TV and 15 minutes; automatic actions must match the grant and be fresh. Pairing/installation retains per-action confirmation. | Result IDs are persisted to prevent replay. Closing the app does not create permanent unattended control. |
| Compatible UI updates, `flix-admin-tan.vercel.app` | Foreground HTTPS manifest checks, then versioned HTML/JS/assets; server receives network metadata such as IP. | Cached bytes are checked against SHA-256, length and bridge version. Hashes detect mismatch with the manifest, not independent publisher authenticity. Downloaded code executes in the app web context. The same-origin iframe is not an isolation guarantee. |
| Media search/catalog and artwork | Search text/catalog requests go to `flix-s-neon.vercel.app`. The original page also links S (`flix-s-phi.vercel.app`), F (`flix-s-neon.vercel.app`) and IPTV (`flix-iptv-snowy.vercel.app`). Artwork may come from `image.tmdb.org`. | These hosts receive query/path and network metadata. Their retention is outside this client's verified scope. The source MIT license grants no artwork/media rights. |
| Package library and downloads | Authenticated catalog queries; user-selected HTTPS URLs supplied by the catalog, potentially external hosts. | Byte length/hash verified. Other applications have separate licenses and privacy terms. iOS/Android/LG/Samsung packages are not interchangeable. |
| Voice control | Microphone/speech permission for requested voice input. Apple Speech or Android speech provider may process audio; on-device-only recognition is not enforced. | The app does not intentionally send microphone audio to FLIX support. OS/provider terms and device settings apply. |

## Local storage and deletion limits

iOS sessions and TV/ADB secrets use Keychain with `WhenUnlockedThisDeviceOnly`.
Android uses AndroidKeyStore AES-GCM and private preferences. Other state uses
Capacitor Preferences/app files; browser sessions use sessionStorage. Error events
are limited to 80, resolved action IDs to 200 and pending results to 100. These are
count limits, not timed deletion. Local package files persist until removed.

Signing out clears the saved account session/client support state and requests
server logout. It does not erase server inventory/reports/conversations/results.
Forgetting TV state clears saved TV data; the phone's ADB identity is intentionally
retained. Do not assume uninstall clears iOS Keychain. Exported/shared files remain
with their recipients.

The reviewed remote backend stores JSON without expiration; closing a report sets
`active=false`. No automatic retention or user-facing remote-data erasure route was
found. Deletion requests may be sent to the maintainer contact; no deadline or
completed deletion is promised by this source review. Hosting supports a configured
house store, Upstash and Vercel Blob. The deployed provider, region, backups and
processor retention were not inspected through credentials.

## Publication status

No advertising SDK was intentionally added. **Do not claim zero data collection
or App Fair privacy compliance.** Account-linked presence is automatic; optional
diagnostics can include activity. Their eligibility, the subscription gate, cloud
executable updates, retention/erasure and processor disclosures remain publication
blockers. Store data labels and required-reason API declarations must match the
approved binary/services. Tracking=false in `PrivacyInfo.xcprivacy` alone does not
prove that no data is collected.

Evidence: `review/PRIVACY_REVIEW.md` and `review/RELEASE_REVIEW.md`. This candidate
disclosure does not claim the blocked production/privacy work has been completed.
