#!/usr/bin/env python3
"""Verify the exact APK distributed by the website, without private signing keys."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
manifest = json.loads((root / 'public/downloads/tracker-release.json').read_text())
sdk = Path(os.environ.get('ANDROID_HOME') or os.environ['ANDROID_SDK_ROOT'])
bin_dir = sdk / 'build-tools/35.0.0'
apk = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'public/downloads' / manifest['file']
cert = subprocess.check_output([str(bin_dir / 'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)], text=True)
expected = 'Signer #1 certificate SHA-256 digest: ' + manifest['certificateSha256']
assert expected in cert, 'APK signer does not match the permanent release certificate'
assert 'Android Debug' not in cert, 'Debug certificate cannot be distributed'
info = subprocess.check_output([str(bin_dir / 'aapt'), 'dump', 'badging', str(apk)], text=True)
assert "name='com.aim4price.tracker.pilot'" in info, 'Wrong application ID'
assert "versionCode='%s'" % manifest['versionCode'] in info, 'Wrong version code'
assert "versionName='%s'" % manifest['version'] in info, 'Wrong version name'
assert 'application-debuggable' not in info, 'Debug APK cannot be distributed'
assert hashlib.sha256(apk.read_bytes()).hexdigest() == manifest['sha256'], 'Download checksum mismatch'
if len(sys.argv) == 1:
    for name in manifest['aliases']:
        assert (root / 'public/downloads' / name).read_bytes() == apk.read_bytes(), 'Stale download: ' + name
print('PASS: release signature, version, package, non-debuggable flag and download checksums')
