import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../kernel/settings';
import { useVfs, vfs } from '../kernel/vfs';
import { useWindows } from '../kernel/windows';

export interface WallpaperDef { id: string; name: string; colors: [string, string, string, string]; light?: boolean }

export const WALLPAPERS: WallpaperDef[] = [
  { id: 'aurora', name: 'Aurora', colors: ['#05060f', '#4c1d95', '#0e7490', '#6d28d9'] },
  { id: 'ember', name: 'Ember', colors: ['#0c0505', '#9a3412', '#be123c', '#f59e0b'] },
  { id: 'lagoon', name: 'Lagoon', colors: ['#020c0b', '#065f46', '#0e7490', '#84cc16'] },
  { id: 'midnight', name: 'Midnight', colors: ['#03040a', '#1e3a8a', '#312e81', '#0ea5e9'] },
  { id: 'rose', name: 'Rosé', colors: ['#0d0509', '#831843', '#6b21a8', '#fb7185'] },
  { id: 'graphite', name: 'Graphite', colors: ['#050506', '#27272a', '#3f3f46', '#71717a'] },
  { id: 'mist', name: 'Mist', colors: ['#e9ecf5', '#c7d2fe', '#bae6fd', '#fbcfe8'], light: true },
  { id: 'dune', name: 'Dune', colors: ['#f5ede1', '#fdba74', '#fca5a5', '#fde68a'], light: true },
];

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision highp float;
uniform vec2 r;uniform float t;uniform vec3 c0,c1,c2,c3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*1.6;
float tt=t*.035;
vec2 q=vec2(fbm(p+vec2(0.,tt)),fbm(p+vec2(5.2,1.3)-tt));
vec2 w=vec2(fbm(p+3.*q+vec2(1.7,9.2)+tt*1.3),fbm(p+3.*q+vec2(8.3,2.8)-tt));
float f=fbm(p+2.5*w);
vec3 col=mix(c0,c1,clamp(f*f*2.2,0.,1.));
col=mix(col,c2,clamp(length(q)*.9-.25,0.,1.));
col=mix(col,c3,clamp(w.x*w.x*1.4-.25,0.,1.)*.75);
float band=smoothstep(.35,.0,abs(uv.y-.62-.12*sin(uv.x*3.+t*.05)-(f-.5)*.4));
col+=c3*band*.22;
col*=1.-.35*length(uv-vec2(.5,.45));
col+=(h(gl_FragCoord.xy+t)-.5)*.018;
gl_FragColor=vec4(col,1.);}`;

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function ShaderWall({ def, animate }: { def: WallpaperDef; animate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const covered = useWindows((s) => Object.values(s.wins).some((w) => w.ws === s.ws && w.state === 'maximized'));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    if (!gl) { setFailed(true); return; }
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setFailed(true); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't');
    def.colors.forEach((c, i) => gl.uniform3fv(gl.getUniformLocation(prog, `c${i}`), hex(c)));

    // Render at reduced resolution — it's a soft gradient, and this keeps GPU cost tiny.
    const scale = 0.5;
    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth * scale);
      canvas.height = Math.ceil(window.innerHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uR, canvas.width, canvas.height);
    };
    resize();
    const seed = 40 + (def.id.charCodeAt(0) % 17) * 13;
    let raf = 0;
    let last = 0;
    const draw = (now: number) => {
      gl.uniform1f(uT, seed + now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 30) return; // 30fps is plenty for slow motion
      last = now;
      if (document.hidden) return;
      draw(now);
    };
    const shouldAnimate = animate && !covered;
    if (shouldAnimate) raf = requestAnimationFrame(loop);
    else draw(performance.now());
    const onResize = () => { resize(); if (!shouldAnimate) draw(performance.now()); };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [def, animate, covered]);

  if (failed) {
    const [a, b, c] = def.colors;
    return <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 20% 10%, ${b}, transparent 60%), radial-gradient(100% 80% at 90% 90%, ${c}, transparent 60%), ${a}` }} />;
  }
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

function CustomWall({ path }: { path: string }) {
  const ready = useVfs((s) => s.ready);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !vfs.exists(path)) return;
    let u: string | null = null;
    let alive = true;
    vfs.objectUrl(path).then((x) => { if (alive) { u = x; setUrl(x); } else URL.revokeObjectURL(x); });
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [path, ready]);
  if (!url) return <ShaderWall def={WALLPAPERS[0]} animate={false} />;
  return <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />;
}

export function Wallpaper({ forceBuiltIn }: { forceBuiltIn?: boolean }) {
  const { wallpaper, animatedWallpaper, reducedMotion } = useSettings();
  const isCustom = wallpaper.startsWith('custom:');
  const def = WALLPAPERS.find((w) => w.id === wallpaper) ?? WALLPAPERS[0];
  return (
    <div className="fixed inset-0 -z-0 overflow-hidden" style={{ background: def.colors[0] }}>
      {isCustom && !forceBuiltIn
        ? <CustomWall path={wallpaper.slice(7)} />
        : <ShaderWall def={isCustom ? WALLPAPERS[0] : def} animate={animatedWallpaper && !reducedMotion} />}
    </div>
  );
}
