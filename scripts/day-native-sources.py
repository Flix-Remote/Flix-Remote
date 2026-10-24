"""Preserve exact upstream source and real license notices, not POM labels.

This repairs provenance; source availability never marks binary reproduction true.
"""
from pathlib import Path
import hashlib, io, json, os, shutil, subprocess, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[1]
PINS = [
    ('libadb-android', '3.1.1', 'MuntashirAkon/libadb-android',
     'c849886ebc6d48e7b46d967e78a6bb65c90c3b74', 'Apache-2.0 OR GPL-3.0-or-later'),
    ('ionfilesystem-android', '1.1.1', 'ionic-team/ion-android-filesystem',
     'ad4c23981b63fdf60627e23a94187076997fc82b', 'MIT'),
    ('iadb-ios', 'revision-22902f6231c4', 'h33h/iadb-ios',
     '22902f6231c413f2d90accee68f0e59f1c9ea360', 'MIT'),
    ('ionfilesystem-ios', '2.0.1', 'ionic-team/ion-ios-filesystem',
     '549c18ad9d9bb70d05df37cc3f6f7aa7f5d0ee52', 'MIT'),
    ('capacitor-swift-pm', '8.5.3', 'ionic-team/capacitor-swift-pm',
     '4c7f346d16196e21fbe23d4a7a6fc7af62af6742', 'MIT'),
    ('capacitor-implementation', '8.5.3', 'ionic-team/capacitor',
     '06e3e1984337f836a4c28b2afc92faa977dea315', 'MIT'),
]
GO_REVIEWED = {'golang.org/x/crypto':'v0.43.0', 'golang.org/x/net':'v0.45.0',
               'golang.org/x/sys':'v0.37.0', 'golang.org/x/term':'v0.36.0',
               'golang.org/x/text':'v0.30.0'}

def main():
    folder = ROOT / 'public/licenses/native'
    folder.mkdir(parents=True, exist_ok=True)
    index, notices = [], []
    for name, version, repo, revision, expression in PINS:
        url = f'https://codeload.github.com/{repo}/zip/{revision}'
        data = urllib.request.urlopen(url, timeout=60).read()
        archive_name = f'{name}-{version}-source.zip'
        (folder / archive_name).write_bytes(data)
        archive = zipfile.ZipFile(io.BytesIO(data))
        assert archive.testzip() is None
        prefix = archive.namelist()[0].split('/')[0] + '/'
        documents = []
        for entry in archive.namelist():
            relative = entry.removeprefix(prefix)
            if entry.endswith('/') or not (relative in ('COPYING', 'LICENSE', 'LICENSE.md', 'NOTICE', 'NOTICE.md') or relative.startswith('LICENSES/')):
                continue
            text = archive.read(entry)
            # All notice bytes are preserved; no generic substitute copyright.
            notices.append(f'\n===== {name}@{version} / {relative} / {revision} =====\n' + text.decode())
            documents.append({'path': relative, 'sha256': hashlib.sha256(text).hexdigest()})
        assert documents, f'No actual upstream notices: {name}'
        index.append({'name': name, 'version': version, 'repository': f'https://github.com/{repo}',
                      'revision': revision, 'source_url': url, 'source_file': archive_name,
                      'sha256': hashlib.sha256(data).hexdigest(), 'licenses': expression,
                      'selected_alternative': 'Apache-2.0' if name == 'libadb-android' else 'MIT',
                      'documents': documents, 'binary_reproduction_verified': False})
        if name == 'capacitor-swift-pm':
            # This repository is a binary wrapper, not the Capacitor implementation.
            # Preserve the distinction rather than claiming its archive is the binary's source.
            index[-1]['source_kind'] = 'SwiftPM binary-target wrapper; implementation source separately identified'
            index[-1]['implementation_source'] = {
                'repository': 'https://github.com/ionic-team/capacitor',
                'tag': '8.5.3', 'revision': '06e3e1984337f836a4c28b2afc92faa977dea315',
                'binary_reproduction_verified': False}
            index[-1]['binary_targets'] = [
                {'name': 'Capacitor', 'sha256': '9316f568444411d362dcb4d1946e7572d4aef5d690c122ff6f1cb8a44a920c9f'},
                {'name': 'Cordova', 'sha256': 'bdcd8eab2d62a077efd76c3c8b9629e65ae7043c1462289a1e55de9be19bbf1f'}]
    go = os.environ.get('FLIX_GO') or shutil.which('go')
    if not go: raise RuntimeError('Go is required to verify locked module source before copying its notices')
    raw = subprocess.check_output([go, 'mod', 'download', '-json', 'all'], cwd=ROOT / 'sshcore', text=True).strip()
    decoder, modules = json.JSONDecoder(), []
    while raw:
        module, end = decoder.raw_decode(raw)
        if module.get('Error'): raise RuntimeError(module['Error'])
        if GO_REVIEWED.get(module['Path']) != module['Version']:
            raise RuntimeError('Go license graph changed; review the actual new license before exporting')
        if not module.get('Sum') or not module.get('GoModSum'): raise RuntimeError('Missing verified Go source checksums')
        license_file = Path(module['Dir']) / 'LICENSE'
        license_bytes = license_file.read_bytes()
        notices.append(f"\n===== {module['Path']}@{module['Version']} / LICENSE =====\n" + license_bytes.decode())
        modules.append({k:module[k] for k in ['Path','Version','Sum','GoModSum']})
        modules[-1].update({'license':'BSD-3-Clause', 'license_sha256':hashlib.sha256(license_bytes).hexdigest(),
            'source_url':f"https://proxy.golang.org/{module['Path']}/@v/{module['Version']}.zip",
            'binary_reproduction_verified':False})
        raw = raw[end:].strip()
    (folder / 'go-sources.json').write_text(json.dumps(modules, indent=2)+'\n')
    (folder / 'notices.txt').write_text(''.join(notices), encoding='utf-8')
    (folder / 'sources.json').write_text(json.dumps(index, indent=2)+'\n')
    print(json.dumps({'pinned_sources': len(index), 'go_modules':len(modules),
                      'actual_license_documents': sum(len(x['documents']) for x in index)+len(modules),
                      'binary_reproduction_verified': False}))

if __name__ == '__main__': main()
