import { create } from 'zustand';
import { useAiProfileStore } from './useAiProfileStore';
import { useAppStore } from './useAppStore';
import { useAIChatStore } from './useAIChatStore';
import type { ActionType } from './useActionRegistry';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase/client';

// Trigger HMR
export type OrchestratorSource = 
  | 'dashboard_chat' 
  | 'sidebar_chat' 
  | 'ai_3d_create' 
  | 'ai_render' 
  | 'canvas';

export type OrchestratorIntent = 'CREATE_PROJECT' | 'TRIGGER_CANVAS' | 'RESPOND_CHAT';

export interface OrchestratorResponse {
  intent: OrchestratorIntent;
  actionType: ActionType;
  assistantMessage: string;
  payload?: any;
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

interface CoreOrchestratorState {
  isProcessing: boolean;
  sendMessageToOrchestrator: (text: string, options?: { source?: OrchestratorSource; sessionId?: string }) => Promise<OrchestratorResponse>;
}

export const useCoreOrchestrator = create<CoreOrchestratorState>((set, get) => ({
  isProcessing: false,

  sendMessageToOrchestrator: async (text, options) => {
    const aiChatStore = useAIChatStore.getState();
    const sessionId = options?.sessionId || aiChatStore.activeSessionId;
    
    if (sessionId) {
      // 1. Add user's message to log
      aiChatStore.addMessage({
        sessionId,
        role: 'user',
        text,
        source: options?.source || 'dashboard_chat'
      });
      
      // Auto-generate title if this is the first user message and the title is "新規チャット"
      const currentSession = aiChatStore.sessions.find(s => s.id === sessionId);
      const sessionMessages = aiChatStore.getMessagesForSession(sessionId);
      if (currentSession && currentSession.title === "新規チャット" && sessionMessages.length === 1) {
        // Just take the first 15 chars as a simple title for now
        const newTitle = text.length > 15 ? text.substring(0, 15) + '...' : text;
        aiChatStore.updateSessionTitle(sessionId, newTitle);
      }
    }

    set({ isProcessing: true });

    try {
      // 2. Fetch context
      const activeProfile = useAiProfileStore.getState().aiProfiles.find(p => p.status === 'Active');
      const systemPrompt = activeProfile 
          ? await useAiProfileStore.getState().buildCompleteSystemPrompt(activeProfile.id)
          : 'Default Prompt fallback';
      
      const { contextLevel, watchedScopes } = (await import('./useJournalAiStore')).useJournalAiStore.getState();
      const activeScopes = contextLevel === 'off' ? 'none' : watchedScopes.join(', ');
      console.log(`[Core Orchestrator] Sending to Backend proposeDesktopAction.
- Context Level: ${contextLevel}
- Active Scopes: ${activeScopes}
- Prompt Length: ${systemPrompt.length} chars
- Prompt Preview: ${systemPrompt.substring(0, 150)}...`);
      
      // 3. Call backend function
      const proposeActionFn = httpsCallable(functions, "proposeDesktopAction");
      const res = await proposeActionFn({
        systemPromptContext: systemPrompt,
        userMessage: text
      });
      
      const resultObj = (res.data as any).result as OrchestratorResponse;

      // Ensure basic normalization just in case
      const actionType = resultObj.actionType || 'RESPOND_CHAT';
      const aiResponseText = resultObj.assistantMessage || '処理を完了しました。';
      const intent = resultObj.intent || 'GENERAL_CHAT';

      // 4. Update Chat Log with AI Response
      if (sessionId) {
        aiChatStore.addMessage({
          sessionId,
          role: 'ai',
          text: aiResponseText,
          source: options?.source || 'sidebar_chat'
        });
      }

      set({ isProcessing: false });

      // 5. Construct and return formal proposal
      return {
        intent: intent as OrchestratorIntent,
        actionType: actionType as ActionType,
        assistantMessage: aiResponseText,
        payload: resultObj.payload || {},
        requiresConfirmation: resultObj.requiresConfirmation || false,
        riskLevel: resultObj.riskLevel || 'low'
      };

    } catch (e) {
      console.error("[Core Orchestrator] Backend LLM Call failed:", e);
      set({ isProcessing: false });
      
      const errorText = "API通信に失敗しました。時間をおいて再試行してください。";
      if (sessionId) {
        aiChatStore.addMessage({
          sessionId,
          role: 'ai',
          text: errorText,
          source: options?.source || 'sidebar_chat'
        });
      }

      return {
        intent: 'RESPOND_CHAT',
        actionType: 'NONE',
        assistantMessage: errorText
      };
    }
  }
}));
