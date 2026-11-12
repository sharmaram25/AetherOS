import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Paperclip, Trash2, Cpu, Download, ShieldCheck, Square, X, Zap, FileText, AlertTriangle } from 'lucide-react';
import type { AppProps } from '../kernel/registry';
import { allApps } from '../kernel/registry';
import { useAppData, setAppData, getAppData, loadAppData } from '../kernel/appdata';
import { vfs } from '../kernel/vfs';
import { wm } from '../kernel/windows';
import { dialog } from '../kernel/dialog';
import { useSettings } from '../kernel/settings';
import { session } from '../kernel/session';
import { timers } from '../kernel/scheduler';
import { randomId } from '../kernel/crypto';
import { evaluate, formatNumber, fuzzy, tryEvaluate } from '../lib/calc';
import { renderMarkdown } from '../lib/markdown';
import { HOME, basename } from '../lib/path';
import { WALLPAPERS } from '../shell/Wallpaper';
import { shell } from '../shell/store';
import { Button, IconButton, Select, Badge, cx } from '../ui';
import { useLinkGuard } from './shared';

interface Msg { id: string; role: 'user' | 'assistant' | 'system'; content: string; local?: boolean; attachment?: string }
interface CortexData { messages: Msg[]; model: string }

const MODELS = [
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M', size: '~280 MB', note: 'Fastest · basic answers' },
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B', size: '~420 MB', note: 'Fast · good balance' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B', size: '~880 MB', note: 'Smarter · needs ~1.5 GB VRAM' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi 3.5 mini', size: '~2.2 GB', note: 'Best quality · needs ~4 GB VRAM' },
];

/* ---------- Engine singleton (survives window close) ---------- */
type Engine = { chat: { completions: { create: (o: unknown) => Promise<AsyncIterable<{ choices: { delta: { content?: string } }[] }>> } }; interruptGenerate: () => void; unload: () => Promise<void> };
let engine: Engine | null = null;
let engineModel = '';

