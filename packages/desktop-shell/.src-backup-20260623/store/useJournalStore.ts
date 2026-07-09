import { create } from 'zustand';
import type { JournalEntry } from '../features/projects/types';
import { JournalRepository } from '../features/projects/repositories/JournalRepository';
import { useAuthStore } from './useAuthStore';
import { useAppStore } from './useAppStore';

interface JournalState {
  entries: JournalEntry[];
  isSubmitting: boolean;
  submitEntry: (content: string, title: string | undefined, aiContextSnapshot: JournalEntry['aiContextSnapshot']) => Promise<void>;
  updateEntry: (entryId: string, content: string, title?: string) => Promise<void>;
  deleteEntry: (entryId: string) => Promise<void>;
  
  // Subscription management
  activeProjectId: string | null;
  selectedEntryId: string | null;
  setSelectedEntryId: (id: string | null) => void;
  subscribeToProjectJournals: (projectId: string) => void;
  unsubscribeFromProjectJournals: () => void;
}

let currentUnsubscribe: (() => void) | null = null;

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  isSubmitting: false,
  activeProjectId: null,
  selectedEntryId: null,
  setSelectedEntryId: (id) => set({ selectedEntryId: id }),

  submitEntry: async (content: string, title: string | undefined, aiContextSnapshot) => {
    const { getActiveProject } = useAppStore.getState();
    const activeProject = getActiveProject();
    const { currentUser } = useAuthStore.getState();

    if (!activeProject || !currentUser) {
      console.warn("[useJournalStore] Cannot submit entry: No active project or user.");
      throw new Error("Missing active project or user");
    }

    // Auto-generate title and excerpt if needed
    const finalTitle = title?.trim() || (content.length > 30 ? content.substring(0, 30).trim() + "..." : content.trim());
    const finalExcerpt = content.length > 80 ? content.substring(0, 80).replace(/\n/g, ' ').trim() + "..." : content.replace(/\n/g, ' ').trim();

    set({ isSubmitting: true });
    try {
      await JournalRepository.addJournalEntry(activeProject.id, {
        authorId: currentUser.uid,
        title: finalTitle,
        excerpt: finalExcerpt,
        content,
        aiContextSnapshot,
      });
    } catch (error) {
      console.error("[useJournalStore] Error submitting journal entry:", error);
      throw error;
    } finally {
      set({ isSubmitting: false });
    }
  },

  updateEntry: async (entryId: string, content: string, title?: string) => {
    const { getActiveProject } = useAppStore.getState();
    const activeProject = getActiveProject();

    if (!activeProject) throw new Error("Missing active project");

    const finalTitle = title?.trim() || (content.length > 30 ? content.substring(0, 30).trim() + "..." : content.trim());
    const finalExcerpt = content.length > 80 ? content.substring(0, 80).replace(/\n/g, ' ').trim() + "..." : content.replace(/\n/g, ' ').trim();

    try {
      await JournalRepository.updateJournalEntry(activeProject.id, entryId, {
        content,
        title: finalTitle,
        excerpt: finalExcerpt
      });
    } catch (error) {
      console.error("[useJournalStore] Error updating journal entry:", error);
      throw error;
    }
  },

  deleteEntry: async (entryId: string) => {
    const { getActiveProject } = useAppStore.getState();
    const activeProject = getActiveProject();
    const { currentUser } = useAuthStore.getState();

    if (!activeProject || !currentUser) throw new Error("Missing active project or user");

    try {
      await JournalRepository.deleteJournalEntry(activeProject.id, entryId, currentUser.uid);
    } catch (error) {
      console.error("[useJournalStore] Error deleting journal entry:", error);
      throw error;
    }
  },

  subscribeToProjectJournals: (projectId: string) => {
    const state = get();
    if (state.activeProjectId === projectId) return; // Already subscribed

    // Clean up previous subscription
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }

    set({ activeProjectId: projectId, entries: [] });

    currentUnsubscribe = JournalRepository.subscribeToRecentJournals(
      projectId,
      50, // Fetch up to 50 for the feed, we can adjust later
      (entries) => {
        set({ entries });
      },
      (error) => {
        console.error("[useJournalStore] Subscription error:", error);
      }
    );
  },

  unsubscribeFromProjectJournals: () => {
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }
    set({ activeProjectId: null, entries: [] });
  }
}));
