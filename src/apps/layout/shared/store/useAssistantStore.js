import { create } from 'zustand';
import { normalizeColors } from '@layout/shared/constants/Colors';

// モックの思考ステップ
const MOCK_THINKING_STEPS = [
  "条件を解析中...",
  "フィルタを更新中...",
  "候補を抽出中...",
];

const createNewThread = () => ({
  id: Date.now().toString(),
  title: "新規チャット",
  messages: [{
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content: "S.Models アシスタントです。モデルの検索やダッシュボードの操作をサポートします。「オレンジ色の家具を探して」「30000円以下のソファ」のように指示してください。",
    timestamp: Date.now()
  }],
  context: {
    filters: {},
    searchQuery: "",
    selectedModelIds: []
  }
});

export const useAssistantStore = create((set, get) => ({
  isChatOpen: false,
  isDriveOpen: false,

  // Multi-Thread States
  threads: [createNewThread()],
  activeThreadId: null, // Initialized below

  isThinking: false,
  thinkingStatus: "",
  
  // External hooks
  dashboardActions: null,

  setDashboardActions: (actions) => set({ dashboardActions: actions }),

  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  toggleDrive: () => set((state) => ({ isDriveOpen: !state.isDriveOpen })),

  closeAssistant: () => set({ isChatOpen: false, isDriveOpen: false }),

  // Shared state with Dashboard
  currentSelectedModel: null,
  setCurrentSelectedModel: (model) => set({ currentSelectedModel: model }),

  // Thread Actions
  switchThread: (threadId) => {
    set({ activeThreadId: threadId });
    // TODO: Phase 7.2 context restoration. If switching threads, we should re-apply the context.filters to the dashboad.
    // For now we just update the active thread ID.
  },
  
  startNewThread: () => set((state) => {
    const newThread = createNewThread();
    return {
      threads: [newThread, ...state.threads],
      activeThreadId: newThread.id
    };
  }),

  deleteThread: (threadId) => set((state) => {
    const remaining = state.threads.filter(t => t.id !== threadId);
    
    // Fallback if deleting the last thread
    if (remaining.length === 0) {
      const newThread = createNewThread();
      return { 
        threads: [newThread],
        activeThreadId: newThread.id
      };
    }

    // Fallback active mapping if the deleted one was active
    let nextActiveId = state.activeThreadId;
    if (state.activeThreadId === threadId) {
      nextActiveId = remaining[0].id;
    }

    return {
      threads: remaining,
      activeThreadId: nextActiveId
    };
  }),

  // Action Dispatcher
  applyAssistantAction: (action) => {
    const { dashboardActions } = get();
    if (!dashboardActions) {
      console.warn("dashboardActions is not registered in useAssistantStore.");
      return;
    }

    if (action.type === 'SET_FILTERS') {
      dashboardActions.setFilters(action.payload);
    } else if (action.type === 'SET_SEARCH_QUERY') {
      dashboardActions.setSearchQuery(action.payload);
    }
  },

  // Chat Actions
  sendMessage: async (content) => {
    let { threads, activeThreadId } = get();
    
    if (!activeThreadId && threads.length > 0) {
      activeThreadId = threads[0].id;
    }

    const userMsg = { id: Date.now().toString(), role: "user", content, timestamp: Date.now() };
    
    set((state) => {
      const updatedThreads = state.threads.map(t => {
        if (t.id === activeThreadId) {
          const isFirstUserMsg = t.messages.filter(m => m.role === 'user').length === 0;
          return {
            ...t,
            title: isFirstUserMsg ? content.substring(0, 15) + (content.length > 15 ? '...' : '') : t.title,
            messages: [...t.messages, userMsg]
          };
        }
        return t;
      });
      return { 
        threads: updatedThreads,
        isThinking: true,
        thinkingStatus: "処理を開始しています..."
      };
    });

    // 解析モック (Keyword parsing)
    let pendingAction = null;
    let responseText = `「${content}」について確認しました。（※指示に該当するキーワードがありませんでした）`;

    const lowerContent = content.toLowerCase();

    // フィルタなどの判定状態
    let hasColor = false;
    let hasPrice = false;
    let hasCategory = false;
    let hasSimilar = false;

    // リセット系の判定
    const isResetAll = lowerContent.includes('リセット') || lowerContent.includes('クリア') || (lowerContent.includes('一覧') && lowerContent.includes('戻し')) || lowerContent.includes('元リスト');
    const isClearSimilar = lowerContent.includes('類似検索を解除') || (lowerContent.includes('類似') && lowerContent.includes('戻し'));

    // 類似検索の判定
    const isSimilarRequest = lowerContent.includes('似た') || lowerContent.includes('類似') || lowerContent.includes('似ている') || lowerContent.includes('同じよう');

    if (isClearSimilar && !isResetAll) {
      pendingAction = { type: 'CLEAR_SIMILAR_TO' };
      responseText = "類似検索を解除し、通常の一覧に戻しました。";
    } else if (isResetAll) {
      pendingAction = { type: 'RESET_FILTERS' };
      responseText = "検索条件をリセットし、通常の一覧に戻しました。";
    } else if (isSimilarRequest) {
      hasSimilar = true;
      const { currentSelectedModel } = get();
      if (!currentSelectedModel) {
        responseText = "類似検索の基準となるモデルが見つかりません。先にメインエリアから基準にしたいモデルを選択してください。";
      } else {
        const referenceId = currentSelectedModel.id || currentSelectedModel.entityId;
        const referenceName = currentSelectedModel.title || currentSelectedModel.name || '選択中モデル';
        
        pendingAction = {
          type: 'SET_FILTERS',
          payload: { similarTo: referenceId } // similarTo フィルタをセット
        };
        responseText = `「${referenceName}」を基準に類似モデルを検索しました。メインエリアを確認してください。`;
      }
    } else {
      // カラー抽出: 入力テキスト全体の配列を渡し、正規化IDを取得
      const extractedColors = normalizeColors([content.replace(/\s+/g, '')]); // 空白を詰めて簡易検索
      hasColor = extractedColors.length > 0;

      hasPrice = lowerContent.includes('30000') || lowerContent.includes('3万') || lowerContent.includes('30,000');
      hasCategory = lowerContent.includes('家具') || lowerContent.includes('ソファ');

      if (hasColor || hasPrice || hasCategory) {
        let filtersToUpdate = { similarTo: null }; // フィルタ更新時は類似検索を解除
        let searchTerms = [];

        if (hasCategory) {
          filtersToUpdate.mainCategory = '家具';
        }
        if (hasColor) {
          filtersToUpdate.colors = extractedColors;
        }
        if (hasPrice) {
          filtersToUpdate.maxPrice = 30000;
        }

        pendingAction = {
          type: 'SET_FILTERS',
          payload: filtersToUpdate // Using direct object instead of function to simplify
        };
        
        let actionDesc = [];
        if (hasColor) actionDesc.push(`色「${extractedColors.join(', ')}」`);
        if (hasCategory) actionDesc.push('カテゴリ「家具」');
        if (hasPrice) actionDesc.push('価格「〜30000円」');

        responseText = `${actionDesc.join('、')}を表示するように条件を更新しました。メインエリアを確認してください。`;
      }
    }

    // 思考プロセス
    const steps = pendingAction ? MOCK_THINKING_STEPS : ["意図を解析中..."];
    for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        set({ thinkingStatus: steps[i] });
    }

    // 適用
    if (pendingAction) {
      if (pendingAction.type === 'SET_FILTERS') {
        get().applyAssistantAction({
          type: 'SET_FILTERS',
          payload: (prev) => ({ ...prev, ...pendingAction.payload })
        });
      } else if (pendingAction.type === 'CLEAR_SIMILAR_TO') {
        get().applyAssistantAction({
          type: 'SET_FILTERS',
          payload: (prev) => ({ ...prev, similarTo: null })
        });
      } else if (pendingAction.type === 'RESET_FILTERS') {
        get().resetAllSearchState();
      }
    }

    // Reset feedback state if we are doing a complete reset or clear
    if (pendingAction && (pendingAction.type === 'RESET_FILTERS' || pendingAction.type === 'CLEAR_SIMILAR_TO')) {
      set({ awaitingResultFeedback: false, lastActionContext: null });
    }

    // アシスタントの応答を追加
    const aiMsg = { 
      id: (Date.now() + 1).toString(), 
      role: "assistant", 
      content: responseText, 
      timestamp: Date.now() 
    };
    
    set((state) => ({
      threads: state.threads.map(t => 
        t.id === activeThreadId 
          ? { ...t, messages: [...t.messages, aiMsg], context: { ...t.context, filters: pendingAction ? pendingAction.payload : t.context.filters } }
          : t
      ),
      isThinking: false,
      thinkingStatus: "",
      awaitingResultFeedback: !!pendingAction,
      lastActionContext: pendingAction ? { hasColor, hasPrice, hasCategory } : null
    }));
  },
  
  reportSearchResult: (count, hasError = false) => {
    const { awaitingResultFeedback, isChatOpen, activeThreadId, threads, lastActionContext } = get();
    // AI Chatが直前に適用した検索（フィードバック待ち状態）かつ 0件の時だけ反応
    if (!awaitingResultFeedback) return;
    if (count > 0 || !isChatOpen) {
      set({ awaitingResultFeedback: false, lastActionContext: null });
      return;
    }

    if (hasError && lastActionContext?.hasSimilar) {
       // エラー発生かつ、それが類似検索だった場合
       const msg = {
         id: Date.now().toString(),
         role: "assistant",
         content: "類似検索でエラーが発生しました。時間を置いて再度お試しください。",
         timestamp: Date.now()
       };
       set((state) => ({
         threads: state.threads.map(t => 
           t.id === activeThreadId ? { ...t, messages: [...t.messages, msg] } : t
         ),
         awaitingResultFeedback: false,
         lastActionContext: null
       }));
       return;
    }

    const ctx = get().lastActionContext || {};
    const actions = [];
    if (ctx.hasPrice) actions.push({ id: `relax-price`, label: "価格条件を外して再検索", type: "REMOVE_PRICE_FILTER" });
    if (ctx.hasColor) actions.push({ id: `relax-color`, label: "色条件を外して再検索", type: "REMOVE_COLOR_FILTER" });
    if (ctx.hasCategory) actions.push({ id: `relax-category`, label: "カテゴリ条件を外して再検索", type: "REMOVE_CATEGORY_FILTER" });
    
    // 特定の条件があれば「すべてクリア」も追加、なければフォールバック
    if (actions.length > 0) {
       actions.push({ id: `reset-all`, label: "条件をすべてクリア", type: "RESET_FILTERS" });
    } else {
       actions.push({ id: `reset-all-fallback`, label: "フィルタをリセット", type: "RESET_FILTERS" });
    }

    // action processing in handleFollowUp (already exists below)

    const msg = {
      id: Date.now().toString(),
      role: "assistant",
      content: "条件に一致するモデルが0件でした。条件を少し緩めてみてはいかがでしょうか？",
      timestamp: Date.now(),
      actions
    };

    set((state) => ({
      threads: state.threads.map(t => 
        t.id === activeThreadId ? { ...t, messages: [...t.messages, msg] } : t
      ),
      awaitingResultFeedback: false
    }));
  },

  executeAction: (messageId, actionId, actionType) => {
    const { activeThreadId, applyAssistantAction, lastActionContext } = get();
    
    // クリックしたchipのみを一旦無効化
    set((state) => ({
      threads: state.threads.map(t => {
        if (t.id !== activeThreadId) return t;
        return {
          ...t,
          messages: t.messages.map(m => {
            if (m.id !== messageId || !m.actions) return m;
            return {
              ...m,
              actions: m.actions.map(a => a.id === actionId ? { ...a, disabled: true } : a)
            };
          })
        };
      })
    }));

    let pendingPayload = {};
    let desc = "";
    let nextContext = { ...lastActionContext };

    if (actionType === "REMOVE_PRICE_FILTER") {
      pendingPayload = { maxPrice: null };
      nextContext.hasPrice = false;
      desc = "価格条件を外して再検索します。";
    } else if (actionType === "REMOVE_COLOR_FILTER") {
      pendingPayload = { colors: [] }; // Set explicitly colors to empty
      nextContext.hasColor = false;
      desc = "色条件を外して再検索します。";
    } else if (actionType === "REMOVE_CATEGORY_FILTER") {
      pendingPayload = { mainCategory: "" };
      nextContext.hasCategory = false;
      desc = "カテゴリ条件を外して再検索します。";
    } else if (actionType === "RESET_FILTERS") {
      nextContext = {};
      desc = "すべての条件をクリアして再検索します。";
    }

    if (actionType === "RESET_FILTERS") {
      get().resetAllSearchState();
    } else {
      applyAssistantAction({
        type: 'SET_FILTERS',
        payload: (prev) => ({ ...prev, ...pendingPayload })
      });
    }

    const followUpMsg = {
      id: Date.now().toString(),
      role: "assistant",
      content: desc,
      timestamp: Date.now()
    };

    set((state) => ({
      threads: state.threads.map(t => t.id === activeThreadId ? { ...t, messages: [...t.messages, followUpMsg] } : t),
      awaitingResultFeedback: true,
      lastActionContext: nextContext // 再検索後さらに0件の場合に備える
    }));
  },

  resetAllSearchState: () => {
    const { applyAssistantAction } = get();
    // 1. Reset Filters to completely empty object
    applyAssistantAction({
      type: 'SET_FILTERS',
      payload: {}
    });
    // 2. Reset Search Query to empty string
    applyAssistantAction({
      type: 'SET_SEARCH_QUERY',
      payload: ""
    });
    // 3. Reset any chat-related follow-up feedback states
    set({ awaitingResultFeedback: false, lastActionContext: null });
  },

  clearMessages: () => {
    const { activeThreadId } = get();
    set((state) => ({
      threads: state.threads.map(t => 
        t.id === activeThreadId 
          ? { ...t, messages: [
              {
                id: `welcome-${Date.now()}`,
                role: "assistant",
                content: "スレッドの会話をクリアしました。新しく指示をどうぞ。",
                timestamp: Date.now()
              }
            ]}
          : t
      )
    }));
  }
}));

// Initialize activeThreadId
useAssistantStore.setState((state) => ({
  activeThreadId: state.threads[0].id
}));
