"""Record dependency identities, without claiming license approval or reproducibility."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
metadata = json.loads((root / 'evidence/day-cargo-metadata.json').read_text(encoding='utf-8-sig'))
lock_bytes = (root / 'package-lock.json').read_bytes()
lock = json.loads(lock_bytes)
rust = []
for package in metadata['packages']:
    rust.append({key: package.get(key) for key in ('name', 'version', 'source', 'license', 'repository')})
node = []
for path, package in lock['packages'].items():
    if not path or package.get('dev'): continue
    node.append({'path': path, **{key: package.get(key) for key in ('version', 'license', 'resolved', 'integrity')}})
result = {
    'status': 'inventory-only; no release eligibility or binary reproduction claim',
    'scope': 'Cargo all-feature metadata (including build/host dependencies) and npm non-dev lock entries',
    'cargo_lock_sha256': hashlib.sha256((root / 'Flix-Remote/Cargo.lock').read_bytes()).hexdigest(),
    'npm_lock_sha256': hashlib.sha256(lock_bytes).hexdigest(),
    'rust': sorted(rust, key=lambda p: (p['name'], p['version'])),
    'npm': node,
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
print(json.dumps({'rust_packages': len(rust), 'npm_runtime_entries': len(node), 'approval': False}))
