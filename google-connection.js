export const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';
export const EMAIL = 'https://www.googleapis.com/auth/userinfo.email';
export const SCOPES = [DRIVE_FILE, 'openid', EMAIL];
const copy = value => JSON.parse(JSON.stringify(value));

// No storage dependency: credentials, identity and pending transfers are memory-only.
export function createGoogleConnection({clientId, oauth, fetcher = fetch, now = Date.now, onChange = () => {}}) {
  let token = null, account = null, expires = 0, epoch = 0, pendingReject = null, busy = false;
  let phase = clientId ? 'disconnected' : 'unconfigured';
  const emit = () => onChange();
  function clear(next = 'disconnected') {
    epoch++; token = null; account = null; expires = 0; phase = next;
    if (pendingReject) { pendingReject(new Error('Connection cancelled.')); pendingReject = null; }
    emit();
  }
  function status() {
    if (token && now() >= expires) clear('expired');
    return {phase, account: account ? {...account} : null, busy};
  }
  function requireConnection() {
    if (status().phase !== 'connected') throw new Error('Connect to Google again before copying data.');
  }
  function connect() {
    if (!clientId) return Promise.reject(new Error('Google connection needs an OAuth client ID. Guest use is available.'));
    if (busy || phase === 'connecting') return Promise.reject(new Error('Please wait for the current operation.'));
    clear(); phase = 'connecting'; const attempt = epoch; emit();
    return new Promise((resolve, reject) => {
      pendingReject = reject;
      const fail = message => {
        if (attempt !== epoch) return;
        pendingReject = null; clear(); reject(new Error(message));
      };
      try {
        const client = oauth.initTokenClient({
          client_id: clientId, scope: SCOPES.join(' '), include_granted_scopes: false,
          callback: async response => {
            if (attempt !== epoch) return;
            if (response.error) { fail('Google access was not granted. Your guest data is unchanged.'); return; }
            if (!response.access_token || !(Number(response.expires_in) > 30) || !oauth.hasGrantedAllScopes(response, ...SCOPES)) {
              fail('Required permission was not granted. No study data was sent.'); return;
            }
            const candidate = response.access_token;
            const candidateExpiry = now() + (Number(response.expires_in) - 30) * 1000;
            try {
              const result = await fetcher('https://openidconnect.googleapis.com/v1/userinfo', {
                headers: {Authorization: 'Bearer ' + candidate}, cache: 'no-store', credentials: 'omit'
              });
              if (!result.ok) throw new Error();
              const identity = await result.json();
              if (!identity.sub || !identity.email || identity.email_verified !== true || now() >= candidateExpiry) throw new Error();
              if (attempt !== epoch) return;
              token = candidate; account = {id: identity.sub, email: identity.email}; expires = candidateExpiry;
              phase = 'connected'; pendingReject = null; emit(); resolve(status());
            } catch { fail('Could not verify the Google account. Reconnect before copying data.'); }
          },
          error_callback: () => fail('Google sign-in was closed or blocked. Try connecting again; guest data is unchanged.')
        });
        // This call must be synchronous within the user's click to allow the popup.
        client.requestAccessToken({prompt: 'select_account'});
      } catch { fail('Google authorization could not start. Please try again.'); }
    });
  }
  function prepareBackup(data) {
    requireConnection();
    const snapshot = copy(data), json = JSON.stringify(snapshot);
    if (new TextEncoder().encode(json).length > 1000000) throw new Error('This backup is too large for this first Google transfer version. Use Export JSON backup.');
    return {accountId: account.id, email: account.email, epoch, json, data: snapshot, createdAt: new Date(now()).toISOString()};
  }
  async function createBackup(plan) {
    requireConnection();
    if (busy) throw new Error('A copy is already in progress.');
    if (plan.epoch !== epoch || plan.accountId !== account.id) throw new Error('The connection changed. Review a new copy confirmation for the current account.');
    const cells = text => ({values: [{userEnteredValue: {stringValue: text}}]});
    const chars = Array.from(plan.json), chunks = [];
    for (let i = 0; i < chars.length; i += 20000) chunks.push(chars.slice(i, i + 20000).join(''));
    const body = {properties: {title: 'Magic Spreadsheet backup ' + plan.createdAt}, sheets: [
      {properties: {title: 'Read me'}, data: [{rowData: [
        cells('Magic Spreadsheet guest-data backup'), cells('Created ' + plan.createdAt),
        cells('This is a one-time copy, not automatic synchronization. Local study data remains in your browser.'),
        cells('Backup!A1 is the format marker. Concatenate A2 onward to reconstruct the original JSON backup.'),
        cells('Includes saved questions, marks, review history and recoverable deleted records. Do not edit the Backup tab.')
      ]}]},
      {properties: {title: 'Backup'}, data: [{rowData: [cells('magic-spreadsheet-json-v1'), ...chunks.map(cells)]}]}
    ]};
    const operationEpoch = epoch, operationToken = token;
    busy = true; emit();
    try {
      let result;
      try {
        result = await fetcher('https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId', {
          method: 'POST', headers: {Authorization: 'Bearer ' + operationToken, 'Content-Type': 'application/json'},
          credentials: 'omit', body: JSON.stringify(body)
        });
      } catch { throw new Error('Copy outcome is uncertain. Check Google Drive for the dated backup before trying again; no automatic retry was made.'); }
      if (result.status === 401) {
        if (operationEpoch === epoch) clear('expired');
        throw new Error('Google authorization expired. Reconnect, then review the copy again.');
      }
      if (!result.ok) {
        if (result.status >= 500) throw new Error('Copy outcome is uncertain. Check Google Drive before trying again; no automatic retry was made.');
        throw new Error('Google rejected the copy (HTTP ' + result.status + '). Check permissions and API setup. Local data is unchanged.');
      }
      let created;
      try { created = await result.json(); } catch { throw new Error('Copy may have completed. Check Google Drive before trying again.'); }
      if (!/^[A-Za-z0-9_-]+$/.test(created.spreadsheetId || '')) throw new Error('Copy may have completed, but its link could not be verified. Check Google Drive before trying again.');
      return {url: 'https://docs.google.com/spreadsheets/d/' + created.spreadsheetId + '/edit', email: plan.email};
    } finally { busy = false; emit(); }
  }
  return {status, connect, prepareBackup, createBackup, disconnect() { if (busy) throw new Error('Wait for the copy to finish before disconnecting.'); clear(); }};
}
