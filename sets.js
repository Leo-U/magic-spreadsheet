export function activeSets(state) {
  const deleted=new Set((state.setDeletions||[]).map(d=>d.setId));
  return state.sets.filter(set=>!deleted.has(set.id));
}
