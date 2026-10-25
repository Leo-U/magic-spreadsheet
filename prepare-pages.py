#!/usr/bin/env python3
"""Build a reviewed, allowlisted static release. Does not publish or read browser data."""
from pathlib import Path
import hashlib
import json
import re
import tempfile

ROOT = Path(__file__).resolve().parent
FILES = ('index.html', 'style.css', 'app.js', 'theme.js', 'model.js', 'storage.js',
         'calendar.js', 'sets.js', 'overview.js', 'history-data.js', 'transactions.js',
         'google-config.js', 'google-connection.js', 'google-ui.js', 'google-signin.js', 'sync-core.js', 'sync-remote.js', 'sync-ui.js')

def build():
    contents = {name: (ROOT / name).read_text() for name in FILES}
    if not re.search(r"GOOGLE_CLIENT_ID\s*=\s*''", contents['google-config.js']):
        raise SystemExit('Google configuration is no longer disabled: review production OAuth setup before packaging.')
    if not re.search(r"GOOGLE_SIGN_IN_CLIENT_ID\s*=\s*''", contents['google-config.js']):
        raise SystemExit('Local sign-in client configured: review separate production setup before packaging.')
    patterns = (r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', r'GOCSPX-[A-Za-z0-9_-]+',
                r'gh[pousr]_[A-Za-z0-9]{20,}', r'github_pat_[A-Za-z0-9_]{20,}')
    for name, text in contents.items():
        if any(re.search(pattern, text) for pattern in patterns):
            raise SystemExit('Credential-like content detected in ' + name + '; release stopped.')
        refs = re.findall(r'''(?:src|href)=["']([^"']+)["']''', text) if name.endswith('.html') else []
        refs += re.findall(r'''(?:from\s+|import\s*)["'](\.[^"']+)["']''', text)
        for ref in refs:
            if ref.startswith(('https://', 'http://', '#')):
                continue
            target = ref.split('?')[0].removeprefix('./')
            if target not in FILES:
                raise SystemExit('Non-release or non-relative asset in ' + name + ': ' + target)
    # Each build gets a new local directory, so no previous/user files are deleted.
    output = Path(tempfile.mkdtemp(prefix='magic-spreadsheet-pages-', dir='/tmp'))
    for name, text in contents.items():
        (output / name).write_text(text)
    (output / '.nojekyll').write_text('')
    (output / 'README.md').write_text('''# Magic Spreadsheet

A browser-local study chart linking topics to question sets. Inspired by Ali Abdaal's study techniques; independent and not officially affiliated.

Static ES modules; no build dependencies. Serve this directory over HTTP. For GitHub Pages, publish main / (root). Hash routes support the landing page, #chart and #set/<id> beneath a project-site path.

Guest data is saved only in this browser's localStorage. Google connection is disabled pending separate production OAuth setup. No live sync is available. Export/import JSON backups manually when changing origins or devices.

The public source includes only application files and generic built-in sample questions. No study records, credentials, test fixtures, screenshots or local logs are included.
''')
    manifest = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in output.iterdir() if p.is_file()}
    (output / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(output)
    print('PASS: 18 application files + .nojekyll + public README + integrity manifest; relative dependency closure and credential-pattern scan.')
    return output

if __name__ == '__main__':
    build()
