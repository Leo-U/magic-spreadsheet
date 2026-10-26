import {activeSets} from './sets.js?v=20261026-local-study-1';
import {localDay} from './calendar.js?v=20261026-local-study-1';
import {prepareHistory} from './history-data.js?v=20261026-local-study-1';
export const newId = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const empty = () => ({version:1, sets:[], items:[], reviews:[], snapshots:[]});
export function addSet(state,name) { const set={id:newId(),name:name.trim()}; if(!set.name) throw Error('Enter a set name.'); state.sets.push(set); return set; }
export function addItem(state,setId,question,answer) { if(!activeSets(state).some(s=>s.id===setId)||!question.trim()||!answer.trim()) throw Error('A question and answer are required.'); const item={id:newId(),setId,question:question.trim(),answer:answer.trim(),green:false,yellow:false,red:false,difficult:false}; state.items.push(item); return item; }
export function progress(state,setId) { const items=activeItems(state).filter(q=>q.setId===setId); const green=items.filter(q=>effectiveMark(q)==='green').length; return {total:items.length,green,percent:items.length?green/items.length*100:0}; }
export function color(p) { return p>=90?'#93c47d':p>=80?'#b6d7a8':p>=70?'#ffd966':p>=60?'#f6b26b':'#dd7e6b'; }
export function snapshot(state,setId,at=new Date().toISOString()) { const s={id:newId(),setId,at,...progress(state,setId)}; state.snapshots.push(s); return s; }
// CSV and tab-separated text, including quoted delimiters and multiline answers.
export function parsePairs(text) { text=text.replace(/^\uFEFF/,''); const delimiter=text.split(/\r?\n/)[0].includes('\t')?'\t':','; let rows=[],row=[],cell='',quoted=false; for(let i=0;i<text.length;i++){const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw Error('Unexpected quote in input.');}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;} if(quoted)throw Error('Unclosed quote in input.');row.push(cell);rows.push(row);rows=rows.filter(r=>r.some(c=>c.trim()));if(rows[0]?.[0]?.trim().toLowerCase()==='question'&&rows[0]?.[1]?.trim().toLowerCase()==='answer')rows.shift();if(!rows.length)throw Error('No questions found.');if(rows.some(r=>r.length!==2||!r[0].trim()||!r[1].trim()))throw Error('Each row must contain exactly two nonempty columns: question and answer. Headings alone are not questions.');return rows; }
export function validate(s) { const fail=()=>{throw Error('Invalid or unsupported backup. Nothing was replaced.');}; if(!s||s.version!==1||!['sets','items','reviews','snapshots'].every(k=>Array.isArray(s[k])))fail(); const ids=new Set(); const id=x=>{if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id))fail();ids.add(x.id);}; const str=x=>typeof x==='string'&&x.trim().length>0; const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x)); const flags=x=>['green','yellow','red','difficult'].every(k=>typeof x[k]==='boolean');s.sets.forEach(x=>{id(x);if(!str(x.name))fail();}); const sets=new Set(s.sets.map(x=>x.id));s.items.forEach(x=>{id(x);if(!sets.has(x.setId)||!str(x.question)||!str(x.answer)||!flags(x))fail();});const items=new Set(s.items.map(x=>x.id));s.reviews.forEach(x=>{id(x);if(!items.has(x.itemId)||!date(x.at)||!flags(x))fail();});s.snapshots.forEach(x=>{id(x);if(!sets.has(x.setId)||!date(x.at)||!Number.isInteger(x.total)||x.total<0||!Number.isInteger(x.green)||x.green<0||x.green>x.total||!Number.isFinite(x.percent)||Math.abs(x.percent-(x.total?100*x.green/x.total:0))>0.00001)fail();});
  if(s.deletedHistory!==undefined) {
    if(!Array.isArray(s.deletedHistory))fail();
    const snapshots=new Set(s.snapshots.map(r=>r.id));
    for(const entry of s.deletedHistory){
      if(!entry||!date(entry.at))fail();
      if(Array.isArray(entry.snapshotIds)){
        if(!entry.snapshotIds.length||new Set(entry.snapshotIds).size!==entry.snapshotIds.length||entry.snapshotIds.some(id=>!snapshots.has(id)))fail();
      }else if(!sets.has(entry.setId)||typeof entry.day!=='string'||!s.snapshots.some(r=>r.setId===entry.setId&&localDay(r.at)===entry.day))fail();
    }
  }
  if(s.questionDeletions!==undefined){
    if(!Array.isArray(s.questionDeletions))fail();
    const deleted=new Set();
    for(const entry of s.questionDeletions){if(!entry||!items.has(entry.itemId)||!date(entry.at)||deleted.has(entry.itemId))fail();deleted.add(entry.itemId);}
  }
  if(s.setDeletions!==undefined){
    if(!Array.isArray(s.setDeletions))fail();
    const deleted=new Set();
    for(const entry of s.setDeletions){if(!entry||!sets.has(entry.setId)||!date(entry.at)||deleted.has(entry.setId))fail();deleted.add(entry.setId);}
  }
  return s; }

