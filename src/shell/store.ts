import { create } from 'zustand';

type Panel = 'spotlight' | 'launchpad' | 'quick' | 'center' | 'shortcuts' | 'shield' | 'about' | null;

export const useShell = create<{ panel: Panel; spotlightQuery: string; nightLight: number; shielded: boolean }>(() => ({
  panel: null,
  spotlightQuery: '',
  nightLight: 0,
  shielded: false,
}));

export const shell = {
  open(panel: Panel, query = '') {
    useShell.setState((s) => ({ panel: s.panel === panel && !query ? null : panel, spotlightQuery: query }));
  },
  close() {
    useShell.setState({ panel: null });
  },
};
