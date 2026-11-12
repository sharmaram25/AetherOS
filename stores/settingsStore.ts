
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  // Appearance
  theme: 'light' | 'dark';
  accentColor: string;
  blurStrength: number; // 0 to 40 (px)
  wallpaperId: string;
  
  // User
  userName: string;
  userBio: string;
  
  // System / Performance
  scale: number; // 0.8 to 1.2
  ecoMode: boolean;
  reducedMotion: boolean;
  
  // Widget State
  clockScale: number; // 0.5 to 2.0
  
  // Actions
  setTheme: (t: 'light' | 'dark') => void;
  setAccentColor: (c: string) => void;
  setBlurStrength: (b: number) => void;
  setWallpaperId: (id: string) => void;
  setUserName: (n: string) => void;
  setUserBio: (b: string) => void;
  
  setScale: (s: number) => void;
  setEcoMode: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setClockScale: (s: number) => void;
  
  hardReset: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults
      theme: 'dark',
      accentColor: '#3b82f6', // blue-500
      blurStrength: 16,
      wallpaperId: 'default',
      
      userName: 'Guest User',
      userBio: 'Explorer of the Digital Void',
      
      scale: 1,
      ecoMode: false,
      reducedMotion: false,
      clockScale: 1.0,

      // Setters
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setBlurStrength: (blurStrength) => set({ blurStrength }),
      setWallpaperId: (wallpaperId) => set({ wallpaperId }),
      
      setUserName: (userName) => set({ userName }),
      setUserBio: (userBio) => set({ userBio }),
      
      setScale: (scale) => set({ scale }),
      setEcoMode: (ecoMode) => set({ ecoMode }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setClockScale: (clockScale) => set({ clockScale }),
      
      hardReset: () => {
        if (confirm("WARNING: This will wipe all files and settings. Are you sure?")) {
            localStorage.clear();
            indexedDB.deleteDatabase('aether-os-db');
            window.location.reload();
        }
      }
    }),
    {
      name: 'aether-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