export function changeFlag(state,id,flag,value) {
  if(!['green','yellow','red','difficult'].includes(flag)||typeof value!=='boolean') throw Error('Invalid mark.');
  const q=state.items.find(q=>q.id===id);
  if(!q) throw Error('Question not found.');
  q[flag]=value;
}
export function chartProgress(state,setIds,at=new Date().toISOString()) {
  const ids=[...new Set(setIds)];
  if(!ids.length) throw Error('Select at least one subject.');
  if(ids.some(id=>!activeSets(state).some(s=>s.id===id))) throw Error('Subject not found.');
  prepareHistory(state);
  for(const setId of ids) {
    const entry=snapshot(state,setId,at);
    for(const q of activeItems(state).filter(q=>q.setId===setId)) {
      const mark=effectiveMark(q);
      state.reviews.push({id:newId(),itemId:q.id,snapshotId:entry.id,at,green:mark==='green',yellow:mark==='yellow',red:mark==='red',difficult:q.difficult,source:'chart'});
    }
  }
}

export function deleteHistoryEntry(state,snapshotId,at=new Date().toISOString()) {
  prepareHistory(state);
  if(!state.snapshots.some(s=>s.id===snapshotId))throw Error('History entry not found.');
  if(!state.deletedHistory)state.deletedHistory=[];
  if(!state.deletedHistory.some(d=>d.snapshotIds.includes(snapshotId)))state.deletedHistory.push({snapshotIds:[snapshotId],at});
}
export function undoHistoryDeletion(state) {
  if(!state.deletedHistory?.length)throw Error('No entry deletion to undo.');
  return state.deletedHistory.pop();
}
export function prepareStoredState(raw) {
  return validate(prepareHistory(JSON.parse(JSON.stringify(raw))));
}

export function activeItems(state) {
  const deleted=new Set((state.questionDeletions||[]).map(d=>d.itemId));
  const sets=new Set(activeSets(state).map(s=>s.id));
  return state.items.filter(q=>sets.has(q.setId)&&!deleted.has(q.id));
}
export function deleteQuestion(state,itemId,at=new Date().toISOString()) {
  if(!state.items.some(q=>q.id===itemId)) throw Error('Question not found.');
  if(!state.questionDeletions) state.questionDeletions=[];
  if(!state.questionDeletions.some(d=>d.itemId===itemId)) state.questionDeletions.push({itemId,at});
}
export function undoQuestionDeletion(state) {
  if(!state.questionDeletions?.length) throw Error('No question deletion to undo.');
  return state.questionDeletions.pop();
}

export function effectiveMark(item) { return item.red?'red':item.yellow?'yellow':item.green?'green':null; }
export function selectMark(state,id,mark) {
  if(mark!==null&&!['green','yellow','red'].includes(mark))throw Error('Invalid color.');
  const q=state.items.find(q=>q.id===id);
  if(!q)throw Error('Question not found.');
  for(const flag of ['green','yellow','red'])q[flag]=flag===mark;
}

export function deleteSet(state,setId,at=new Date().toISOString()) {
  if(!state.sets.some(s=>s.id===setId))throw Error('Question set not found.');
  if(!state.setDeletions)state.setDeletions=[];
  if(!state.setDeletions.some(d=>d.setId===setId))state.setDeletions.push({setId,at});
}
export function undoSetDeletion(state){
  if(!state.setDeletions?.length)throw Error('No set deletion to undo.');
  return state.setDeletions.pop();
}
