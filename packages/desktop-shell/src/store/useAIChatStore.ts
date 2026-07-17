import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrchestratorSource } from './useCoreOrchestrator';

// AI メッセージに付随するクリック可能な構造化UI（Claude Code 風の選択肢など）。
// 既存のプレーンテキスト描画はそのまま、`ui` がある時だけ追加描画する（加算的拡張）。
export type ChatUi =
  | {
      kind: 'choices';
      toolUseId: string;            // 対応する propose_choices の tool_use id（再開キー）
      prompt: string;
      multiSelect?: boolean;
      choices: { id: string; label: string; description?: string }[];
      /**
       * 特別な決定論ハンドラへ委譲する分岐。未指定＝通常の propose_choices（LLM 再開）。
       * 'furniture_source' = 家具ソース選択（S.Model 自動/手動）を LLM でなくオーケストレーターで直接処理。
       * 'board_type' = 「ボード」種別（Research & Memo / S.Slide）の確認を LLM に投げず
       *               クライアントで決定論的に処理（曖昧なまま推測させない原則）。
       */
      intent?: 'furniture_source' | 'board_type';
      /** intent ハンドラに渡す文脈（projectId/planId 等）。 */
      context?: Record<string, any>;
      resolved?: { ids: string[]; text?: string }; // 選択済み（text = 「その他」自由入力）
    }
  | {
      kind: 'image_picker';
      toolUseId: string;            // 対応する open_image_picker の tool_use id
      purpose: string;
      max: number;
      resolved?: { count: number };
    }
  | {
      kind: 'batch_started';
      batchId: string;
      total: number;
      skipped: number;
    }
  | {
      kind: 'furniture_picker';
      toolUseId: string;
      candidateCount: number;
      resolved?: { count: number };
    }
  | {
      kind: 'material_source_picker';
      toolUseId: string;
      currentProjectId?: string;
      resolved?: { created: number; skipped: number };
    }
  | {
      kind: 'material_gen_done';
      created: number;
      skipped: number;
      totalGroups: number;
    }
  | {
      /** 家具/商品検索の結果を共有グリッドでチャット内に表示する（非対話・閲覧/購入リンク）。
       *  実データ（items）は useChatProductResultsStore に保持し、ここは参照IDのみ（永続肥大化回避）。 */
      kind: 'product_results';
      resultId: string;
      query: string;
      count: number;
    }
  | {
      /** ツール実行後に表示する結果ナビゲーションカード（非対話・常時表示）。 */
      kind: 'navigate_result';
      summary: string;   // 「予定を3件・タスクを2件追加しました」等
      items: Array<{
        label:     string;                // ボタンラベル
        action:    'open_schedule_tab' | 'open_task_tab' | 'open_project';
        projectId?: string;
      }>;
    }
  | {
      /** S.Layout のレンダー結果を画像グリッドでチャット内に表示する（非対話・閲覧）。 */
      kind: 'render_results';
      planId: string;
      renders: { id: string; url: string }[];
    };

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'ai';
  text: string;
  source?: OrchestratorSource;
  timestamp: number;
  /** 任意: AIが提示するクリック可能UI（選択肢・画像ピッカー・バッチ開始カード）。 */
  ui?: ChatUi;
  /** 任意: RAGで根拠に使った接続ナレッジの出典（資料名）。 */
  citations?: { id: string; title: string }[];
}

// Chat スコープ階層（docs/12_sdiagram_manim_operation.md §2）:
//   アカウントサイト > プロジェクト > 子アプリ > タスク
// ('global' は旧称。現在はトップ＝ユーザーのアカウントサイト('account')。後方互換で残す)
export type ChatScope = 'account' | 'global' | 'project' | 'subapp' | 'task';

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  // ── スコープ拡張（任意・後方互換。未指定なら従来＝project スコープ扱い）──
  scope?: ChatScope;
  appScope?: string;   // '3dsd' 等。subapp/task スコープで使用
  taskId?: string;     // = diagramId。task スコープで使用
  taskTitle?: string;  // ダイアグラム名（ツリー表示用キャッシュ）
}

/** スコープ指定の絞り込み条件。 */
export interface ChatScopeQuery {
  projectId?: string;
  appScope?: string;
  taskId?: string;
}

interface AIChatStoreState {
  sessions: ChatSession[];
  messages: ChatMessage[];
  activeSessionId: string | null;
  /** この永続データの所有ユーザー uid（アカウント切替時のクリア判定用）。 */
  ownerUid: string | null;
  /** ログインユーザーが変わったら履歴をクリアする（前アカウントのチャット漏洩防止）。 */
  ensureOwner: (uid: string | null) => void;

