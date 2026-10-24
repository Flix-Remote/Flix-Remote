# Privacy and networking disclosure — review draft

The remote discovers and connects directly to compatible televisions on the phone's LAN.
Device names, LAN addresses, capabilities, paired credentials and application lists may be
stored on the phone. Pairing and installing a package require the target device's permission.
The app does not guarantee reading television activity or settings unsupported by its OS.
Microphone and speech recognition are used only when the voice control is requested.
Apple/Android speech services may process audio under the device's speech settings.

The existing FLIX account feature contacts FLIX account/profile APIs over HTTPS. The page
also checks a trusted FLIX HTTPS UI manifest and downloads compatible JavaScript/HTML/assets.
The package library contacts FLIX package endpoints and downloads only user-selected packages.
Optional support/diagnostics may transmit the logged-in account identity, device context and
error information after consent. Remote support commands require the existing authenticated
and consent-gated flow. These features are preserved for owner review, not represented as
already compliant with App Fair's prohibition on telemetry.

Before store submission the operator and App Fair must approve an accurate public policy
covering actual fields, retention/deletion, processors, support access and lawful package
content. No claim of zero data collection, verified retention, or App Fair approval is made.
No account passwords, signing secrets or device pairing records are included in this source.
