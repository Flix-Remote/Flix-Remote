"""Fetch versioned source JARs for the measured graph; never claim reproduction.

No Gradle execution, devices, services, credentials or production writes.
The downloaded archives are local review evidence, not bundled runtime code.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'Flix-Remote/review/native'
graph = json.loads((REVIEW / 'review-android-mdc.json').read_text())
folder = ROOT / 'evidence/maven-source-archives'
folder.mkdir(exist_ok=True)
groups = {}
for artifact in graph['runtime']['artifacts']:
    groups.setdefault(artifact['coordinate'], []).append(artifact)
previous_file = REVIEW / 'MAVEN_REPRODUCTION_WORKLIST.json'
previous = {row['coordinate']: row for row in json.loads(previous_file.read_text())['components']} if previous_file.exists() else {}


def collect(item):
    coordinate, binaries = item
    group, artifact, version = coordinate.split(':')
    relative = f"{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}-sources.jar"
    bases = (['https://jitpack.io/'] if group.startswith('com.github.') else
             ['https://dl.google.com/dl/android/maven2/'] if group.startswith(('androidx.', 'com.android.', 'com.google.android.material')) else
             ['https://repo.maven.apache.org/maven2/'])
    row = {'coordinate': coordinate, 'released_binaries': [
        {'name': b['name'], 'sha256': b['sha256']} for b in binaries],
        'pom_evidence': binaries[0]['poms'], 'source_archive_available': False,
        'exact_source_revision_verified': False, 'build_instructions_verified': False,
        'binary_reproduction_verified': False, 'license_approval': False}
    filename = coordinate.replace(':', '_') + '-sources.jar'
    old = previous.get(coordinate, {})
    cached = folder / filename
    if old.get('source_archive_available') and old['released_binaries'] == row['released_binaries'] and cached.exists():
        if hashlib.sha256(cached.read_bytes()).hexdigest() == old['source_archive_sha256']:
            return old
    for base in bases:
        url = base + relative
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'FLIX-source-review'})
            with urllib.request.urlopen(request, timeout=20) as response:
                data = response.read(40 * 1024 * 1024 + 1)
            if len(data) > 40 * 1024 * 1024:
                raise ValueError('source archive exceeds review limit')
            with zipfile.ZipFile(io.BytesIO(data)) as packed:
                if packed.testzip() is not None:
                    raise ValueError('invalid source archive CRC')
                notices = [{'path': e.filename, 'sha256': hashlib.sha256(packed.read(e)).hexdigest()}
                           for e in packed.infolist() if not e.is_dir()
                           and e.filename.rsplit('/', 1)[-1].lower().startswith(('license', 'notice', 'copying'))]
            (folder / filename).write_bytes(data)
            row.update({'source_archive_available': True, 'source_url': url,
                        'source_archive_sha256': hashlib.sha256(data).hexdigest(),
                        'source_archive_bytes': len(data), 'embedded_notices': notices})
            return row
        except (urllib.error.URLError, ValueError, zipfile.BadZipFile) as error:
            row.setdefault('download_errors', []).append({'url': url, 'error': str(error)})
    return row


with ThreadPoolExecutor(max_workers=8) as pool:
    rows = list(pool.map(collect, sorted(groups.items())))
result = {'measured_source_commit': graph['source_commit'], 'binary_files': sum(len(v) for v in groups.values()),
          'unique_coordinates': len(rows), 'source_archives_available': sum(x['source_archive_available'] for x in rows),
          'binary_reproduction_verified': 0, 'license_approval': False,
          'boundary': 'A versioned source JAR and POM do not establish exact VCS revision, complete transitive licenses, build environment or matching rebuilt output.',
          'components': rows}
(REVIEW / 'MAVEN_REPRODUCTION_WORKLIST.json').write_text(json.dumps(result, indent=2) + '\n')
notices = []
for row in rows:
    if not row['source_archive_available']:
        continue
    archive = folder / (row['coordinate'].replace(':', '_') + '-sources.jar')
    with zipfile.ZipFile(archive) as packed:
        for notice in row['embedded_notices']:
            text = packed.read(notice['path'])
            if hashlib.sha256(text).hexdigest() != notice['sha256']:
                raise ValueError('source notice hash mismatch')
            notices.append(f"\n===== {row['coordinate']} / {notice['path']} =====\n" + text.decode('utf-8'))
notice_file = ROOT / 'public/licenses/native/maven-embedded-notices.txt'
notice_file.write_text('Original notices embedded in versioned source JARs. This is a supplement, not proof of complete native notices or binary reproduction.\n' + ''.join(notices), encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'components'}))
