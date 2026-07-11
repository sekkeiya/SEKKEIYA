import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppStore } from './useAppStore';

/**
 * AI モデル設定（Global Settings > AI）。
 * 「どの用途にどのモデルを使うか」を用途（タスク）ごとに保存する。
 *   - taskModels: テキスト生成系の用途 → モデル の割り当て（チャット / S.Blog / 整文 / 要約 …）
 *   - imageProvider: 画像生成のプロバイダ
 * チャット下部のモデル切替は「そのセッションの一時的な上書き」、ここは「起動時の既定値」。
 *
 * ⚠️ サーバー対応状況（別リポの Cloud Functions）:
 *   現状 model パラメータを honor するのは agentTurn（chat）と requestAiRender（image）のみ。
 *   blog / polish / summarize は各 function が model を受け取る改修が入るまで、
 *   設定は保存・送信されるがサーバー側の固定モデルで動作する（クライアント配線は先行実装）。
 */

export interface ChatModelOption {
  value: string;
  label: string;
}

/** テキスト生成に使えるモデルの選択肢（AIChatPanel のセレクタと同一の値域）。 */
export const CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet ✦ 推奨' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku · 高速/低コスト' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · 無料枠' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Free)' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'gpt-4o', label: 'GPT-4o' },
];

export interface Localized { ja: string; en: string }

export interface AiTaskDef {
  /** 用途ID（保存キー・call site の getTaskModel 引数）。 */
  id: string;
  label: Localized;
  description: Localized;
  /** この用途の既定モデル（CHAT_MODEL_OPTIONS の value）。 */
  defaultModel: string;
  /** サーバー側 function が model パラメータを honor するか（UIに「配線待ち」を出すため）。 */
  serverHonorsModel: boolean;
}

/**
 * テキスト生成系の用途カタログ。
 * 追加時: ここに1件足し、対応する呼び出し側で getTaskModel(id) を model として送る。
 */
export const AI_TASKS: AiTaskDef[] = [
  {
    id: 'chat',
    label: { ja: 'SEKKEIYA OS（対話・ツール実行）', en: 'SEKKEIYA OS (conversation & tools)' },
    description: {
      ja: '設計フローの司令塔。対話・提案・ツール選択に使う基本モデル。チャット下部の切替はここを一時的に上書きします。',
      en: 'The orchestrator for the design flow. Base model for conversation, suggestions and tool calls. The in-chat selector temporarily overrides this.',
    },
    defaultModel: 'claude-sonnet-4-6',
    serverHonorsModel: true,
  },
  {
    id: 'blog',
    label: { ja: 'S.Blog 議論・執筆', en: 'S.Blog dialogue & writing' },
    description: {
      ja: 'S.Blog のインタビュアーとの議論、記事への反映（synthesize）に使うモデル。',
      en: 'Model for the S.Blog interviewer dialogue and synthesizing the discussion into the article.',
    },
    defaultModel: 'claude-sonnet-4-6',
    serverHonorsModel: false,
  },
  {
    id: 'polish',
    label: { ja: '整文・清書（Alt+Shift+S）', en: 'Text polish (Alt+Shift+S)' },
    description: {
      ja: '入力欄テキストの清書に使うモデル。短文・低レイテンシ重視。',
      en: 'Model for polishing text in input fields. Optimized for short text and low latency.',
    },
    defaultModel: 'claude-haiku-4-5-20251001',
    serverHonorsModel: false,
  },
  {
    id: 'summarize',
    label: { ja: 'S.Library 要約・知識化', en: 'S.Library summarize' },
    description: {
      ja: '本・PDF・URL・メモの要約とタグ/カテゴリ提案に使うモデル。',
      en: 'Model for summarizing books, PDFs, URLs and notes, and suggesting tags/categories.',
    },
    defaultModel: 'claude-haiku-4-5-20251001',
    serverHonorsModel: false,
  },
];

/** 用途IDの既定モデル。未知IDは推奨モデルにフォールバック。 */
function defaultModelFor(taskId: string): string {
  return AI_TASKS.find(t => t.id === taskId)?.defaultModel ?? 'claude-sonnet-4-6';
}

export interface ImageProviderOption {
  value: string;
  label: string;
  description: string;
  /** サーバー側（requestAiRender のプロバイダ＋APIキー）が準備できているか。 */
  available: boolean;
  /** 画像→画像編集（inputImageUrl を尊重する）に対応するか。false は text→image 専用。 */
  edit?: boolean;
}

