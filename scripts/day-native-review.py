"""Capture resolved native dependency evidence after packing, without devices or credentials."""
from pathlib import Path
import hashlib, json, os, shutil, subprocess, sys, xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'Flix-Remote'


def run(args, cwd):
    return subprocess.check_output(args, cwd=cwd, text=True)


def main():
    target = os.environ['DAY_PACK_TARGET']
    result = {'target': target, 'source_commit': os.environ.get('GITHUB_SHA'),
              'license_approval': False, 'binary_reproduction_verified': False,
              'physical_devices_tested': False, 'tv_connections': 0}
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
