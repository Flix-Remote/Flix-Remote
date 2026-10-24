"""Capture resolved native dependency evidence after packing, without devices or credentials."""
from pathlib import Path
import hashlib, json, os, plistlib, shutil, subprocess, sys, zipfile, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Flix-Remote'

def run(args, cwd):
    return subprocess.check_output(args, cwd=cwd, text=True)

def main():
    target = os.environ['DAY_PACK_TARGET']
    result = {'target': target, 'source_commit': os.environ.get('GITHUB_SHA'),
              'license_approval': False, 'binary_reproduction_verified': False,
              'physical_devices_tested': False, 'tv_connections': 0}
    source_index = ROOT / 'public/licenses/native/sources.json'
    result['additional_native_sources'] = json.loads(source_index.read_text())
    for source in result['additional_native_sources']:
        archive = source_index.parent / source['source_file']
        if hashlib.sha256(archive.read_bytes()).hexdigest() != source['sha256']:
            raise RuntimeError('Native source archive hash mismatch: ' + archive.name)
    if target == 'android-mdc':
        android = PROJECT / 'platform/android'
        wrapper = android / ('gradlew.bat' if os.name == 'nt' else 'gradlew')
        gradle = str(wrapper) if wrapper.is_file() else shutil.which('gradle')
        if not gradle: raise RuntimeError('Gradle not available; native review must not be skipped')
        # This evidence-only task inspects the live resolved Gradle model. It
        # must not reuse/serialize that model through the configuration cache.
        # Native build/pack and all qualification failures remain unchanged.
        subprocess.run([gradle, ':app:flixDependencyReview', '--no-configuration-cache', '-q', '--console=plain'], cwd=android, check=True)
        result['runtime'] = json.loads((PROJECT / 'build/bridge/native-runtime.json').read_text())
        cache = Path(os.environ.get('GRADLE_USER_HOME', str(Path.home() / '.gradle'))) / 'caches/modules-2/files-2.1'
        for artifact in result['runtime']['artifacts']:
            group, name, version = artifact['coordinate'].split(':', 2)
            pom_files = sorted((cache / group / name / version).glob('*/*.pom'))
            artifact['poms'] = []
            for pom in pom_files:
                tree = ET.fromstring(pom.read_bytes())
                ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
                get = lambda path: tree.findtext(path, '', ns)
                artifact['poms'].append({'sha256': hashlib.sha256(pom.read_bytes()).hexdigest(),
                    'licenses': [{'name': x.findtext('m:name', '', ns), 'url': x.findtext('m:url', '', ns)} for x in tree.findall('m:licenses/m:license', ns)],
                    'source_url': get('m:scm/m:url'), 'source_tag': get('m:scm/m:tag'),
                    'reproduction_verified': False})
    elif target == 'ios-uikit':
        # Day creates its default Xcode host under build/day/xcode/ios; a
        # checked-in platform/ios host is only an explicit customization.
        locks = sorted({p for base in [PROJECT / 'platform/ios', PROJECT / 'build/day/xcode/ios']
                        for p in base.rglob('Package.resolved')})
        if not locks: raise RuntimeError('Missing resolved SwiftPM graph')
        result['swiftpm'] = [{'path': p.relative_to(PROJECT).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
                              'resolved': json.loads(p.read_text())} for p in locks]
        # Check the actual packed app, not only the staged source. Store review
        # still has to assess these declarations against the running services.
        ipas = sorted((PROJECT / 'build/day/dist').glob('*.ipa'))
        if len(ipas) != 1: raise RuntimeError('Expected exactly one packed iOS IPA')
        expected = plistlib.loads((ROOT / 'ios/App/App/PrivacyInfo.xcprivacy').read_bytes())
        if not expected.get('NSPrivacyCollectedDataTypes'):
            raise RuntimeError('Account and support collection must be declared')
        with zipfile.ZipFile(ipas[0]) as archive:
            manifests = [n for n in archive.namelist() if n.startswith('Payload/')
                         and len(Path(n).parts) == 3 and n.endswith('.app/PrivacyInfo.xcprivacy')]
            if len(manifests) != 1: raise RuntimeError('Missing main-app privacy manifest')
            raw = archive.read(manifests[0])
        actual = plistlib.loads(raw)
        if actual != expected: raise RuntimeError('Packed privacy manifest differs from reviewed source')
        result['packaged_privacy'] = {'ipa_sha256': hashlib.sha256(ipas[0].read_bytes()).hexdigest(),
            'manifest_sha256': hashlib.sha256(raw).hexdigest(), 'matches_source': True,
            'declarations': actual, 'privacy_approval': False}
    else:
        return
    result['go_version'] = run(['go', 'version'], ROOT / 'sshcore').strip()
    # Download exactly the go.mod/go.sum graph so even lazily loaded modules
    # have verifiable content checksums; this never marks a binary reproduced.
    downloads = run(['go', 'mod', 'download', '-json', 'all'], ROOT / 'sshcore').strip()
    decoder = json.JSONDecoder()
    result['go_downloads'] = []
    while downloads:
        value, end = decoder.raw_decode(downloads)
        if value.get('Error'): raise RuntimeError(value['Error'])
        result['go_downloads'].append({k: value[k] for k in ['Path', 'Version', 'Sum', 'GoModSum'] if k in value})
        downloads = downloads[end:].strip()
    modules = run(['go', 'list', '-m', '-json', 'all'], ROOT / 'sshcore').strip()
    result['go_modules'] = []
    while modules:
        value, end = decoder.raw_decode(modules)
        result['go_modules'].append({k: value[k] for k in ['Path', 'Version', 'Sum', 'GoVersion', 'Main'] if k in value})
        modules = modules[end:].strip()
    output = PROJECT / f'build/day/dist/review-{target}.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'review': output.name, 'target': target, 'approval': False}))

if __name__ == '__main__': main()
