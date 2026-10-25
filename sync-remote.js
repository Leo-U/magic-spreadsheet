import {revisionRows,encodeRevision} from './sync-core.js?v=20261023-sync-1';
export const SYNC_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRIVE='https://www.googleapis.com/drive/v3/files';
const SHEETS='https://sheets.googleapis.com/v4/spreadsheets/';
export function chooseStudyFile(files, preferredId=null) {
  const primary=files.filter(f=>f.appProperties?.magicPrimary==='v1');
  if(primary.length>1)throw Error('More than one primary study file was found. No data was changed.');
  if(primary.length===1)return primary[0];
  if(preferredId){const selected=files.find(f=>f.id===preferredId);if(!selected)throw Error('Your selected study file is unavailable. No replacement was created.');return selected;}
  if(files.length>1)throw Error('Existing study files need a one-time migration before they can open automatically. No data was changed.');
  return files[0]||null;
}
export function createSyncRemote({access,owner,validate,fetcher=fetch}) {
  async function request(url,options={}) {
    const token=access();if(!token){const e=Error('Reconnect Google');e.auth=true;throw e;}
    const response=await fetcher(url,{...options,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});
    if(!response.ok){const e=Error('Google request failed (HTTP '+response.status+')');e.auth=response.status===401;throw e;}
    return response.json();
  }
  async function list() {
    const files=[];let pageToken='';
    do {
      const query="trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='magicSync' and value='v1' }";
      const params=new URLSearchParams({q:query,fields:'files(id,name,appProperties),nextPageToken',pageSize:'100'});if(pageToken)params.set('pageToken',pageToken);
      const result=await request(DRIVE+'?'+params);files.push(...(result.files||[]).filter(f=>f.appProperties?.owner===owner));pageToken=result.nextPageToken||'';
    }while(pageToken);
    return files;
  }
  function forFile(fileId) {
    if(!/^[\w-]+$/.test(fileId))throw Error('Invalid spreadsheet ID');
    const url=SHEETS+fileId+'/values/Journal!A1:BB';
    return {
      async read(){const result=await request(url);const [header,...rows]=result.values||[];if(header?.[0]!=='magic-sync-v1'||header?.[1]!==owner)throw Error('This is not this account’s sync spreadsheet.');return revisionRows(rows,owner,validate);},
      async append(revision){await request(url+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:JSON.stringify({values:[encodeRevision(revision,owner)]})});}
    };
  }
  async function create(name) {
    const file=await request(DRIVE+'?fields=id,name,appProperties',{method:'POST',body:JSON.stringify({name,mimeType:'application/vnd.google-apps.spreadsheet',appProperties:{magicSync:'v1',owner}})});
    if(!/^[\w-]+$/.test(file.id||''))throw Error('Creation could not be confirmed.');
    const metadata=await request(SHEETS+file.id+'?fields=sheets.properties');
    const initial=metadata.sheets||[];
    if(initial.length!==1||!Number.isInteger(initial[0].properties?.sheetId))throw Error('Unexpected new spreadsheet layout.');
    const journalId=initial[0].properties.sheetId;
    await request(SHEETS+file.id+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
      {updateSheetProperties:{properties:{sheetId:journalId,title:'Journal',gridProperties:{columnCount:54}},fields:'title,gridProperties.columnCount'}},
      {updateCells:{start:{sheetId:journalId,rowIndex:0,columnIndex:0},rows:[{values:[{userEnteredValue:{stringValue:'magic-sync-v1'}},{userEnteredValue:{stringValue:owner}}]}],fields:'userEnteredValue'}}
    ]})});
    return file;
  }
  async function markPrimary(file){
    await forFile(file.id).read(); // Validate the account and journal before marking an existing file.
    return request(DRIVE+'/'+file.id+'?fields=id,name,appProperties',{method:'PATCH',body:JSON.stringify({appProperties:{...file.appProperties,magicPrimary:'v1'}})});
  }
  return {list,forFile,create,markPrimary};
}
