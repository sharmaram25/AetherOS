
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { WindowState, AppId } from '../types';
import { APP_REGISTRY } from '../utils/appRegistry';

interface WindowManagerStore {
  windows: Record<string, WindowState>;
  activeWindowId: string | null;
  windowOrder: string[]; 

  openWindow: (appId: AppId, title: string, data?: any) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
}

export const useWindowManager = create<WindowManagerStore>()(
  persist(
    (set, get) => ({
      windows: {},
      activeWindowId: null,
      windowOrder: [],

      openWindow: (appId, title, data) => {
        const config = APP_REGISTRY[appId];
        
        // Single Instance Check (if supported by registry, for now mostly allowing multiples unless strictly defined)
        // const existingId = Object.keys(get().windows).find(id => get().windows[id].appId === appId);
        
        // Use random ID for multiples, or appId for singletons
        const id = appId + '-' + Math.random().toString(36).substr(2, 5); 
        const zIndex = get().windowOrder.length + 1;
        
        const newWindow: WindowState = {
          id,
          appId,
          title: title || config.title,
          position: { x: window.innerWidth / 2 - (config.defaultWidth / 2), y: window.innerHeight / 2 - (config.defaultHeight / 2) },
          size: { width: config.defaultWidth, height: config.defaultHeight },
          isMinimized: false,
          isMaximized: false,
          zIndex,
          data
        };

        set((state) => ({
          windows: { ...state.windows, [id]: newWindow },
          windowOrder: [...state.windowOrder, id],
          activeWindowId: id,
        }));
      },

      closeWindow: (id) => {
        set((state) => {
          const { [id]: _, ...remainingWindows } = state.windows;
          const newOrder = state.windowOrder.filter((wId) => wId !== id);
          const newActive = newOrder.length > 0 ? newOrder[newOrder.length - 1] : null;
          return {
            windows: remainingWindows,
            windowOrder: newOrder,
            activeWindowId: newActive,
          };
        });
      },

      focusWindow: (id) => {
        const { windows, windowOrder } = get();
        if (!windows[id]) return;

        if (windows[id].isMinimized) {
            get().restoreWindow(id);
        }

        if (get().activeWindowId === id) return;

        const newOrder = windowOrder.filter((wId) => wId !== id);
        newOrder.push(id);

        const updatedWindows = { ...windows };
        newOrder.forEach((wId, index) => {
          updatedWindows[wId] = { ...updatedWindows[wId], zIndex: index + 1 };
        });

        set({
          windows: updatedWindows,
          windowOrder: newOrder,
          activeWindowId: id,
        });
      },

      minimizeWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], isMinimized: true },
          },
          activeWindowId: null,
        }));
      },

      maximizeWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], isMaximized: true },
          },
        }));
        get().focusWindow(id);
      },

      restoreWindow: (id) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], isMinimized: false, isMaximized: false },
          },
        }));
        get().focusWindow(id);
      },

      updateWindow: (id, updates) => {
        set((state) => ({
          windows: {
            ...state.windows,
            [id]: { ...state.windows[id], ...updates },
          },
        }));
      },
    }),
    {
      name: 'aether-os-state', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ windows: state.windows, windowOrder: state.windowOrder }),
    }
  )
);
