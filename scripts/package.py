"""Create the single deliverable ZIP without local credentials, caches or machine binaries."""
from pathlib import Path
import hashlib
import zipfile

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT.parent/'shizz-ai-agent-android.zip'
EXCLUDED={'node_modules','.venv','__pycache__','.pytest_cache','.ruff_cache','target','build','dist','.gradle','.git','artifacts','bin'}
ALLOWED_ENV={'.env.example'}


def included(path):
    rel=path.relative_to(ROOT)
    if any(part in EXCLUDED for part in rel.parts):return False
    if path.name.startswith('.env') and path.name not in ALLOWED_ENV:return False
    if path.name in {'local.properties','MANIFEST.sha256'}:return False
    if path.suffix in {'.apk','.aab','.jks','.keystore','.tsbuildinfo','.pyc'}:return False
    if 'service-account' in path.name.lower():return False
    return True


def main():
    files=sorted(p for p in ROOT.rglob('*') if p.is_file() and included(p))
    manifest='\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(ROOT).as_posix() for p in files)+'\n'
    (ROOT/'MANIFEST.sha256').write_text(manifest)
    with zipfile.ZipFile(DEST,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in files+[ROOT/'MANIFEST.sha256']:
            z.write(p,'shizz-ai-agent/'+p.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(DEST) as z:
        assert z.testzip() is None
        assert 'shizz-ai-agent/.env' not in z.namelist()
        assert not any('/node_modules/' in n or '/workers/bin/' in n for n in z.namelist())
    print(f'{DEST.name}: {len(files)+1} files, {DEST.stat().st_size:,} bytes')
    print('SHA-256:',hashlib.sha256(DEST.read_bytes()).hexdigest())

if __name__=='__main__':main()
