import { create } from 'zustand';

export type AiContextLevel = 'off' | 'workspace' | 'project' | 'custom';
export type WatchedScope = 'requirements' | 'workfiles' | 'models' | 'layout' | 'presents' | 'journal' | 'ai_drive';

interface JournalAiState {
  // AI Context Settings
  contextLevel: AiContextLevel;
  watchedScopes: WatchedScope[];
  
  // Live Assist / Manual Assist
  liveAssistMode: 'manual' | 'auto' | 'off';
  isSuggesting: boolean;
  currentSuggestion: string | null;

  // Actions
  setContextLevel: (level: AiContextLevel) => void;
  setWatchedScopes: (scopes: WatchedScope[]) => void;
  toggleWatchedScope: (scope: WatchedScope) => void;
  setLiveAssistMode: (mode: 'manual' | 'auto' | 'off') => void;
  setIsSuggesting: (isSuggesting: boolean) => void;
  setCurrentSuggestion: (suggestion: string | null) => void;
}

export const useJournalAiStore = create<JournalAiState>((set, get) => ({
  // Defaults
  contextLevel: 'project', // Default as requested
  watchedScopes: ['requirements', 'workfiles', 'models', 'layout', 'presents', 'journal'], // Default project scopes
  
  liveAssistMode: 'manual', // Manual for Phase 1
  isSuggesting: false,
  currentSuggestion: null,

  setContextLevel: (level) => set({ contextLevel: level }),
  
  setWatchedScopes: (scopes) => set({ watchedScopes: scopes }),
  
  toggleWatchedScope: (scope) => {
    const current = get().watchedScopes;
    if (current.includes(scope)) {
      set({ watchedScopes: current.filter(s => s !== scope) });
    } else {
      set({ watchedScopes: [...current, scope] });
    }
  },
  
  setLiveAssistMode: (mode) => set({ liveAssistMode: mode }),
  setIsSuggesting: (isSuggesting) => set({ isSuggesting }),
  setCurrentSuggestion: (suggestion) => set({ currentSuggestion: suggestion })
}));