/* ---------- Local intent engine: instant, private, works without any model ---------- */
async function localIntent(text: string): Promise<string | null> {
  const t = text.trim();
  const l = t.toLowerCase().replace(/[?!.]+$/, '');
  let m: RegExpExecArray | null;

  if (/^(help|what can you do|commands)$/.test(l)) {
    return `I can act on AetherOS directly — instantly and offline:\n\n- **open** an app — “open notes”, “launch terminal”\n- **new note** — “new note called Groceries”\n- **add task** — “add task call the bank”\n- **timers & focus** — “timer 10 minutes”, “remind me to stretch in 20 min”, “start focus”\n- **settings** — “dark mode”, “wallpaper ember”, “do not disturb on”\n- **math** — “what is 15% of 340”, “sqrt(2) * pi”\n- **files** — “find budget”, “summarize” with a 📎 attached file\n- **lock** — “lock my screen”\n\nFor open-ended questions, download an on-device model below. It runs on your GPU; nothing you type ever leaves this device.`;
  }
  if ((m = /^(?:open|launch|start|show)\s+(?:the\s+)?(.+?)(?:\s+app)?$/.exec(l)) && !/^focus/.test(m[1])) {
    const q = m[1];
    const best = allApps().map((a) => ({ a, s: Math.max(fuzzy(q, a.name), ...(a.keywords ?? []).map((k) => fuzzy(q, k) - 50)) })).sort((x, y) => y.s - x.s)[0];
    if (best && best.s > 0) { wm.open(best.a.id); return `Opened **${best.a.name}**.`; }
  }
  if ((m = /^(?:new|create|make|write)\s+(?:a\s+)?note(?:\s+(?:called|titled|named|about))?\s*(.*)$/.exec(l))) {
    const title = (t.slice(t.length - m[1].length) || 'Untitled').trim() || 'Untitled';
    const p = vfs.uniquePath(`${HOME}/Notes`, `${title.replace(/[/\\]/g, '-')}.md`);
    await vfs.writeText(p, `# ${title}\n\n`);
    wm.open('notes', { path: p });
    return `Created the note **${title}** in Notes.`;
  }
  if ((m = /^(?:add|create|new)\s+(?:a\s+)?(?:task|todo|to-do)[:\s]+(.+)$/.exec(l))) {
    const title = t.slice(t.length - m[1].length).trim();
    await loadAppData('tasks', { tasks: [], boards: [] });
    const d = getAppData<{ tasks: unknown[]; boards: { id: string }[] }>('tasks', { tasks: [], boards: [] });
    setAppData('tasks', { ...d, tasks: [...d.tasks, { id: randomId(8), title, status: 'todo', priority: 'med', board: d.boards?.[0]?.id ?? 'personal', created: Date.now() }] });
    return `Added **${title}** to your tasks.`;
  }
  if ((m = /remind me (?:to\s+)?(.+?)\s+in\s+(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)$/.exec(l))) {
    const n = Number(m[2]), unit = m[3][0];
    const ms = n * (unit === 's' ? 1000 : unit === 'h' ? 3_600_000 : 60_000);
    timers.add(ms, m[1].replace(/^./, (c) => c.toUpperCase()));
    return `Okay — I'll remind you to **${m[1]}** in ${n} ${unit === 's' ? 'seconds' : unit === 'h' ? 'hours' : 'minutes'}.`;
  }
  if ((m = /(?:set\s+(?:a\s+)?)?timer\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?|h|hours?)?/.exec(l))) {
    const n = Number(m[1]), unit = (m[2] ?? 'm')[0];
    timers.add(n * (unit === 's' ? 1000 : unit === 'h' ? 3_600_000 : 60_000), `${n}${unit} timer`);
    return `Timer started for **${n} ${unit === 's' ? 'seconds' : unit === 'h' ? 'hours' : 'minutes'}**. It'll ring even if you close me.`;
  }
  if (/^(start\s+)?(a\s+)?(focus|pomodoro)(\s+session)?$/.test(l)) { timers.startFocus(); return 'Focus session started — 25 minutes, notifications silenced. You\'ve got this.'; }
  if (/\b(dark mode|dark theme)\b/.test(l)) { useSettings.getState().set({ theme: 'dark' }); return 'Switched to **dark mode**.'; }
  if (/\b(light mode|light theme)\b/.test(l)) { useSettings.getState().set({ theme: 'light' }); return 'Switched to **light mode**.'; }
  if (/do not disturb|\bdnd\b/.test(l)) { const on = !/\boff\b|disable/.test(l); useSettings.getState().set({ dnd: on }); return `Do Not Disturb is **${on ? 'on' : 'off'}**.`; }
  if ((m = /wallpaper\s+(?:to\s+)?(\w+)/.exec(l))) {
    const w = WALLPAPERS.find((x) => x.id === m![1] || x.name.toLowerCase() === m![1]);
    if (w) { useSettings.getState().set({ wallpaper: w.id }); return `Wallpaper set to **${w.name}**.`; }
    return `I know these wallpapers: ${WALLPAPERS.map((w2) => w2.name).join(', ')}.`;
  }
  if (/^lock( (my|the))?( screen| computer)?$/.test(l)) { setTimeout(() => void session.lock(), 600); return 'Locking now. 🔒'; }
  if (/^(what('?s| is) the )?(time|date|day)( is it)?( today)?$/.test(l)) return `It's **${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}** on ${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;
  if ((m = /^(?:find|search(?: for)?|where is)\s+(.+)$/.exec(l))) {
    const hits = vfs.search(m[1], 8);
    if (!hits.length) return `I couldn't find any files matching “${m[1]}”.`;
    return `Found ${hits.length} match${hits.length > 1 ? 'es' : ''}:\n\n${hits.map((h) => `- \`${h.path.replace(HOME, '~')}\``).join('\n')}`;
  }
  if (/privacy|how (safe|secure|private)|encrypt/.test(l) && l.length < 60) { wm.open('shield'); return 'Your files are encrypted with **AES-256-GCM** and never leave this device. I opened **Shield** so you can see your privacy score and a live network log.'; }
  if ((m = /^(?:what(?:'s| is)\s+)?(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)$/.exec(l))) return `**${formatNumber((Number(m[1]) / 100) * Number(m[2]))}**`;
  const expr = l.replace(/^(what(?:'s| is)|calculate|compute|calc|solve)\s+/, '');
  const v = tryEvaluate(expr);
  if (v !== null) return `**${formatNumber(v)}**`;
  if (/^[\d\s+\-*/^().]+$/.test(expr)) { try { return `**${formatNumber(evaluate(expr))}**`; } catch { /* fallthrough */ } }
  if (/^(hi|hello|hey|yo)\b/.test(l) && l.length < 20) return `Hi ${useSettings.getState().userName.split(' ')[0]}! Ask me to open apps, set timers, create notes — or type **help**.`;
  return null;
}

export default function Cortex({ win }: AppProps) {
  const [data, setData, loaded] = useAppData<CortexData>('cortex', { messages: [], model: MODELS[1].id });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ text: string; p: number } | null>(null);
  const [ready, setReady] = useState(!!engine);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [streaming, setStreaming] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const hasGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const linkGuard = useLinkGuard();

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [data.messages.length, streaming]);
  useEffect(() => { if (win.data?.prompt && loaded) void send(win.data.prompt); }, [win.data?._n, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (m: Omit<Msg, 'id'>) => setData((d) => ({ ...d, messages: [...d.messages, { ...m, id: randomId(8) }].slice(-200) }));

  const loadModel = async () => {
    const model = MODELS.find((x) => x.id === data.model)!;
    const ok = await dialog.confirm({
      title: `Download ${model.name}?`,
      message: `${model.size} of model weights will be downloaded once from huggingface.co and cached in your browser.\n\nOnly the model files are fetched — your messages and files are never sent anywhere. Inference runs entirely on your GPU.`,
      confirmLabel: 'Download & run locally',
    });
    if (!ok) return;
    setProgress({ text: 'Preparing…', p: 0 });
    try {
      if (engine && engineModel !== data.model) { await engine.unload(); engine = null; }
      const webllm = await import('@mlc-ai/web-llm');
      engine = (await webllm.CreateMLCEngine(data.model, { initProgressCallback: (r: { text: string; progress: number }) => setProgress({ text: r.text, p: r.progress }) })) as unknown as Engine;
      engineModel = data.model;
      setReady(true);
      push({ role: 'system', content: `${model.name} is ready — running on-device.` });
    } catch (e) {
      push({ role: 'system', content: `Couldn't start the model: ${(e as Error).message}` });
    } finally { setProgress(null); }
  };

  const send = async (text = input) => {
    const t = text.trim();
    if (!t || busy) return;
    setInput('');
    const att = attachment;
    setAttachment(null);
    push({ role: 'user', content: t, attachment: att?.name });
    setBusy(true);
    try {
      if (!att) {
        const local = await localIntent(t);
        if (local) { push({ role: 'assistant', content: local, local: true }); return; }
      }
      if (!engine) {
        push({ role: 'assistant', local: true, content: hasGPU
          ? `I can handle commands instantly (type **help**), but for questions like this I need an on-device language model. Pick one below and press **Download** — it runs privately on your GPU.`
          : `This browser doesn't support WebGPU, so an on-device language model can't run here. I can still handle commands — type **help** to see what I can do.` });
        return;
      }
      const history = getAppData<CortexData>('cortex', data).messages.filter((m) => m.role !== 'system').slice(-12);
      const sys = `You are Cortex, the private on-device assistant inside AetherOS, a local-first encrypted web operating system. The user's name is ${useSettings.getState().userName}. Be concise, warm and accurate. Use Markdown. Today is ${new Date().toDateString()}.`;
      const msgs = [{ role: 'system', content: sys }, ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))];
      msgs.push({ role: 'user', content: att ? `Here is the content of the file "${att.name}":\n\n"""\n${att.text.slice(0, 8000)}\n"""\n\n${t}` : t });
      const stream = await engine.chat.completions.create({ messages: msgs, stream: true, temperature: 0.6, max_tokens: 800 });
      let out = '';
      for await (const chunk of stream) {
        out += chunk.choices[0]?.delta?.content ?? '';
        setStreaming(out);
      }
      setStreaming('');
      push({ role: 'assistant', content: out.trim() || '…' });
    } catch (e) {
      setStreaming('');
      push({ role: 'system', content: `Error: ${(e as Error).message}` });
    } finally { setBusy(false); requestAnimationFrame(() => taRef.current?.focus()); }
  };

  const attach = async () => {
    const p = await dialog.open({ title: 'Attach a text file for Cortex to read', extensions: ['md', 'txt', 'js', 'ts', 'json', 'csv', 'html', 'css', 'py'] });
    if (!p) return;
    setAttachment({ name: basename(p), text: await vfs.readText(p) });
    if (!input) setInput('Summarize this file');
  };

  const model = MODELS.find((m) => m.id === data.model) ?? MODELS[1];
  const suggestions = ['What can you do?', 'Start a focus session', 'New note called Ideas', 'Timer 5 minutes', 'What is 18% of 2450'];

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white"><Sparkles size={15} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">Cortex</div>
          <div className="text-[11px] text-muted flex items-center gap-1">{ready ? <><span className="w-1.5 h-1.5 rounded-full bg-success" /> {engineModel ? MODELS.find((m) => m.id === engineModel)?.name : model.name} · on-device</> : <><Zap size={10} /> Commands mode · instant & offline</>}</div>
        </div>
        <Badge tone="success"><ShieldCheck size={10} /> Private</Badge>
        <IconButton icon={Trash2} label="Clear conversation" onClick={() => setData((d) => ({ ...d, messages: [] }))} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4" onClick={linkGuard}>
        {data.messages.length === 0 && (
          <div className="flex flex-col items-center text-center pt-6 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-violet-500/25"><Sparkles size={30} /></div>
            <div className="mt-4 text-[20px] font-semibold">How can I help?</div>
            <div className="text-[13px] text-muted mt-1 max-w-sm">I run entirely on this device. Nothing you ask me is ever sent to a server.</div>
            <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-md">
              {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="h-8 px-3.5 rounded-full bg-hover border border-line hover:border-accent hover:text-accent text-[12.5px] transition-colors">{s}</button>)}
            </div>
          </div>
        )}
        {data.messages.map((m) => m.role === 'system' ? (
          <div key={m.id} className="text-center text-[11.5px] text-faint">{m.content}</div>
        ) : (
          <div key={m.id} className={cx('flex gap-3', m.role === 'user' && 'justify-end')}>
            {m.role === 'assistant' && <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white shrink-0 mt-0.5"><Sparkles size={13} /></div>}
            <div className={cx('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] selectable', m.role === 'user' ? 'bg-accent text-accent-fg rounded-br-md' : 'bg-hover border border-line rounded-bl-md')}>
              {m.attachment && <div className="text-[11.5px] opacity-80 flex items-center gap-1 mb-1"><FileText size={11} /> {m.attachment}</div>}
              {m.role === 'user' ? <div className="whitespace-pre-wrap">{m.content}</div> : <div className="prose-aether !text-[13.5px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />}
              {m.local && <div className="text-[10px] text-faint mt-1.5 flex items-center gap-1"><Zap size={9} /> local action</div>}
            </div>
          </div>
        ))}
        {(busy || streaming) && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white shrink-0"><Sparkles size={13} className="animate-pulse" /></div>
            <div className="max-w-[80%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-hover border border-line text-[13.5px]">
              {streaming ? <div className="prose-aether !text-[13.5px] [&>*:first-child]:mt-0" dangerouslySetInnerHTML={{ __html: renderMarkdown(streaming) }} /> : <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
            </div>
          </div>
        )}
      </div>

      {!ready && (
        <div className="mx-3 mb-2 rounded-xl border border-line bg-hover p-3">
          {progress ? (
            <div>
              <div className="flex justify-between text-[12px] mb-1.5"><span className="truncate pr-3 text-muted">{progress.text}</span><span className="tabular-nums">{Math.round(progress.p * 100)}%</span></div>
              <div className="h-1.5 rounded-full bg-line overflow-hidden"><div className="h-full bg-accent transition-all" style={{ width: `${progress.p * 100}%` }} /></div>
            </div>
          ) : hasGPU ? (
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-accent shrink-0" />
              <Select value={data.model} onChange={(v) => setData((d) => ({ ...d, model: v }))} options={MODELS.map((m) => ({ value: m.id, label: `${m.name} · ${m.size}` }))} className="flex-1 min-w-0" />
              <Button size="sm" variant="primary" icon={Download} onClick={loadModel}>Load model</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-muted"><AlertTriangle size={14} className="text-warn" /> WebGPU unavailable — on-device chat needs Chrome/Edge 113+. Commands still work.</div>
          )}
          {!progress && hasGPU && <div className="text-[11px] text-faint mt-1.5">{model.note}. Downloaded once, cached locally, runs offline afterwards.</div>}
        </div>
      )}

      <div className="p-3 pt-0">
        {attachment && (
          <div className="mb-2 inline-flex items-center gap-2 h-7 pl-2.5 pr-1 rounded-lg bg-accent/12 text-accent text-[12px]">
            <FileText size={12} /> {attachment.name}<button onClick={() => setAttachment(null)} className="w-5 h-5 rounded hover:bg-accent/20 flex items-center justify-center"><X size={11} /></button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-hover focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 p-1.5 transition-all">
          <IconButton icon={Paperclip} label="Attach a file" onClick={attach} />
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            rows={1}
            placeholder="Ask Cortex, or tell it what to do…"
            className="flex-1 bg-transparent outline-none resize-none text-[13.5px] py-1.5 max-h-32"
            style={{ height: 'auto' }}
          />
          {busy && engine ? (
            <IconButton icon={Square} label="Stop" onClick={() => engine?.interruptGenerate()} />
          ) : (
            <button onClick={() => send()} disabled={!input.trim()} className="w-8 h-8 rounded-xl bg-accent text-accent-fg flex items-center justify-center disabled:opacity-40 transition-opacity"><Send size={15} /></button>
          )}
        </div>
        <div className="text-[10.5px] text-faint text-center mt-1.5">Tip: press <b>Ctrl K</b> anywhere and type a question to ask Cortex.</div>
      </div>
    </div>
  );
}

export { shell };
