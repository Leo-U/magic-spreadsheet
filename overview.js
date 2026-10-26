import {activeSets} from './sets.js?v=20261026-local-study-1';
import {localDay} from './calendar.js?v=20261026-local-study-1';
import {hiddenSnapshotIds} from './history-data.js?v=20261026-local-study-1';
// Stable timestamp order retains stored order when two entries share a timestamp.
export function historyRows(state) {
  const hidden=hiddenSnapshotIds(state);
  return activeSets(state).map(set=>({set,entries:state.snapshots.filter(s=>s.setId===set.id&&!hidden.has(s.id)).slice().sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))}));
}
export function shortDate(at) { const [year,month,day]=localDay(at).split('-');return `${day}.${month}.${year.slice(-2)}`; }