  createSession: (projectId: string, initialTitle?: string) => string;
  /** スコープ付きセッションを作成（全体/プロジェクト/子アプリ/タスク）。
   *  activate: false でグローバルのアクティブセッションを変えずに作成する
   *  （子アプリ埋め込みチャットが右ドックの表示中セッションを奪わないため）。 */
  createScopedSession: (
    scope: ChatScope,
    opts: { projectId?: string; appScope?: string; taskId?: string; taskTitle?: string; title?: string; activate?: boolean }
  ) => string;
  setActiveSession: (sessionId: string | null) => void;
  deleteSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  /** toolUseId に一致するメッセージの ui を部分更新（クリック後の resolved 刻印など）。 */
  resolveMessageUi: (toolUseId: string, patch: Partial<ChatUi>) => void;
  getMessagesForSession: (sessionId: string) => ChatMessage[];
  getSessionsForProject: (projectId: string) => ChatSession[];
  /** スコープ条件に一致するセッションを新しい順で返す。 */
  getSessionsForScope: (q: ChatScopeQuery) => ChatSession[];
  /** タスク（= diagram）の Chat を取得、無ければ作成（Editor 起点で使用）。
   *  opts.activate: false でグローバルのアクティブセッションを変更しない。 */
  getOrCreateTaskSession: (projectId: string, appScope: string, taskId: string, taskTitle?: string, opts?: { activate?: boolean }) => string;
  /** 指定メッセージ以降（そのメッセージ含む）をセッションから削除する。 */
  rewindToMessage: (sessionId: string, messageId: string) => void;
}

export const useAIChatStore = create<AIChatStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      messages: [],
      activeSessionId: null,
      ownerUid: null,

      ensureOwner: (uid) => {
        if (get().ownerUid === uid) return;
        // 所有者が一致しない（ログアウト/別アカウント/所有者不明の旧データ）→ 履歴を全クリア。
        // 旧データは所有者を検証できないため、漏洩防止を優先してクリアする。
        set({ ownerUid: uid, sessions: [], messages: [], activeSessionId: null });
      },

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
              scope: 'project',
            },
          ],
          activeSessionId: newSessionId,
        }));
        return newSessionId;
      },

      createScopedSession: (scope, opts) => {
        const newSessionId = crypto.randomUUID();
        const now = Date.now();
        const defaultTitle =
          scope === 'account' ? 'マイページ チャット'
          : scope === 'global' ? '全体チャット'
          : scope === 'task' ? (opts.taskTitle || '新規タスク')
          : scope === 'subapp' ? `${opts.appScope ?? ''} チャット`
          : '新規チャット';
        set((state) => ({
          sessions: [
            ...state.sessions,
            {
              id: newSessionId,
              projectId: opts.projectId ?? '__global__',
              title: opts.title ?? defaultTitle,
              createdAt: now,
              updatedAt: now,
              scope,
              appScope: opts.appScope,
              taskId: opts.taskId,
              taskTitle: opts.taskTitle,
            },
          ],
          activeSessionId: opts.activate === false ? state.activeSessionId : newSessionId,
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

      resolveMessageUi: (toolUseId, patch) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.ui && (m.ui as any).toolUseId === toolUseId
              ? ({ ...m, ui: { ...m.ui, ...patch } as ChatUi })
              : m
          ),
        }));
      },

      getMessagesForSession: (sessionId) => {
        return get().messages.filter((m) => m.sessionId === sessionId);
      },

      getSessionsForProject: (projectId) => {
        return get()
          .sessions.filter((s) => s.projectId === projectId)
          .sort((a, b) => b.updatedAt - a.updatedAt); // Newest first
      },

      getSessionsForScope: (q) => {
        return get()
          .sessions.filter((s) => {
            if (q.projectId !== undefined && s.projectId !== q.projectId) return false;
            if (q.appScope !== undefined && s.appScope !== q.appScope) return false;
            if (q.taskId !== undefined && s.taskId !== q.taskId) return false;
            return true;
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },

      getOrCreateTaskSession: (projectId, appScope, taskId, taskTitle, opts) => {
        const existing = get().sessions.find(
          (s) => s.projectId === projectId && s.appScope === appScope && s.taskId === taskId
        );
        if (existing) {
          // タイトルキャッシュを最新化
          if (taskTitle && existing.taskTitle !== taskTitle) {
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === existing.id ? { ...s, taskTitle, title: taskTitle } : s
              ),
            }));
          }
          if (opts?.activate !== false) set({ activeSessionId: existing.id });
          return existing.id;
        }
        return get().createScopedSession('task', { projectId, appScope, taskId, taskTitle, activate: opts?.activate });
      },

      rewindToMessage: (sessionId, messageId) => {
        set((state) => {
          const sessionMsgs = state.messages
            .filter((m) => m.sessionId === sessionId)
            .sort((a, b) => a.timestamp - b.timestamp);
          const idx = sessionMsgs.findIndex((m) => m.id === messageId);
          if (idx < 0) return state;
          const removeIds = new Set(sessionMsgs.slice(idx).map((m) => m.id));
          return { messages: state.messages.filter((m) => !removeIds.has(m.id)) };
        });
      },
    }),
    {
      name: 'sekkeiya-ai-chat-storage',
    }
  )
);
