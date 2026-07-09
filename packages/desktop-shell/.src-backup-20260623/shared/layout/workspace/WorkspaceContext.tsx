import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { PanelModel, OpenPanelInput, WorkspaceContextType } from './types';

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
};

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePanels, setActivePanels] = useState<PanelModel[]>([]);
  const [currentPanelId, setCurrentPanelId] = useState<string | null>(null);

  const focusPanel = useCallback((panelId: string) => {
    setCurrentPanelId(panelId);
  }, []);

  const closePanel = useCallback((panelId: string) => {
    setActivePanels(prev => {
      const next = prev.filter(p => p.id !== panelId);
      if (currentPanelId === panelId) {
        // If closing the active panel, focus the last remaining one
        setCurrentPanelId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, [currentPanelId]);

  const openPanel = useCallback((input: OpenPanelInput) => {
    setActivePanels(prev => {
      // Duplication check (singleton or dedupeKey)
      if (input.isSingleton) {
        const existing = prev.find(p => p.type === input.type);
        if (existing) {
          setCurrentPanelId(existing.id); // Focus existing
          // Update the payload and title smoothly for the existing singleton panel
          return prev.map(p =>
            p.id === existing.id
              ? { ...p, title: input.title || p.title, payload: input.payload || p.payload }
              : p
          );
        }
      }
      if (input.dedupeKey) {
        const existing = prev.find(p => p.dedupeKey === input.dedupeKey);
        if (existing) {
          setCurrentPanelId(existing.id);
          // Update the payload and title for dedupeKey too
          return prev.map(p =>
            p.id === existing.id
              ? { ...p, title: input.title || p.title, payload: input.payload || p.payload }
              : p
          );
        }
      }
      
      const newId = `panel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const title = input.title || input.type; // Fallback title
      
      const newPanel: PanelModel = {
        ...input,
        id: newId,
        title
      };
      
      setCurrentPanelId(newId);
      return [...prev, newPanel];
    });
  }, []);

  const value = useMemo(() => ({
    activePanels,
    currentPanelId,
    openPanel,
    closePanel,
    focusPanel
  }), [activePanels, currentPanelId, openPanel, closePanel, focusPanel]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
