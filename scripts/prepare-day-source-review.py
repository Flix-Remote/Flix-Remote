"""Build a source-only, validated standalone Day candidate; no publication or device calls."""
from pathlib import Path
import hashlib, importlib.util, json, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'releases/day-source-review-20261024'

def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

def main():
    source = module('ios_sources', 'stage-ios-cloud.py')
    checks = module('packet_checks', 'prepare-sponsor-packet.py')
    files = {f.relative_to(ROOT).as_posix(): f.read_bytes() for f in source.source_files(ROOT)}
    # Only this workflow is used for the experimental branch, never the old IPA workflow.
    files = {n: b for n, b in files.items() if not n.startswith('.github/workflows/') and n != 'src/build-info.ts'}
    # These two tests belong to the private browser-server checkout, not the phone client.
    # Keep their full-workspace checks intact; never replace them with copied mock server code.
    server_tests = {'browser-packages.test.ts', 'remote-background.test.ts'}
    # Only isolated client tests; live household/device scripts are not exported or run.
    for f in (ROOT / 'tests').glob('*.test.ts'):
        if f.name in server_tests: continue
        files[f.relative_to(ROOT).as_posix()] = f.read_bytes()
    for f in (ROOT / 'tests/fixtures').rglob('*'):
        if f.is_file(): files[f.relative_to(ROOT).as_posix()] = f.read_bytes()
    for name in ['tests/native-fixture.ts', 'tests/startup-page.ts', 'tests/original-page.ts', 'scripts/stage-day.mjs', 'scripts/verify-day-web.mjs', 'scripts/prepare-day-source-review.py', 'scripts/day-dependency-inventory.py', 'scripts/day-native-review.py', 'DAY_MIGRATION.md', '.github/workflows/day.yml']:
        files[name] = (ROOT / name).read_bytes()
    exclude = {'build', 'target', '.day', '.git'}
    generated = {'platform/ios/bridge/HomeDiscoveryPlugin.swift', 'platform/ios/Runner/PrivacyInfo.xcprivacy',
                 'platform/android/res/xml/file_paths.xml', 'resource/assets/capacitor.config.json'}
    for f in (ROOT / 'Flix-Remote').rglob('*'):
        rel = f.relative_to(ROOT / 'Flix-Remote')
        if not f.is_file() or any(p in exclude for p in rel.parts): continue
        if rel.as_posix() in generated or rel.as_posix().startswith('resource/assets/public/'): continue
        if f.is_symlink(): raise ValueError('Source symlink rejected')
        files['Flix-Remote/' + rel.as_posix()] = f.read_bytes()
    files['LICENSE'] = (ROOT / 'sponsorship/2026-10-24/assets/LICENSE-MIT.txt').read_bytes()
    for n, b in files.items(): checks.validate_member(n, b)
    if OUT.exists():
        # Rebuilding the candidate is explicit; refuse replacing a non-matching owned export.
        marker = OUT / 'SOURCE_MANIFEST.json'
        if not marker.exists(): raise FileExistsError(OUT)
    app = OUT / 'app'
    app.mkdir(parents=True, exist_ok=True)
    manifest = []
    for n, b in sorted(files.items()):
        p = app / n; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(b)
        manifest.append({'path': n, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
    metadata = {'files': manifest, 'selection': 'existing client allowlist plus Day project; no build artifacts or server account data',
                'workspace_only_tests': sorted(server_tests),
                'secret_scan': 'filename rules and four high-confidence patterns; not a complete audit',
                'tv_connections': 0, 'video_server_changes': 0, 'paid_enrollments': 0}
    (OUT / 'SOURCE_MANIFEST.json').write_text(json.dumps(metadata, indent=2) + '\n')
    archive = ROOT / 'releases/flix-remote-day-source-review-20261024.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
        for n,b in sorted(files.items()): z.writestr(n,b)
    with zipfile.ZipFile(archive) as z: assert z.testzip() is None
    print(json.dumps({'files':len(files),'bytes':archive.stat().st_size,
          'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'archive':str(archive)}))

if __name__ == '__main__': main()
