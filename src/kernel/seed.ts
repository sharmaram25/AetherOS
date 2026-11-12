import type { Vfs } from './vfs';
import { HOME } from '../lib/path';

const WELCOME = `# Welcome to AetherOS

AetherOS is a **private, encrypted, local-first** operating system that lives entirely in your browser.

## Your data stays yours
- Every file, note, password and event is encrypted with **AES-256-GCM** before it touches disk.
- Your passphrase never leaves this device and is never stored — only a key derived from it (PBKDF2, 600,000 rounds).
- There are no accounts, no telemetry, no cloud. Open **Shield** to see a live log of every network request (there should be none).

## Get around fast
| Shortcut | Action |
|---|---|
| \`Ctrl + K\` | Spotlight search — apps, files, math, commands |
| \`Alt + Tab\` | Switch windows |
| \`Alt + O\` | Overview of all windows |
| \`Alt + ↑\` | Maximize / restore window |
| \`Alt + ← / →\` | Snap window left / right |
| \`Alt + 1…4\` | Switch workspace |
| \`Alt + L\` | Lock instantly |
| \`Alt + /\` | Show all shortcuts |

Drag files from your computer onto the desktop or into **Files** to import them — they're encrypted on the way in.

> Tip: try typing \`neofetch\` in **Terminal**, or \`2^10 * 3\` in Spotlight.
`;

const NOTE = `# Getting started with Notes

Notes are Markdown files saved in \`~/Notes\` — encrypted, searchable and portable.

- [x] Open AetherOS
- [ ] Write your first note
- [ ] Pin something important

**Bold**, *italic*, \`code\`, [links](https://example.com) and tables all work.

\`\`\`js
console.log('Hello from AetherOS');
\`\`\`
`;

const IDEAS = `# Ideas

- A weekend project: build an Aether app with the SDK (open **App Center → Developers**)
- Plan the next trip in Calendar
- Move passwords into **Keychain** and turn on 2FA codes
`;

const HELLO_JS = `// Open this file in Code and press ▶ Run to execute it in a sandbox.
const greet = (name) => \`Hello, \${name}! The time is \${new Date().toLocaleTimeString()}.\`;
console.log(greet('Aether'));

const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
console.log('fib(20) =', fib(20));
`;

const HELLO_HTML = `<!doctype html>
<html>
<head>
  <style>
    body { font-family: system-ui; display: grid; place-items: center; height: 100vh; margin: 0;
           background: linear-gradient(135deg, #1e1b4b, #0f766e); color: white; }
    button { font-size: 18px; padding: 12px 22px; border-radius: 12px; border: 0; cursor: pointer; }
  </style>
</head>
<body>
  <div style="text-align:center">
    <h1>My first Aether app</h1>
    <p>Runs in a locked-down sandbox — no network, no access to your files unless you allow it.</p>
    <button onclick="aether.notify('Hello!', 'Sent from a sandboxed app')">Send a notification</button>
  </div>
</body>
</html>
`;

const BUDGET = `Category,January,February,March
Rent,1200,1200,1200
Groceries,340,310,365
Transport,90,120,85
Utilities,140,135,150
Fun,200,180,240
Total,=SUM(B2:B6),=SUM(C2:C6),=SUM(D2:D6)
`;

function art(a: string, b: string, c: string, shapes: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="60"/></filter></defs>
<rect width="1600" height="1000" fill="url(#g)"/><g filter="url(#b)" opacity="0.85">${shapes}</g></svg>`;
}

const ART_1 = art('#0b1026', '#3b2a7a', '#0e7490',
  '<circle cx="420" cy="380" r="260" fill="#7c3aed"/><circle cx="1150" cy="620" r="320" fill="#0891b2"/><circle cx="900" cy="250" r="180" fill="#f472b6"/>');
const ART_2 = art('#1a0b0b', '#7c2d12', '#fbbf24',
  '<circle cx="1200" cy="300" r="240" fill="#fde68a"/><ellipse cx="500" cy="800" rx="600" ry="220" fill="#9a3412"/><circle cx="300" cy="300" r="160" fill="#f97316"/>');
const ART_3 = art('#04130f', '#065f46', '#a7f3d0',
  '<circle cx="800" cy="500" r="300" fill="#34d399"/><circle cx="300" cy="200" r="200" fill="#0f766e"/><circle cx="1350" cy="820" r="260" fill="#d9f99d"/>');

export async function seedFileSystem(v: Vfs, opts: { userName?: string; legacy?: { path: string; content: string }[] } = {}) {
  for (const d of ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Notes', 'Projects']) {
    await v.mkdir(`${HOME}/${d}`);
  }
  await v.writeText(`${HOME}/Desktop/Welcome.md`, WELCOME);
  await v.writeText(`${HOME}/Notes/Getting Started.md`, NOTE);
  await v.writeText(`${HOME}/Notes/Ideas.md`, IDEAS);
  await v.writeText(`${HOME}/Projects/hello.js`, HELLO_JS);
  await v.writeText(`${HOME}/Projects/hello-app.html`, HELLO_HTML);
  await v.writeText(`${HOME}/Documents/Budget.csv`, BUDGET);
  await v.writeText(`${HOME}/Pictures/Nebula.svg`, ART_1);
  await v.writeText(`${HOME}/Pictures/Ember.svg`, ART_2);
  await v.writeText(`${HOME}/Pictures/Lagoon.svg`, ART_3);

  if (opts.legacy?.length) {
    for (const f of opts.legacy) {
      const rel = f.path.replace(/^\/home\/user\/?/, '').replace(/^\/+/, '');
      await v.writeText(`${HOME}/Documents/Imported from v1/${rel || 'untitled.txt'}`, f.content);
    }
  }
}
