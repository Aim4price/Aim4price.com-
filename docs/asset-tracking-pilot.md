# Aim4price Tracker

This Android app pairs one equipment phone to one asset. It adds a Movement tab to the existing Location history dialog; the Asset Map layout stays intact. No Play Store listing or Traccar subscription is required.

## Install and pair

1. On the equipment phone, download `/downloads/aim4price-tracker-pilot.apk` from Aim4price. Allow installation from your browser when Android asks. Version 0.5 is a non-debuggable release signed with the dedicated Aim4price certificate. Signing does not guarantee Play Protect approval. If Android reports the app as harmful or blocks it, capture the exact message for investigation; do not turn off Play Protect. See [release instructions](tracker-release.md) before replacing versions 0.4 or earlier.
2. In the desktop Asset Register, open the asset → Advanced settings → Update location → Tracking device → Create pairing code.
3. Enter that code in the Android app within 15 minutes. Pairing a replacement revokes the old device automatically.
4. Tap Activate. Grant precise location and notification access, enable GPS, and set the app's battery usage to unrestricted in Android settings. Keep the phone on the equipment.
5. Open Asset Map → select the asset → Location history → Movement. Choose Today, Yesterday, Last 7 days or custom dates (up to 31 days), then Download report → PDF or Excel. PDF opens the standard print window; choose Save as PDF. It includes the route, recorded dots, start/end and observed stops. Excel contains summary, readings and stops sheets.

The phone shows its asset, Activate/Deactivate and a small status. The Android tracking notification remains visible. After a phone reboot, open the app and tap Activate; the pilot posts a reminder but does not silently restart tracking. A force-stopped app also needs to be reopened.

The setup panel confirms phone pairing separately from the first received location. It shows last contact and location capture time; View movement opens the asset’s Movement tab. Pairing codes have a copy button and expiry countdown. Replace/disconnect actions are under Manage device.

## Sampling, data and battery

- Request a GPS reading each minute. GPS/Android may deliver later; this is a target, not a timing guarantee.
- Save at most one good fix per minute while moving. Ignore fixes older than two minutes or with reported accuracy worse than 50 metres.
- After 15 minutes without movement beyond the accuracy threshold, record Stopped and save a stationary point every ten minutes. GPS continues to be checked each minute to detect movement; reduced storage is not a promise of proportionally reduced battery consumption.
- Upload in batches approximately every two minutes while moving, plus a five-minute heartbeat/retry. The desktop refresh is separate; locations are timestamped, not labelled instantaneous.
- One minute halves the maximum daily count from 2,880 to 1,440 points. An eight-hour moving day plus sixteen stationary hours is approximately 576 points, plus transition readings.
- Native SQLite holds up to 43,200 pending points. At capacity recording stops with an explicit message. The server accepts captures up to 30 days old. For a pilot, reconnect well before that period; older queued records require recovery rather than silent deletion.
- No photos, maps or other asset records are sent by the phone. Actual mobile-data and power-bank use must be measured on the selected handset.

## Meaning of reports

Distance and speed are GPS estimates from positions and capture timestamps. Stationary jitter is filtered; poor fixes, implausible jumps, sessions and missing intervals are not joined. Routes are straight segments between observations, so tight field turns between one-minute points may be missed and distance underestimated. Moving time is not engine hours or productive work time. Overall speed uses observed moving plus stationary time. Unobserved time covers gaps between available readings, not time before the first or after the last fix.

Dates are interpreted in Africa/Johannesburg. Reports are capped at 31 calendar days and 50,000 points, with an explicit shorter-period error rather than silent truncation. The map displays at most 5,000 individual dots at once, while route lines and exported readings retain the full selected data.

Existing saved GPS observations remain separate. Latest valid phone positions update the map response without writing fake QR-scan events. Current-location reports also use the latest phone position where it is newer than the saved observation. The old scan timestamp remains a scan timestamp.

## Backend and security

`asset_tracking_devices` stores short-lived one-use pairing code hashes, random hashed device credentials, owner/asset assignments and connection status. `asset_tracking_points` stores readings separately from scans. Tables/indexes are created additively by `ensureTrackingTables`; no new Railway environment variables or services are required.

Owner endpoints use the existing session, active account access and asset ownership checks. Browser mutations require a trusted Origin. Device credentials can upload only to their assigned asset, cannot read asset records, and are rejected after revocation or ownership transfer. Pair codes contain 64 random bits and expire in 15 minutes. Uploads are capped at 64 KiB / 120 points and 40 requests per device per minute; uniqueness limits persisted data to one sample per device per UTC minute. Retry acknowledgements prevent duplicate points. Device tokens are never returned to owner listing endpoints or written to logs.

Pilot storage is retained until the asset is deleted (foreign-key cascades). Do not roll this out broadly without selecting a retention/archive policy and measuring PostgreSQL growth and query performance. No automatic historical deletion has been enabled.

## Build and update

Requires JDK 17, Android SDK 35, build-tools 35 and Gradle 8.9:

```sh
gradle -p android/tracker :app:assembleDebug :app:lintDebug
```

The **Asset tracking** workflow builds a development APK with a separate application ID and verifies the website APK against the release certificate, version, checksum and non-debuggable flag. CI debug artifacts must never replace the website download. Follow [release instructions](tracker-release.md) to build and sign website updates.

## Field acceptance test

Use one farm-owned phone and test a known route with screen locked, a 20-minute stop and resumed movement. Check stationary distance stays near zero. Disconnect mobile data, drive, restore connectivity and confirm capture times and route order. Repeat an upload, deactivate, revoke and re-pair. Check that the old device stops uploading. Swap power banks and restart the phone (then Activate). Measure a full day's data and battery usage before buying more equipment.

Validated automatically: TypeScript, route maths, database-backed pairing/ingestion/revocation tests and Android compilation/lint. Physical-phone, heat, radio-coverage and battery-runtime validation are separate field tests.

### Pairing QR (tracker 0.2)

The pairing card now shows a QR code. Scan with the Android phone camera, tap **Open Tracker**, then **Connect** and **Activate**. Manual code entry remains available. The QR opens `/tracker/pair` with the short-lived code in the URL fragment, which is removed from the address bar after reading. It never connects or activates without the user tapping the app controls. Expiration and one-time use remain enforced by the pairing API.

The bundled APK is updated to version code 2 and was verified with the same signing certificate as the previous bundled build, so existing installations can update in place. Older app versions can still pair by entering the code manually.

### Live verification and tracker 0.3 — 18 October 2026

Fixed two end-to-end failures missed by earlier component fixtures: generated pairing codes contain hyphens, and the Android client used the apex hostname (HTTP 405 for pairing) instead of the working `https://www.aim4price.com` API. QR normalization now accepts the actual server format.

A temporary Railway job ran `scripts/verify-tracker-live.ts` against production PostgreSQL and the public HTTPS endpoints with a uniquely scoped test asset. Verified generated code/QR, one-time pairing, 24 saved readings, retry deduplication, latest map position, route/stop report data, revoked credentials and expired codes. All passed at 2026-10-18T17:15:47Z. Test records and the temporary service were removed. These were synthetic readings, not a physical GPS drive test.

The 0.3 APK uses the same signing identity and package for in-place installation. The versioned download avoids confusion with cached older files; old download links also receive the current binary. Android installation still requires opening the downloaded APK and approving Update. The app has a branded layout, persistent pairing errors, version label and immediate first-fix upload. A real phone's locked-screen/background GPS behavior still needs physical validation.
