window.__syncTest={idConfig:null,oauthConfig:null,rows:[],writes:0};
const t=window.__syncTest;
t.files=[{id:'test_sheet',name:'Synthetic account workspace',appProperties:{magicSync:'v1',owner:'synthetic-owner'}}];
window.google={accounts:{id:{initialize(c){t.idConfig=c;},renderButton(el){const b=document.createElement('button');b.textContent='Mock sign-in';el.append(b);},disableAutoSelect(){}},oauth2:{initTokenClient(c){t.oauthConfig=c;return {requestAccessToken(){}};},hasGrantedAllScopes(){return true;}}}};
window.fetch=async(url,options={})=>{
 let result;if(url.includes('/values/'))t.lastAuthorization=options.headers?.Authorization;
 if(url.includes('/oauth2/v3/certs'))result={keys:[t.jwk]};
 else if(url.includes('userinfo'))result=t.user||{sub:'synthetic-owner',email:'test@example.test',email_verified:true};
 else if(url.includes('drive/v3/files?')&&options.method==='POST'){t.creates=(t.creates||0)+1;const body=JSON.parse(options.body);const file={id:'new_study',...body};t.files.push(file);result=file;}
 else if(url.includes(':batchUpdate')){t.setupRequests=JSON.parse(options.body).requests;result={};}
 else if(url.includes('?fields=sheets.properties'))result={sheets:[{properties:{sheetId:73,title:'Sheet1'}}]};
 else if(url.includes('drive/v3/files?'))result={files:JSON.parse(JSON.stringify(t.files))};
 else if(options.method==='PATCH'){const id=url.split('/files/')[1].split('?')[0];const file=t.files.find(f=>f.id===id);file.appProperties=JSON.parse(options.body).appProperties;result=file;t.marked=id;}
 else if(url.includes('study-migration.local.json'))result={fileId:'test_sheet'};
 else if(url.includes(':append')){t.lastAppendUrl=url;t.writes++;t.rows.push(JSON.parse(options.body).values[0]);result={updates:{updatedRows:1}};}
 else if(url.includes('/values/'))result={values:[['magic-sync-v1','synthetic-owner'],...t.rows]};
 else throw Error('Unexpected request '+url);
 return {ok:true,json:async()=>result};
};
