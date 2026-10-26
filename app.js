import {activeSets} from './sets.js';
import {empty,addSet,addItem,progress,color,chartProgress,deleteSet,undoSetDeletion,effectiveMark,selectMark,activeItems,deleteQuestion,undoQuestionDeletion,deleteHistoryEntry,undoHistoryDeletion,changeFlag,parsePairs,validate,prepareStoredState} from './model.js?v=20261023-entries-9';
import {STUDY_TIME_ZONE} from './calendar.js';
import {createStorage} from './storage.js?v=20261023-entries-9';
const guestStorage=createStorage({empty,validate,prepareStoredState});
let accountStorage=null,guestChosen=false;
let restoringSession=false;
try{restoringSession=!!(localStorage.getItem('magic-study-device-v1')||sessionStorage.getItem('magic-study-tab-v1'));const saved=JSON.parse(sessionStorage.getItem('magic-google-session-v1')||'null');restoringSession=restoringSession||!!(saved?.token&&saved?.identity?.sub&&Number.isFinite(saved.expires)&&saved.expires>Date.now());}catch{}

const storage={load:()=>guestStorage.load(),save:data=>(accountStorage||guestStorage).save(data)};
import {historyRows,shortDate} from './overview.js?v=20261023-entries-9';
import {createTransactions} from './transactions.js?v=20261023-radios-3';
const transactions=createTransactions(storage);
const $=s=>document.querySelector(s);let state,selected,account=false,editing=null,shown=new Set(),chartSelection=new Set(),chartDeselection=new Set(),selectedHistory=null;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Date(s).toLocaleString(undefined,{timeZone:STUDY_TIME_ZONE});
function message(text,error=false){$('#status').textContent=text;$('#status').className=error?'error':'';}
function commit(change,success,undoable=false,prepareUndo){try{state=transactions.commit(state,change,undoable,prepareUndo);render();message(success);return true;}catch(e){message(`Could not save: ${e.message}`,true);return false;}}
function resetEditor(){editing=null;$('#editor-panel').open=false;$('#editor').reset();$('#editor-title').textContent='Add a question';$('#save-item').textContent='Add question';$('#cancel-edit').hidden=true;$('#delete-question').hidden=true;}
function render(){
  if(selected&&!activeSets(state).some(s=>s.id===selected)){selected=null;history.replaceState(null,'','#chart');}
  $('#session-loading').hidden=!restoringSession;
  $('#account-view').hidden=restoringSession||!account;
  $('#save-indicator').hidden=restoringSession||account;
  $('#account-link').setAttribute('aria-current',account?'page':'false');
  $('#home-link').hidden=account;
  $('#back-to-chart').hidden=!selected;
  $('#chart-view').hidden=restoringSession||account||!!selected;
  $('#status').hidden=restoringSession||account;
  $('.undo-bar').hidden=restoringSession||account;
  document.title=account?'Magic Spreadsheet':selected?state.sets.find(s=>s.id===selected).name+' · Magic Spreadsheet':'Chart · Magic Spreadsheet';
  $('#detail-view').hidden=restoringSession||!selected;
  $('#workspace').hidden=!selected;
  $('#undo-question').hidden=!state.questionDeletions?.length;
  $('#undo').hidden=!selected||!transactions.canUndo;
  renderOverview();
  if(!selected){$('#questions').replaceChildren();$('#title').textContent='';return;}
$('#title').textContent=state.sets.find(s=>s.id===selected).name;const p=progress(state,selected);$('#stats').innerHTML=`<div class="stat"><strong>${p.total}</strong>questions</div><div class="stat"><strong>${p.percent.toFixed(0)}%</strong>marked green</div><div class="stat"><strong>${activeItems(state).filter(q=>q.setId===selected&&effectiveMark(q)==='red').length}</strong>difficult</div>`;const items=activeItems(state).filter(q=>q.setId===selected&&(!$('#difficult-only').checked||effectiveMark(q)==='red'));$('#questions').innerHTML=items.map(q=>{return `<article class="question" data-rating="${effectiveMark(q)||''}" data-id="${escape(q.id)}"><div class="question-heading"><h4>${escape(q.question)}</h4><button type="button" class="edit-icon secondary" data-action="edit" aria-label="Edit question" title="Edit question"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z"/></svg></button></div><div class="question-controls"><button class="secondary" data-action="reveal" aria-expanded="${shown.has(q.id)}">${shown.has(q.id)?'Hide':'Reveal'} answer</button><div class="marks">${['green','yellow','red'].map(f=>`<label class="${f}" title="${f[0].toUpperCase()+f.slice(1)} mark"><input type="radio" name="mark-${escape(q.id)}" data-flag="${f}" aria-label="${f[0].toUpperCase()+f.slice(1)} mark" ${effectiveMark(q)===f?'checked':''}></label>`).join('')}</div></div>${shown.has(q.id)?`<div class="answer" id="answer-${escape(q.id)}">${escape(q.answer)}</div>`:''}</article>`;}).join('')||'<p class="panel">No questions in this view. Add questions below or turn off the difficult-only filter.</p>';}
try{state=storage.load();applyRoute(false);}catch(e){message(`Stored data could not be loaded: ${e.message} Existing data has not been overwritten.`,true);document.querySelectorAll('button,input,textarea').forEach(e=>e.disabled=true);throw e;}
$('#new-set').onsubmit=e=>{e.preventDefault();if(commit(s=>{addSet(s,$('#set-name').value);},'Set created. Open its name in the chart to add questions.')){$('#new-set').reset();$('#set-name').focus();}};
$('#sample').onclick=()=>{let id;if(commit(s=>{id=addSet(s,'Sample · Everyday science').id;addItem(s,id,'What does a mitochondrion do?','It produces most of the ATP used to power cellular processes.');addItem(s,id,'Why does ice float on water?','Its crystal structure makes solid water less dense than liquid water.');addItem(s,id,'What is a light-year?','The distance light travels in one year.');},'Sample set added.')){navigate('#set/'+encodeURIComponent(id));}};
$('#rename').onclick=()=>{const name=prompt('Set name',state.sets.find(s=>s.id===selected).name);if(name?.trim())commit(s=>{s.sets.find(s=>s.id===selected).name=name.trim();},'Set renamed; history preserved.');};
$('#difficult-only').onchange=render;

