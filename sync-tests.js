(async()=>{
const {createSyncEngine,revisionRows,encodeRevision,clone}=await import('./sync-core.js?v=20261023-sync-1');
const {createSyncRemote}=await import('./sync-remote.js?v=20261023-sync-1');
const {mountSync}=await import('./sync-ui.js?v=20261023-sync-1');
const {empty,validate}=await import('./model.js?v=20261023-entries-9');
let count=0;const check=(v,m)=>{if(!v)throw Error(m);count++;};const data=name=>({...empty(),sets:[{id:'s',name}]});
let rows=[],failRead=false,mode='',appendCount=0;const owner='owner';
const graph=()=>revisionRows(rows,owner,validate);
const remote={async read(){if(failRead)throw Error('offline');return graph();},async append(r){appendCount++;if(mode==='lost'){rows.push(encodeRevision(r,owner));throw Error('lost response');}if(mode==='before')throw Error('offline');rows.push(encodeRevision(r,owner));}};
function make(seed=null,allow=()=>true){let saved=seed?clone(seed):null;const archived=[],applied=[],statuses=[];const cache={load:()=>saved,save:v=>saved=clone(v),archive:v=>archived.push(clone(v))};let serial=0;
const engine=createSyncEngine({remote,cache,validate,empty,onData:v=>applied.push(v),onStatus:s=>statuses.push(s),canApply:allow,id:()=>crypto.randomUUID()});return {engine,cache,archived,applied,statuses,get saved(){return saved;}};}
const a=make();a.engine.save(data('first'));await a.engine.cycle();check(a.engine.status().phase==='saved'&&rows.length===1,'Initial save failed');check(a.saved.outbox===null&&!a.saved.dirty,'Acknowledgement missing');
const b=make();await b.engine.cycle();check(b.engine.data().sets[0].name==='first','Cross-device load failed');
a.engine.save(data('device A'));b.engine.save(data('device B'));await Promise.all([a.engine.cycle(),b.engine.cycle()]);check(graph().heads.length===2&&rows.length===3,'Concurrent edit was overwritten');
await a.engine.cycle();check(a.engine.status().phase==='conflict','Conflict not exposed');
a.engine.resolve('local');await a.engine.cycle();check(graph().heads.length===1&&a.engine.status().phase==='saved'&&rows.length===4,'Conflict resolution did not preserve parents');
await b.engine.cycle();check(b.engine.data().sets[0].name==='device A','Other device did not load resolution');
failRead=true;b.engine.save(data('offline pending'));await b.engine.cycle();check(b.saved.dirty&&b.engine.status().phase==='offline','Offline edit lost');
const recovery=make(b.saved);failRead=false;await recovery.engine.cycle();check(recovery.engine.status().phase==='saved'&&graph().heads[0].data.sets[0].name==='offline pending','Reload recovery failed');
mode='lost';recovery.engine.save(data('lost response'));await recovery.engine.cycle();check(recovery.saved.outbox&&recovery.engine.status().phase==='uncertain','Uncertain result not retained');const writes=appendCount;mode='';await recovery.engine.cycle();check(!recovery.saved.outbox&&appendCount===writes,'Uncertain success duplicated automatically');
mode='before';recovery.engine.save(data('not sent'));await recovery.engine.cycle();const uncertain=appendCount;mode='';await recovery.engine.cycle();check(appendCount===uncertain&&recovery.saved.outbox,'Uncertain failure automatically retried');await recovery.engine.cycle({retry:true});check(recovery.engine.status().phase==='saved','Explicit safe retry failed');
const stale=make({data:data('unsent local'),base:[],dirty:true,outbox:null});await stale.engine.cycle();check(stale.engine.status().phase==='conflict','Stale offline base not detected');stale.engine.resolve(graph().heads[0].id);check(stale.archived[0].data.sets[0].name==='unsent local','Discarded local edit not archived');await stale.engine.cycle();
const waiting=make(null,()=>false);await waiting.engine.cycle();check(waiting.engine.status().phase==='waiting'&&!waiting.applied.length,'Remote applied over unfinished editor');
const stopped=make();stopped.engine.stop();const before=rows.length;await stopped.engine.cycle();check(rows.length===before&&!stopped.applied.length,'Stopped account mutated');
const duplicate=clone(rows);duplicate.push(clone(rows[0]));check(revisionRows(duplicate,owner,validate).records.size===rows.length,'Duplicate immutable revision not idempotent');
function rejects(fn,message){let fail=false;try{fn();}catch(_){fail=true;}check(fail,message);}
rejects(()=>revisionRows(rows,'another-account',validate),'Cross-account history accepted');
rejects(()=>revisionRows([['x','["missing"]',owner,JSON.stringify(empty())]],owner,validate),'Missing parent accepted');
rejects(()=>revisionRows([['x','["y"]',owner,JSON.stringify(empty())],['y','["x"]',owner,JSON.stringify(empty())]],owner,validate),'Cycle accepted');
rejects(()=>encodeRevision({id:'x',parents:[],data:{huge:'x'.repeat(1000000)}},owner),'Oversize snapshot accepted');
// Edits arriving during an in-flight save remain queued for the next revision.
const overlapping=make();await overlapping.engine.cycle();overlapping.engine.save(data('first in flight'));
const appendNormally=remote.append;let release;
remote.append=async r=>{await new Promise(resolve=>{release=resolve;});return appendNormally(r);};
const inFlight=overlapping.engine.cycle();while(!release)await Promise.resolve();overlapping.engine.save(data('newer edit'));release();await inFlight;
check(overlapping.saved.dirty&&overlapping.saved.data.sets[0].name==='newer edit','In-flight save discarded newer edit');remote.append=appendNormally;await overlapping.engine.cycle();check(graph().heads[0].data.sets[0].name==='newer edit','Queued newer edit was not saved');
const unicode=data('🙂'.repeat(12000)),encoded=encodeRevision({id:'unicode',parents:[],data:unicode},owner);
check(revisionRows([encoded],owner,validate).heads[0].data.sets[0].name===unicode.sets[0].name,'Chunked Unicode did not round trip');
check(encoded.slice(3).every(chunk=>[...chunk].every(c=>c.length===2||c.charCodeAt(0)<0xD800||c.charCodeAt(0)>0xDFFF)),'Unicode surrogate split between cells');
const blockedCache=createSyncEngine({remote,cache:{load:()=>null,save(){throw Error('quota');}},validate,empty});const unchangedWrites=appendCount;rejects(()=>blockedCache.save(data('quota blocked')),'Storage failure was ignored');check(appendCount===unchangedWrites&&blockedCache.data().sets.length===0,'Storage failure changed active state or uploaded');blockedCache.stop();
// Identity and transport UI tests have no actual Google requests.
const guestBefore=localStorage.getItem('learning-insights-v1');let cfg,guestSaves=0,active=null,display=null,who=owner,apiRows=[],apiCalls=[];
const provider={initTokenClient(c){cfg=c;return {requestAccessToken(){}};},hasGrantedAllScopes(){return true;}};
const fetcher=async(url,o={})=>{apiCalls.push({url,method:o.method||'GET',body:o.body});let result;
if(url.includes('userinfo'))result={sub:who,email:'test@example.test',email_verified:true};
else if(url.includes('drive/v3/files?')&&!o.method)result={files:[{id:'fake_sheet',name:'Test workspace',appProperties:{owner,magicSync:'v1'}}]};
else if(url.includes('drive/v3/files?')&&o.method==='POST')result={id:'new_fake_sheet',name:'Empty test'};
else if(url.includes(':append')){const row=JSON.parse(o.body).values[0];apiRows.push(row);result={updates:{updatedRows:1}};}
else if(url.includes('/values/'))result={values:[['magic-sync-v1',owner],...apiRows]};
else result={};return {ok:true,json:async()=>result};};
const ui=mountSync({guest:{load:()=>data('PRIVATE GUEST MUST NOT UPLOAD'),save(){guestSaves++;}},validate,empty,onData:v=>display=v,onMode:v=>active=v,canApply:()=>true,provider,fetcher,clientId:'test'});
ui.signedIn({sub:owner,email:'test@example.test'});check(!apiCalls.length&&display.sets[0].name==='PRIVATE GUEST MUST NOT UPLOAD','Sign-in uploaded or linked guest data');
document.getElementById('sync-connect').click();check(cfg.scope.includes('/drive.file')&&!cfg.scope.includes('/auth/spreadsheets')&&cfg.include_granted_scopes===false,'Broad scope requested');
who='different';await cfg.callback({access_token:'synthetic-memory-only',expires_in:3600});check(apiCalls.length===1&&!active,'Mismatched account connected');
who=owner;document.getElementById('sync-connect').click();await cfg.callback({access_token:'synthetic-memory-only',expires_in:3600});check(active&&display.sets.length===0,'Remote workspace did not replace view separately');check(!apiCalls.some(c=>c.body?.includes('PRIVATE GUEST')),'Guest data transmitted');
active.save(data('Synced synthetic edit'));await ui.engine.cycle();check(apiRows.length===1&&!guestSaves,'Account save wrote guest adapter');check(!localStorage.getItem('learning-insights-v1')||localStorage.getItem('learning-insights-v1')===guestBefore,'Guest key changed');
check(apiCalls.find(c=>c.url.includes(':append')).url.includes('valueInputOption=RAW'),'Formula injection protection missing');
document.getElementById('sync-disconnect').click();check(active===null&&display.sets[0].name==='PRIVATE GUEST MUST NOT UPLOAD','Guest restoration failed');
check(!Object.values(localStorage).some(s=>s.includes('synthetic-memory-only')),'Access token persisted');
ui.destroy();document.title='PASS '+count+' sync safety, recovery, conflict and account-isolation checks';
})().catch(e=>document.title='FAIL '+e.message);
