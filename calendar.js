// Joel's local calendar is Atlanta. Explicit IANA zone handles DST and avoids
// the server/runner's UTC date changing a study day before local midnight.
export const STUDY_TIME_ZONE='America/New_York';
export function localDay(at) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:STUDY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));
  const value=type=>parts.find(p=>p.type===type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function latestForDay(records,day) {
  return records.reduce((latest,r)=>localDay(r.at)===day&&(!latest||Date.parse(r.at)>=Date.parse(latest.at))?r:latest,null);
}
