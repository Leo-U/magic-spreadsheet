const key='learning-insights-v1';
// The app supplies its current versioned model; no stale nested model import.
export function createStorage({empty,validate,prepareStoredState}) {
  return {
    load(){const raw=localStorage.getItem(key);return raw?prepareStoredState(JSON.parse(raw)):empty();},
    save(state){localStorage.setItem(key,JSON.stringify(validate(state)));}
  };
}
