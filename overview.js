import {activeSets} from './sets.js';
import {localDay} from './calendar.js';
import {hiddenSnapshotIds} from './history-data.js';
// Stable timestamp order retains stored order when two entries share a timestamp.
export function historyRows(state) {
  const hidden=hiddenSnapshotIds(state);
  return activeSets(state).map(set=>({set,entries:state.snapshots.filter(s=>s.setId===set.id&&!hidden.has(s.id)).slice().sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))}));
}
export function shortDate(at) { const [year,month,day]=localDay(at).split('-');return `${day}.${month}.${year.slice(-2)}`; }
