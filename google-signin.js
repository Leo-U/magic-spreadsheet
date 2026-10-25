import {GOOGLE_SIGN_IN_CLIENT_ID, GOOGLE_SIGN_IN_ORIGIN} from './google-config.js?v=20261025-live-1';

const bytes = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const decode = value => JSON.parse(new TextDecoder().decode(bytes(value)));
// This verifies identity for display only. There is no backend session or remote data access.
export async function verifyIdentity(token, {clientId, nonce, fetcher = fetch, now = Date.now}) {
  if (typeof token !== 'string' || token.length > 20000) throw Error('Invalid identity response.');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Invalid identity response.');
  const header = decode(parts[0]), claims = decode(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
      claims.aud !== clientId || claims.nonce !== nonce ||
      !Number.isFinite(claims.exp) || claims.exp * 1000 <= now() ||
      !Number.isFinite(claims.iat) || claims.iat * 1000 > now() + 60000 ||
      typeof claims.sub !== 'string' || !claims.sub ||
      claims.email_verified !== true || typeof claims.email !== 'string') throw Error('Identity could not be verified.');
  const response = await fetcher('https://www.googleapis.com/oauth2/v3/certs', {credentials:'omit', signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('Google identity verification is unavailable.');
  const {keys} = await response.json();
  const jwk = keys?.find(key => key.kid === header.kid && key.kty === 'RSA' && key.alg === 'RS256');
  if (!jwk) throw Error('Google signing key is unavailable. Try again.');
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))) throw Error('Identity could not be verified.');
  if (claims.exp * 1000 <= now()) throw Error('Identity expired. Sign in again.');
  return {sub:claims.sub, email:claims.email, expiresAt:claims.exp * 1000};
}

export function mountGoogleSignIn({clientId = GOOGLE_SIGN_IN_CLIENT_ID, allowedOrigin = GOOGLE_SIGN_IN_ORIGIN, provider, fetcher, now = Date.now, onIdentity = () => {}} = {}) {
  const button = document.getElementById('google-signin-button');
  const status = document.getElementById('google-signin-status');
  const signout = document.getElementById('google-signout');
  let sdk, account = null, generation = 0, destroyed = false, nonce;
  const note = text => {status.textContent = text;};
  function renderButton() {
    button.replaceChildren(); button.hidden = false;
    sdk.renderButton(button, {type:'standard', theme:'outline', size:'large', text:'signin_with', shape:'rectangular'});
  }
  function reset(message) {
    generation++; account = null; onIdentity(null); signout.hidden = true;
    sdk?.disableAutoSelect();
    if (sdk && !destroyed) initialize();
    note(message);
  }
  async function callback(response) {
    const current = ++generation;
    note('Checking your Google account…');
    try {
      const identity = await verifyIdentity(response.credential, {clientId, nonce, fetcher, now});
      if (destroyed || current !== generation) return;
      account = identity; onIdentity({...identity}); button.hidden = true; signout.hidden = false;
      note('Signed in as ' + identity.email + '. Guest data stays separate.');
    } catch (_) {
      if (!destroyed && current === generation) {account = null; onIdentity(null); signout.hidden = true; button.hidden = false; note('Google sign-in could not be verified. Try again; guest use is still available.');}
    }
  }
  function initialize() {
    nonce = Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2,'0')).join('');
    sdk.initialize({client_id:clientId, callback, nonce, ux_mode:'popup', auto_select:false, button_auto_select:false});
    renderButton();
  }
  async function load() {
    if (provider) return provider;
    if (window.google?.accounts?.id) return window.google.accounts.id;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
      const timer = setTimeout(() => {script.remove(); reject(Error('SDK timeout'));}, 15000);
      script.onload = () => {clearTimeout(timer); window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(Error('SDK unavailable'));};
      script.onerror = () => {clearTimeout(timer); script.remove(); reject(Error('SDK unavailable'));};
      document.head.append(script);
    });
  }
  const ready = (async () => {
    if (!clientId || location.origin !== allowedOrigin) {note('Google sign-in is available in the local test at http://127.0.0.1:8765. Guest use is available here.'); return;}
    note('Loading Google sign-in…');
    try {sdk = await load(); if (destroyed) return; initialize(); note('Choose Sign in with Google, or continue as a guest.');}
    catch (_) {note('Google sign-in could not load. Reload to retry; guest use is still available.');}
  })();
  signout.onclick = () => reset('Signed out on this page. Your browser study data is unchanged.');
  const timer = setInterval(() => {if (account && account.expiresAt <= now()) reset('Google sign-in expired. Sign in again; study data is unchanged.');}, 1000);
  return {ready, status:() => account ? {...account} : null, destroy(){destroyed = true; generation++; account = null; clearInterval(timer); button.replaceChildren(); signout.onclick = null;}};
}
