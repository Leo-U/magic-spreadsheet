// Append-only revisions preserve simultaneous device edits instead of overwriting them.
export const clone = value => JSON.parse(JSON.stringify(value));
export const revisionId = () => crypto.randomUUID();
export function revisionRows(rows, accountId, validate) {
  const records = new Map();
  for (const row of rows) {
    if (!row.length) continue;
    const [id, parents, owner, ...chunks] = row;
    if (!id || owner !== accountId) throw Error('Unexpected sync account or damaged revision.');
    const entry = {id, parents:JSON.parse(parents), data:validate(JSON.parse(chunks.join('')))};
    if (!Array.isArray(entry.parents) || entry.parents.some(p => typeof p !== 'string' || p === id)) throw Error('Invalid revision history.');
    if (records.has(id) && JSON.stringify(records.get(id)) !== JSON.stringify(entry)) throw Error('Conflicting revision IDs.');
    records.set(id, entry);
  }
  const visited=new Set(), visiting=new Set();
  function visit(id){if(visiting.has(id))throw Error('Cyclic revision history.');if(visited.has(id))return;visiting.add(id);for(const p of records.get(id)?.parents||[])visit(p);visiting.delete(id);visited.add(id);}
  for(const id of records.keys())visit(id);
  const ancestors = new Set();
  for (const record of records.values()) for (const p of record.parents) {
    if (!records.has(p)) throw Error('Incomplete revision history.');
    ancestors.add(p);
  }
  const heads = [...records.values()].filter(r => !ancestors.has(r.id));
  if (records.size && !heads.length) throw Error('Invalid revision history.');
  return {records, heads};
}
export function encodeRevision(record, owner) {
  const json = JSON.stringify(record.data);
  if (new TextEncoder().encode(json).length > 900000) throw Error('This workspace exceeds the current sync size limit. Export a backup.');
  const chars=Array.from(json),chunks=[];for (let i=0;i<chars.length;i+=18000) chunks.push(chars.slice(i,i+18000).join(''));
  return [record.id,JSON.stringify(record.parents),owner,...chunks];
}

export function createSyncEngine({remote, cache, validate, empty, onData=()=>{}, onStatus=()=>{}, canApply=()=>true, id=revisionId}) {
  let value=cache.load() || {data:empty(),base:[],dirty:false,outbox:null};
  validate(value.data);let busy=false,stopped=false,conflicts=[],phase='ready';
  const persist=()=>cache.save(clone(value));
  const emit=(p,message)=>{phase=p;onStatus({phase:p,message,conflicts:clone(conflicts),dirty:value.dirty});};
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function save(data) {
    validate(data);const next={...value,data:clone(data),dirty:true};
    cache.save(clone(next));value=next;emit('pending','Changes saved on this device; waiting to sync…');
  }
  async function cycle({retry=false}={}) {
    if(busy||stopped)return;busy=true;
    try {
      emit('checking','Checking Google Sheets…');
      let graph=await remote.read();if(stopped)return;
      if(value.outbox && graph.records.has(value.outbox.id)) {
        const sent=value.outbox;
        if(!same(graph.records.get(sent.id),sent))throw Error('Saved revision does not match.');
        value={...value,base:[sent.id],dirty:!same(value.data,sent.data),outbox:null};persist();
      }
      if(value.outbox && !retry) {emit('uncertain','A save could not be confirmed. Local edits are safe. Check again or retry the same revision.');return;}
      const headIds=graph.heads.map(r=>r.id).sort();
      const base=[...value.base].sort();
      if((graph.heads.length>1 && !(value.dirty&&same(headIds,base))) || (value.dirty&&!same(headIds,base)&&!value.outbox)) {
        conflicts=graph.heads;emit('conflict','Different edits exist on another device. Both copies are preserved. Choose a copy to continue.');return;
      }
      conflicts=[];
      if(!value.dirty&&!value.outbox) {
        if(!same(headIds,base)) {
          if(!canApply()){emit('waiting','New data is available. Finish editing to load it.');return;}
          const data=graph.heads[0]?.data || empty();
          value={data:clone(data),base:headIds,dirty:false,outbox:null};persist();onData(clone(data));
        }
        emit('saved','Saved to Google Sheets');return;
      }
      if(!value.outbox) {value.outbox={id:id(),parents:headIds,data:clone(value.data)};persist();}
      const sent=clone(value.outbox);emit('saving','Saving to Google Sheets…');
      await remote.append(sent);if(stopped)return;
      graph=await remote.read();if(stopped)return;
      if(!graph.records.has(sent.id)||!same(graph.records.get(sent.id),sent))throw Error('Save could not be confirmed.');
      value={...value,base:[sent.id],dirty:!same(value.data,sent.data),outbox:null};persist();
      if(graph.heads.length>1){conflicts=graph.heads;emit('conflict','Concurrent edits were preserved. Choose a copy to continue.');return;}
      emit(value.dirty?'pending':'saved',value.dirty?'More local edits are waiting to save…':'Saved to Google Sheets');
    } catch(e) {emit(e.auth?'reconnect':value.outbox?'uncertain':'offline',e.auth?'Reconnect Google to resume syncing. Local edits are safe.':value.outbox?'Save outcome is uncertain. Local edits are safe; no automatic write retry was made.':'Offline or unable to read Google Sheets. Local edits are saved on this device.');}
    finally {busy=false;}
  }
  function resolve(which) {
    if(busy||!conflicts.length)throw Error('Check sync again before choosing a copy.');
    const data=which==='local'?value.data:conflicts.find(r=>r.id===which)?.data;
    if(!data)throw Error('Choose a saved copy.');
    const next={data:clone(data),base:conflicts.map(r=>r.id).sort(),dirty:true,outbox:null};
    if(which!=='local'&&!same(value.data,data)){if(!cache.archive)throw Error('Local recovery storage is unavailable. Export your local copy first.');cache.archive(clone({...value,dirty:true}));}
    cache.save(clone(next));value=next;conflicts=[];onData(clone(data));emit('pending','Your choice is saved locally. Syncing it will preserve earlier versions.');
  }
  return {save,cycle,resolve, data:()=>clone(value.data), status:()=>({phase,busy,dirty:value.dirty,conflicts:clone(conflicts)}), stop(){stopped=true;}, startDirty(){save(value.data);}};
}
