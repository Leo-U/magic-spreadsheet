import {createGoogleConnection} from './google-connection.js?v=20261026-local-study-1';
import {GOOGLE_CLIENT_ID} from './google-config.js?v=20261026-local-study-1';
export function mountGoogleConnection({getStudyData, clientId = GOOGLE_CLIENT_ID, oauthProvider, fetcher, now}) {
  const $ = id => document.getElementById(id);
  let connection, plan = null, sdkReady = false;
  function note(text) { $('google-message').textContent = text; }
  function resetPlan() { plan = null; $('google-copy-review').hidden = true; $('google-copy-consent').checked = false; }
  function render() {
    if (!connection) return;
    const s = connection.status();
    $('google-connect').disabled = !clientId || !sdkReady || s.busy || s.phase === 'connecting';
    $('google-connect').hidden = s.phase === 'connected';
    $('google-connect').textContent = s.phase === 'expired' ? 'Reconnect to Google' : s.phase === 'connecting' ? 'Connecting…' : 'Connect to Google';
    $('google-disconnect').hidden = s.phase !== 'connected';
    $('google-disconnect').disabled = s.busy;
    $('google-copy').hidden = s.phase !== 'connected';
    $('google-copy').disabled = s.busy;
    $('google-copy-confirm').disabled = s.busy || !$('google-copy-consent').checked;
    $('google-copy-cancel').disabled = s.busy;
    $('google-copy-consent').disabled = s.busy;
    const labels = {unconfigured: 'Google connection is not configured yet. Continue using the chart as a guest.', disconnected: 'Not connected. Your study data stays in this browser.', connecting: 'Choose a Google account and review its permissions.', expired: 'Connection expired. Reconnect to copy data; guest study still works.'};
    $('google-status').textContent = s.phase === 'connected' ? 'Connected to ' + s.account.email + '. Study data still stays in this browser.' : labels[s.phase];
    if (s.phase !== 'connected') resetPlan();
  }
  async function loadSDK() {
    if (oauthProvider) return oauthProvider;
    if (window.google?.accounts?.oauth2) return window.google.accounts.oauth2;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      const timeout = setTimeout(() => { script.remove(); reject(new Error('Google connection could not load. Reload to retry; guest use remains available.')); }, 15000);
      script.onload = () => {clearTimeout(timeout);window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('Google connection is unavailable. Reload to retry.'));};
      script.onerror = () => {clearTimeout(timeout);script.remove();reject(new Error('Google connection could not load. Reload to retry; guest use remains available.'));};
      document.head.append(script);
    });
  }
  async function initialize() {
    connection = createGoogleConnection({clientId, oauth: null, onChange: render, fetcher, now});
    render();
    if (!clientId) return;
    note('Loading Google authorization…');
    try {
      const oauth = await loadSDK();
      connection = createGoogleConnection({clientId, oauth, onChange: render, fetcher, now});
      sdkReady = true; note('Connecting never uploads study data.'); render();
    } catch (e) { note(e.message); }
  }
  $('google-connect').onclick = () => {
    resetPlan(); $('google-result').replaceChildren(); note('');
    connection.connect().then(() => note('Nothing was uploaded. Use Copy guest data to review a separate transfer.')).catch(e => note(e.message));
  };
  $('google-disconnect').onclick = () => {
    try { connection.disconnect(); resetPlan(); $('google-result').replaceChildren(); note('Disconnected on this page. Existing Google permissions and copied files remain; manage permissions in your Google account. Guest data is unchanged.'); } catch (e) { note(e.message); }
  };
  $('google-copy').onclick = () => {
    try {
      plan = connection.prepareBackup(getStudyData());
      $('google-copy-summary').textContent = 'Copy this browser’s ' + plan.data.sets.length + ' saved sets, ' + plan.data.items.length + ' questions and ' + plan.data.snapshots.length + ' progress records to a NEW backup spreadsheet in ' + plan.email + '? This includes recoverable deleted records. It will not overwrite existing spreadsheets or change local data. Future edits will not sync automatically.';
      $('google-copy-review').hidden = false; $('google-copy-consent').checked = false; render();
      $('google-copy-consent').focus();
    } catch (e) { note(e.message); resetPlan(); }
  };
  $('google-copy-consent').onchange = render;
  $('google-copy-cancel').onclick = resetPlan;
  $('google-copy-confirm').onclick = async () => {
    if (!plan || !$('google-copy-consent').checked) return;
    try {
      if (JSON.stringify(getStudyData()) !== plan.json) throw new Error('Guest data changed after this preview. Cancel and review a fresh copy.');
      note('Copying the reviewed data…');
      const result = await connection.createBackup(plan);
      resetPlan();
      const link = document.createElement('a'); link.href = result.url; link.textContent = 'Open backup in Google Sheets'; link.target = '_blank'; link.rel = 'noopener noreferrer';
      $('google-result').replaceChildren(link);
      note('Backup copied to ' + result.email + '. Your browser data is unchanged. This is a one-time backup, not live sync.');
    } catch (e) { resetPlan(); note(e.message); }
  };
  // Tokens are never renewed in the background; reconnect requires a user click.
  const timer = setInterval(() => { if (connection) render(); }, 10000);
  const ready = initialize();
  return {ready, destroy() {clearInterval(timer);}, status: () => connection.status()};
}