$('#questions').onclick=e=>{const radio=e.target.closest('input[type="radio"][data-flag]');if(radio){const q=state.items.find(q=>q.id===radio.closest('[data-id]').dataset.id);if(effectiveMark(q)===radio.dataset.flag){e.preventDefault();saveQuestionMark(q.id,null,radio.dataset.flag);}return;}const b=e.target.closest('[data-action]');if(!b)return;const id=b.closest('[data-id]').dataset.id;const q=state.items.find(q=>q.id===id);if(b.dataset.action==='reveal'){shown.has(id)?shown.delete(id):shown.add(id);render();}if(b.dataset.action==='edit'){$('#editor-panel').open=true;editing=id;$('#question').value=q.question;$('#answer').value=q.answer;$('#editor-title').textContent='Edit question';$('#save-item').textContent='Save changes';$('#cancel-edit').hidden=false;$('#delete-question').hidden=false;$('#question').focus();}};
$('#editor').onsubmit=e=>{e.preventDefault();const question=$('#question').value.trim(),answer=$('#answer').value.trim();if(!question||!answer){message('Enter both a question and an answer.',true);return;}if(commit(s=>{if(editing){Object.assign(s.items.find(q=>q.id===editing),{question,answer});}else addItem(s,selected,question,answer);},editing?'Question updated; review history preserved.':'Question added.'))resetEditor();};
$('#cancel-edit').onclick=resetEditor;
$('#add-question').onclick=()=>{resetEditor();$('#editor-panel').open=true;$('#question').focus();};
$('#chart-progress').onclick=()=>commit(s=>chartProgress(s,[...chartSelection]),'New progress entries saved for selected subjects.');
$('#pairs-file').onchange=async e=>{try{if(e.target.files[0])$('#pairs').value=await e.target.files[0].text();}catch(err){message(err.message,true);}};
$('#import').onsubmit=e=>{e.preventDefault();try{const pairs=parsePairs($('#pairs').value);if(commit(s=>pairs.forEach(([q,a])=>addItem(s,selected,q,a)),`${pairs.length} questions imported.`))$('#import').reset();}catch(err){message(err.message,true);}};
$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`learning-insights-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Backup download requested. Keep it somewhere safe.');};
$('#restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const next=prepareStoredState(JSON.parse(await f.text()));if(!confirm(`Replace ${accountStorage?'the synced workspace in '+accountStorage.label:'guest browser data'} with ${next.sets.length} sets and ${next.items.length} questions? Export your current backup first if needed.`))return;storage.save(next);transactions.clear();state=next;selected=null;chartSelection.clear();chartDeselection.clear();shown.clear();resetEditor();navigate('#chart',true);message('Backup restored to the current workspace.');}catch(err){message(`Restore failed: ${err.message}`,true);}finally{e.target.value='';}};

$('#undo').onclick=()=>{try{state=transactions.undo(state);render();message('Last mark undone.');}catch(e){message(`Could not undo: ${e.message}`,true);}};

function renderOverview(){
  const rows=historyRows(state);
  const entryColumns=Math.max(1,...rows.map(row=>row.entries.length));
  $('#undo-set').hidden=!state.setDeletions?.length;
  const sets=activeSets(state);
  chartSelection=new Set([...chartSelection].filter(id=>sets.some(s=>s.id===id)));
  // A lone set is ready to chart unless the user explicitly unchecked it.
  if(sets.length===1&&!chartDeselection.has(sets[0].id))chartSelection.add(sets[0].id);
  $('#chart-progress').disabled=!chartSelection.size;
  $('#history-empty').hidden=rows.length>0;
  $('#history-grid').hidden=!rows.length;
  $('#history').innerHTML=rows.map(({set,entries})=>`<tr data-history-set="${escape(set.id)}"><th scope="row"><div class="set-controls"><label class="select-set" title="Select ${escape(set.name)} for Chart Progress"><input type="checkbox" class="subject-select" data-chart-set="${escape(set.id)}" aria-label="Select ${escape(set.name)} for Chart Progress" ${chartSelection.has(set.id)?'checked':''}></label><a class="topic-link" data-open-set="${escape(set.id)}" href="#set/${encodeURIComponent(set.id)}" title="Study ${escape(set.name)}">${escape(set.name)}</a><button type="button" class="row-delete-set" data-delete-set="${escape(set.id)}" aria-label="Delete set ${escape(set.name)}" title="Delete set ${escape(set.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div></th>${entries.map(s=>`<td class="history-cell" data-snapshot-id="${escape(s.id)}" style="background:${color(s.percent)}" title="${escape(date(s.at))} · ${s.green}/${s.total} (${s.percent.toFixed(0)}%) green / total"><button class="history-select" data-select-history="${escape(s.id)}" aria-pressed="${selectedHistory===s.id}" aria-label="Select ${escape(set.name)}, ${shortDate(s.at)}, ${s.green} of ${s.total} questions green, ${s.percent.toFixed(0)} percent"><span>${shortDate(s.at)}</span><span class="history-score">${s.green}/${s.total} (${s.percent.toFixed(0)}%)</span></button></td>`).join('')}${Array.from({length:entryColumns-entries.length},(_,i)=>!entries.length&&i===0?'<td class="no-history">No reviews yet</td>':'<td class="empty-history" aria-label="No entry"></td>').join('')}</tr>`).join('');
  updateHistorySelection(rows);
}
function updateHistorySelection(rows=historyRows(state)) {
  const chosen=rows.flatMap(r=>r.entries).find(s=>s.id===selectedHistory);
  if(!chosen) selectedHistory=null;
  $('#delete-entry').disabled=!chosen;
  $('#undo-entry').hidden=!state.deletedHistory?.length;
  $('#entry-selection').textContent=chosen?`${state.sets.find(s=>s.id===chosen.setId).name} · ${shortDate(chosen.at)} selected`:'Select a dated cell to delete only its progress entry.';
  document.querySelectorAll('[data-select-history]').forEach(button=>{
    const selected=button.dataset.selectHistory===selectedHistory;
    button.setAttribute('aria-pressed',String(selected));
    button.closest('td').classList.toggle('selected-cell',selected);
  });
}
$('#history').onclick=e=>{
  const remove=e.target.closest('[data-delete-set]');
  if(remove){removeSet(remove.dataset.deleteSet);return;}
  const cell=e.target.closest('td[data-snapshot-id]');
  if(cell){
    selectedHistory=cell.dataset.snapshotId;
    updateHistorySelection();
    cell.querySelector('button')?.focus({preventScroll:true});
    return;
  }
  const button=e.target.closest('[data-open-set]');
  if(button&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();navigate(button.getAttribute('href'));}
};

