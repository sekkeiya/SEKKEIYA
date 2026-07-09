import { create } from 'zustand';
import { normalizeColors } from '../../../utils/colors';

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
    content: "3DSS アシスタントです。モデルの検索やダッシュボードの操作をサポートします。「オレンジ色の家具を探して」「30000円以下のソファ」のように指示してください。",
    timestamp: Date.now()
  }],
  context: {
    filters: {},
    searchQuery: "",
    selectedModelIds: []
  }
});

export const useAssistantStore = create((set, get) => ({
  // Multi-Thread States
  threads: [createNewThread()],
  activeThreadId: null, // Initialized below

  isThinking: false,
  thinkingStatus: "",
  
  // External hooks
  dashboardActions: null,

  setDashboardActions: (actions) => set({ dashboardActions: actions }),

  // Shared state with Dashboard
  currentSelectedModel: null,
  setCurrentSelectedModel: (model) => set({ currentSelectedModel: model }),

  // AI App Context
  currentBoardId: null,
  currentProjectId: null,
  currentStrategySummary: null,
  setAiContext: (arg1, arg2) => set(state => {
    let boardId = state.currentBoardId;
    let projectId = state.currentProjectId;
    let strategySummary = state.currentStrategySummary;

    if (arg1 && typeof arg1 === 'object') {
      if (arg1.boardId !== undefined) boardId = arg1.boardId;
      if (arg1.projectId !== undefined) projectId = arg1.projectId;
      if (arg1.strategySummary !== undefined) strategySummary = arg1.strategySummary;
    } else {
      if (arg1 !== undefined) boardId = arg1;
      if (arg2 !== undefined) projectId = arg2;
    }

    const isSummaryChanged = JSON.stringify(state.currentStrategySummary) !== JSON.stringify(strategySummary);

    // Only update if changed
    if (state.currentBoardId !== boardId || state.currentProjectId !== projectId || isSummaryChanged) {
      console.log("[useAssistantStore] Derived AI Context updated:", { boardId, projectId, hasStrategy: !!strategySummary });
      return { 
        currentBoardId: boardId, 
        currentProjectId: projectId,
        currentStrategySummary: strategySummary
      };
    }
    return {};
  }),

  // Thread Actions
  switchThread: (threadId) => {
    set({ activeThreadId: threadId });
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
    if (remaining.length === 0) {
      const newThread = createNewThread();
      return { 
        threads: [newThread],
        activeThreadId: newThread.id
      };
    }
    let nextActiveId = state.activeThreadId;
    if (state.activeThreadId === threadId) {
      nextActiveId = remaining[0].id;
    }
    return {
      threads: remaining,
      activeThreadId: nextActiveId
    };
  }),

  // Execution Tracker
  markActionExecuted: (messageId, actionId) => set((state) => {
    return {
      threads: state.threads.map(t => {
        if (t.id === state.activeThreadId) {
          return {
            ...t,
            messages: t.messages.map(m => {
              if (m.id === messageId && m.actions) {
                return {
                  ...m,
                  actions: m.actions.map(a => a.id === actionId ? { ...a, isExecuted: true } : a)
                };
              }
              return m;
            })
          };
        }
        return t;
      })
    };
  }),

  // Legacy Action Dispatcher (Keeping for internal parts not using JSON Action yet)
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
    let { threads, activeThreadId, currentProjectId, currentBoardId, currentStrategySummary } = get();
    
    if (!activeThreadId && threads.length > 0) {
      activeThreadId = threads[0].id;
    }

    // [Phase 8] メッセージ構成とペイロード生成
    const payload = {
      message: content,
      context: {
        projectId: currentProjectId || null,
        boardId: currentBoardId || null,
        strategySummary: currentStrategySummary || null
      }
    };
    console.log("[AssistantDrawer] Sending AI request with context:", payload.context);

    // [Phase 8 & 31] 内部プロンプト文脈への反映
    let _internalPromptContext = `Current projectId: ${currentProjectId || 'None'}\nCurrent boardId: ${currentBoardId || 'None'}\n`;
    if (currentStrategySummary) {
      _internalPromptContext += `\n[Project Strategy Context (Read-Only Reference)]\n${JSON.stringify(currentStrategySummary, null, 2)}\n*Note: This strategy data is for context reference only. Do not treat it as absolute truth if it contradicts explicit user requirements. Prioritize user requirements.*`;
    }
    _internalPromptContext += `\n\nUse this context when answering the user.`;

    const userMsg = { id: Date.now().toString(), role: "user", content, timestamp: Date.now() };
    
    set((state) => {
      const updatedThreads = state.threads.map(t => {
        if (t.id === activeThreadId) {
          const isFirstUserMsg = t.messages.filter(m => m.role === 'user').length === 0;
          return {
            ...t,
            title: isFirstUserMsg ? content.substring(0, 15) + (content.length > 15 ? '...' : '') : t.title,
            messages: [...t.messages, userMsg],
            context: { ...t.context, aiPrompt: _internalPromptContext } // 内部コンテキストへ保存
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

    // アクションの定義（JSON仕様へ・配列対応）
    let pendingActions = [];
    let responseText = `「${content}」について確認しました。（※指示に該当するキーワードがありませんでした）`;
    const lowerContent = content.toLowerCase();

    // フィルタ判定状態
    let hasColor = false;
    let hasPrice = false;
    let hasCategory = false;
    let hasSimilar = false;

    // リセット判定
    const isResetAll = lowerContent.includes('リセット') || lowerContent.includes('クリア') || (lowerContent.includes('一覧') && lowerContent.includes('戻し')) || lowerContent.includes('元リスト');
    const isClearSimilar = lowerContent.includes('類似検索を解除') || (lowerContent.includes('類似') && lowerContent.includes('戻し'));
    const isSimilarRequest = lowerContent.includes('似た') || lowerContent.includes('類似') || lowerContent.includes('似ている') || lowerContent.includes('同じよう');
    const isMultiStepModelFlow = lowerContent.includes('追加して開く') || lowerContent.includes('追加してボードを開く');

    const generateActionId = () => `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (isMultiStepModelFlow) {
      pendingActions.push({ id: generateActionId(), type: 'searchModels', payload: { query: 'ソファ' } });
      pendingActions.push({ id: generateActionId(), type: 'addModelToBoard', payload: { modelId: 'mock-sofa-1', boardId: currentBoardId || 'mock-board-id' } });
      pendingActions.push({ id: generateActionId(), type: 'openBoard', payload: { boardId: currentBoardId || 'mock-board-id' } });
      responseText = "ソファを検索し、現在のボードに追加してからそのボードを開きました。";
    }
    else if (isClearSimilar && !isResetAll) {
      pendingActions.push({ id: generateActionId(), type: 'clearSimilarTo', payload: {} });
      responseText = "類似検索を解除し、通常の一覧に戻しました。";
    } else if (isResetAll) {
      pendingActions.push({ id: generateActionId(), type: 'resetFilters', payload: {} });
      responseText = "検索条件をリセットし、通常の一覧に戻しました。";
    } else if (isSimilarRequest) {
      hasSimilar = true;
      const { currentSelectedModel } = get();
      if (!currentSelectedModel) {
        responseText = "類似検索の基準となるモデルが見つかりません。先にメインエリアから基準にしたいモデルを選択してください。";
      } else {
        const referenceId = currentSelectedModel.id || currentSelectedModel.entityId;
        const referenceName = currentSelectedModel.title || currentSelectedModel.name || '選択中モデル';
        pendingActions.push({
          id: generateActionId(),
          type: 'applyFilters',
          payload: { similarTo: referenceId }
        });
        responseText = `「${referenceName}」を基準に類似モデルを検索しました。メインエリアを確認してください。`;
      }
    } else {
      const extractedColors = normalizeColors([content.replace(/\s+/g, '')]);
      hasColor = extractedColors.length > 0;
      hasPrice = lowerContent.includes('30000') || lowerContent.includes('3万') || lowerContent.includes('30,000');
      hasCategory = lowerContent.includes('家具') || lowerContent.includes('ソファ');

      if (hasColor || hasPrice || hasCategory) {
        let filtersToUpdate = { similarTo: null };
        if (hasCategory) filtersToUpdate.mainCategory = '家具';
        if (hasColor) filtersToUpdate.colors = extractedColors;
        if (hasPrice) filtersToUpdate.maxPrice = 30000;

        pendingActions.push({
          id: generateActionId(),
          type: 'applyFilters',
          payload: filtersToUpdate
        });
        
        let actionDesc = [];
        if (hasColor) actionDesc.push(`色「${extractedColors.join(', ')}」`);
        if (hasCategory) actionDesc.push('カテゴリ「家具」');
        if (hasPrice) actionDesc.push('価格「〜30000円」');
        responseText = `${actionDesc.join('、')}を表示するように条件を更新しました。メインエリアを確認してください。`;
      }
    }

    const steps = pendingActions.length > 0 ? MOCK_THINKING_STEPS : ["意図を解析中..."];
    for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        set({ thinkingStatus: steps[i] });
    }

    if (pendingActions.some(a => a.type === 'resetFilters' || a.type === 'clearSimilarTo')) {
      set({ awaitingResultFeedback: false, lastActionContext: null });
    }

    const aiMsg = { 
      id: (Date.now() + 1).toString(), 
      role: "assistant", 
      content: responseText, 
      timestamp: Date.now(),
      actions: pendingActions.length > 0 ? pendingActions : null,
      context: pendingActions.length > 0 ? { projectId: currentProjectId, boardId: currentBoardId, userQuery: content } : { userQuery: content }
    };
    
    set((state) => ({
      threads: state.threads.map(t => 
        t.id === activeThreadId 
          ? { 
              ...t, 
              messages: [...t.messages, aiMsg], 
              context: { 
                ...t.context, 
                filters: pendingActions.find(a => a.type === 'applyFilters')?.payload || t.context.filters,
                userQuery: content 
              } 
            }
          : t
      ),
      isThinking: false,
      thinkingStatus: "",
      awaitingResultFeedback: pendingActions.length > 0,
      lastActionContext: pendingActions.length > 0 ? { hasColor, hasPrice, hasCategory } : null
    }));
  },
  
  reportSearchResult: (count, hasError = false) => {
    // 割愛(Same as existing implementation based on context provided before)
    const { awaitingResultFeedback, activeThreadId, lastActionContext } = get();
    if (!awaitingResultFeedback) return;
    if (count > 0) {
      set({ awaitingResultFeedback: false, lastActionContext: null });
      return;
    }

    if (hasError && lastActionContext?.hasSimilar) {
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
    
    if (actions.length > 0) {
       actions.push({ id: `reset-all`, label: "条件をすべてクリア", type: "RESET_FILTERS" });
    } else {
       actions.push({ id: `reset-all-fallback`, label: "フィルタをリセット", type: "RESET_FILTERS" });
    }

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
      pendingPayload = { colors: [] };
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
      lastActionContext: nextContext
    }));
  },

  resetAllSearchState: () => {
    const { applyAssistantAction } = get();
    applyAssistantAction({ type: 'SET_FILTERS', payload: {} });
    applyAssistantAction({ type: 'SET_SEARCH_QUERY', payload: "" });
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

useAssistantStore.setState((state) => ({
  activeThreadId: state.threads[0].id
}));
