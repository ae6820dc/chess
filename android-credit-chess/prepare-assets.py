"""Package unmodified source assets; catalog records source IDs and storage keys."""
from pathlib import Path
import hashlib, json, re, shutil
project=Path(__file__).resolve().parent
repo=project.parent
extensions={'.html','.js','.css','.webmanifest','.json','.png','.svg','.txt','.gz'}
spec=json.loads((project/'project.json').read_text())
def original_id(html):
    m=re.search(r'Program ID:</strong>\s*<code[^>]*>([A-Fa-f0-9]{32})',html) or re.search(r'Program ID:\s*([A-Fa-f0-9]{32})',html)
    if not m:raise ValueError('Original Program ID missing')
    return m.group(1)
# Documentation is required in every source folder. Only XML resources go to
# AAPT; readme.html files stay in source control, outside compiled resource sets.
for source_res in (project/'app/src').glob('*/res'):
    target_res=project/'app/build/generated/resources'/source_res.parent.name
    if target_res.exists():shutil.rmtree(target_res)
    for source in source_res.rglob('*.xml'):
        target=target_res/source.relative_to(source_res);target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
for flavor in spec:
    output=project/f'app/build/generated/offline/{flavor}'
    if output.exists():shutil.rmtree(output)
    output.mkdir(parents=True)
    sources=[];catalog=[]
    if flavor=='mathematics':
        folders=['advanced-algebra','calculus-analysis','matrix-lab','statistics-probability','number-theory']
        for folder in folders:
            for sample in (1,2):
                cfg=(repo/f'calculator/{folder}/config{2 if sample==2 else ""}.js').read_text()
                cfg=json.loads(cfg.split('const CONFIG = ',1)[1].split(';\n',1)[0])
                catalog.append(dict(id=f'math-{folder}-{sample}',group=cfg['title'],name='Original' if sample==1 else 'Studio II · High precision',path=f'calculator/{folder}/sample{sample}.html',kind='calculator',programId=cfg['id'],storageKey=cfg['key']))
        for folder in folders+['lab2']:
            sources += [p for p in (repo/'calculator'/folder).rglob('*') if p.is_file() and p.suffix in extensions and not p.name.endswith('.test.cjs')]
    elif flavor=='unicode':
        for version in range(1,10):
            for sample in range(1,4):
                p=repo/f'unicode/{version}/sample{sample}.html';html=p.read_text();sources.append(p)
                key=re.search(r"const STORAGE_KEY=['\"]([^'\"]+)",html)
                catalog.append(dict(id=f'unicode-{version}-{sample}',group=f'Unicode {version}',name=f'Sample {sample}',path=str(p.relative_to(repo)),kind='unicode',programId=original_id(html),storageKey=key.group(1) if key else None))
    elif flavor=='creditChess':
        app=repo/'credit-chess/stockfish'
        sources=[p for p in app.rglob('*') if p.is_file() and p.suffix in extensions|{'.wasm'} and not any(x in p.relative_to(app).parts for x in ('tests','docs','node_modules','test-results','playwright-report')) and p.name not in ('package.json','package-lock.json','playwright.config.js')]
        storage=(app/'storage.js').read_text()
        catalog.append(dict(id='credit-chess',group='Credit Chess',name='Choose Desktop or Tablet',path='credit-chess/stockfish/index.html',kind='chess',programId=re.search(r"PROGRAM_ID='([^']+)'",storage).group(1),storageKey=re.search(r"STORAGE_KEY='([^']+)'",storage).group(1)))
    checksums={}
    for source in sorted(set(sources)):
        path=source.relative_to(repo);destination=output/'site'/(str(path)+('.bin' if source.suffix=='.gz' else ''));destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,destination)
        checksums[str(path)]=hashlib.sha256(source.read_bytes()).hexdigest()
    (output/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
    (output/'source-checksums.json').write_text(json.dumps(checksums,indent=2)+'\n')
    shutil.copyfile(project/'host.js',output/'host.js')
    assert len({p['id'] for p in catalog})==len(catalog)
    print(f'{flavor}: {len(catalog)} programs, {len(checksums)} original files copied unchanged')
