#!/usr/bin/env python3
"""Start a detached loopback-only preview; no service installation or browser changes."""
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
URL = 'http://127.0.0.1:8765/'

def check():
    with urllib.request.urlopen(URL, timeout=2) as response:
        body = response.read().decode('utf-8')
        if '<title>Magic Spreadsheet</title>' not in body:
            raise RuntimeError('Port 8765 is serving a different application; it was not changed.')
    for asset in ('app.js', 'model.js', 'storage.js', 'transactions.js', 'overview.js', 'calendar.js', 'sets.js', 'history-data.js', 'style.css'):
        with urllib.request.urlopen(URL + asset, timeout=2) as response:
            if response.status != 200 or not response.read():
                raise RuntimeError('Missing asset: ' + asset)

try:
    check()
except urllib.error.URLError:
    log = ROOT / 'preview.log'
    with log.open('ab') as output:
        child = subprocess.Popen(
            [sys.executable, '-u', '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', str(ROOT)],
            stdin=subprocess.DEVNULL, stdout=output, stderr=output,
            start_new_session=True, close_fds=True)
    for attempt in range(20):
        time.sleep(.15)
        try:
            check()
            print(f'Preview ready: {URL} (detached PID {child.pid}; log: {log})')
            break
        except urllib.error.URLError:
            if child.poll() is not None:
                raise SystemExit(f'Server exited; inspect {log}')
    else:
        raise SystemExit(f'Preview did not respond; inspect {log}')
else:
    print(f'Preview already running and assets verified: {URL}')
