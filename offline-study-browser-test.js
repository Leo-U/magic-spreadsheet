// Disposable WebKit profile; all Google responses and study records are synthetic.
imports.gi.versions.Gtk='3.0';imports.gi.versions.WebKit2='4.0';
const {Gtk,WebKit2,GLib}=imports.gi;Gtk.init(null);
const manager=new WebKit2.UserContentManager();
manager.add_script(new WebKit2.UserScript(imports.byteArray.toString(GLib.file_get_contents('sync-app-bootstrap.js')[1])+`
const baseFetch=window.fetch;t.cloudCalls=0;
if(sessionStorage.getItem('offline-rows'))t.rows=JSON.parse(sessionStorage.getItem('offline-rows'));
window.fetch=async(url,options={})=>{
 if(String(url).startsWith('https://')){t.cloudCalls++;if(t.revoked)return {ok:false,status:401,json:async()=>({})};}
 return baseFetch(url,options);
};
if(sessionStorage.getItem('offline-stage')==='3')Object.defineProperty(window,'google',{get(){throw Error('Synthetic unavailable SDK');}});
`,WebKit2.UserContentInjectedFrames.TOP_FRAME,WebKit2.UserScriptInjectionTime.START,null,null));
const win=new Gtk.OffscreenWindow();win.set_default_size(Number(ARGV[0]||390),900);
const view=new WebKit2.WebView({web_context:WebKit2.WebContext.new_ephemeral(),user_content_manager:manager});win.add(view);win.show_all();
view.connect('load-changed',(_,event)=>{if(event!==WebKit2.LoadEvent.FINISHED)return;view.run_javascript(`(async()=>{
const wait=ms=>new Promise(r=>setTimeout(r,ms));await wait(650);
const $=id=>document.getElementById(id),check=(v,m)=>{if(!v)throw Error(m)},t=window.__syncTest;
const marker='magic-study-device-v1',tab='magic-study-tab-v1',auth='magic-google-session-v1';
const cached=()=>JSON.parse(localStorage.getItem(JSON.parse(sessionStorage.getItem(tab)||localStorage.getItem(marker)).cacheKey));
const reload=n=>{sessionStorage.setItem('offline-rows',JSON.stringify(t.rows));sessionStorage.setItem('offline-stage',String(n));location.reload();};
const stage=Number(sessionStorage.getItem('offline-stage')||0);
if(stage===0){
 $('sync-connect').click();await t.oauthConfig.callback({access_token:'SYNTHETIC_TOKEN_ONLY',expires_in:3600});
 $('set-name').value='Disconnected study';$('new-set').requestSubmit();
 document.querySelector('[data-open-set]').click();$('add-question').click();$('question').value='Synthetic study prompt';$('answer').value='Synthetic answer';$('editor').requestSubmit();document.querySelector('[data-flag="green"]').click();await wait(1400);
 check($('sync-status').textContent==='Saved to Google Sheets','Initial save failed');
 check(localStorage.getItem(marker)&&!localStorage.getItem(marker).includes('SYNTHETIC_TOKEN_ONLY'),'Device collection or token isolation failed');
 sessionStorage.setItem('offline-route',location.hash);
 const saved=JSON.parse(sessionStorage.getItem(auth));saved.expires=Date.now()-1;sessionStorage.setItem(auth,JSON.stringify(saved));
 // A fresh tab can use the device marker without inheriting an OAuth session.
 sessionStorage.removeItem(tab);reload(1);
}else if(stage===1){
 check(location.hash===sessionStorage.getItem('offline-route')&&!$('detail-view').hidden,'Expired token locked the cached questions');
 check(document.querySelector('[data-flag="green"]').checked,'Previously synced mark missing');
 check(t.cloudCalls===0&&t.writes===0&&!sessionStorage.getItem(auth),'Expired token accessed Google');
 check(!$('sync-reconnect').hidden&&!$('sync-reconnect').disabled,'Reconnect unavailable beside questions');
 document.querySelector('[data-flag="red"]').click();await wait(1100);
 check(cached().dirty&&cached().data.items[0].red&&t.writes===0,'Red mark not queued offline');
 check($('sync-status').textContent.includes('Saved on this device')&&!$('detail-view').hidden,'Offline state not clearly usable');const stale=JSON.parse(localStorage.getItem(marker));stale.cacheKey+='-missing-clean-cache';sessionStorage.setItem(tab,JSON.stringify(stale));reload(2);
}else if(stage===2){
 check(document.querySelector('[data-flag="red"]').checked&&t.writes===0,'Offline red mark lost on reload');
 document.querySelector('[data-flag="yellow"]').click();await wait(1100);check(cached().data.items[0].yellow,'Yellow mark not saved offline');
 $('sync-reconnect').click();t.user={sub:'other-owner',email:'other@example.test',email_verified:true};await t.oauthConfig.callback({access_token:'WRONG_OWNER_ONLY',expires_in:3600});delete t.user;
 check(document.querySelector('[data-flag="yellow"]').checked&&t.writes===0,'Different Google account received local edits');
 $('sync-reconnect').click();await t.oauthConfig.callback({access_token:'RENEWED_SYNTHETIC_ONLY',expires_in:3600});
 check(t.writes===1&&!cached().dirty&&t.lastAuthorization==='Bearer RENEWED_SYNTHETIC_ONLY','Queued offline marks did not sync on verified reconnect');
 check($('sync-status').textContent==='Saved to Google Sheets'&&$('sync-reconnect').hidden,'Connected status incorrect');
 t.revoked=true;document.querySelector('[data-flag="red"]').click();await wait(1100);
 check(cached().data.items[0].red&&cached().dirty&&!sessionStorage.getItem(auth),'Revoked connection discarded a mark');
 check(!$('sync-reconnect').hidden&&!$('detail-view').hidden,'Revocation blocked studying');reload(3);
}else if(stage===3){
 check(document.querySelector('[data-flag="red"]').checked&&!$('detail-view').hidden,'Unavailable Google SDK hid cached questions');
 check($('sync-reconnect').disabled,'Unavailable SDK left misleading reconnect enabled');
 document.querySelector('[data-flag="green"]').click();await wait(1100);
 check(cached().data.items[0].green&&t.writes===0,'Green mark could not save without Google SDK');
 $('back-to-chart').click();check(!$('chart-progress').disabled,'Offline Chart Progress disabled');$('chart-progress').click();await wait(1100);
 check(cached().dirty&&cached().data.snapshots.length===1&&t.writes===0,'Offline chart progress not saved');reload(4);
}else if(stage===4){
 check(location.hash==='#chart'&&document.querySelectorAll('.history-cell').length===1,'Offline progress lost on reload');
 $('sync-reconnect').click();await t.oauthConfig.callback({access_token:'FINAL_SYNTHETIC_ONLY',expires_in:3600});
 check(t.writes===1&&cached().data.items[0].green&&cached().data.snapshots.length===1&&!cached().dirty,'Reconnect lost offline green mark or progress');
 check(!t.creates,'Reconnect created replacement study file');
 document.querySelector('[data-open-set]').click();
 $('sync-connect').click();await t.oauthConfig.callback({access_token:'SHORT_SYNTHETIC_ONLY',expires_in:31});await wait(1100);
 const requests=t.cloudCalls,writes=t.writes;document.querySelector('[data-flag="yellow"]').click();await wait(1100);
 check(cached().dirty&&cached().data.items[0].yellow&&t.cloudCalls===requests&&t.writes===writes,'In-tab token expiry sent a stale token or blocked marks');
 check(!$('sync-reconnect').hidden&&!$('detail-view').hidden,'Expired in-tab session hid questions');
 document.title='SNAPSHOT disconnected';await wait(500);
 $('sync-reconnect').click();await t.oauthConfig.callback({access_token:'FINAL_SYNTHETIC_ONLY',expires_in:3600});
 check(!cached().dirty&&cached().data.items[0].yellow,'In-tab expired marks did not reconnect');
 for(const value of Object.values(localStorage))check(!value.includes('SYNTHETIC_ONLY')&&!value.includes('SYNTHETIC_TOKEN_ONLY')&&!value.includes('WRONG_OWNER_ONLY'),'Token persisted in local storage');
 $('google-signout').click();check(!localStorage.getItem(marker)&&!sessionStorage.getItem(tab)&&!sessionStorage.getItem(auth),'Sign-out kept automatic offline reopening');reload(5);
}else if(stage===5){
 check(location.hash==='#home'&&$('detail-view').hidden,'Sign-out reopened account study cache');
 localStorage.setItem(marker,JSON.stringify({clientId:'575432005951-4cp6hmvfn3rdpr7566t9cp35gqm53i26.apps.googleusercontent.com',identity:{sub:'another-account',email:'other@example.test'},file:{id:'test_sheet'},cacheKey:'learning-insights-v1'}));reload(6);
}else{
 check(location.hash==='#home'&&$('detail-view').hidden&&t.writes===0,'Malformed cross-account cache reference accepted');
 document.title='PASS expired/revoked Google, unavailable SDK, offline red/yellow/green and charting, reload, verified reconnect, account mismatch, guest isolation and sign-out at '+innerWidth;
}
})().catch(e=>document.title='FAIL '+e.message);void 0;`,null,(v,r)=>v.run_javascript_finish(r));});
GLib.timeout_add(GLib.PRIORITY_DEFAULT,100,()=>{const title=view.get_title()||'';if(title==='SNAPSHOT disconnected'){view.run_javascript("document.title='Disconnected study preview';void 0;",null,(v,r)=>v.run_javascript_finish(r));view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE,WebKit2.SnapshotOptions.NONE,null,(v,r)=>v.get_snapshot_finish(r).writeToPNG('/tmp/magic-disconnected-study-'+(ARGV[0]||390)+'.png'));}if(/^(PASS|FAIL)/.test(title)){print(title);if(title.startsWith('FAIL'))imports.system.exit(1);view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE,WebKit2.SnapshotOptions.NONE,null,(v,r)=>{v.get_snapshot_finish(r).writeToPNG('/tmp/magic-offline-study-'+(ARGV[0]||390)+'.png');Gtk.main_quit();});return GLib.SOURCE_REMOVE;}return GLib.SOURCE_CONTINUE;});
view.load_uri('http://127.0.0.1:8765/#home');GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,45,()=>{printerr('TIMEOUT '+view.get_title());imports.system.exit(1);});Gtk.main();
