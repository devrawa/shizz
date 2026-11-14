"""Collect installed npm dependency license files for the distributed native web bundle."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
mods=ROOT/'mobile/node_modules'
sections=[]
# Include dev-tool notices as well, to err on the side of attribution.
for package in sorted(mods.glob('*/package.json'))+sorted(mods.glob('@*/*/package.json')):
    try:data=json.loads(package.read_text())
    except (ValueError,OSError):continue
    texts=[]
    for file in sorted(package.parent.iterdir()):
        if file.is_file() and file.name.lower().split('.')[0] in {'license','licence','notice','copying','copyright'}:
            texts.append(file.name+'\n'+file.read_text(errors='replace'))
    if texts:
        sections.append('\n'+'='*78+'\n'+str(data.get('name'))+' '+str(data.get('version'))+'\n'+'\n'.join(texts))
output=ROOT/'docs/licenses/npm-dependency-notices.txt'
output.write_text('Third-party license files from the installed npm tree. Packages retain their own rights.\n'+''.join(sections))
print(f'Collected notices from {len(sections)} packages.')
