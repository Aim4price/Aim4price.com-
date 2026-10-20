"""Temporary release job. Only the verified public APK is emitted; never secrets."""
import base64, hashlib, json, os, pathlib, subprocess, tempfile, time
root = pathlib.Path('/build')
os.umask(0o077)
with tempfile.TemporaryDirectory() as folder:
    key = pathlib.Path(folder) / 'release.jks'
    key.write_bytes(base64.b64decode(os.environ['RELEASE_KEYSTORE_B64'], validate=True))
    env = os.environ.copy()
    env.update(TRACKER_KEYSTORE=str(key), TRACKER_STORE_PASSWORD=env['RELEASE_PASSWORD'],
               TRACKER_KEY_PASSWORD=env['RELEASE_PASSWORD'], TRACKER_KEY_ALIAS=env['RELEASE_ALIAS'])
    for name in ('RELEASE_KEYSTORE_B64','RELEASE_PASSWORD','RELEASE_ALIAS'):
        env.pop(name, None)
    result = subprocess.run(['gradle','--no-daemon','--max-workers=2','-p','android/tracker',
                             ':app:assembleRelease',':app:lintRelease','--console','plain'],
                            env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if result.returncode:
        # Keep raw build logs private because Gradle can include signing configuration in errors.
        print('RELEASE_FAILED: Gradle build or lint failed; no artifact published.', flush=True)
        raise SystemExit(1)
apk = root / 'android/tracker/app/build/outputs/apk/release/app-release.apk'
data = apk.read_bytes()
sha = hashlib.sha256(data).hexdigest()
manifest_path = root / 'public/downloads/tracker-release.json'
manifest = json.loads(manifest_path.read_text())
manifest.update(version='0.8', versionCode=8, sha256=sha)
manifest_path.write_text(json.dumps(manifest))
subprocess.run(['python3','android/tracker/scripts/verify-release.py',str(apk)],check=True)
print('RELEASE_META '+json.dumps(dict(version='0.8',versionCode=8,sha256=sha,bytes=len(data))),flush=True)
encoded=base64.b64encode(data).decode()
chunks=[encoded[i:i+3000] for i in range(0,len(encoded),3000)]
for i,chunk in enumerate(chunks):
    print(f'RELEASE_APK {i:04d}/{len(chunks):04d} {chunk}',flush=True)
    time.sleep(0.05)
print('RELEASE_COMPLETE',flush=True)
# Temporary build service is removed after artifact verification; no public port.
time.sleep(1800)
