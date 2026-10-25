import {GOOGLE_SIGN_IN_CLIENT_ID,GOOGLE_SIGN_IN_ORIGIN} from './google-config.js?v=20261023-signin-1';
import {createSyncRemote,SYNC_SCOPE} from './sync-remote.js?v=20261023-sync-1';
import {createSyncEngine,clone} from './sync-core.js?v=20261023-sync-1';
export function mountSync({guest,validate,empty,onData,onMode,canApply,provider,fetcher,clientId=GOOGLE_SIGN_IN_CLIENT_ID}) {
  const $=id=>document.getElementById(id);
  let identity=null,token=null,expires=0,epoch=0,remote=null,engine=null,file=null,cacheKey=null,debounce=null,running=false;
  let authAttempt=0, sdk=null;
  const pageId=crypto.randomUUID();
  function note(text){$('sync-status').textContent=text;}
  function controls(){
    $('account-exit').hidden=!identity;
    $('google-signin-status').textContent=identity?'Signed in as '+identity.email:'';
    $('google-signout').hidden=!identity;
    $('sync-guidance').textContent=!identity?'Your study data saves automatically to Google Sheets':!file?'Choose your existing study workspace below.':'Changes save automatically. Offline edits stay on this device until you reconnect.';
    $('sync-manage').hidden=!remote;
    $('sync-manage-title').textContent=file?'Manage study workspaces':'Choose study data';
    $('sync-manage').open=!!remote&&!file;
    $('sync-active').hidden=!file;
    $('sync-active').textContent=file?'Current workspace: '+file.name:'';
    $('sync-connect').textContent=identity?'Reconnect to sync':'Sign in with Google';
  }
  const persistPrefix=id=>'magic-sync-v1:'+encodeURIComponent(identity.sub)+':'+id+':';
  function reset(){authAttempt++;epoch++;running=false;identity=null;token=null;remote=null;engine?.stop();engine=null;file=null;cacheKey=null;clearTimeout(debounce);onMode(null);onData(guest.load());$('sync-options').hidden=true;$('sync-file-link').hidden=true;$('sync-conflict').hidden=true;$('sync-retry').hidden=true;$('sync-cancel').hidden=true;$('sync-recovery').hidden=true;controls();}
  function cache(){const key=cacheKey;return {load(){const text=localStorage.getItem(key);return text?JSON.parse(text):null;},save(value){localStorage.setItem(key,JSON.stringify({...value,updatedAt:new Date().toISOString()}));},archive(value){localStorage.setItem(key+':recovery:'+crypto.randomUUID(),JSON.stringify({...value,updatedAt:new Date().toISOString()}));}};}
  function status(s){
    note((identity?.email||'')+' · '+s.message);
    $('sync-retry').hidden=!['uncertain','offline','waiting'].includes(s.phase);
    $('sync-connect').hidden=s.phase!=='reconnect';
    $('sync-connect').textContent='Reconnect to sync';
    $('sync-conflict').hidden=s.phase!=='conflict';
    if(s.phase==='conflict') {
      const choices=$('sync-copies');choices.replaceChildren();
      for(const r of s.conflicts){const option=document.createElement('option');option.value=r.id;option.textContent='Google copy '+r.id.slice(0,8)+' · '+r.data.sets.length+' sets, '+r.data.items.length+' questions';choices.append(option);}
    }
  }
  function localCandidates(fileId){const prefix=persistPrefix(fileId),found=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key.startsWith(prefix))continue;const value=JSON.parse(localStorage.getItem(key));validate(value.data);if(value.dirty||value.outbox)found.push({key,value});}return found;}
  async function open(selected, initial=null, recovered=null, skipRecovery=false) {
    if(running)throw Error('Wait for the current connection.');
    const generation=epoch;
    const candidates=localCandidates(selected.id);
    if(!initial&&!recovered&&!skipRecovery&&candidates.length){
      $('sync-recovery').hidden=false;$('sync-recoveries').replaceChildren();
      for(const candidate of candidates){const opt=document.createElement('option');opt.value=candidate.key;opt.textContent=(candidate.value.updatedAt||'Earlier local copy')+' · '+candidate.value.data.sets.length+' sets';$('sync-recoveries').append(opt);}
      $('sync-recover').onclick=()=>safe(()=>open(selected,null,$('sync-recoveries').value));
      $('sync-keep-cloud').onclick=()=>safe(()=>open(selected,null,null,true));
      note('Unsynced local edits exist for this account. Choose the local copy to recover; other copies remain stored.');return;
    }
    $('sync-recovery').hidden=true;
    engine?.stop();file=selected;cacheKey=persistPrefix(file.id)+pageId+':'+crypto.randomUUID();
    let seed=initial?{data:clone(initial),base:[],dirty:true,outbox:null}:recovered?JSON.parse(localStorage.getItem(recovered)):null;
    if(seed)cache().save(seed);
    const localCache=cache();
    // Keep a recovered pending copy until its new copy is confirmed saved.
    const recoveredKey=recovered;
    engine=createSyncEngine({remote:remote.forFile(file.id),cache:localCache,validate,empty,canApply,
      onData(data){if(generation===epoch&&file?.id===selected.id)onData(data);},onStatus(s){if(generation!==epoch||file?.id!==selected.id)return;status(s);if(s.phase==='saved'&&recoveredKey){const old=localStorage.getItem(recoveredKey);if(old&&JSON.stringify(JSON.parse(old).data)===JSON.stringify(engine.data()))localStorage.removeItem(recoveredKey);}}});
    onMode({label:identity.email,save(data){engine.save(data);clearTimeout(debounce);debounce=setTimeout(()=>engine?.cycle(),800);}});
    onData(engine.data());
    $('sync-file-link').href='https://docs.google.com/spreadsheets/d/'+file.id+'/edit';$('sync-file-link').hidden=false;
    controls();
    await engine.cycle();
  }
  function selectedFile(){const select=$('sync-files');return {id:select.value,name:select.selectedOptions[0]?.textContent};}
  async function list(){
    const generation=epoch;const files=await remote.list();if(generation!==epoch)return;
    $('sync-files').replaceChildren();
    for(const f of files){const option=document.createElement('option');option.value=f.id;option.textContent=f.name;$('sync-files').append(option);}
    $('sync-open').disabled=!files.length;$('sync-options').hidden=false;
    controls();
    note(file?'Connected · '+identity.email:'Google Sheets connected · choose your study workspace');
    if(file&&engine){await engine.cycle();return;}
    if(files.length===1){if(file?.id===files[0].id&&engine)await engine.cycle();else await open(files[0]);}
  }
  async function safe(fn, attempt=null){
    try{await fn();}catch(e){
      if(attempt!==null&&attempt!==authAttempt)return;
      $('sync-connect').hidden=false;
      $('sync-connect').textContent=identity?'Reconnect to sync':'Sign in with Google';
      note(e.auth?'Reconnect to resume syncing. Local changes remain stored.':e.message+' No automatic retry was made.');
    }finally{
      if(attempt===null||attempt===authAttempt){running=false;$('sync-cancel').hidden=true;if(!remote)$('sync-connect').hidden=false;}
    }
  }
  $('sync-connect').onclick=()=>{
    if(running||!sdk)return;
    const approved=identity?.sub,generation=epoch,attempt=++authAttempt;
    const current=()=>generation===epoch&&attempt===authAttempt;
    running=true;$('sync-connect').hidden=true;$('sync-cancel').hidden=false;
    note(identity?'Waiting for Google · reconnect with '+identity.email:'Waiting for Google · choose your account and allow sync access');
    const scopes=[SYNC_SCOPE,'openid','https://www.googleapis.com/auth/userinfo.email'];
    // The popup opens directly from the user's click, not after an async sign-in callback.
    try{
      const client=sdk.initTokenClient({client_id:clientId,scope:scopes.join(' '),include_granted_scopes:false,
        callback:r=>{
          if(!current())return;
          return safe(async()=>{
            if(r.error||!r.access_token||!sdk.hasGrantedAllScopes(r,...scopes))throw Error('Google access was not granted. Your study data is unchanged.');
            const candidate=r.access_token;
            const response=await (fetcher||fetch)('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+candidate},credentials:'omit',signal:AbortSignal.timeout(20000)});
            if(!current())return;
            if(!response.ok)throw Error('Could not verify the Google account.');
            const who=await response.json();
            if(!current())return;
            if(typeof who.sub!=='string'||!who.sub||typeof who.email!=='string'||!who.email||who.email_verified!==true)throw Error('Could not verify the Google account.');
            if(approved&&who.sub!==approved)throw Error('Choose the same account to reconnect. Sign out first to switch accounts. Nothing was uploaded.');
            if(!Number.isFinite(Number(r.expires_in))||Number(r.expires_in)<=30)throw Error('Google access expired. Try again.');
            identity={sub:who.sub,email:who.email};token=candidate;expires=Date.now()+(Number(r.expires_in)-30)*1000;
            // Existing workspace engines read the current token after reconnection.
            if(!remote)remote=createSyncRemote({owner:who.sub,validate,fetcher,access:()=>identity?.sub===who.sub&&generation===epoch&&Date.now()<expires?token:null});
            $('sync-connect').hidden=true;$('sync-disconnect').hidden=true;running=false;controls();
            await list();
          },attempt);
        },error_callback:()=>{
          if(!current())return;
          running=false;$('sync-cancel').hidden=true;$('sync-connect').hidden=false;
          note('Google window closed or blocked. Click Sign in with Google again to retry. Your study data is unchanged.');
        }});
      client.requestAccessToken({prompt:'select_account',...(identity?{login_hint:identity.email}:{})});
    }catch(e){running=false;$('sync-cancel').hidden=true;$('sync-connect').hidden=false;note('Could not open Google. Try again. Your study data is unchanged.');}
  };
  $('sync-cancel').onclick=()=>{authAttempt++;running=false;$('sync-cancel').hidden=true;$('sync-connect').hidden=false;note('Connection cancelled. Your study data is unchanged.');};
  $('sync-open').onclick=()=>safe(()=>open(selectedFile()));
  $('sync-refresh').onclick=()=>safe(list);
  $('sync-new').onclick=()=>safe(async()=>{
    if(running)return;running=true;
    const generation=epoch;note('Creating a separate empty synced workspace…');
    const created=await remote.create('Magic Spreadsheet study workspace '+new Date().toISOString());
    running=false;if(generation===epoch){const option=document.createElement('option');option.value=created.id;option.textContent=created.name;$('sync-files').append(option);$('sync-files').value=created.id;$('sync-open').disabled=false;await open(created,empty());}
  });
  $('google-signout').onclick=$('sync-disconnect').onclick=()=>{reset();$('sync-connect').hidden=false;note('Guest mode · Google study data is kept separately');};
  $('sync-retry').onclick=()=>engine?.cycle({retry:true});
  $('sync-use-local').onclick=()=>safe(async()=>{if(confirm('Continue with this device’s copy? Earlier Google versions remain in Sheets; any unsynced local copy is kept for recovery.')){engine.resolve('local');await engine.cycle();}});
  $('sync-use-cloud').onclick=()=>safe(async()=>{if(confirm('Continue with the selected Google copy? Earlier Google versions remain in Sheets; any unsynced local copy is kept for recovery.')){engine.resolve($('sync-copies').value);await engine.cycle();}});
  $('sync-export-copy').onclick=()=>{const record=engine?.status().conflicts.find(r=>r.id===$('sync-copies').value);if(!record)return;const url=URL.createObjectURL(new Blob([JSON.stringify(record.data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='magic-spreadsheet-conflict.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const poll=()=>{if(engine&&!document.hidden)engine.cycle();};
  const timer=setInterval(poll,15000);window.addEventListener('focus',poll);window.addEventListener('online',poll);
  controls();$('sync-connect').hidden=false;$('sync-connect').disabled=true;
  note('Guest mode · saved in this browser');
  const ready=(async()=>{
    if(!clientId||(!provider&&location.origin!==GOOGLE_SIGN_IN_ORIGIN)){$('sync-guidance').textContent='Google sync is available only in the local test. You can use guest mode here.';return;}
    try{
      sdk=provider||window.google?.accounts?.oauth2;
      if(!sdk)sdk=await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
        const timeout=setTimeout(()=>{script.remove();reject(Error('Google did not load'));},15000);
        script.onload=()=>{clearTimeout(timeout);window.google?.accounts?.oauth2?resolve(window.google.accounts.oauth2):reject(Error('Google unavailable'));};
        script.onerror=()=>{clearTimeout(timeout);reject(Error('Google unavailable'));};document.head.append(script);
      });
      $('sync-connect').disabled=false;
    }catch(e){$('sync-guidance').textContent='Google could not load. Reload this page to try again, or continue as a guest.';}
  })();
  return {ready,destroy(){reset();clearInterval(timer);window.removeEventListener('focus',poll);window.removeEventListener('online',poll);},get engine(){return engine;}};
}
