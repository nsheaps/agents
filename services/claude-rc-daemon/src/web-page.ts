/** Single-page UI served by the daemon. Reads its token from ?token= (never embedded) and builds DOM with textContent only. */
export const PAGE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>claude-rc</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1b1f24;--mut:#667;--line:#d0d7de;--ok:#1a7f37;--bad:#cf222e;--warn:#9a6700}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--mut:#8b949e;--line:#30363d;--ok:#3fb950;--bad:#f85149;--warn:#d29922}}
body{font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:16px;max-width:980px;margin-inline:auto}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}
.mut{color:var(--mut)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}
button,input,select,textarea{font:inherit;color:inherit;background:transparent;border:1px solid var(--line);border-radius:6px;padding:4px 8px}
button{cursor:pointer}button:hover{border-color:var(--mut)}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}label{display:inline-flex;gap:6px;align-items:center}
textarea{width:100%;min-height:70px;font-family:ui-monospace,monospace}
#msg{min-height:1.4em;margin:8px 0}
</style></head><body>
<h1>claude-rc</h1>
<div id="hdr" class="mut">loading…</div><div id="upd"></div><div id="msg" role="status"></div>
<h2>Repositories</h2>
<table><thead><tr><th>Name</th><th>State</th><th>Path</th><th>Spawn</th><th></th></tr></thead><tbody id="repos"></tbody></table>
<div class="row"><input id="newPath" placeholder="/absolute/path/to/repo" size="40" aria-label="Repository path">
<input id="newName" placeholder="name (optional)" size="16" aria-label="Repository name"><button id="add">Add repo</button></div>
<h2>Settings</h2>
<div class="row"><label>Default spawn <select id="spawn"><option>worktree</option><option>same-dir</option><option>session</option></select></label>
<label><input type="checkbox" id="autoTrust"> Auto-trust workspaces</label></div>
<div class="row"><b>Notifications</b>
<label><input type="checkbox" id="n_enabled"> enabled</label><label><input type="checkbox" id="n_onStart"> on start</label><label><input type="checkbox" id="n_onExit"> on exit</label></div>
<div class="row"><b>Daily update check</b>
<label><input type="checkbox" id="u_claudeRc"> claude-rc</label><label><input type="checkbox" id="u_claude"> Claude Code</label></div>
<div class="row"><label>UI port <input type="number" id="ui_port" min="0" max="65535" style="width:6em"></label><span class="mut">(takes effect after the daemon restarts)</span></div>
<div class="row" style="display:block"><label for="env">Environment for every repo (KEY=value per line)</label><textarea id="env" spellcheck="false"></textarea></div>
<div class="row"><button id="save">Save settings</button></div>
<script>
const tok=new URLSearchParams(location.search).get("token")||sessionStorage.getItem("t")||"";
if(tok){sessionStorage.setItem("t",tok);history.replaceState(null,"",location.pathname)}
const $=id=>document.getElementById(id);
const say=(t,c)=>{const m=$("msg");m.textContent=t;m.className=c||""};
async function api(method,path,body){
  const r=await fetch(path,{method,headers:{"x-claude-rc-token":tok,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||("HTTP "+r.status));
  return j;
}
const act=(label,fn)=>async()=>{try{say(label+"…");await fn();say(label+": done","ok");await refresh()}catch(e){say(label+" failed: "+e.message,"bad")}};
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function btn(text,fn){const b=el("button",text);b.onclick=fn;return b}
let editing=false;
async function refresh(){
  try{
    const s=await api("GET","/api/status");
    $("hdr").textContent="v"+s.version+" · "+s.supervisor.kind+" · "+s.phase+" · pid "+s.pid+(s.configError?" · CONFIG ERROR: "+s.configError:"");
    const u=$("upd");u.textContent="";
    const l=s.updates&&s.updates.latest;
    if(l)u.append(el("span","Latest: claude-rc "+(l.claudeRc||"?")+" · Claude Code "+(l.claude||"?"),"mut"));
    const tb=$("repos");tb.textContent="";
    if(!s.repos.length){const tr=el("tr");const td=el("td","No repositories yet — add one below.","mut");td.colSpan=5;tr.append(td);tb.append(tr)}
    for(const r of s.repos){
      const tr=el("tr");
      const st=r.stoppedByUser?"stopped (by you)":r.state;
      tr.append(el("td",r.name),el("td",st+(r.pid?" · pid "+r.pid:"")+(r.restarts?" · "+r.restarts+" restarts":""),r.state==="running"?"ok":r.state==="failed"?"bad":"warn"),el("td",r.path,"mut"),el("td",r.spawn));
      const a=el("td");
      a.append(btn("Restart",act("restart "+r.name,()=>api("POST","/api/repos/"+encodeURIComponent(r.name)+"/restart"))),
        btn(r.stoppedByUser||r.state!=="running"?"Start":"Stop",act((r.stoppedByUser||r.state!=="running"?"start ":"stop ")+r.name,()=>api("POST","/api/repos/"+encodeURIComponent(r.name)+(r.stoppedByUser||r.state!=="running"?"/start":"/stop")))),
        btn("Remove",()=>{if(confirm("Remove "+r.name+" from the config? Its service will be stopped."))act("remove "+r.name,()=>api("DELETE","/api/repos/"+encodeURIComponent(r.name)))()}));
      tr.append(a);tb.append(tr);
    }
    if(!editing){const c=await api("GET","/api/config");fill(c)}
  }catch(e){say("Cannot reach the daemon: "+e.message,"bad")}
}
function fill(c){
  $("spawn").value=c.spawn;$("autoTrust").checked=c.autoTrust;
  for(const k of ["enabled","onStart","onExit"])$("n_"+k).checked=c.notifications[k];
  for(const k of ["claudeRc","claude"])$("u_"+k).checked=c.updates[k];
  $("ui_port").value=c.ui.port;
  $("env").value=Object.entries(c.env).map(([k,v])=>k+"="+v).join("\\n");
}
for(const id of ["spawn","autoTrust","n_enabled","n_onStart","n_onExit","u_claudeRc","u_claude","ui_port","env"])$(id).addEventListener("input",()=>{editing=true});
$("add").onclick=act("add repo",async()=>{const b={path:$("newPath").value.trim()};if($("newName").value.trim())b.name=$("newName").value.trim();await api("POST","/api/repos",b);$("newPath").value="";$("newName").value=""});
$("save").onclick=act("save settings",async()=>{
  const env={};
  for(const line of $("env").value.split("\\n")){const t=line.trim();if(!t||t[0]==="#")continue;const i=t.indexOf("=");if(i<1)throw new Error("bad env line: "+t);env[t.slice(0,i)]=t.slice(i+1)}
  await api("PUT","/api/settings",{spawn:$("spawn").value,autoTrust:$("autoTrust").checked,env,
    notifications:{enabled:$("n_enabled").checked,onStart:$("n_onStart").checked,onExit:$("n_onExit").checked},
    updates:{claudeRc:$("u_claudeRc").checked,claude:$("u_claude").checked},ui:{port:Number($("ui_port").value)}});
  editing=false;
});
refresh();setInterval(refresh,5000);
</script></body></html>
`;
