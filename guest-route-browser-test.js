// Isolated browsing context: never reads or changes the user's study data.
imports.gi.versions.Gtk='3.0';imports.gi.versions.WebKit2='4.0';
const {Gtk,WebKit2,GLib}=imports.gi;Gtk.init(null);
const win=new Gtk.OffscreenWindow();win.set_default_size(390,800);
const view=new WebKit2.WebView({web_context:WebKit2.WebContext.new_ephemeral()});win.add(view);win.show_all();let stage=0;
view.connect('load-changed',(_,event)=>{
 if(event!==WebKit2.LoadEvent.FINISHED)return;
 const source=`(()=>{const check=(v,m)=>{if(!v)throw Error(m)};try{
 check(location.hash==='#home'&&!document.getElementById('account-view').hidden&&document.getElementById('chart-view').hidden,'Fresh chart URL bypassed home');
 ${stage++===0?`document.getElementById('open-chart').click();check(location.hash==='#chart'&&!document.getElementById('chart-view').hidden,'Guest choice did not open chart');location.reload();return 'reload';`:`return 'PASS refresh requires a fresh guest choice';`}
 }catch(e){return 'FAIL '+e.message}})()`;
 GLib.timeout_add(GLib.PRIORITY_DEFAULT,500,()=>{view.run_javascript(source,null,(v,r)=>{const result=v.run_javascript_finish(r).get_js_value().to_string();if(result==='reload')return;print(result);Gtk.main_quit();if(!result.startsWith('PASS'))imports.system.exit(1);});return GLib.SOURCE_REMOVE;});
});
view.load_uri('http://127.0.0.1:8765/#chart');
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,20,()=>{printerr('TIMEOUT');imports.system.exit(1);});Gtk.main();
