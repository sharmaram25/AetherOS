import {
  Lock, Moon, BellOff, NotebookPen, SquareTerminal, Trash2, Monitor, LayoutDashboard, Image, ShieldCheck, Timer,
  HardDriveDownload, Keyboard, Settings, Focus, FolderOpen, Sun, Info, type LucideIcon, Eye, Ghost,
} from 'lucide-react';
import { session } from '../kernel/session';
import { useSettings } from '../kernel/settings';
import { wm } from '../kernel/windows';
import { vfs } from '../kernel/vfs';
import { dialog } from '../kernel/dialog';
import { toast } from '../kernel/notify';
import { timers } from '../kernel/scheduler';
import { shell, useShell } from './store';
import { HOME } from '../lib/path';
import { sound } from '../lib/sound';

export interface Command { id: string; title: string; subtitle?: string; icon: LucideIcon; keywords?: string; shortcut?: string; run: () => void | Promise<void> }

export async function newNote() {
  const path = vfs.uniquePath(`${HOME}/Notes`, 'Untitled.md');
  await vfs.writeText(path, '# Untitled\n\n');
  wm.open('notes', { path });
}

export async function emptyTrash() {
  const n = vfs.list('/Trash').length;
  if (!n) { toast('Trash is already empty'); return; }
  const ok = await dialog.confirm({ title: `Permanently delete ${n} item${n > 1 ? 's' : ''}?`, message: 'Encrypted blobs are deleted from storage. This cannot be undone.', confirmLabel: 'Empty Trash', danger: true });
  if (!ok) return;
  await vfs.emptyTrash();
  if (useSettings.getState().sounds) sound('trash');
  toast('Trash emptied', 'success');
}

export function getCommands(): Command[] {
  const s = useSettings.getState();
  return [
    { id: 'lock', title: 'Lock screen', icon: Lock, shortcut: 'Alt L', keywords: 'secure away', run: () => session.lock() },
    { id: 'theme', title: s.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode', icon: s.theme === 'light' ? Moon : Sun, keywords: 'theme appearance dark light', run: () => s.set({ theme: s.theme === 'light' ? 'dark' : 'light' }) },
    { id: 'dnd', title: s.dnd ? 'Turn off Do Not Disturb' : 'Turn on Do Not Disturb', icon: BellOff, keywords: 'focus silence notifications', run: () => s.set({ dnd: !s.dnd }) },
    { id: 'shield', title: s.privacyShield ? 'Disable privacy shield' : 'Enable privacy shield', subtitle: 'Blur windows when AetherOS loses focus', icon: Eye, keywords: 'privacy blur shoulder', run: () => s.set({ privacyShield: !s.privacyShield }) },
    { id: 'note', title: 'New note', icon: NotebookPen, keywords: 'create write', run: newNote },
    { id: 'term', title: 'New terminal window', icon: SquareTerminal, shortcut: 'Alt T', keywords: 'shell console', run: () => { wm.open('terminal', undefined, { newWindow: true }); } },
    { id: 'files', title: 'Open home folder', icon: FolderOpen, shortcut: 'Alt E', run: () => { wm.open('files'); } },
    { id: 'focus', title: 'Start a 25-minute focus session', icon: Focus, keywords: 'pomodoro concentrate dnd', run: () => { timers.startFocus(25, 5); toast('Focus session started — notifications silenced', 'success'); } },
    { id: 'timer5', title: 'Start a 5-minute timer', icon: Timer, run: () => { timers.add(5 * 60_000, '5 min timer'); toast('Timer started'); } },
    { id: 'desktop', title: 'Show desktop', icon: Monitor, shortcut: 'Alt D', run: () => wm.showDesktop() },
    { id: 'overview', title: 'Window overview', icon: LayoutDashboard, shortcut: 'Alt O', keywords: 'mission control expose', run: () => wm.toggleOverview(true) },
    { id: 'trash', title: 'Empty Trash', icon: Trash2, keywords: 'delete clean', run: emptyTrash },
    { id: 'wallpaper', title: 'Change wallpaper', icon: Image, keywords: 'background appearance', run: () => { wm.open('settings', { page: 'appearance' }); } },
    { id: 'privacy', title: 'Open privacy center', icon: ShieldCheck, keywords: 'security permissions network shield', run: () => { wm.open('shield'); } },
    { id: 'backup', title: 'Create encrypted backup…', icon: HardDriveDownload, keywords: 'export save', run: () => { wm.open('settings', { page: 'storage' }); } },
    { id: 'keys', title: 'Keyboard shortcuts', icon: Keyboard, shortcut: 'Alt /', keywords: 'help hotkeys', run: () => shell.open('shortcuts') },
    { id: 'settings', title: 'Settings', icon: Settings, shortcut: 'Alt ,', keywords: 'preferences', run: () => { wm.open('settings'); } },
    { id: 'about', title: 'About AetherOS', icon: Info, run: () => useShell.setState({ panel: 'about' }) },
  ];
}
