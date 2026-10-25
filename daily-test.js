// Calendar compatibility remains important even though entries no longer coalesce.
import {localDay} from './calendar.js';
import {shortDate} from './overview.js';
const cases=[['2026-10-23T03:59:59Z','2026-10-22'],['2026-10-23T04:00:00Z','2026-10-23'],['2026-12-23T04:59:59Z','2026-12-22']];for(const [at,day] of cases){if(localDay(at)!==day)throw Error('Wrong local day');}if(shortDate('2026-10-23T01:00:00Z')!=='22.10.26')throw Error('Wrong displayed date');print('PASS 4 Atlanta calendar/display checks (no daily grouping)');
