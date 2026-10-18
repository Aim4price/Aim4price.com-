#!/usr/bin/env bash
set -euo pipefail
: "${TRACKER_KEYSTORE:?Set the permanent release keystore path}"
: "${TRACKER_STORE_PASSWORD:?Set the release store password}"
: "${TRACKER_KEY_ALIAS:?Set the release key alias}"
: "${TRACKER_KEY_PASSWORD:?Set the release key password}"
tracker_dir="$(cd "$(dirname "$0")/.." && pwd)"
"${GRADLE_BIN:-gradle}" -p "$tracker_dir" :app:assembleRelease :app:lintRelease
printf '%s\n' "Signed build: $tracker_dir/app/build/outputs/apk/release/app-release.apk"
