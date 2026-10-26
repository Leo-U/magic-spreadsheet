import {localDay} from './calendar.js?v=20261026-local-study-1';
// Deterministic repair: no records removed, original IDs retained for audit.
// Called on a copy during load/import; browser storage is not written on startup.
export function prepareHistory(state) {
  if(!state||!Array.isArray(state.snapshots))return state;
  const occupied=new Set();
  for(const key of ['sets','items','reviews'])for(const item of state[key]||[])if(item&&typeof item.id==='string')occupied.add(item.id);
  const reserved=new Set([...occupied,...state.snapshots.filter(Boolean).map(s=>s.id)]);
  const mapping=new Map();
  state.snapshots.forEach((entry,index)=>{
    if(!entry||typeof entry!=='object')return;
    const original=entry.id;
    if(typeof original!=='string'||!original||occupied.has(original)){
      let id=`legacy-snapshot-${index}`,suffix=0;
      while(reserved.has(id))id=`legacy-snapshot-${index}-${++suffix}`;
      if(!state.historyIdRepairs)state.historyIdRepairs=[];
      state.historyIdRepairs.push({index,previousId:original===undefined?null:original,newId:id});
      entry.id=id;reserved.add(id);
    }
    occupied.add(entry.id);
    if(!mapping.has(original))mapping.set(original,[]);
    mapping.get(original).push(entry.id);
  });
  if(Array.isArray(state.deletedHistory))for(const marker of state.deletedHistory){
    if(!marker||typeof marker!=='object')continue;
    if(Array.isArray(marker.snapshotIds)) {
      marker.snapshotIds=[...new Set(marker.snapshotIds.flatMap(id=>mapping.get(id)||[id]))];
    } else if(typeof marker.setId==='string'&&typeof marker.day==='string') {
      // Freeze old day deletion to entries already stored, never future charts.
      marker.snapshotIds=state.snapshots.filter(s=>s&&s.setId===marker.setId&&Number.isFinite(Date.parse(s.at))&&localDay(s.at)===marker.day).map(s=>s.id);
    }
  }
  return state;
}
export function hiddenSnapshotIds(state) {
  const hidden=new Set();
  for(const marker of state.deletedHistory||[]){
    if(Array.isArray(marker.snapshotIds))marker.snapshotIds.forEach(id=>hidden.add(id));
    else for(const entry of state.snapshots)if(entry.setId===marker.setId&&localDay(entry.at)===marker.day)hidden.add(entry.id);
  }
  return hidden;
}