/**
 * 画像生成モデル（requestAiRender の provider）。
 * 追加時はサーバー側 airender/providers・pricing.js への登録とAPIキー設定が必要。
 */
export const IMAGE_PROVIDER_OPTIONS: ImageProviderOption[] = [
  { value: 'nanobanana', label: 'Gemini（標準）', description: '高品質・約1分/枚・画像編集対応', available: true, edit: true },
  { value: 'flux-schnell', label: 'FLUX schnell', description: '高速（数秒/枚）· 生成専用（編集不可）', available: true, edit: false },
  { value: 'flux-lora', label: '内観LoRA（公式）', description: 'SEKKEIYA公式・内観パース特化 · 約10秒/枚 · 生成専用（編集不可）', available: true, edit: false },
  { value: 'flux-lora-local', label: '内観LoRA（ローカル・無料）', description: 'あなたのGPUで生成（クラウド課金ゼロ）· 要ComfyUI起動 · 生成専用（編集不可）', available: true, edit: false },
];

/** 画像→画像編集に対応する provider か（false は text→image 専用で編集に使うと入力画像を無視する）。 */
export const isEditCapableProvider = (value: string): boolean =>
  IMAGE_PROVIDER_OPTIONS.find((o) => o.value === value)?.edit === true;

/** 編集で使う既定 provider（編集対応の先頭。通常は nanobanana）。 */
export const DEFAULT_EDIT_PROVIDER =
  IMAGE_PROVIDER_OPTIONS.find((o) => o.available && o.edit)?.value || 'nanobanana';

interface AiSettingsState {
  /** 用途（タスク）→ モデル の割り当て。未設定の用途は defaultModelFor() が既定を返す。 */
  taskModels: Record<string, string>;
  /** 画像生成に使うプロバイダ（research_board_generate_image / AI Render）。 */
  imageProvider: string;
  setTaskModel: (taskId: string, model: string) => void;
  setImageProvider: (provider: string) => void;
}

/** 初期 taskModels（各用途の既定モデル）。 */
function initialTaskModels(): Record<string, string> {
  return Object.fromEntries(AI_TASKS.map(t => [t.id, t.defaultModel]));
}

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set, get) => ({
      taskModels: initialTaskModels(),
      imageProvider: 'flux-schnell', // 既定は高速・低コストの FLUX schnell（高品質重視なら AI設定で Gemini へ）
      setTaskModel: (taskId, model) => {
        set({ taskModels: { ...get().taskModels, [taskId]: model } });
        // チャット用途の変更は現在のチャットにも即時反映する
        if (taskId === 'chat') {
          useAppStore.getState().setSelectedLlmModel(model);
        }
      },
      setImageProvider: (provider) => {
        // 未準備プロバイダはフォールバック（UI側でも disabled にしている二重ガード）
        const opt = IMAGE_PROVIDER_OPTIONS.find(o => o.value === provider);
        set({ imageProvider: opt?.available ? provider : 'nanobanana' });
      },
    }),
    {
      name: 'sekkeiya-ai-settings',
      version: 1,
      // v0（単一 defaultChatModel）→ v1（taskModels マップ）への移行。
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version < 1) {
          const legacyChat = persisted.defaultChatModel;
          persisted.taskModels = {
            ...initialTaskModels(),
            ...(legacyChat ? { chat: legacyChat } : {}),
          };
          delete persisted.defaultChatModel;
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 欠けている用途があれば既定で埋める（用途追加時の前方互換）。
        state.taskModels = { ...initialTaskModels(), ...(state.taskModels ?? {}) };
        // 起動時: 保存済みのチャットモデルをチャットの選択モデルへ適用する
        useAppStore.getState().setSelectedLlmModel(state.taskModels.chat);
      },
    },
  ),
);

/** 用途に割り当てられたモデルを同期的に読む（call site 用ヘルパー）。 */
export function getTaskModel(taskId: string): string {
  const m = useAiSettingsStore.getState().taskModels[taskId];
  return m || defaultModelFor(taskId);
}

/** 画像生成 verb などから同期的に読むためのヘルパー（利用可能なプロバイダのみ返す）。 */
export function getActiveImageProvider(): string {
  const p = useAiSettingsStore.getState().imageProvider;
  const opt = IMAGE_PROVIDER_OPTIONS.find(o => o.value === p);
  return opt?.available ? p : 'nanobanana';
}
