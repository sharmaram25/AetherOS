import { create } from 'zustand';
import { randomId } from './crypto';
import { settings } from './settings';
import { sound } from '../lib/sound';

export interface NoteAction { label: string; run: () => void }

export interface Note {
  id: string;
  appId?: string;
  title: string;
  body?: string;
  time: number;
  read: boolean;
  tone?: 'info' | 'success' | 'warn' | 'error';
  actions?: NoteAction[];
  /** Toast-only notes are not kept in the notification center. */
  transient?: boolean;
}

interface NotifyStore {
  history: Note[];
  toasts: Note[];
  centerOpen: boolean;
}

export const useNotify = create<NotifyStore>(() => ({ history: [], toasts: [], centerOpen: false }));

export function notify(n: Omit<Note, 'id' | 'time' | 'read'>): string {
  const note: Note = { ...n, id: randomId(8), time: Date.now(), read: false };
  const dnd = settings().dnd;
  useNotify.setState((s) => ({
    history: n.transient ? s.history : [note, ...s.history].slice(0, 100),
    toasts: dnd && n.tone !== 'error' ? s.toasts : [...s.toasts, note].slice(-4),
  }));
  if (!dnd && settings().sounds) sound(n.tone === 'error' ? 'error' : 'notify');
  return note.id;
}

/** Small, transient confirmation message ("Copied", "Saved"). */
export function toast(title: string, tone: Note['tone'] = 'info', body?: string) {
  return notify({ title, body, tone, transient: true });
}

export function dismissToast(id: string) {
  useNotify.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export function clearNotifications() {
  useNotify.setState({ history: [] });
}

export function removeNotification(id: string) {
  useNotify.setState((s) => ({ history: s.history.filter((h) => h.id !== id) }));
}

export function markAllRead() {
  useNotify.setState((s) => ({ history: s.history.map((h) => ({ ...h, read: true })) }));
}