$('#history').onchange=e=>{const id=e.target.dataset.chartSet;if(id){if(e.target.checked){chartSelection.add(id);chartDeselection.delete(id);}else{chartSelection.delete(id);chartDeselection.add(id);}$('#chart-progress').disabled=!chartSelection.size;}};

$('#delete-entry').onclick=()=>{if(!selectedHistory)return;if(commit(s=>deleteHistoryEntry(s,selectedHistory),'Progress entry hidden; the question set is kept. Undo restores the entry.'))$('#undo-entry').focus({preventScroll:true});};
$('#undo-entry').onclick=()=>{if(commit(s=>undoHistoryDeletion(s),'Deleted entry restored.'))$('#overview-scroll').focus({preventScroll:true});};

$('#delete-question').onclick=()=>{if(!editing)return;if(commit(s=>deleteQuestion(s,editing),'Question hidden. Undo restores its answer and marks, even after reload.')){resetEditor();$('#undo-question').focus({preventScroll:true});}};
$('#undo-question').onclick=()=>commit(s=>undoQuestionDeletion(s),'Deleted question restored with its saved answer and marks.');

$('#questions').onchange=e=>{
  const input=e.target.closest('input[type="radio"][data-flag]');
  if(!input||!input.checked)return;
  const id=input.closest('[data-id]').dataset.id,mark=input.dataset.flag;
  saveQuestionMark(id,mark,mark);
};
function saveQuestionMark(id,mark,focusMark){
  commit(s=>selectMark(s,id,mark),mark===null?'Mark cleared.': 'Mark saved. Use Chart Progress when ready.',true,prior=>selectMark(prior,id,effectiveMark(prior.items.find(q=>q.id===id))));
  const card=[...document.querySelectorAll('.question')].find(c=>c.dataset.id===id);
  if(card)card.querySelector(`[data-flag="${focusMark}"]`)?.focus({preventScroll:true});else $('#difficult-only').focus({preventScroll:true});
};

