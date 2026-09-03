from pathlib import Path
import re
import subprocess
import sys

html = Path('index.html').read_text(encoding='utf-8')
html_without_comments = re.sub(r'<!--[\s\S]*?-->', '', html)
scripts = re.findall(r'<script\s*>([\s\S]*?)</script\s*>', html_without_comments, flags=re.I)
if not scripts:
    raise SystemExit('Nenhum script encontrado')
js = '\n\n'.join(scripts)
Path('/tmp/coach-run-current.js').write_text(js, encoding='utf-8')
result = subprocess.run(['node', '--check', '/tmp/coach-run-current.js'], text=True)
raise SystemExit(result.returncode)
