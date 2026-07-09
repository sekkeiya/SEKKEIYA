import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrchestratorSource } from './useCoreOrchestrator';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'ai';
  text: string;
  source?: OrchestratorSource;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface AIChatStoreState {
  sessions: ChatSession[];
  messages: ChatMessage[];
  activeSessionId: string | null;

  createSession: (projectId: string, initialTitle?: string) => string;
  setActiveSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  getMessagesForSession: (sessionId: string) => ChatMessage[];
  getSessionsForProject: (projectId: string) => ChatSession[];
}

export const useAIChatStore = create<AIChatStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      messages: [],
      activeSessionId: null,

      createSession: (projectId, initialTitle = "新規チャット") => {
        const newSessionId = crypto.randomUUID();
        const now = Date.now();
        set((state) => ({
          sessions: [
            ...state.sessions,
            {
              id: newSessionId,
              projectId,
              title: initialTitle,
              createdAt: now,
              updatedAt: now,
            },
          ],
          activeSessionId: newSessionId,
        }));
        return newSessionId;
      },

      setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId });
      },

      deleteSession: (sessionId) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          messages: state.messages.filter((m) => m.sessionId !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }));
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title, updatedAt: Date.now() } : s
          ),
        }));
      },

      addMessage: (msg) => {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        
        set((state) => {
          // Update the session's updatedAt time when a message is added
          const updatedSessions = state.sessions.map((s) => 
            s.id === msg.sessionId ? { ...s, updatedAt: timestamp } : s
          );
          
          return {
            messages: [...state.messages, { ...msg, id, timestamp }],
            sessions: updatedSessions
          };
        });
      },

      getMessagesForSession: (sessionId) => {
        return get().messages.filter((m) => m.sessionId === sessionId);
      },

      getSessionsForProject: (projectId) => {
        return get()
          .sessions.filter((s) => s.projectId === projectId)
          .sort((a, b) => b.updatedAt - a.updatedAt); // Newest first
      },
    }),
    {
      name: 'sekkeiya-ai-chat-storage',
    }
  )
);
