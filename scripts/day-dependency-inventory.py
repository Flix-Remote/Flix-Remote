"""Record dependency identities, without claiming license approval or reproducibility."""
from pathlib import Path
import hashlib
import json
import re
import sys, io, zipfile, urllib.request

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root / 'evidence/day-cargo-metadata.json').read_text(encoding='utf-8-sig'))
lock_bytes = (root / 'package-lock.json').read_bytes()
lock = json.loads(lock_bytes)
rust = []
documents = {}
upstream_path = root / 'public/licenses/upstream-index.json'
upstream = json.loads(upstream_path.read_text()) if upstream_path.exists() else {}
archives = {}
def fetch_url(url, maximum=16*1024*1024):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'FLIX-License-Review/1.0'}), timeout=45) as response:
        data = response.read(maximum + 1)
    if len(data) > maximum: raise ValueError('Source review download exceeds limit')
    return data

def supplement(key, directory, repository):
    if key not in upstream and '--fetch-missing' in sys.argv:
        directory = Path(directory)
        vcs = directory / '.cargo_vcs_info.json'
        if vcs.exists():
            info = json.loads(vcs.read_text()); revision = info['git']['sha1']; subdir = info.get('path_in_vcs', '')
        else:
            package = json.loads((directory / 'package.json').read_text())
            published = json.loads(fetch_url('https://registry.npmjs.org/' + package['name'].replace('/', '%2f') + '/' + package['version'], 1024*1024))
            revision = published.get('gitHead'); subdir = ''
            repository = package.get('repository', {}).get('url', '')
        match = re.search(r'github.com[:/]([^/]+/[^/#?]+)', repository or '')
        if not match or not revision or not re.fullmatch('[a-f0-9]{40}', revision): return []
        repo = match.group(1).removesuffix('.git')
        url = f'https://codeload.github.com/{repo}/zip/{revision}'
        if url not in archives:
            data = fetch_url(url)
            archives[url] = (zipfile.ZipFile(io.BytesIO(data)), hashlib.sha256(data).hexdigest())
        archive, archive_sha = archives[url]
        prefix = archive.namelist()[0].split('/')[0] + '/'
        wanted = []
        parents = [str(p) for p in [Path(subdir), *Path(subdir).parents]]
        for name in archive.namelist():
            rel = name.removeprefix(prefix)
            if str(Path(rel).parent) in parents and re.match(r'^(licen[cs]e|notice|copying|copyright|unlicense)([._-]|$)', Path(rel).name, re.I) and not name.endswith('/'):
                content = archive.read(name); content.decode('utf-8')
                sha = hashlib.sha256(content).hexdigest()
                out = root / 'public/licenses/upstream' / (sha + '.txt')
                out.parent.mkdir(parents=True, exist_ok=True); out.write_bytes(content)
                wanted.append({'name': rel, 'sha256': sha, 'file': out.relative_to(root).as_posix()})
        if wanted:
            upstream[key] = {'repository': 'https://github.com/' + repo, 'revision': revision, 'archive_url': url,
                             'archive_sha256': archive_sha, 'documents': wanted}
    result = []
    for doc in upstream.get(key, {}).get('documents', []):
        content = (root / doc['file']).read_bytes()
        if hashlib.sha256(content).hexdigest() != doc['sha256']: raise ValueError('Upstream license hash mismatch')
        documents[doc['sha256']] = content.decode('utf-8')
        result.append(doc)
    return result
def collect(directory, ancestors=False, declared=None):
    directory = Path(directory)
    candidates = [directory / declared] if declared else []
    current = directory
    for _ in range(8 if ancestors else 1):
        if current.is_dir():
            candidates.extend(p for p in current.iterdir() if p.is_file() and (re.match(r'^(licen[cs]e|notice|copying|copyright|unlicense)([._-]|$)', p.name, re.I) or directory.name.startswith('r-efi-') and p.name == 'AUTHORS'))
        if not ancestors or (current / '.git').exists(): break
        current = current.parent
    found = []
    for p in sorted(set(candidates)):
        if not p.is_file(): continue
        content = p.read_bytes()
        try: content.decode('utf-8')
        except UnicodeDecodeError: continue
        sha = hashlib.sha256(content).hexdigest()
        documents[sha] = content.decode('utf-8')
        found.append({'name': p.name, 'sha256': sha})
    return found

for package in metadata['packages']:
    entry = {key: package.get(key) for key in ('name', 'version', 'source', 'license', 'repository')}
    entry['license_documents'] = collect(Path(package['manifest_path']).parent,
        ancestors=bool(package.get('source', '') and package['source'].startswith('git+')), declared=package.get('license_file'))
    if not entry['license_documents']:
        entry['license_documents'] = supplement('cargo:' + package['name'] + '@' + package['version'], Path(package['manifest_path']).parent, package.get('repository'))
    rust.append(entry)
node = []
for path, package in lock['packages'].items():
    if not path or package.get('dev'): continue
    docs = collect(root / path)
    if not docs: docs = supplement('npm:' + path.removeprefix('node_modules/') + '@' + package['version'], root / path, None)
    node.append({'path': path, **{key: package.get(key) for key in ('version', 'license', 'resolved', 'integrity')}, 'license_documents': docs})
missing = [p.get('path', p.get('name')) for p in rust + node if not p['license_documents']]
result = {
    'status': 'license-text evidence collected; native reproduction and distribution compatibility not approved',
    'scope': 'Cargo all-feature metadata (including build/host dependencies) and npm non-dev lock entries',
    'cargo_lock_sha256': hashlib.sha256((root / 'Flix-Remote/Cargo.lock').read_bytes()).hexdigest(),
    'npm_lock_sha256': hashlib.sha256(lock_bytes).hexdigest(),
    'rust': sorted(rust, key=lambda p: (p['name'], p['version'])),
    'npm': node,
    'missing_license_documents': missing,
    'document_count': len(documents),
    'notice_bundle': 'public/licenses/day-transitive-notices.txt',
    'remaining': [
        'Resolve final iOS SwiftPM graph and Android Gradle graph in native SDK builds',
        'Review DFSG and distribution compatibility for every transitive dependency',
        'Supply exact Maven binary source revisions, build environments and reproduction evidence',
        'Review all bundled assets and applicable attribution/license texts',
    ],
}
out = root / 'Flix-Remote/review/dependencies.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
bundle = ['FLIX Day candidate dependency license documents. Component mappings and exact document SHA-256 are in Flix-Remote/review/dependencies.json. Original licenses remain applicable. This is not a compatibility or reproduction certificate.\n']
for sha, content in sorted(documents.items()):
    bundle.append('\n===== Document SHA-256: ' + sha + ' =====\n' + content + '\n')
(root / 'public/licenses/day-transitive-notices.txt').write_text(''.join(bundle), encoding='utf-8')
if upstream:
    upstream_path.write_text(json.dumps(upstream, indent=2, sort_keys=True) + '\n')
print(json.dumps({'rust_packages': len(rust), 'npm_runtime_entries': len(node), 'license_documents': len(documents), 'missing': missing, 'approval': False}))
