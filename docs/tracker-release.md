# Tracker 0.5 release and field test

## Release status

0.5 replaces the debug build with a dedicated RSA-3072 release certificate, disables debugging and separates future development installs with a `.debug` application ID suffix. The website download checksum and public certificate fingerprint are in `public/downloads/tracker-release.json`. No private signing material is committed.

**Release gate:** preserve the signing keystore and password in an approved durable secret store before merging/distributing this version. The initial attempt to back them up to Railway shared variables was blocked by automatic approval review and requires the owner's explicit approval. The generated key currently exists only in the build workspace. Do not generate a different key for the next update.

Release signing improves the distribution build; it does not certify that Android will accept it or establish full field reliability. No physical-device installation, screen-lock or battery test has been completed for 0.5.

## Install on the test phone

1. If a version up to 0.4 is installed, connect to data and confirm its last upload. Deactivate tracking while online. Uninstall only after pending readings have uploaded: uninstalling removes local queued data. Existing server history remains.
2. Download the 0.5 APK from the Aim4price installation link. Android cannot update the old debug app with the new release signature; this one-time fresh install is required.
3. If Android asks to allow this browser to install an app, review and grant that per-source permission. If it reports a harmful-app/Play Protect block, keep protections enabled and send the exact warning, phone model and Android version for diagnosis. Release signing cannot bypass that decision.
4. Generate a new pairing code in Tracking device; scan or enter it. Tap Connect, then Activate. Grant precise location and notifications. In Phone settings, set battery use to unrestricted.
5. Go outdoors and confirm GPS received and Last upload timestamps. Confirm the desktop shows that asset's new capture time. A connection alone is not evidence of a GPS fix.

After a reboot or force stop, reopen Tracker and Activate. Automatic unattended restart is not implemented. A foreground notification remains visible during tracking.

## Tomorrow's acceptance test

- Walk or drive a known 15–20 minute route with the phone locked. Verify captured dots, plausible distance and timestamps in Location history → Movement.
- Stop for 20 minutes, then move again. Verify the stationary section and restart; stopped means position unchanged, not engine off.
- Disable mobile data for 10 minutes, move, reconnect and allow five minutes for retry. Confirm the original capture timestamps appear without duplicate records.
- Deactivate and verify recording stops. Restart the phone, reopen and Activate; verify a new tracking session.
- Download the chosen period's PDF and Excel report. Check route, gaps, dots and totals against the map.
- Record battery and mobile-data usage over a full working day. One-minute GPS is a target, not an exact guarantee.

Do not call the tracker ready for unattended fleet use until these tests pass on the actual handset. Storage retention and performance at fleet scale remain separate rollout work.

## Future signed builds

Use JDK 17, SDK/build-tools 35 and Gradle 8.9. Restore the original keystore from the approved secret store into a private file outside the repository. Set `TRACKER_KEYSTORE`, `TRACKER_STORE_PASSWORD`, `TRACKER_KEY_ALIAS` and `TRACKER_KEY_PASSWORD` in the build environment, never in source or command logs. The key alias is `aim4price-tracker`.

Run `bash android/tracker/scripts/build-release.sh`. It fails closed if release credentials are missing. Increase versionCode/versionName for every update; sign with the same key. Copy the signed release APK to the new versioned website path and all supported aliases, update `TRACKER_INSTALL_URL` and the JSON release checksum/version, retaining the existing public certificate fingerprint. Run `python3 android/tracker/scripts/verify-release.py` with `ANDROID_HOME` set. Do not distribute the debug CI artifact.
