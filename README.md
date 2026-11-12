<div align="center">

# AetherOS 2.0 — *Halcyon*

### The private operating system that lives in a browser tab.

Encrypted by default · local-first · zero telemetry · extensible with sandboxed apps

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=0B1020)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Crypto](https://img.shields.io/badge/WebCrypto-AES--256--GCM-10b981)](#security-model)
[![License](https://img.shields.io/badge/License-MIT-22c55e)](#license)

</div>

---

AetherOS turns any modern browser into a complete, private desktop. Every file, note, password, event and setting is **encrypted on-device with AES-256-GCM** before it touches storage. There are no accounts, no servers and no analytics — and a strict Content-Security-Policy makes it technically impossible for the OS or any app inside it to send your data anywhere.

It's designed to be the thing you'd actually trust with your life admin, and a platform others can build on.

## Highlights

| | |
|---|---|
| 🔐 **Encrypted vault** | AES-256-GCM per record, 600k-round PBKDF2 passphrase or non-extractable device key, brute-force throttling, auto-lock, instant key rotation |
| 🛡️ **Shield privacy center** | Privacy score with one-click fixes, per-app permissions, sensor & access audit log, live network transparency log, raw-ciphertext viewer |
| 🪟 **Real window manager** | Drag, 8-way resize, edge & quarter snapping with previews, 4 workspaces, overview (Alt O), Alt-Tab switcher, session restore |
| 🔎 **Spotlight** (Ctrl K) | Fuzzy search over apps, commands, file names *and decrypted file contents*, inline calculator, ask-Cortex fallback |
| 🧩 **App platform** | Install sandboxed HTML apps (`.aetherapp`), capability-based SDK, permission prompts, built in Code with one-click install |
| 🤖 **On-device AI** | Cortex: instant offline intent engine + optional WebGPU LLMs (Qwen, Llama, Phi, SmolLM) — prompts never leave the device |
| 👻 **Guest sessions** | RAM-only sessions that vanish completely when you exit |
| 💾 **Portable backups** | Single password-encrypted `.aether` file, restorable anywhere (merge or replace) |

## The app suite (19 built-in apps)

**Productivity** — Notes (Markdown, notebooks, live preview, clickable checklists) · Calendar (month/week/agenda, reminders, `.ics` import/export) · Tasks (Kanban + list, boards, subtasks) · Sheets (formula engine, ranges, CSV) · Cortex (AI)

**Privacy** — Keychain (password manager with RFC-6238 2FA codes, generator, offline security audit, CSV import) · Shield (privacy center)

**Developer** — Code (CodeMirror 6, tabs, file tree, sandboxed JS runner, live HTML/Markdown preview, install-as-app) · Terminal (real shell: pipes, redirects, `&&`, globs, env vars, tab completion, 50+ commands incl. `seal`/`unseal` file encryption)

**Media & Creativity** — Photos (library, viewer, editor; strips GPS/EXIF) · Media (audio/video, visualizer, media keys) · Canvas (paint: brushes, shapes, flood fill, eyedropper, text) · Camera (permission-gated, live in-use indicator, photo/video)

**System & Utilities** — Files (multi-select, drag & drop, preview pane, trash, starred, checksum, password-seal) · Settings · App Center · Monitor (real FPS, main-thread latency, heap, storage, processes) · Clock (world, alarms, stopwatch, timers, Pomodoro focus with auto-DND) · Calculator (basic/scientific/programmer)

## Security model

```
passphrase ──PBKDF2-SHA256 (600k, 128-bit salt)──► KEK ──AES-GCM wrap──► DEK (random 256-bit)
                                                                            │
          IndexedDB:  vault:header  (wrapped DEK, salt — no plaintext)      │ AES-256-GCM, random 96-bit IV,
                      fs:index      (encrypted directory tree)  ◄───────────┤ record-bound associated data
                      blob:<rand>   (encrypted file contents)   ◄───────────┘
```

- **Zero-knowledge at rest.** File names, folder structure and contents are all ciphertext. Blob keys are random IDs, so storage reveals nothing about what you keep.
- **Associated data binding** prevents swapping or replaying encrypted records between keys.
- **Key rotation is instant** — changing your passphrase only re-wraps the DEK.
- **Locking** unmounts every app, drops decrypted caches and forgets the key.
- **Throttling** — repeated wrong passphrases trigger exponential lockouts.
- **CSP (production build)** restricts `connect-src`, `img-src` and `form-action` so neither the OS nor sandboxed apps can exfiltrate data. The only allowed external hosts are the model mirrors used when *you* opt in to downloading an AI model.
- **Remote images in Markdown are blocked** (no tracking pixels); external links require confirmation and never send a referrer.
- **Clipboard hygiene** — copied secrets are auto-cleared.

**Threat model:** protects data at rest (copied browser profiles, stolen disks, other software reading storage). While unlocked, data is decrypted in the tab's memory; a compromised browser or OS is out of scope for any web app.

## Building apps for AetherOS

An app is one HTML document plus a manifest:

```json
{
  "id": "my-app",
  "name": "My App",
  "icon": "🚀",
  "color": "#6366f1",
  "permissions": ["notifications", "storage"],
  "html": "<button onclick=\"aether.notify('Hi!')\">Hello</button>"
}
```

Apps run in an opaque-origin `sandbox="allow-scripts"` iframe and talk to the OS only through `window.aether`:

| API | Permission |
|---|---|
| `aether.notify(title, body?)` | `notifications` |
| `aether.clipboard.write(text)` | `clipboard` |
| `aether.storage.get / set / remove / keys` | — (private, encrypted, 2 MB) |
| `aether.fs.open({extensions})`, `aether.fs.save(name, content)` | `files` (user picks) |
| `aether.fs.read / write / list(path)` | `files` (runtime consent) |
| `aether.setTitle()`, `aether.theme()`, `aether.on('theme', fn)` | — |

Every call is checked against the manifest *and* user consent, and logged in Shield. Write one in **Code**, hit *Preview*, then *Install as app*.

## Keyboard

| Shortcut | Action |
|---|---|
| `Ctrl K` / `Alt Space` | Spotlight |
| `Alt Tab` / ``Alt ` `` | Switch windows |
| `Alt O` | Overview |
| `Alt ← → ↑ ↓` | Snap / maximize / minimize |
| `Alt 1–4`, `Alt Shift 1–4` | Switch / move to workspace |
| `Alt L` | Lock |
| `Alt /` | All shortcuts |

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # type-checks, then builds to dist/ with the strict CSP
npm run preview
```

Requires a modern Chromium, Firefox or Safari. On-device AI chat requires WebGPU (Chrome/Edge 113+).

## Architecture

```text
src/
  kernel/   crypto · db · vault · vfs · session · windows · settings · appdata
            privacy (permissions, sensors, network log) · scheduler · launcher · backup · registry
  shell/    Boot · Setup · LockScreen · Desktop · TopBar · Dock · WindowFrame · WindowLayer
            Spotlight · Launchpad · NotificationCenter · QuickSettings · Dialogs · Widgets · Wallpaper (WebGL)
  apps/     19 built-in apps
  sdk/      sandbox runtime · manifest validation · built-in catalog
  ui/       design system primitives (light & dark tokens)
  lib/      path · mime · calc (safe evaluator) · markdown · strength · totp · sound
```

Upgrading from v1? The setup wizard detects your old unencrypted files, imports them into the encrypted vault, and removes the plaintext copy.

## Author

**Ram Sharma** — Creative Technologist · Full-Stack Builder · Systems UI Enthusiast
[GitHub](https://github.com/sharmaram25) · [Portfolio](https://portfolio-ram-sharma.netlify.app/)

## License

MIT
