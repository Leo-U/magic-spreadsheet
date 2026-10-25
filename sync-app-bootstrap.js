window.__syncTest={idConfig:null,oauthConfig:null,rows:[],writes:0};
const t=window.__syncTest;
window.google={accounts:{id:{initialize(c){t.idConfig=c;},renderButton(el){const b=document.createElement('button');b.textContent='Mock sign-in';el.append(b);},disableAutoSelect(){}},oauth2:{initTokenClient(c){t.oauthConfig=c;return {requestAccessToken(){}};},hasGrantedAllScopes(){return true;}}}};
window.fetch=async(url,options={})=>{
 let result;if(url.includes('/values/'))t.lastAuthorization=options.headers?.Authorization;
 if(url.includes('/oauth2/v3/certs'))result={keys:[t.jwk]};
 else if(url.includes('userinfo'))result=t.user||{sub:'synthetic-owner',email:'test@example.test',email_verified:true};
 else if(url.includes('drive/v3/files?'))result={files:[{id:'test_sheet',name:'Synthetic account workspace',appProperties:{magicSync:'v1',owner:'synthetic-owner'}}]};
 else if(url.includes(':append')){t.writes++;t.rows.push(JSON.parse(options.body).values[0]);result={updates:{updatedRows:1}};}
 else if(url.includes('/values/'))result={values:[['magic-sync-v1','synthetic-owner'],...t.rows]};
 else throw Error('Unexpected request '+url);
 return {ok:true,json:async()=>result};
};
