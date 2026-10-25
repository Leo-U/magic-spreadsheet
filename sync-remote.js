import {revisionRows,encodeRevision} from './sync-core.js?v=20261023-sync-1';
export const SYNC_SCOPE='https://www.googleapis.com/auth/drive.file';
const DRIVE='https://www.googleapis.com/drive/v3/files';
const SHEETS='https://sheets.googleapis.com/v4/spreadsheets/';
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
    await request(SHEETS+file.id+':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
      {addSheet:{properties:{sheetId:4123,title:'Journal',gridProperties:{rowCount:1000,columnCount:54}}}},
      {updateCells:{start:{sheetId:4123,rowIndex:0,columnIndex:0},rows:[{values:[{userEnteredValue:{stringValue:'magic-sync-v1'}},{userEnteredValue:{stringValue:owner}}]}],fields:'userEnteredValue'}}
    ]})});
    return file;
  }
  return {list,forFile,create};
}