function applyRoute(focus=true){
  if(restoringSession){account=true;selected=null;render();return;}
  if(!accountStorage&&!guestChosen&&location.hash&&! ['#home','#account'].includes(location.hash))history.replaceState(null,'','#home');
  let id=null;
  try{if(location.hash.startsWith('#set/'))id=decodeURIComponent(location.hash.slice(5));}catch{}
  selected=activeSets(state).some(s=>s.id===id)?id:null;
  account=!location.hash||location.hash==='#home'||location.hash==='#account';
  if(!selected&&!account&&location.hash!=='#chart')history.replaceState(null,'','#chart');
  shown.clear();resetEditor();$('#difficult-only').checked=false;$('#import').reset();$('#import-panel').open=false;
  render();
  if(focus){(account?$('#account-title'):selected?$('#title'):$('#overview-title')).focus({preventScroll:true});window.scrollTo(0,0);}
}
function navigate(hash,replace=false){
  if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);
  applyRoute();
}
window.addEventListener('popstate',()=>applyRoute());
window.addEventListener('hashchange',()=>applyRoute());
for(const id of ['back-to-chart','open-chart','home-link','account-link','sync-attention'])$('#'+id).onclick=e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(id==='open-chart'&&!accountStorage)guestChosen=true;navigate(e.currentTarget.hash);}};

function removeSet(id){if(!id)return;if(commit(s=>deleteSet(s,id),'Question set hidden, including its chart row and page. Undo restores it.')){$('#undo-set').focus({preventScroll:true});}}
$('#undo-set').onclick=()=>{if(commit(s=>undoSetDeletion(s),'Question set restored with its questions, marks and history.'))$('#overview-title').focus({preventScroll:true});};

// Guest and Google account storage stay separate. Signing in never uploads guest data.
import {mountSync} from './sync-ui.js?v=20261026-local-study-1';
const sync=mountSync({guest:guestStorage,validate,empty,
  onReady(){
    const keepPage=restoringSession&&(location.hash.startsWith('#set/')||location.hash==='#chart'||location.hash==='#account');
    restoringSession=false;
    if(keepPage)applyRoute(false);else if(account)navigate('#chart',true);
  },
  onSignOut(){navigate('#home',true);},
  onMode(adapter){chartDeselection.clear();guestChosen=false;accountStorage=adapter;$('#open-chart').textContent=adapter?'Open synced chart':'Open chart · use as guest';transactions.clear();},
  onData(data){state=prepareStoredState(data);selected=null;shown.clear();chartSelection.clear();selectedHistory=null;resetEditor();applyRoute(false);},
  canApply:()=>!document.activeElement?.matches('input,textarea,select')&&!$('#editor-panel').open
});

sync.ready.finally(()=>{if(restoringSession){restoringSession=false;applyRoute(false);}});
