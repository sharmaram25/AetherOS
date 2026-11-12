import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePref = 'dark' | 'light' | 'auto';
export type DockAutohide = 'never' | 'maximized' | 'always';

export interface Settings {
  userName: string;
  avatar: string;
  avatarColor: string;
  theme: ThemePref;
  accent: string;
  wallpaper: string;
  animatedWallpaper: boolean;
  blur: boolean;
  reducedMotion: boolean;
  use24h: boolean;
  showSeconds: boolean;

  dockSize: number;
  dockMagnify: boolean;
  dockAutohide: DockAutohide;
  pinned: string[];

  showDesktopIcons: boolean;
  showWidgets: boolean;
  restoreSession: boolean;

  autoLockMinutes: number;
  lockOnHide: boolean;
  privacyShield: boolean;
  clipboardClearSeconds: number;
  stripMetadata: boolean;
  confirmExternalLinks: boolean;

  dnd: boolean;
  sounds: boolean;
  tourDone: boolean;
}

export const ACCENTS = ['#6d7cff', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#94a3b8'];

export const DEFAULT_PINNED = ['files', 'notes', 'code', 'terminal', 'keychain', 'calendar', 'tasks', 'photos', 'cortex', 'store', 'settings'];

export const DEFAULT_SETTINGS: Settings = {
  userName: 'Aether User',
  avatar: '',
  avatarColor: '#6d7cff',
  theme: 'dark',
  accent: '#6d7cff',
  wallpaper: 'aurora',
  animatedWallpaper: true,
  blur: true,
  reducedMotion: false,
  use24h: false,
  showSeconds: false,
  dockSize: 52,
  dockMagnify: true,
  dockAutohide: 'maximized',
  pinned: DEFAULT_PINNED,
  showDesktopIcons: true,
  showWidgets: true,
  restoreSession: true,
  autoLockMinutes: 15,
  lockOnHide: false,
  privacyShield: false,
  clipboardClearSeconds: 45,
  stripMetadata: true,
  confirmExternalLinks: true,
  dnd: false,
  sounds: true,
  tourDone: false,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'aether.settings', version: 2 },
  ),
);

export const settings = () => useSettings.getState();
