import type { ExtManifest } from '../kernel/registry';

const BASE_CSS = `
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;height:100vh;overflow:hidden}
[data-theme=dark] body{background:#12141c;color:#eef0fa}[data-theme=light] body{background:#f6f7fb;color:#111827}
button{font:inherit;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;background:var(--aether-accent);color:#fff;font-weight:600}
button.ghost{background:rgba(127,127,127,.15);color:inherit}
input,textarea,select{font:inherit;color:inherit;background:rgba(127,127,127,.1);border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:8px 10px;outline:none}
input:focus,textarea:focus{border-color:var(--aether-accent)}
`;

const BREATHE = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body{display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#1e3a5f,#0b1020)!important;color:#e0f2fe!important}
.wrap{text-align:center}
.orb{width:220px;height:220px;border-radius:50%;margin:0 auto 34px;background:radial-gradient(circle at 35% 30%,#a5f3fc,#0891b2 55%,#164e63);box-shadow:0 0 80px #22d3ee88;transform:scale(.55);transition:transform 4s cubic-bezier(.45,0,.55,1)}
h1{font-weight:300;letter-spacing:.2em;text-transform:uppercase;font-size:20px;margin:0 0 8px}
p{opacity:.6;margin:0 0 24px}
select{background:#ffffff14;border-color:#ffffff30}
</style></head><body><div class="wrap">
<div class="orb" id="orb"></div><h1 id="phase">Ready</h1><p id="count">Box breathing · 4-4-4-4</p>
<div style="display:flex;gap:10px;justify-content:center">
<select id="mode"><option value="4,4,4,4">Box 4-4-4-4</option><option value="4,7,8,0">Relax 4-7-8</option><option value="5,0,5,0">Coherent 5-5</option></select>
<button id="go">Start</button></div></div>
<script>
let running=false,timer=null,cycles=0;
const orb=document.getElementById('orb'),phase=document.getElementById('phase'),count=document.getElementById('count');
function run(){const [i,h1,e,h2]=document.getElementById('mode').value.split(',').map(Number);
const steps=[['Breathe in',i,1],['Hold',h1,1],['Breathe out',e,.55],['Hold',h2,.55]].filter(s=>s[1]>0);let k=0;
const next=()=>{if(!running)return;const [label,secs,scale]=steps[k];phase.textContent=label;orb.style.transitionDuration=secs+'s';orb.style.transform='scale('+scale+')';
let left=secs;count.textContent=left;const iv=setInterval(()=>{left--;if(left>0)count.textContent=left;else clearInterval(iv)},1000);
k=(k+1)%steps.length;if(k===0){cycles++;aether.setTitle('Breathe · '+cycles+' cycles')}timer=setTimeout(next,secs*1000)};next()}
document.getElementById('go').onclick=e=>{running=!running;e.target.textContent=running?'Stop':'Start';if(running)run();else{clearTimeout(timer);phase.textContent='Ready';orb.style.transform='scale(.55)';count.textContent=cycles+' cycles completed'}};
</script></body></html>`;

const PALETTE = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body{display:flex;flex-direction:column}
.bar{display:flex;gap:8px;padding:14px;align-items:center}
.sw{flex:1;display:flex}
.c{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:18px 14px;cursor:pointer;transition:flex .25s}
.c:hover{flex:1.4}.c span{font:600 14px ui-monospace,monospace;background:#0006;color:#fff;padding:6px 8px;border-radius:8px;align-self:flex-start;backdrop-filter:blur(6px)}
.lock{opacity:.7;font-size:12px;margin-top:6px;color:#fff;text-shadow:0 1px 2px #0008}
</style></head><body>
<div class="bar"><button id="gen">Generate  ␣</button><select id="mode"><option>analogous</option><option>complementary</option><option>triadic</option><option>monochrome</option><option>pastel</option></select>
<span style="flex:1"></span><button class="ghost" id="save">Save palette</button></div>
<div class="sw" id="sw"></div>
<script>
let locked=[false,false,false,false,false],colors=[];
const hsl=(h,s,l)=>{s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')};
function gen(){const m=document.getElementById('mode').value,h=Math.random()*360;
const make=i=>{switch(m){case'complementary':return hsl((h+(i%2)*180)%360,60+i*6,35+i*9);case'triadic':return hsl((h+i*120)%360,65,45+i*6);case'monochrome':return hsl(h,55,18+i*15);case'pastel':return hsl((h+i*40)%360,70,80);default:return hsl((h+i*22)%360,62,38+i*8)}};
colors=colors.length?colors.map((c,i)=>locked[i]?c:make(i)):[0,1,2,3,4].map(make);render()}
function render(){const sw=document.getElementById('sw');sw.innerHTML='';colors.forEach((c,i)=>{const d=document.createElement('div');d.className='c';d.style.background=c;
d.innerHTML='<span>'+c.toUpperCase()+'</span><div class="lock">'+(locked[i]?'🔒 locked':'click: copy · shift+click: lock')+'</div>';
d.onclick=async e=>{if(e.shiftKey){locked[i]=!locked[i];render();return}try{await aether.clipboard.write(c.toUpperCase());}catch(err){alert(err.message)}};sw.appendChild(d)})}
document.getElementById('gen').onclick=gen;document.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();gen()}};
document.getElementById('save').onclick=async()=>{const saved=(await aether.storage.get('saved'))||[];saved.push(colors);await aether.storage.set('saved',saved);aether.notify('Palette saved',colors.join('  '))};
gen();
</script></body></html>`;

const JSONLAB = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body{display:flex;flex-direction:column;padding:12px;gap:10px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.panes{flex:1;display:flex;gap:10px;min-height:0}
textarea{flex:1;resize:none;font:13px/1.5 ui-monospace,Consolas,monospace;padding:12px;white-space:pre;tab-size:2}
#status{font-size:13px;padding:6px 10px;border-radius:8px}
.ok{background:#16a34a22;color:#22c55e}.err{background:#dc262622;color:#ef4444}
</style></head><body>
<div class="row"><button id="fmt">Format</button><button class="ghost" id="min">Minify</button><button class="ghost" id="sort">Sort keys</button>
<button class="ghost" id="open">Open…</button><button class="ghost" id="save">Save…</button><span style="flex:1"></span><span id="status">Paste JSON to begin</span></div>
<div class="panes"><textarea id="in" spellcheck="false" placeholder='{"hello": "world"}'></textarea><textarea id="out" spellcheck="false" readonly></textarea></div>
<script>
const $=id=>document.getElementById(id);
const sortKeys=v=>Array.isArray(v)?v.map(sortKeys):v&&typeof v==='object'?Object.keys(v).sort().reduce((o,k)=>(o[k]=sortKeys(v[k]),o),{}):v;
function parse(){try{const v=JSON.parse($('in').value);const n=JSON.stringify(v).length;$('status').className='ok';$('status').textContent='✓ Valid · '+n.toLocaleString()+' bytes';return v}catch(e){$('status').className='err';$('status').textContent='✗ '+e.message;return undefined}}
$('in').oninput=()=>{const v=parse();if(v!==undefined)$('out').value=JSON.stringify(v,null,2)};
$('fmt').onclick=()=>{const v=parse();if(v!==undefined)$('out').value=JSON.stringify(v,null,2)};
$('min').onclick=()=>{const v=parse();if(v!==undefined)$('out').value=JSON.stringify(v)};
$('sort').onclick=()=>{const v=parse();if(v!==undefined)$('out').value=JSON.stringify(sortKeys(v),null,2)};
$('open').onclick=async()=>{try{const f=await aether.fs.open({extensions:['json','txt']});if(f){$('in').value=f.text;$('in').oninput();aether.setTitle('JSON Lab · '+f.name)}}catch(e){$('status').className='err';$('status').textContent=e.message}};
$('save').onclick=async()=>{try{const p=await aether.fs.save('data.json',$('out').value||$('in').value);if(p)aether.notify('Saved',p)}catch(e){$('status').className='err';$('status').textContent=e.message}};
</script></body></html>`;

const PIXEL = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
#grid{display:grid;grid-template-columns:repeat(16,22px);gap:1px;background:rgba(127,127,127,.25);padding:1px;border-radius:6px;touch-action:none}
#grid div{width:22px;height:22px;background:var(--bg,#fff0);cursor:crosshair}
[data-theme=dark] #grid div{--empty:#1c1f2b}[data-theme=light] #grid div{--empty:#fff}
.pal{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:420px}
.pal span{width:26px;height:26px;border-radius:8px;cursor:pointer;border:2px solid transparent}
.pal span.on{border-color:currentColor;transform:scale(1.1)}
</style></head><body>
<div class="pal" id="pal"></div><div id="grid"></div>
<div style="display:flex;gap:8px"><button class="ghost" id="clear">Clear</button><button id="export">Save PNG to Pictures</button></div>
<script>
const COLORS=['#00000000','#111827','#f8fafc','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899','#78350f','#94a3b8'];
let cur=1,down=false,cells=Array(256).fill(0);
const grid=document.getElementById('grid'),pal=document.getElementById('pal');
COLORS.forEach((c,i)=>{const s=document.createElement('span');s.style.background=i?c:'repeating-conic-gradient(#8884 0 25%,transparent 0 50%) 0 0/10px 10px';s.onclick=()=>{cur=i;draw()};pal.appendChild(s)});
for(let i=0;i<256;i++){const d=document.createElement('div');d.onpointerdown=e=>{down=true;paint(i)};d.onpointerenter=()=>down&&paint(i);grid.appendChild(d)}
onpointerup=()=>down=false;
function paint(i){cells[i]=cur;draw();aether.storage.set('art',cells)}
function draw(){[...grid.children].forEach((d,i)=>d.style.background=cells[i]?COLORS[cells[i]]:'var(--empty)');[...pal.children].forEach((s,i)=>s.classList.toggle('on',i===cur))}
document.getElementById('clear').onclick=()=>{cells.fill(0);draw();aether.storage.set('art',cells)};
document.getElementById('export').onclick=async()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');cells.forEach((v,i)=>{if(v){x.fillStyle=COLORS[v];x.fillRect((i%16)*16,Math.floor(i/16)*16,16,16)}});
try{const p=await aether.fs.save('pixel-art.png',c.toDataURL('image/png'),{startDir:'~/Pictures'});if(p)aether.notify('Saved to Pictures',p)}catch(e){alert(e.message)}};
aether.storage.get('art').then(a=>{if(Array.isArray(a))cells=a;draw()});
</script></body></html>`;

export const CATALOG: ExtManifest[] = [
  { id: 'breathe', name: 'Breathe', icon: '🫧', color: '#0891b2', description: 'Guided breathing exercises to reset your focus.', author: 'Aether Labs', version: '1.0.0', permissions: [], width: 520, height: 560, html: BREATHE, builtin: true },
  { id: 'palette', name: 'Palette', icon: '🎨', color: '#db2777', description: 'Generate harmonious color palettes. Space to shuffle.', author: 'Aether Labs', version: '1.0.0', permissions: ['clipboard', 'notifications', 'storage'], width: 820, height: 480, html: PALETTE, builtin: true },
  { id: 'jsonlab', name: 'JSON Lab', icon: '🧪', color: '#7c3aed', description: 'Validate, format, minify and sort JSON documents.', author: 'Aether Labs', version: '1.0.0', permissions: ['files', 'notifications'], width: 900, height: 560, html: JSONLAB, builtin: true },
  { id: 'pixelpad', name: 'Pixel Pad', icon: '👾', color: '#16a34a', description: 'A tiny 16×16 pixel-art studio that saves to Pictures.', author: 'Aether Labs', version: '1.0.0', permissions: ['files', 'notifications', 'storage'], width: 560, height: 620, html: PIXEL, builtin: true },
];

export const MANIFEST_TEMPLATE = `{
  "id": "my-app",
  "name": "My App",
  "icon": "🚀",
  "color": "#6366f1",
  "version": "1.0.0",
  "description": "What my app does",
  "permissions": ["notifications", "storage"],
  "width": 640,
  "height": 480,
  "html": "<h1>Hello Aether</h1><button onclick=\\"aether.notify('Hi!')\\">Notify</button>"
}`;
