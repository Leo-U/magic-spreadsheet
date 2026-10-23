// Persist before replacing visible state. Undo is one action deep and never survives reload.
export function createTransactions(adapter) {
  let previous=null;
  return {
    commit(state,change,undoable=false,prepareUndo=()=>{}) {
      const next=JSON.parse(JSON.stringify(state));
      change(next);
      const prior=undoable?JSON.parse(JSON.stringify(state)):null;
      if(prior)prepareUndo(prior);
      adapter.save(next);
      previous=prior;
      return next;
    },
    undo(state) {
      if(!previous) return state;
      adapter.save(previous);
      const restored=previous;
      previous=null;
      return restored;
    },
    clear(){previous=null;},
    get canUndo(){return previous!==null;}
  };
}
