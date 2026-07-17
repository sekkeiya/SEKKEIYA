// SEKKEIYA Chat コアオーケストレーター。
// Phase B: クライアント主導ループランナー。
//   1. agentTurn(callable) を呼び、assistantMessage + toolCalls を受け取る。
//   2. 各 toolCall をクライアントで実行（useActionRegistry → useProjectSiteStore / fs）。
//   3. tool_result を積み、stop_reason = "end_turn" まで反復（STEP_CAP で上限）。
// 仕様: sekkeiya-desktop/docs/10_sekkeiya_chat_spec.md §7.0

import { create } from 'zustand';
import { useAiProfileStore } from './useAiProfileStore';
import { useAppStore } from './useAppStore';
import { useAIChatStore } from './useAIChatStore';
import { buildSiteSnapshot, formatSiteSnapshotForPrompt } from '../features/sites/siteSnapshot';
import { buildBlogSnapshot, formatBlogSnapshotForPrompt } from '../features/dsb/lib/blogSnapshot';
import { listLocalAssets, readLocalAssetText } from '../features/sites/localAssetsSnapshot';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase/client';
import type { DiagramTemplate } from '../features/dsd/manim/diagramSpecBridge';

export type OrchestratorSource =
  | 'dashboard_chat'
  | 'sidebar_chat'
  | 'ai_3d_create'
  | 'ai_render'
  | 'canvas'
  | 'task_auto_execute';

export type OrchestratorIntent = 'CREATE_PROJECT' | 'TRIGGER_CANVAS' | 'RESPOND_CHAT';

export interface OrchestratorResponse {
  intent: OrchestratorIntent;
  actionType: string;
  assistantMessage: string;
  payload?: any;
  requiresConfirmation?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  /** Phase B: ステップごとの進捗テキスト（ツール実行ログ）。 */
  steps?: string[];
}

// 添付画像（Claude マルチモーダル）。base64 データと media_type を保持。
export interface OrchestratorImage { mediaType: string; data: string; }

// 添付ファイルのテキスト内容（テキスト系ファイルの中身）。可視メッセージには出さず、
// 追加のテキストブロックとして AI に渡す（images と同じ扱い）。
export interface OrchestratorDoc { name: string; text: string; }

// agentTurn の 1 往復で使うメッセージ型（バックエンドとの中立フォーマット）。
// content は文字列、または Anthropic 形式の content ブロック配列（テキスト＋画像）。
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string | ContentBlock[];  // user（画像添付時は配列）
  text?: string;             // assistant
  toolCalls?: { id: string; name: string; input: any }[];  // assistant
  results?: { tool_use_id: string; content: string; is_error?: boolean }[];  // tool
}

/** ツール実行名 → 日本語進捗ラベル。 */
const TOOL_LABEL: Record<string, string> = {
  site_snapshot: 'サイト構成を確認しています…',
  gallery_query: 'アセットを検索しています…',
  local_assets_list: 'ローカル素材を確認しています…',
  local_assets_read: 'ローカル資料を読み込んでいます…',
  create_site_from_template: 'サイトの骨格を作成しています…',
  add_section: 'セクションを追加しています…',
  update_section: '本文・タイトルを更新しています…',
  remove_section: 'セクションを削除しています…',
  reorder_sections: 'セクションの並び順を変更しています…',
  add_asset_to_section: 'アセットを紐付けています…',
  set_theme: 'テーマを設定しています…',
  set_motion: 'スクロールの動きを設定しています…',
  subapp_guide: '欠落アセットの補完先を確認しています…',
  // S.Diagram (3dsd) ツール（docs/12 §4）
  dsd_create_diagram: '新しいダイアグラムを作成しています…',
  dsd_patch_spec: 'ダイアグラムを生成・更新しています…',
  dsd_render_manim: 'Manimで動画をレンダリングしています…',
  // S.Movie (3dsm) ツール（docs/14 §6）
  movie_sequence_snapshot: 'シーケンス構成を確認しています…',
  movie_add_cut: 'カットを追加しています…',
  movie_reorder_cuts: 'カットを並び替えています…',
  movie_set_transition: 'トランジションを設定しています…',
  movie_set_bgm: 'BGMを設定しています…',
  movie_add_title: 'テロップを追加しています…',
  movie_export: '動画を書き出しています…',
  // 3D一括生成フロー
  start_3d_generation: '3Dモデルの一括生成を開始しています…',
  // 家具選定フロー
  furniture_catalog_search: '家具カタログを検索しています…',
  add_furniture_to_project: '選定した家具をプロジェクトに追加しています…',
  // 自動レイアウトフロー
  layout_list: 'レイアウト一覧を取得しています…',
  layout_get: 'レイアウトの詳細を確認しています…',
  get_layout_outputs: 'レイアウトの成果物を確認しています…',
  layout_create: '新規レイアウトを作成しています…',
  render_layout: 'レイアウトをレンダリングしています…',
  run_auto_layout: 'ルールベースで家具を自動配置しています…',
  // Google Calendar コネクタ
  gcal_list_events:    'Google Calendar のイベントを取得しています…',
  gcal_create_event:   'Google Calendar にイベントを追加しています…',
  gcal_update_event:   'Google Calendar のイベントを更新しています…',
  gcal_delete_event:   'Google Calendar からイベントを削除しています…',
  gcal_list_calendars: 'Google Calendar の一覧を確認しています…',
  // S.Library（知識ライブラリ）連携
  library_list:      'S.Library の知識を確認しています…',
  library_add_url:   '電子カタログを S.Library に登録しています…',
  library_add_pdf:   'カタログPDFをダウンロードしています…',
  web_list_links:    'ページのリンク（カタログ/PDF）を取得しています…',
  catalog_product_search: '索引済み商品を検索しています…',
  library_save_note: '調べた内容を S.Library に保存しています…',
  create_blog_draft: '記事の下書きを作成しています…',
  search_knowledge: '外付け脳（RAG）を検索しています…',
  // スケジュール・タスク管理
  schedule_list:   '予定一覧を確認しています…',
  schedule_create: '予定を追加しています…',
  schedule_update: '予定を更新しています…',
  schedule_delete: '予定を削除しています…',
  task_list:       'タスク一覧を確認しています…',
  task_create:     'タスクを追加しています…',
  task_update:     'タスクを更新しています…',
  task_delete:     'タスクを削除しています…',
};

// 「UIを出してユーザー操作を待つ」ツール。これらはループを中断し、クリックで再開する。
const YIELD_TOOLS = new Set(['propose_choices', 'open_image_picker', 'open_furniture_picker', 'open_material_source_picker']);

/** タスク割り当て通知を担当者の notifications に書き込む（task_create / task_update から呼ぶ）。 */
async function notifyTaskAssigned(params: {
  assigneeUid: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  fromUid: string;
}): Promise<void> {
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  const { db } = await import('../lib/firebase/client');
  const appStore = useAppStore.getState();
  const projectName = appStore.projects.find((p: any) => p.id === params.projectId)?.name ?? '';
  const { useAuthStore } = await import('./useAuthStore');
  const fromName = useAuthStore.getState().currentUser?.displayName ?? '';
  await addDoc(collection(db, 'users', params.assigneeUid, 'notifications'), {
    type: 'task_assigned',
    projectId: params.projectId,
    projectName,
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    fromUid: params.fromUid,
    fromName,
    read: false,
    createdAt: serverTimestamp(),
  });
}

const STEP_CAP = 8; // 1 ターンあたりの最大 LLM 往復回数

/** ループ1回分の実行コンテキスト（初回・再開で共通）。 */
interface RunCtx {
  sessionId: string | null;
  history: AgentMessage[];
  systemPromptWithSite: string;
  /**
   * サーバー agentTurn の固定 SYSTEM_PROMPT に後置するクライアント文脈
   * （日付・編集対象スナップショット・文脈プレイブック・RAG抜粋等）。
   * ⚠️これを送らないとプレイブックは一切モデルに届かない（systemPromptWithSite は
   * legacy 経路用で、agentTurn には渡っていない）。
   */
  clientContext: string;
  /** AIメモリー（プロジェクトスコープ）注入用。サーバーが memorySection を構築する。 */
  projectId?: string | null;
  model: string;
  step: number;
  source?: OrchestratorSource;
  steps: string[];
  /** RAGで根拠に使った接続ナレッジの出典（最終AIメッセージに添付）。 */
  citations?: { id: string; title: string }[];
  /**
   * 💰 前置き削減: サーバーagentTurnで除外するツールsilo（例 'research'）。
   * その作業をしていない時は関連ツールを送らずキャッシュ前置きを小さくする。
   * 判定はクライアント（isResearchBoardContext等・キーワード検出込み）で行うので誤爆しにくい。
   */
  excludeSilos?: string[];
  /**
   * サーバーの自動silo判定（キーワード検出）でも絶対に外させないsilo（例 'layout'）。
   * 子アプリスコープのチャットでは、会話にドメイン語が出ていなくても
   * そのアプリのツールが必要なため、サーバー側のマージ後に keepSilos 分を復元させる。
   */
  keepSilos?: string[];
}

/** UI-yield ツールで中断したループの再開スナップショット。 */
interface PendingTurn extends RunCtx {
  pendingToolUseId: string;
  partialResults: NonNullable<AgentMessage['results']>;
}

interface CoreOrchestratorState {
  isProcessing: boolean;
  /** 現在実行中のツール名（進捗表示用）。 */
  currentToolLabel: string | null;
  /** 同一 LLM ターンで複数ツールが連続する場合の進捗（null = 単発 or 非実行中）。 */
  toolProgress: { current: number; total: number } | null;
  /** UI-yield ツールでループ中断中のスナップショット（null = 非中断）。 */
  pending: PendingTurn | null;
  sendMessageToOrchestrator: (text: string, options?: { source?: OrchestratorSource; sessionId?: string; images?: OrchestratorImage[]; docs?: OrchestratorDoc[]; hidden?: boolean }) => Promise<OrchestratorResponse>;
  /** 中断中ループを tool_result で再開する。pending が無ければ false（リロード等でロスト）。 */
  resumeWithToolResult: (toolUseId: string, content: string) => Promise<boolean>;
  /** propose_choices の選択を返して再開する（resumeWithToolResult のラッパ）。戻り値=再開できたか。 */
  resumeWithChoice: (toolUseId: string, ids: string[]) => Promise<boolean>;
  /**
   * 家具ソース分岐（intent:'furniture_source'）を LLM を介さず決定論的に処理する。
   * 'auto_models' = S.Model から自動選定して再配置、'manual_models' = S.Model ピッカーを開く。
   * 堂々巡り（noFurniture → 同じ選択肢）を断つための専用ハンドラ。
   */
  resolveFurnitureSourceChoice: (id: string, context: Record<string, any>) => Promise<void>;
  /** 実行中のターンを中断する（UIの「停止」ボタン）。 */
  stopProcessing: () => void;
  /** 中断検出用の世代カウンタ（内部）。stopProcessing で +1 され、進行中ループは不一致を検知して打ち切る。 */
  _cancelId: number;
}

// AI が yield ツールを呼んだ時のチャットUIメッセージ生成＋ピッカー起動。
/**
 * 「ボード」とだけ言われて種別（Research & Memo か S.Slide か）が文脈から
 * 一意に決まらない要求か。true のときは推測で進めず、クライアントで種別選択を出す。
 */
function isAmbiguousBoardRequest(text: string): boolean {
  const isResearchExplicit = useAppStore.getState().activeProjectTab === 'memo'
    || /リサーチボード|リサーチキャンバス|Research\s*&?\s*Memo|メモボード|論証グラフ|ボードに(置|貼|まとめ|整理|追加)|research.?board/i.test(text);
  const mentionsPresentation = /プレゼン|提案書|提案資料|スライド|presentation|deck/i.test(text);
  return !isResearchExplicit && !mentionsPresentation
    && /ボード[をに]?.{0,6}(作|つく|追加|ほし|欲し)/.test(text);
}

function handleYield(
  sessionId: string | null,
  assistantText: string | undefined,
  yieldTc: { id: string; name: string; input: any },
): void {
  if (!sessionId) return;
  const aiChatStore = useAIChatStore.getState();
  if (yieldTc.name === 'propose_choices') {
    const choices = Array.isArray(yieldTc.input?.choices) ? yieldTc.input.choices : [];
    const prompt  = yieldTc.input?.prompt || '';
    aiChatStore.addMessage({
      sessionId, role: 'ai', source: 'sidebar_chat',
      text: assistantText || '',
      ui: {
        kind: 'choices',
        toolUseId: yieldTc.id,
        prompt,
        multiSelect: !!yieldTc.input?.multiSelect,
        choices,
      },
    });
    // チャット画面とは別に、デスクトップ通知でも選択肢を提示する（fire-and-forget）。
    import('./useAiTaskNotifier').then(({ notifyChoices }) => {
      notifyChoices(yieldTc.id, prompt, choices);
    }).catch(() => {});
  } else if (yieldTc.name === 'open_image_picker') {
    const max = yieldTc.input?.max ?? 100;
    const purpose = yieldTc.input?.purpose || '3d';
    aiChatStore.addMessage({
      sessionId, role: 'ai', source: 'sidebar_chat',
      text: assistantText || '',
      ui: { kind: 'image_picker', toolUseId: yieldTc.id, purpose, max },
    });
    import('./useImagePickerStore').then(({ useImagePickerStore }) => {
      useImagePickerStore.getState().openPicker({ toolUseId: yieldTc.id, purpose, max });
    });
  } else if (yieldTc.name === 'open_material_source_picker') {
    const currentProjectId = useAppStore.getState().getActiveProject()?.id ?? undefined;
    aiChatStore.addMessage({
      sessionId, role: 'ai', source: 'sidebar_chat',
      text: assistantText || '',
      ui: { kind: 'material_source_picker', toolUseId: yieldTc.id, currentProjectId },
    });
  } else if (yieldTc.name === 'open_furniture_picker') {
    const candidateIds: string[] = Array.isArray(yieldTc.input?.candidateIds) ? yieldTc.input.candidateIds : [];
    aiChatStore.addMessage({
      sessionId, role: 'ai', source: 'sidebar_chat',
      text: assistantText || '',
      ui: { kind: 'furniture_picker', toolUseId: yieldTc.id, candidateCount: candidateIds.length },
    });
    // ピッカーストアを起動し、S.Model へ遷移する。
    import('./useFurniturePickerStore').then(({ useFurniturePickerStore }) => {
      useFurniturePickerStore.getState().open({ toolUseId: yieldTc.id, candidateIds });
    });
    const activeProject = useAppStore.getState().getActiveProject();
    if (activeProject) {
      useAppStore.getState().setModelsScope('global_models');
      import('../features/launcher/launchWorkspace').then(({ launchWorkspace }) => {
        launchWorkspace({ appScope: '3dss', projectId: activeProject.id, workspaceId: 'models', workspaceName: 'S.Model' });
      });
    }
  }
}

export const useCoreOrchestrator = create<CoreOrchestratorState>((set, get) => {
  // ── 再開可能なループランナー本体 ──
  // 正常終了で OrchestratorResponse を、UI-yield ツールで中断した場合は null を返す。
  const runLoop = async (ctx: RunCtx): Promise<OrchestratorResponse | null> => {
    const aiChatStore = useAIChatStore.getState();
    const agentTurnFn = httpsCallable(functions, 'agentTurn');
    const { dispatch } = (await import('./useActionRegistry')).useActionRegistry.getState();

    const history = ctx.history;
    const steps = ctx.steps;
    let step = ctx.step;
    let finalText = '';
    // 作成されたスケジュール/タスクを追跡（ナビゲーションUI用）
    let createdSchedules = 0;
    let createdTasks     = 0;
    let createdProjectId: string | null = null;
    // バックグラウンド生成が開始された場合、ツール内でUIカードが追加済みなので
    // AIの finalText（"完了しました！"等）は別途表示しない
    let batchStartedThisTurn = false;

    // 中断検出：stopProcessing が _cancelId を進めたら、このループは結果を捨てて打ち切る。
    const myCancel = get()._cancelId;
    const aborted = () => get()._cancelId !== myCancel;

    while (step < STEP_CAP) {
      step++;
      if (aborted()) return null;

      const res = await agentTurnFn({
        messages: history,
        model: ctx.model,
        clientContext: ctx.clientContext || undefined,
        projectId: ctx.projectId || undefined,
        excludeSilos: (ctx.excludeSilos && ctx.excludeSilos.length) ? ctx.excludeSilos : undefined,
        keepSilos: (ctx.keepSilos && ctx.keepSilos.length) ? ctx.keepSilos : undefined,
      });
      if (aborted()) return null;
      const { stopReason, text: assistantText, toolCalls } = (res.data as any).result as {
        stopReason: string;
        text: string;
        toolCalls: { id: string; name: string; input: any }[];
        usage?: any;
      };

      // assistant メッセージを履歴に追加。
      history.push({ role: 'assistant', text: assistantText || undefined, toolCalls: toolCalls?.length ? toolCalls : undefined });

      if (assistantText) finalText = assistantText;

      // ツール呼び出しが無い or end_turn → ループ終了。
      if (!toolCalls?.length || stopReason === 'end_turn') break;

      // UI-yield ツール（propose_choices / open_image_picker）は最大1つだけ尊重。
      // 残りの通常ツールは先に実行して tool_result を確保してから中断する。
      const yieldTc = toolCalls.find(tc => YIELD_TOOLS.has(tc.name));
      const normalTcs = toolCalls.filter(tc => tc !== yieldTc);

      const toolResults: NonNullable<AgentMessage['results']> = [];
      const multiTool = normalTcs.length > 1;
      // 1ターンに登録できる schedule_create / task_create の上限（強制制御）
      const MAX_BATCH_CREATES = 5;
      const CREATE_TOOLS = new Set(['schedule_create', 'task_create']);
      let turnCreateCount = 0;
      let autoSkippedCount = 0;

      for (let tcIdx = 0; tcIdx < normalTcs.length; tcIdx++) {
        const tc = normalTcs[tcIdx];
        const isCreateTool = CREATE_TOOLS.has(tc.name);

        // バッチ上限超過: このターンはスキップして次ターンへ持ち越す
        if (isCreateTool && turnCreateCount >= MAX_BATCH_CREATES) {
          toolResults.push({
            tool_use_id: tc.id,
            content: JSON.stringify({ ok: false, skipped: true, reason: 'batch_limit_reached' }),
          });
          autoSkippedCount++;
          continue;
        }

        const label = TOOL_LABEL[tc.name] || `${tc.name} を実行しています…`;
        set({
          currentToolLabel: label,
          toolProgress: multiTool ? { current: tcIdx + 1, total: normalTcs.length } : null,
        });
        steps.push(label.replace('…', ''));

        let toolContent = '';
        let isError = false;
        try {
          const result = await dispatchAgentTool(tc.name, tc.input, dispatch, ctx.sessionId);
          toolContent = typeof result === 'string' ? result : JSON.stringify(result ?? 'ok');
          if (tc.name === 'start_3d_generation') batchStartedThisTurn = true;
        } catch (e: any) {
          isError = true;
          toolContent = e?.message || 'error';
          console.error(`[Orchestrator] tool ${tc.name} failed:`, e);
        }
        toolResults.push({ tool_use_id: tc.id, content: toolContent, ...(isError ? { is_error: true } : {}) });

        // スケジュール/タスク作成を追跡
        if (!isError) {
          try {
            const parsed = JSON.parse(toolContent);
            if (tc.name === 'schedule_create' && parsed.ok) {
              createdSchedules++;
              turnCreateCount++;
              if (!createdProjectId) createdProjectId = tc.input?.projectId ?? null;
            }
            if (tc.name === 'task_create' && parsed.ok) {
              createdTasks++;
              turnCreateCount++;
              if (!createdProjectId) createdProjectId = tc.input?.projectId ?? null;
            }
          } catch { /* ignore */ }
        }
      }

      // run_auto_layout が「配置できる家具なし」(noFurniture) を返したら、
      // LLM任せに選択肢を作らせず（カタログ生成/カタログ検索が混ざるのを防ぐ）、
      // 固定の選択肢「S.Modelから自動で選ぶ / S.Modelから手動で選ぶ」を提示してターンを終える。
      // 「その他（自由入力）」は ChatUiRenderer が末尾に自動付与するため choices には入れない。
      // 分岐は intent:'furniture_source' で orchestrator が決定論的に処理（LLM 非経由・堂々巡り防止）。
      const noFurnitureResult = yieldTc ? null : (() => {
        for (const r of toolResults) {
          try { const p = JSON.parse(r.content); if (p?.noFurniture === true) return p; } catch { /* not JSON */ }
        }
        return null;
      })();
      if (noFurnitureResult && ctx.sessionId) {
        aiChatStore.addMessage({
          sessionId: ctx.sessionId,
          role: 'ai',
          source: 'sidebar_chat',
          text: assistantText || 'このプロジェクトには配置できる家具がまだ登録されていません。家具の選び方を選んでください。',
          ui: {
            kind: 'choices',
            toolUseId: crypto.randomUUID(),
            prompt: '配置する家具をどう選びますか？',
            multiSelect: false,
            intent: 'furniture_source',
            context: {
              sessionId: ctx.sessionId,
              projectId: noFurnitureResult.projectId,
              planId: noFurnitureResult.planId,
              buildingType: noFurnitureResult.buildingType,
              roomWidthMm: noFurnitureResult.roomWidthMm,
              roomDepthMm: noFurnitureResult.roomDepthMm,
            },
            choices: [
              { id: 'auto_models', label: 'S.Modelから自動で選ぶ', description: 'S.Model に登録済みのモデルからAIが自動で選定して配置します' },
              { id: 'manual_models', label: 'S.Modelから手動で選ぶ', description: 'S.Model のモデル一覧から自分で選んで配置します' },
            ],
          },
        });
        set({ isProcessing: false, currentToolLabel: null, toolProgress: null, pending: null });
        return {
          intent: 'RESPOND_CHAT',
          actionType: 'NONE',
          assistantMessage: assistantText || '',
          payload: {},
          requiresConfirmation: false,
          riskLevel: 'low',
          steps,
        };
      }

      // creates が2件以上起きた場合は必ず propose_choices を挿入して中断する。
      // AIが "続けて登録します！" と言ってそのまま end_turn するケースを防ぐ。
      // 単発登録（1件）はそのまま完了させ、バッチ登録（2件以上）のみ中断して確認する。
      // スキップ有りの場合は残り件数を明示し、スキップ無し(≤5件完了)の場合も次の意思確認を求める。
      if (turnCreateCount >= 2 && !yieldTc) {
        const autoYieldId = crypto.randomUUID();
        let promptText: string;
        let choiceLabel: string;
        let summaryText: string;
        if (autoSkippedCount > 0) {
          promptText = `残り ${autoSkippedCount} 件の登録をどうしますか？`;
          choiceLabel = `続きを登録する（残り ${autoSkippedCount} 件）`;
          summaryText = `✅ 今回 ${turnCreateCount} 件登録しました。残り ${autoSkippedCount} 件があります。\n\n${assistantText || ''}`.trim();
        } else {
          promptText = '登録しました。続けて登録しますか？';
          choiceLabel = '続きを登録する';
          summaryText = `✅ ${turnCreateCount} 件登録しました。\n\n${assistantText || ''}`.trim();
        }
        handleYield(ctx.sessionId, summaryText, {
          id: autoYieldId,
          name: 'propose_choices',
          input: {
            prompt: promptText,
            multiSelect: false,
            choices: [
              { id: 'continue', label: choiceLabel, description: '次の最大5件を引き続き登録します' },
              { id: 'stop', label: '今回はここまでにする', description: '残りは後でいつでも依頼できます' },
            ],
          },
        });
        set({
          isProcessing: false,
          currentToolLabel: null,
          toolProgress: null,
          pending: {
            sessionId: ctx.sessionId,
            history,
            systemPromptWithSite: ctx.systemPromptWithSite,
            clientContext: ctx.clientContext,
            excludeSilos: ctx.excludeSilos,
            keepSilos: ctx.keepSilos,
            projectId: ctx.projectId,
            model: ctx.model,
            step,
            source: ctx.source,
            steps,
            pendingToolUseId: autoYieldId,
            partialResults: toolResults,
          },
        });
        return null; // paused
      }

      if (yieldTc) {
        // チャットに選択肢/ピッカーUIを出してループを中断（クリックで再開）。
        handleYield(ctx.sessionId, assistantText, yieldTc);
        set({
          isProcessing: false,
          currentToolLabel: null,
          toolProgress: null,
          pending: {
            sessionId: ctx.sessionId,
            history,
            systemPromptWithSite: ctx.systemPromptWithSite,
            clientContext: ctx.clientContext,
            excludeSilos: ctx.excludeSilos,
            keepSilos: ctx.keepSilos,
            projectId: ctx.projectId,
            model: ctx.model,
            step,
            source: ctx.source,
            steps,
            pendingToolUseId: yieldTc.id,
            partialResults: toolResults,
          },
        });
        return null; // paused
      }

      history.push({ role: 'tool', results: toolResults });
      if (aborted()) return null;
    }

    if (aborted()) return null;
    set({ isProcessing: false, currentToolLabel: null, toolProgress: null, pending: null });

    // ターン終了後にまとめて保存（バッチ保存）。
    const siteStore = (await import('./useProjectSiteStore')).useProjectSiteStore.getState();
    if (siteStore.dirty) await siteStore.save();

    const aiResponseText = finalText || (steps.length ? `${steps.join(' → ')}。完了しました。` : '処理を完了しました。');
    if (ctx.sessionId) {
      // スケジュール/タスクが作成されていれば結果ナビゲーションUIを付与
      let navigateUi: import('./useAIChatStore').ChatUi | undefined;
      if (createdSchedules > 0 || createdTasks > 0) {
        const summaryParts: string[] = [];
        if (createdSchedules > 0) summaryParts.push(`予定を ${createdSchedules} 件追加しました`);
        if (createdTasks     > 0) summaryParts.push(`タスクを ${createdTasks} 件追加しました`);

        // projectId 解決（セッションのprojectId > siteStore > activeProject の優先順）
        const siteSource = (await import('./useProjectSiteStore')).useProjectSiteStore.getState().source;
        const siteProjectId = siteSource?.kind === 'project' ? siteSource.id : null;
        const appStore = (await import('./useAppStore')).useAppStore.getState();
        const navSession = ctx.sessionId ? aiChatStore.sessions.find(s => s.id === ctx.sessionId) : null;
        const navSessionProjectId = navSession?.projectId && navSession.projectId !== '__global__'
          ? navSession.projectId : null;
        const resolvedProjectId = createdProjectId ?? navSessionProjectId ?? siteProjectId ?? appStore.getActiveProject()?.id ?? null;

        // プロジェクト名を取得してsummaryに付加
        const projectName = resolvedProjectId
          ? appStore.projects.find((p: any) => p.id === resolvedProjectId)?.name
          : null;
        const projectLabel = projectName ? `「${projectName}」に` : '';

        navigateUi = {
          kind: 'navigate_result',
          summary: `${projectLabel}${summaryParts.join('・')}`,
          items: [
            { label: 'Schedules & Tasks を確認する', action: 'open_schedule_tab', projectId: resolvedProjectId ?? undefined },
          ],
        };
      }

      // start_3d_generation はツール内でバッチ開始カードを既にチャットに追加している。
      // AIの "完了しました！" 等の finalText は誤解を招くため、その場合は追加しない。
      if (!batchStartedThisTurn) {
        aiChatStore.addMessage({
          sessionId: ctx.sessionId, role: 'ai', text: aiResponseText, source: ctx.source || 'sidebar_chat',
          ...(ctx.citations && ctx.citations.length ? { citations: ctx.citations } : {}),
          ...(navigateUi ? { ui: navigateUi } : {}),
        });
      }

      // 2件以上登録した場合は必ず継続確認UIを追加する（auto-yield が効かなかった場合の安全弁）。
      // pending が null でも ChatUiRenderer のフォールバック（新規メッセージ送信）で動作する。
      if ((createdSchedules + createdTasks) >= 2) {
        const contYieldId = crypto.randomUUID();
        aiChatStore.addMessage({
          sessionId: ctx.sessionId,
          role: 'ai',
          source: 'sidebar_chat',
          text: '',
          ui: {
            kind: 'choices',
            toolUseId: contYieldId,
            prompt: '続けて登録しますか？',
            multiSelect: false,
            choices: [
              { id: 'continue', label: '続きを登録する', description: '引き続き残りの件数を登録します' },
              { id: 'stop',     label: '今回はここまでにする', description: '残りは後でいつでも依頼できます' },
            ],
          },
        });
      }
    }

    return {
      intent: 'RESPOND_CHAT',
      actionType: 'NONE',
      assistantMessage: aiResponseText,
      payload: {},
      requiresConfirmation: false,
      riskLevel: 'low',
      steps,
    };
  };

  return {
    isProcessing: false,
    currentToolLabel: null,
    toolProgress: null,
    pending: null,
    _cancelId: 0,

    stopProcessing: () => {
      const sid = useAIChatStore.getState().activeSessionId;
      set((s) => ({ _cancelId: s._cancelId + 1, isProcessing: false, currentToolLabel: null, toolProgress: null, pending: null }));
      if (sid) {
        useAIChatStore.getState().addMessage({ sessionId: sid, role: 'ai', text: '⏹ 処理を中断しました。', source: 'sidebar_chat' });
      }
    },

    sendMessageToOrchestrator: async (text, options) => {
      const aiChatStore = useAIChatStore.getState();
      let sessionId = options?.sessionId || aiChatStore.activeSessionId;

      // セッションがない場合は自動生成（メッセージが消えるのを防ぐ）
      if (!sessionId) {
        const fallbackProjectId = useAppStore.getState().getActiveProject()?.id ?? '__global__';
        if (fallbackProjectId === '__global__') {
          sessionId = aiChatStore.createScopedSession('global', {});
        } else {
          sessionId = aiChatStore.createSession(fallbackProjectId);
        }
      }

      // 1. ユーザーメッセージを会話ログに記録。
      // hidden=true（UIボタン等からのキックオフ指示）はチャット欄に出さず、モデルにだけ渡す。
      if (sessionId && !options?.hidden) {
        aiChatStore.addMessage({ sessionId, role: 'user', text, source: options?.source || 'dashboard_chat' });
        // 初回メッセージで、仮タイトルのセッションは内容（最初のユーザー発話）から命名する。
        // ＋ボタンで作られた仮名（新しいチャット 等）も対象にする。
        const PLACEHOLDER_CHAT_TITLES = ['新規チャット', '新しいチャット', 'マイページ チャット', '全体チャット', '無題のチャット'];
        const session = aiChatStore.sessions.find(s => s.id === sessionId);
        if (session && PLACEHOLDER_CHAT_TITLES.includes(session.title) && aiChatStore.getMessagesForSession(sessionId).length === 1) {
          const oneLine = text.replace(/\s+/g, ' ').trim();
          const autoTitle = oneLine.length > 24 ? oneLine.slice(0, 24) + '…' : oneLine;
          aiChatStore.updateSessionTitle(sessionId, autoTitle || '新しいチャット');
        }
      }

      // ── 曖昧な「ボード」要求はモデルに投げず、クライアントで種別を選ばせる ──
      // サーバの固定プロンプトが「ボード→提案(3DSP)」へ強く誘導するため、プロンプトの
      // ヒントでは勝ち切れない。判断がつかないなら推測せずユーザーに仰ぐ原則を、
      // 決定論的に（LLM を介さず）保証する。選択後に種別を明示した発話で通常フローへ流す。
      if (sessionId && !options?.hidden && isAmbiguousBoardRequest(text)) {
        aiChatStore.addMessage({
          sessionId, role: 'ai', source: options?.source || 'dashboard_chat',
          text: '',
          ui: {
            kind: 'choices',
            intent: 'board_type',
            toolUseId: crypto.randomUUID(),
            prompt: 'どちらの「ボード」を作成しますか？',
            multiSelect: false,
            choices: [
              { id: 'research_board', label: 'Research & Memo ボード', description: '根拠→解釈→結論を編む思考・論証ボード' },
              { id: 'presentation_board', label: 'プレゼンボード（S.Slide）', description: '提案資料・スライドを作るボード' },
            ],
          },
        });
        set({ isProcessing: false, currentToolLabel: null, toolProgress: null, pending: null });
        return { intent: 'RESPOND_CHAT', actionType: 'NONE', assistantMessage: '', payload: {}, requiresConfirmation: false, riskLevel: 'low', steps: [] };
      }

      set({ isProcessing: true, currentToolLabel: null, toolProgress: null, pending: null });

      const steps: string[] = [];

      try {
        // 2. コンテキスト構築（system prompt + サイトスナップショット）。
        const activeProfile = useAiProfileStore.getState().aiProfiles.find(p => p.status === 'Active');
        const systemPrompt = activeProfile
          ? await useAiProfileStore.getState().buildCompleteSystemPrompt(activeProfile.id)
          : '';
        const siteSnapshot = buildSiteSnapshot();
        // S.Blog で記事を編集中なら、ブログコンテキストを最優先で注入する。
        // 狙い: 「各セクションに画像を」等の指示を、サイトの section（hero/overview…）と
        // 取り違えて add_asset_to_section / 3D生成フローへ誤爆するのを防ぐ。
        const blogSnapshot = buildBlogSnapshot();
        // ブログ編集中はサイトのセクション羅列を「参考」に降格し、見出し名の衝突で
        // 誤爆させない。それ以外は従来どおり完全なサイトスナップショットを注入。
        const editingTargetContext = blogSnapshot.editing
          ? `${formatBlogSnapshotForPrompt(blogSnapshot)}\n\n[参考: サイト構成（編集対象ではない）]\n${formatSiteSnapshotForPrompt(siteSnapshot)}`
          : formatSiteSnapshotForPrompt(siteSnapshot);
        // 注意: 揮発する状態（サイト構成・ローカル素材）は system に入れない。
        // プロンプトキャッシュの前置プレフィックスを安定させるため、エージェントが
        // site_snapshot / local_assets_list ツールで毎ターン取得する設計。
        const nowDate = new Date();
        const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
        const dateContext = `[現在の日時]\n今日の日付: ${todayStr}（${['日','月','火','水','木','金','土'][nowDate.getDay()]}曜日）`;
        const baseSystemPrompt = systemPrompt
          ? `${systemPrompt}\n\n${dateContext}\n\n${PROPOSAL_PLAYBOOK}\n\n${editingTargetContext}`
          : `${dateContext}\n\n${PROPOSAL_PLAYBOOK}\n\n${editingTargetContext}`;

        // RAG: 接続ナレッジから関連抜粋を取得し、systemに注入＋出典を最終メッセージへ。
        const { retrieveConnectedKnowledge } = await import('../features/ai-studio/lib/knowledgeRag');
        const rag = await retrieveConnectedKnowledge(text);

        // 家具選定フロー: ユーザー傾向 + 全体トレンドをシステムプロンプトに注入（Layer 2/3）。
        const { useAuthStore } = await import('./useAuthStore');
        const currentUid = useAuthStore.getState().currentUser?.uid ?? null;

        // チャット経由の指示をAIタスク履歴に記録（学習データ）。
        // source: 'task_auto_execute' はスケジュールタスク側で保存済みのため除外。hidden（UI起点のキックオフ）も除外。
        if (currentUid && text.trim().length >= 4 && options?.source !== 'task_auto_execute' && !options?.hidden) {
          const activeProjectId = useAppStore.getState().getActiveProject()?.id ?? '';
          Promise.all([
            import('firebase/firestore'),
            import('../lib/firebase/client'),
          ]).then(([{ collection, addDoc, serverTimestamp }, { db }]) =>
            addDoc(collection(db, 'users', currentUid, 'aiTaskHistory'), {
              title: text.trim(),
              projectId: activeProjectId,
              source: 'chat',
              createdAt: serverTimestamp(),
            })
          ).catch(() => {});
        }

        // 3D生成フロー: 残り枠をシステムプロンプトに注入する
        const is3dGenRequest = /3[Dd]モデル|3[Dd].*生成|生成.*3[Dd]|モデル.*生成|画像.*3[Dd]|3[Dd].*変換|立体化|tripo/i.test(text);
        let gen3dContext = '';
        if (is3dGenRequest && currentUid) {
          try {
            const { doc: fsDoc3d, getDoc: fsGet3d } = await import('firebase/firestore');
            const { db: db3d } = await import('../lib/firebase/client');
            const { AI_3D_LIMITS } = await import('../features/ai-studio/constants/ai-model-plans');
            const snap3d = await fsGet3d(fsDoc3d(db3d, 'users', currentUid));
            if (snap3d.exists()) {
              const d3d = snap3d.data() as any;
              const plan3d = (d3d.plan || 'free') as string;
              const limit3d = (AI_3D_LIMITS as any)[plan3d]?.tripo3d?.monthly;
              if (limit3d === Infinity) {
                gen3dContext = '\n\n[3D生成残り枠]\n今月の残り生成枠: 無制限';
              } else if (typeof limit3d === 'number') {
                const now3d = new Date();
                const monthStr = `${now3d.getFullYear()}-${String(now3d.getMonth() + 1).padStart(2, '0')}`;
                const usage3d = d3d.aiUsage?.tripo3d || {};
                const used3d = usage3d.lastMonthlyResetAt === monthStr ? (usage3d.monthlyCount || 0) : 0;
                const remaining3d = Math.max(0, limit3d - used3d);
                gen3dContext = `\n\n[3D生成残り枠]\n今月の残り生成枠: ${remaining3d}件（プラン上限: ${limit3d}件/月・使用済み: ${used3d}件）`;
              }
            }
          } catch { /* 取得失敗時は無視 */ }
        }

        let furnitureContextSection = '';
        if (currentUid && /家具|furniture|選定|models/i.test(text)) {
          const { getUserFurniturePreferences, getGlobalFurnitureInsights, buildFurnitureContextSection } =
            await import('../features/ai/furnitureUserLog');
          const [prefs, insights] = await Promise.all([
            getUserFurniturePreferences(currentUid),
            getGlobalFurnitureInsights(),
          ]);
          furnitureContextSection = buildFurnitureContextSection(prefs, insights);
        }

        // スケジュール/タスクの現在状況をコンテキストとして注入
        // プロジェクトID の優先順位:
        //   1. チャットセッションの projectId（最も信頼できる）
        //   2. siteSnapshot の projectId（kind === 'project' のとき確実）
        //   3. store の activeProjectId（フォールバック）
        const session = sessionId ? aiChatStore.sessions.find(s => s.id === sessionId) : null;
        const sessionProjectId = session?.projectId && session.projectId !== '__global__'
          ? session.projectId : null;

        // S.Layout スコープのチャット（右サイドバー埋め込み・task/subapp セッション）:
        // エディタで開いている Base/Plan/Option を確定情報として注入する（Phase 2）。
        const isLayoutScopedSession = session?.appScope === '3dsl'
          && (session.scope === 'task' || session.scope === 'subapp');
        let layoutChatContext = '';
        if (isLayoutScopedSession && session) {
          try {
            const { buildLayoutChatContext } = await import('../features/dsl/layout/chat/layoutChatContext');
            layoutChatContext = '\n\n' + buildLayoutChatContext(session);
          } catch (e) {
            console.warn('[Orchestrator] layout chat context build failed:', e);
          }
        }

        let schedulesTasksContext = '';
        // スケジュール・タスク関連発話か、または「把握」「確認」「整理」等の文脈
        const isScheduleTaskRequest = /スケジュール|予定|タスク|把握|確認|整理|追加|登録|作成|schedule|task/i.test(text);
        // グローバルセッション（マイページチャット等）では注入するプロジェクトが不明なので注入しない
        const isGlobalSession = session?.projectId === '__global__';
        if (isScheduleTaskRequest && !isGlobalSession) {
          // resolveProjectId と同じ優先順位: session → AppStore → siteStore
          const activeProjectId = sessionProjectId
            ?? useAppStore.getState().getActiveProject()?.id
            ?? (siteSnapshot.projectId && siteSnapshot.projectId !== '-' ? siteSnapshot.projectId : null);
          if (activeProjectId) {
            try {
              const { collection: col, getDocs: gd, query: fsq, orderBy: ord, limit: lim } = await import('firebase/firestore');
              const { db: firestoreDb } = await import('../lib/firebase/client');
              const [schSnap, taskSnap] = await Promise.all([
                gd(fsq(col(firestoreDb, 'projects', activeProjectId, 'schedules'), ord('dueDate', 'asc'), lim(20))),
                gd(fsq(col(firestoreDb, 'projects', activeProjectId, 'tasks'), ord('createdAt', 'asc'), lim(20))),
              ]);
              const schLines = schSnap.docs.map(d => {
                const s = d.data() as any;
                return `  - [${d.id}] ${s.title} (${s.dueDate} / ${s.type} / ${s.status})`;
              });
              const taskLines = taskSnap.docs.map(d => {
                const t = d.data() as any;
                return `  - [${d.id}] ${t.title} (${t.type} / ${t.priority} / ${t.status}${t.dueDate ? ' / 期限:' + t.dueDate : ''})`;
              });
              schedulesTasksContext = `\n\n[現在のスケジュール・タスク（projectId=${activeProjectId}）]\n` +
                `スケジュール ${schLines.length} 件:\n${schLines.join('\n') || '  なし'}\n` +
                `タスク ${taskLines.length} 件:\n${taskLines.join('\n') || '  なし'}`;
            } catch { /* Firestore未取得でも続行 */ }
          }
        }

        // カレンダー予定追加インテント検出: schedule 文脈 + 追加系の動詞が両方ある場合のみ注入
        const isCalendarAddIntent = isScheduleTaskRequest && /追加|登録|入れ|作っ|予約|入力|add|create|schedule/i.test(text);
        const calendarPlaybook = isCalendarAddIntent ? CALENDAR_ADD_PLAYBOOK : '';

        // バッチ進捗ルール: スケジュール/タスク文脈なら常時注入（「続きを」等でも機能させる）
        const batchProgressPlaybook = isScheduleTaskRequest ? BATCH_PROGRESS_PLAYBOOK : '';

        // AIタスク自動実行プレイブック
        const isAiTaskExec = text.startsWith('【AIタスク実行】') || options?.source === 'task_auto_execute';
        const aiTaskPlaybook = isAiTaskExec ? AI_TASK_PLAYBOOK : '';

        // グローバルセッション（マイページチャット等）プレイブック
        const globalSessionPlaybook = (isGlobalSession && isScheduleTaskRequest) ? GLOBAL_SESSION_PLAYBOOK : '';

        // 3D生成フロープレイブック（3D生成リクエストのとき注入）
        const gen3dPlaybook = is3dGenRequest ? GEN3D_PLAYBOOK : '';

        // マテリアル生成フロープレイブック
        const isMaterialGenRequest = /マテリアル.*生成|素材.*生成|テクスチャ.*マテリアル|マテリアル.*作っ|material.*gen/i.test(text);
        const materialGenPlaybook = isMaterialGenRequest ? MATERIAL_GEN_PLAYBOOK : '';

        // S.Library 連携プレイブック（知識保存・カタログ登録の意図を検出）
        const isKnowledgeRequest = /S\.?Library|ライブラリ|電子カタログ|カタログ.*(登録|探|集め)|(調べ|要約|まとめ).*(保存|登録|入れ|S\.?Library)|知識.*(保存|登録)|サンゲツ|リリカラ|シンコール|東リ|大建|朝日ウッドテック|永大|LIXIL|リクシル|名古屋モザイク/i.test(text);
        const knowledgePlaybook = isKnowledgeRequest ? KNOWLEDGE_PLAYBOOK : '';

        // S.Layout レンダリング文脈（レンダー/レイアウト/間取り/撮影/パース/提案書用）。
        const isLayoutRenderRequest = /レンダ|render|レイアウト|間取り|ギャラリーに(入れ|追加)|撮影|パース|プレゼン|提案書用/i.test(text);
        const layoutRenderPlaybook = isLayoutRenderRequest ? LAYOUT_RENDER_PLAYBOOK : '';

        // リサーチボード文脈: Research & Memo タブを開いている間は常時注入（そこでの対話＝ボード作業）。
        // タブ外でもボード系キーワードで注入する。
        const isResearchBoardContext = useAppStore.getState().activeProjectTab === 'memo'
          || /リサーチボード|リサーチキャンバス|Research\s*&?\s*Memo|メモボード|論証グラフ|ボードに(置|貼|まとめ|整理|追加)|research.?board/i.test(text);
        const researchBoardPlaybook = isResearchBoardContext ? RESEARCH_BOARD_PLAYBOOK : '';
        // アカウントサイト（マイページ）のチャットからボードを作るときは、個人スコープ('account')を
        // 既定＆推奨にする。作成先を propose_choices で尋ねる場合も先頭に「アカウントサイト」を出させる。
        const researchBoardScopeHint = (isResearchBoardContext && isGlobalSession)
          ? `\n\n[リサーチボードの作成先] 現在のチャットは「アカウントサイト（マイページ）」の文脈で、特定プロジェクトに紐付いていません。ボードは既定でアカウント個人スコープ research_board_create({ projectId: 'account', title }) に作成すること。作成先を propose_choices で確認する場合も、必ず最初の選択肢（推奨）として { id: 'account', label: 'アカウントサイト', description: '個人の思考整理ボード（プロジェクトに属さない）' } を出し、その後に各プロジェクトを並べること。`
          : '';

        const systemPromptWithSite = baseSystemPrompt + calendarPlaybook + batchProgressPlaybook + aiTaskPlaybook + globalSessionPlaybook + gen3dPlaybook + materialGenPlaybook + knowledgePlaybook + layoutRenderPlaybook + researchBoardPlaybook + researchBoardScopeHint + rag.promptSection + furnitureContextSection + schedulesTasksContext + gen3dContext + layoutChatContext;

        // 💰 前置き削減: リサーチボード文脈でない時は research_board_* ツール(約4.3k tok)を送らない。
        // isResearchBoardContext は「memoタブを開いている or メッセージにボード系キーワード」なので、
        // 通常チャットで「リサーチボードにまとめて」等と言われた場合は true になりツールが復活する（誤爆しにくい）。
        const excludeSilos: string[] = isResearchBoardContext ? [] : ['research'];
        // S.Layout スコープのチャット: レイアウト作業に無関係な silo を落として前置きを削減。
        // layout silo 自体はサーバーの自動キーワード判定でも外されないよう keepSilos で保護する
        // （「これを大きくして」等、レイアウト語を含まない発話でツールが欠落するのを防ぐ）。
        if (isLayoutScopedSession) {
          for (const s of ['slide', 'blog', 'library', 'local_assets']) {
            if (!excludeSilos.includes(s)) excludeSilos.push(s);
          }
        }
        const keepSilos: string[] = isLayoutScopedSession ? ['layout'] : [];

        // agentTurn（サーバー）へ後置 system ブロックとして渡すクライアント文脈。
        // サーバーの固定 SYSTEM_PROMPT（キャッシュ対象）と重複・衝突する AIプロファイル /
        // PROPOSAL_PLAYBOOK は含めず、揮発・文脈依存の要素だけを送る。
        // ⚠️これを送らない限り、上記プレイブック群はモデルに一切届かない
        // （systemPromptWithSite は agentTurn には渡っていない）。
        const clientContext =
          dateContext + '\n\n' + editingTargetContext + layoutChatContext +
          calendarPlaybook + batchProgressPlaybook + aiTaskPlaybook + globalSessionPlaybook +
          gen3dPlaybook + materialGenPlaybook + knowledgePlaybook + layoutRenderPlaybook +
          researchBoardPlaybook + researchBoardScopeHint + rag.promptSection + furnitureContextSection +
          schedulesTasksContext + gen3dContext;

        // AIメモリー（プロジェクトスコープ）注入用の projectId（サーバーが digest を構築）。
        const ctxProjectId = sessionProjectId ?? useAppStore.getState().getActiveProject()?.id ?? null;

        const selectedModel = useAppStore.getState().selectedLlmModel;
        // Claude 系モデル・'auto'（サーバーで Haiku↔Sonnet 自動振り分け）は agentTurn（Anthropic）で処理。
        // それ以外（Gemini/GPT を明示選択）は legacy へ。
        const isClaudeModel = selectedModel === 'auto' || selectedModel?.startsWith('claude-');
        if (!isClaudeModel) {
          const legacyCancelId = get()._cancelId;
          const r = await fallbackToLegacy(text, options, sessionId, () => get()._cancelId !== legacyCancelId);
          // legacy 経路は isProcessing を自前で戻さないため、ここで必ず解除（停止中なら維持）。
          if (get()._cancelId === legacyCancelId) set({ isProcessing: false, currentToolLabel: null, toolProgress: null });
          return r;
        }

        // 会話履歴をセッションの過去メッセージから再構築してコンテキストを維持する。
        // 画像添付があれば Anthropic 形式の content ブロック配列にする（テキスト＋画像）。
        const images = options?.images ?? [];
        const docs = options?.docs ?? [];
        // 添付テキストファイルの中身を「テキストブロック」として渡す（吹き出しには出さない）。
        const docBlocks: ContentBlock[] = docs
          .filter(d => d.text && d.text.trim())
          .map(d => ({ type: 'text' as const, text: `【添付ファイル: ${d.name}】\n${d.text}` }));
        const currentUserContent: string | ContentBlock[] = (images.length > 0 || docBlocks.length > 0)
          ? [
              ...(text ? [{ type: 'text' as const, text }] : []),
              ...docBlocks,
              ...images.map(img => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
            ]
          : text;

        // セッションの過去メッセージを取得（最新 N ターンに制限しトークン超過を防ぐ）。
        // addMessage は既に呼ばれているので最後の1件（今回のユーザー発話）はスキップ。
        // hidden の場合は今回の発話がストアに無いので全件が過去分。
        const MAX_HISTORY_MSGS = 30; // 最大 30 メッセージ = 約 15 往復
        const sessionMsgs = sessionId ? aiChatStore.getMessagesForSession(sessionId) : [];
        const priorMsgs = (options?.hidden ? sessionMsgs : sessionMsgs.slice(0, -1)).slice(-MAX_HISTORY_MSGS);
        const history: AgentMessage[] = [
          ...priorMsgs
            .filter(m => m.text && m.text.trim()) // 空テキストのシステムメッセージを除外
            .map(m => m.role === 'ai'
              ? { role: 'assistant' as const, text: m.text }
              : { role: 'user' as const, content: m.text }
            ),
          { role: 'user', content: currentUserContent },
        ];

        const result = await runLoop({
          sessionId, history, systemPromptWithSite, clientContext, projectId: ctxProjectId,
          model: selectedModel, step: 0,
          source: options?.source, steps, citations: rag.citations, excludeSilos, keepSilos,
        });

        // 中断（UI-yield）した場合は空応答を返す（UIはメッセージストアから描画）。
        if (!result) {
          return { intent: 'RESPOND_CHAT', actionType: 'NONE', assistantMessage: '', payload: {}, requiresConfirmation: false, riskLevel: 'low', steps };
        }
        return result;

      } catch (e: any) {
        console.error('[Orchestrator] agentTurn loop failed:', e);
        set({ isProcessing: false, currentToolLabel: null, toolProgress: null, pending: null });

        // agentTurn が利用不可なら既存 proposeDesktopAction にフォールバック。
        return await fallbackToLegacy(text, options, sessionId);
      }
    },

    resumeWithToolResult: async (toolUseId, content) => {
      const p = get().pending;
      // pending が無い（アプリのリロード/再起動で in-memory ループがロスト）→ 再開不可。
      // 呼び出し側がフォールバック（新規メッセージで流れを復元）できるよう false を返す。
      if (!p || p.pendingToolUseId !== toolUseId) return false;
      set({ pending: null, isProcessing: true, currentToolLabel: null });

      const results = [...p.partialResults, { tool_use_id: toolUseId, content }];
      const history = [...p.history, { role: 'tool' as const, results }];
      try {
        await runLoop({
          sessionId: p.sessionId, history, systemPromptWithSite: p.systemPromptWithSite,
          clientContext: p.clientContext, projectId: p.projectId,
          model: p.model, step: p.step, source: p.source, steps: p.steps,
          excludeSilos: p.excludeSilos, keepSilos: p.keepSilos,
        });
      } catch (e: any) {
        console.error('[Orchestrator] resume failed:', e);
        set({ isProcessing: false, currentToolLabel: null, toolProgress: null });
        if (p.sessionId) {
          useAIChatStore.getState().addMessage({ sessionId: p.sessionId, role: 'ai', text: '処理の再開に失敗しました。時間をおいて再試行してください。', source: 'sidebar_chat' });
        }
      }
      return true;
    },

    resumeWithChoice: async (toolUseId, ids) => {
      useAIChatStore.getState().resolveMessageUi(toolUseId, { resolved: { ids } });
      return await get().resumeWithToolResult(toolUseId, JSON.stringify({ selected: ids }));
    },

    resolveFurnitureSourceChoice: async (id, context) => {
      const aiChatStore = useAIChatStore.getState();
      const sessionId: string | null = context.sessionId || aiChatStore.activeSessionId;
      const say = (text: string, ui?: import('./useAIChatStore').ChatUi) => {
        if (sessionId) aiChatStore.addMessage({ sessionId, role: 'ai', text, source: 'sidebar_chat', ...(ui ? { ui } : {}) });
      };

      // ── 手動: S.Model 家具ピッカーを開く（ユーザーが選択→confirm で追加＆再配置）──
      if (id === 'manual_models') {
        const toolUseId = crypto.randomUUID();
        say('S.Model を開きました。配置するモデルを選んで確定してください。', {
          kind: 'furniture_picker', toolUseId, candidateCount: 0,
        });
        const { useFurniturePickerStore } = await import('./useFurniturePickerStore');
        useFurniturePickerStore.getState().open({ toolUseId, candidateIds: [] });
        const pid = context.projectId || useAppStore.getState().getActiveProject()?.id;
        if (pid) {
          useAppStore.getState().setModelsScope('global_models');
          import('../features/launcher/launchWorkspace').then(({ launchWorkspace }) => {
            launchWorkspace({ appScope: '3dss', projectId: pid, workspaceId: 'models', workspaceName: 'S.Model' });
          });
        }
        return;
      }

      // ── 自動: S.Model のモデルから自動選定して再配置（LLM 非経由・1 パスで終わらせる）──
      if (!context.projectId || !context.planId) {
        say('配置先の情報が取得できませんでした。もう一度「自動配置」からお試しください。');
        return;
      }
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid;
      const { useAutoLayoutStore } = await import('../features/dsl/layout/store/useAutoLayoutStore');
      const setProgressMessage = useAutoLayoutStore.getState().setProgressMessage;
      set({ isProcessing: true, currentToolLabel: 'S.Model のモデルから自動配置しています…' });
      try {
        const { runAutoLayoutFromChat } = await import('../features/dsl/layout/services/chatLayoutBridge');
        const result = await runAutoLayoutFromChat(context.projectId, context.planId, {
          userId: uid,
          buildingType: context.buildingType ?? 'residential',
          furnitureSource: 'global_models',
          roomWidthMm: context.roomWidthMm ?? 5000,
          roomDepthMm: context.roomDepthMm ?? 4000,
          onProgress: setProgressMessage,
        });
        setProgressMessage(null);
        set({ isProcessing: false, currentToolLabel: null });

        if (result.placedCount > 0) {
          try {
            useAppStore.getState().setActiveProjectId(context.projectId);
            const { launchWorkspace } = await import('../features/launcher/launchWorkspace');
            await launchWorkspace({ appScope: '3dsl', projectId: context.projectId, workspaceId: 'layout', workspaceName: 'S.Layout' });
          } catch (navErr) {
            console.warn('[furniture_source:auto] S.Layout への遷移に失敗:', navErr);
          }
          say(`S.Model のモデルから ${result.placedCount} 点を自動配置しました。`);
        } else {
          // まだ 0 点。原因を切り分けて伝える（候補0件=モデル未発見 / 候補あり=配置ロジックが置けず）。
          // 自動は再提示せず手動へ誘導し堂々巡りを断つ。
          const cand = result.candidateCount ?? 0;
          const zeroMsg = cand === 0
            ? 'S.Model に配置に使える 3D モデルが見つかりませんでした。モデルを手動で選ぶか、S.Model にアップロードしてください。'
            : `モデル候補は ${cand} 件見つかりましたが、この部屋条件では自動配置できませんでした。モデルを手動で選んで配置してください。`;
          say(zeroMsg, {
            kind: 'choices',
            toolUseId: crypto.randomUUID(),
            prompt: '次にどうしますか？',
            multiSelect: false,
            intent: 'furniture_source',
            context,
            choices: [
              { id: 'manual_models', label: 'S.Modelから手動で選ぶ', description: 'S.Model のモデル一覧から自分で選んで配置します' },
            ],
          });
        }
      } catch (e: any) {
        setProgressMessage(null);
        set({ isProcessing: false, currentToolLabel: null });
        say(`自動配置に失敗しました: ${e?.message || 'unknown error'}`);
      }
    },
  };
});

// ─── 3Dモデル生成フロー・プレイブック ────────────────────────────────────
const GEN3D_PLAYBOOK = `
# 3Dモデル生成フロー（必須ルール）

ユーザーが「3Dモデルを生成して」「画像から3D化して」等を依頼したら、以下の順序で必ず実行する。

## ステップ
1. **open_image_picker** で変換したい画像を選ばせる（purpose='3d', max=100）。
2. 画像選択後、**propose_choices** で件数を確認する（このステップを絶対に省略しない）。
   - \`[3D生成残り枠]\` に記載された今月の残り枠の範囲で選択肢を組む。
   - 残り枠が不明な場合は選択した全枚数を上限とする。
   - 選択肢の例（選択枚数とN=残り枠に合わせて調整）：
     - "1件"（id="1"）
     - "3件"（id="3"、残り枠≥3のとき）
     - "5件"（id="5"、残り枠≥5のとき）
     - "全て（N件）"（id=N、N=min(選択枚数, 残り枠)）
   - promptに「今月の残り生成枠: X件」を必ず一言含める。
   - multiSelect: false（単一選択）。
3. ユーザーが件数を選んだら、**start_3d_generation** を呼ぶ。
   - imageIds は選ばれた件数分だけ使う（先頭から）。

## 禁止
- open_image_picker の直後に propose_choices を挟まず start_3d_generation を呼んではいけない。
- propose_choices の選択肢に今月の残り枠を超える件数を入れてはいけない。
`;

// ─── S.Library（知識ライブラリ）連携プレイブック ─────────────────────────────
const KNOWLEDGE_PLAYBOOK = `
# S.Library 連携フロー（知識の保存・カタログ登録）

S.Library はユーザーの「知識そのもの」を貯める場所。以下を依頼されたら対応するツールで完遂する。

## 使えるツール
- library_save_note({ title, markdown, category?, tags? }) — 調査・要約した内容を Markdown メモとして保存。
- library_add_url({ url, title?, manufacturer?, category?, tags? }) — 製品ページ/電子カタログのURLを登録（kind=url, HTMLスナップショット付き）。
- library_add_pdf({ url, title? }) — PDFの直リンクURLをダウンロードしてローカル(LocalAssets\\Documents\\PDF)に保存し、S.Libraryに取り込む。
- web_list_links({ url, contains? }) — 指定ページの実在リンクを列挙（contains例 "pdf" でPDFのみ）。カタログ/PDFのURL一覧を出すのに使う。
- library_list() — 既存の知識一覧（重複登録を避けるための確認に使う）。

## 重要: Webリンク取得について
- あなたは web_list_links で**実在ページのリンクを取得できる**。「Web検索機能が無い」と一律に断らない。
- URLは**捏造しない**。web_list_links で取得した実在URLのみ提示する。

## A. 調べた内容を S.Library に保存
- 「今調べた内容を保存して」「まとめてS.Libraryに入れて」等。
- 直前までの調査・回答の要点を markdown に整理して library_save_note で保存する。
  - title は内容が一目で分かる簡潔な名前。
  - category は次から最適なものを選ぶ: 法規 / 構造 / 意匠 / 設備 / 環境 / 積算 / 素材・建材 / その他。
  - tags に主題キーワードを入れる。
- 保存後「S.Libraryに『〇〇』を保存しました」と一言報告する。

## B. メーカー電子カタログのURLを探して登録
- 「サンゲツの電子カタログを探してS.Libraryに登録して」「主要仕上げメーカーのカタログをまとめて登録して」等。
- 対象メーカー例: サンゲツ / リリカラ / シンコール / 東リ / 大建工業 / 朝日ウッドテック / 永大産業 / LIXIL / 名古屋モザイク工業。
- 各社ごとに library_add_url を呼ぶ（manufacturer にメーカー名、category は基本「素材・建材」、tags にメーカー名）。
- 複数社まとめての依頼は、確実な公式サイト/カタログ入口URLを各社分そのまま順に登録し、最後に「N 社のカタログを登録しました」と報告する。
- 事前に library_list で既存URLを確認し、重複は登録しない。

## C0. カタログ/PDF の URL 一覧を出す
- 「サンゲツのカタログURL一覧を出して」「カタログPDFのURLを教えて」等。
- メーカーの「カタログ/ダウンロードページ」のURLに対して web_list_links({ url, contains: "pdf" }) を呼び、返ったリンクを一覧で提示する（PDF直リンクは library_add_pdf でDL可能と案内）。
- 入口URLが不明なら、確実な公式トップ（例 サンゲツ https://www.sangetsu.co.jp/ ）に web_list_links を当てて「カタログ」「catalog」「pdf」等を含むリンクを探す。
- それでも見つからない/JS描画でリンクが取れない場合は、その旨を正直に伝え、ユーザーに対象ページのURLを尋ねる。捏造はしない。

## C. メーカーカタログPDFをダウンロードして保存
- 「サンゲツのカタログPDFをダウンロードして（保存して）」等。
- PDFの**直リンクURL（.pdf）**が分かっている場合は library_add_pdf({ url, title? }) でダウンロードしてローカル保存する。
- 直リンクが不明な場合は捏造せず、まず library_add_url でカタログ入口URLを登録するか、ユーザーにPDFのURLを尋ねる。
- 注意: メーカーによってはPDF直リンクが無く「電子ブック（ビューア）」のみの場合がある。その時はPDF保存不可と伝え、URL登録で代替する。

## 原則
- 不確かな深いURLは捏造しない。確実な公式トップ/カタログのランディングを使う。
- 1ターンに大量登録しすぎない（多くても数件ずつ、続きは確認しながら）。
`;

// ─── リサーチボード（Research & Memo）・プレイブック ──────────────────────────
const RESEARCH_BOARD_PLAYBOOK = `
# リサーチボード伴走フロー（Research & Memo）

リサーチボードは「デザインの根拠（エビデンス）をロジックとして編み上げ、コンセプトに落とし込む」ための思考面。
ここでの作業は AI との対話が主役で、ボードは対話の内容が言語化・可視化されて定着する場所。
デザインには必ずロジックと根拠が要る——ボード上のすべての主張が出典まで遡れる状態を保つこと。
ボードの本体は**論証グラフ**: カード（role: evidence=根拠 / interpretation=解釈 / conclusion=結論）を
型付きエッジ（supports=だから / contradicts=でも / applies=例えば / derives=つまり）で繋ぎ、
「どの根拠が・どのロジックで・どの結論を支えるか」を目に見える筋道にする。
最終的に、どのコンセプトからもエッジを遡れば一次根拠に着地する状態がゴール。

**最重要: ボード反映は自発的に行う。** ユーザーが「ボードに置いて」「反映して」と言うのを待たない。
対話の各ターンで言語化できた論点・決定・要件・根拠は、その場で add_items / connect_items でボードに置き、
置いたことを一言だけ報告する（「ボードに置きました。違っていたら直します」程度）。違えば update/remove で直せばよい。
チャットは流れて消えるがボードは残る——**成果物はボード、チャットは対話**。
要件整理・与条件・比較表のような構造化情報をチャットで長々と出すくらいなら、同じ内容をカード群＋エッジとしてボードに置くこと。

## 使えるツール
- research_board_get() — ボードの現状（カード一覧・エッジ一覧・座標＋hints＝論証の穴の診断）。**置く/繋ぐ/整理する前に必ず呼ぶ**。
- research_board_create({ title }) — 新しいボードを作って切り替える。テーマが明確に別（例: 意匠の論拠／事業性の論拠、キャリアの方向性／新規事業アイデア）のときだけ。安易に増やさない。
- research_board_add_items({ items, edges? }) — カードを置く。note=言語化した論点・気づき / quote=出典付き引用（根拠）/ source=S.Library・S.Blog 参照カード / link / image。role で 根拠/解釈/結論 を付けられる。edges で同時に接続もできる（"#0"=今回の items の添字参照）。
- research_board_connect_items({ edges, removeEdgeIds? }) — 既存カード同士を型付きエッジで接続。label（なぜ繋がるかの一行）を必ず添える。
- research_board_update_item({ id, ... }) — 本文の推敲・色分け・role 付け・移動（グルーピング）。
- research_board_remove_items({ ids }) — 削除（ユーザーが明確に求めたときのみ。接続エッジも一緒に消える）。
- research_board_generate_image({ prompts: [{prompt, caption?}] }) — コンセプト/ムードイメージを生成し、完成したらボードに自動配置（約1分）。複数案は prompts[] に1回でまとめる（最大4枚・並列）。即時返却されるので完成を待たずに対話を続ける。
- search_knowledge({ query, category? }) — 外付け脳（S.Library/RAG）から根拠スニペットを検索。
- library_list() — S.Library の一覧（localId を quote/source の refId に使う）。
- blog_list() / blog_get({ id }) — S.Blog 記事の一覧と本文(Markdown)全文＋coverUrl。記事からの引用・画像取得に使う。
- gallery_query({ kind: 'image' }) — プロジェクトの既存画像資産（レンダー/パース/S.Image）。ref.thumbnailUrl を image カードの url に使える。

## 引用・画像の引っ張り方（出典リソース）
根拠・参照は遠慮なくどんどん引いてよい。使える供給源:
- **S.Blog 記事の文章**: blog_list → blog_get で本文全文を読み、要点の一節を quote（refType 'article', refId=記事id, refTitle=記事タイトル）で置く。
- **S.Blog 記事の画像**: blog_get の coverUrl や本文 Markdown 内の画像URL（![](...)）を image カード（text に「◯◯の記事より」等の出所メモ）で置く。
- **S.Library の知識**: search_knowledge のスニペットを quote（refType 'library'）で。library_list で refId（localId）を補う。
- **プロジェクトの画像資産**: gallery_query({ kind: 'image' }) の thumbnailUrl を image カードで置く（既存パース・レンダー・S.Image）。
- 画像はすべて https の実URLを使う。data: URL・捏造URLは不可。

## 対話の始め方（キックオフ）
- ユーザーがボードから対話を始めたら（【リサーチボード・キックオフ】指示を含む）、挨拶は一言で切り上げ、
  デザイナーの発想力・想像力を掻き立てる**具体的で答えやすい問い**を1〜2個だけ投げる。
- 良い問いの型: 体験の記憶（「その敷地で一番心が動いた瞬間は？」）/ 一場面の想像（「施主の休日の朝、どこで何をしていてほしい？」）/
  対比（「開くべき方向と、閉じて守るべきものは？」）/ 参照（「空気感が近いと感じた空間は？」）。抽象論・一般論の質問はしない。

## 対話の作法（深掘り → 言語化 → 可視化 → 根拠づけ → 構造化）
1. **深掘り**: ユーザーの言葉が抽象的なうちは問いで具体化する（誰のため？敷地の何が効く？なぜその素材？）。ただし問いの過程で出た具体は、その都度カード化してよい。
2. **言語化**: 輪郭が出た論点・キーワードは**その場で** note に置く（「置きましょうか？」と許可を求めない）。置いたら一言だけ報告し、違っていれば update/remove で直す。1カード=1主張。長文を1枚に詰めない。
3. **可視化**: 言葉で伝わりにくい空気感・素材感・光の方向性が出てきたら research_board_generate_image でイメージを生成して見せ、
   ユーザーの反応（どこが良い/違う）からさらに深掘りする。複数案は prompts[] に1回でまとめて並列生成（最大4枚）。同じツールを連続で呼ばない。
4. **根拠づけ**: 主張には search_knowledge / library_list で根拠を探し、quote（refTitle・refId 付き）で隣に置く。根拠が見つからない主張は「まだ仮説」と明示する。
5. **構造化（エッジで論証を編む）**: 根拠 quote → それが本PJで何を意味するかの note（role: interpretation）→ 結論、を connect_items で繋ぐ。
   向きは常に 根拠側 → 結論側。label に「なぜ繋がるのか」の一行を必ず入れる——この積み重ねがそのまま設計根拠の説明になる。
   採らなかった案・反対の根拠は contradicts で残す（検討の痕跡が提案の説得力になる）。座標のクラスタ化（左=根拠 → 右=結論 の流れ）も併用する。
   定期的に research_board_get で全景を見て、エッジのないカード（=論理に組み込まれていない素材）や、入エッジのない結論（=根拠のない主張）を指摘する。
6. **コンセプト化**: クラスタが熟したら、束ねる一言（コンセプト候補）を提案し、合意したら note（green・role: conclusion）で置き、支える解釈・根拠から derives/supports のエッジを張る。

## 役割（role）は必ず付ける — ボードは「ロジックの地図」で読まれる
ボードには表示モード「ロジックの地図」があり、**role（evidence=根拠 / interpretation=解釈 / conclusion=結論）で左→右のレーンに自動配置**され、繋がったカード群がテーマの帯に並ぶ。
だから role が付いていないと地図で正しい列に並ばない。カードを置くときは必ず role を付けること:
- quote / source（出典付きの事実）→ evidence
- 「その根拠が本PJで何を意味するか」の解釈 note → interpretation
- コンセプト・設計方針の結論 note → conclusion
- 敷地条件・与条件など動かせない事実の note も evidence 扱いでよい。

## ロジックの地図を整える（マッピングの進化）
ユーザーが「地図を整えて」「ロジックを整理して」「マッピングを進化させて」等と言ったとき、または対話が一区切りしたときは、research_board_get の **hints** を見て論証の穴を埋める:
- **rolelessIds**（役割未設定）→ 各カードの内容から role を推定し update_item で付与する。
- **rootlessConclusionIds**（根拠に着地していない結論）→ それを支える解釈・根拠を探し（無ければ search_knowledge/library で補い）、derives/supports で connect_items する。埋められないなら「この結論はまだ根拠が弱い」と正直に伝える。
- **brokenInterpretationIds**（筋が途切れた解釈）→ 上流の根拠、または下流の結論のうち欠けている側を繋ぐ。
- **unconnectedIds**（宙に浮いたカード）→ 関連するクラスタへ接続するか、まだ使い所が無ければユーザーに位置づけを一言確認する。
- **danglingEvidenceIds**（どこにも効いていない根拠）→ どの解釈・結論に効くかを繋ぐ。
整えたら「役割をN件付与／M本つないで筋を通しました。地図で根拠→結論の流れが見えます」のように何をしたか簡潔に報告する。勝手に大量のエッジを捏造せず、意味のある接続だけを張る。

## 原則
- 毎ターン、そのターンで言語化できた論点・決定・根拠を能動的にボードへ反映する（置いてから一言報告。事前の許可取りはしない）。ユーザーが「集めて」「引っ張って」と資料集めを求めたときは quote/image をまとめて置いてよい（add_items 1回にまとめる）。
- 能動的に置くのは「対話に出た内容」と「出典のある根拠」。ユーザーの言葉にない論点をゼロから大量創作してボードを埋めない。
- ユーザーが書いたカードの本文変更・削除は、必ず事前に合意を取る（AIが置いたカードは自由に直してよい）。
- 出典の捏造は厳禁。refTitle/refId/画像URL は search_knowledge・library_list・blog_get・gallery_query の実データのみ使う。
`;

// ─── マテリアル生成フロー・プレイブック ──────────────────────────────────────
const MATERIAL_GEN_PLAYBOOK = `
# マテリアル生成フロー（必須ルール）

ユーザーが「マテリアルを生成して」「テクスチャからマテリアルを作って」「素材を一括生成して」等を依頼したら、以下の順序で必ず実行する。

## ステップ
1. **open_material_source_picker** を呼び、テクスチャのソース（S.Image／ローカル素材／別プロジェクト）と保存先をユーザーに選ばせる。
2. ユーザーが確認したら、返ってきた sources JSON をそのまま **start_material_generation** に渡す。

## 注意
- ステップ1を省略して直接 start_material_generation を呼んではいけない。
- sources.destination を必ず含める（省略不可）。
`;

// ─── S.Layout レンダリング・プレイブック ──────────────────────────────────────
const LAYOUT_RENDER_PLAYBOOK = `
# S.Layout レンダリング・フロー（必須ルール）

## render_layout の使い方
- render_layout は **完全にヘッドレス（裏側）で実行**される。S.Layout を開く必要はなく、複数チャットの並行作業でも使える。
- 対象は planId で指定する。まず layout_list で間取り一覧と planId を取得し、対象の planId を render_layout に渡す。
- 間取りが1件しかない場合や、どれか明らかな場合は、ユーザーに確認せず即座にレンダリングしてよい。複数あって曖昧なときだけ propose_choices で対象を選ばせる。
- 引数 count で枚数（既定3・最大6）。

## 撮影スタイル（style 引数）
- render_layout は追加引数 style（"realestate" | "magazine" | "catalog"）に対応。指定すると**スタイルに合わせた自動アングル**で撮影される（保存アングルより優先）。
  - 「不動産風・内見用・広く明るく」→ style: "realestate"（立ち目線・ワイド。count 省略時 6 枚）
  - 「雑誌風・ドラマチック・画になる」→ style: "magazine"（座り目線・家具主役。count 省略時 5 枚）
  - 「カタログ風・家具主役・寄り・質感」→ style: "catalog"（タイトに寄る。count 省略時 6 枚）
- 「提案書用に撮影して」「プレゼン用のパースを作って」等、**撮影・プレゼン系の依頼でスタイル指定が無ければ style: "realestate"** を使う。style 指定時は count を省略してよい（スタイル既定枚数になる）。

## プレゼン一式（撮影→レンダー→提案書添付を一気通貫）
- 「提案書用に撮影して載せて」のように**最初から添付まで頼まれている場合**は、確認を挟まず最後までやり切る:
  layout_list →（曖昧なら選択）→ render_layout(planId, style) → get_layout_outputs → add_asset_to_section（ギャラリーセクション）→ 完了報告。
- 「撮影して」だけで添付の指示が無い場合は、レンダー後に下記の propose_choices で聞く。

## 結果表示
- レンダー結果の画像は**システムが自動でチャットに画像グリッドで表示する**。あなたは画像 URL を本文に並べてはいけない。完了の一言（例「3枚レンダリングしました」）だけ述べる。

## レンダリング後のフォローアップ（必ず選択肢で）
- レンダリングが完了したら、次の行動を**必ず propose_choices で選択肢ボタンとして提示する**（プレーンテキストで「追加しますか？」と聞かない）。
  \`\`\`
  propose_choices({
    prompt: "このレンダーをどうしますか？",
    multiSelect: false,
    choices: [
      { id: "add_gallery", label: "提案書のギャラリーに追加", description: "サイトのギャラリーセクションに添付します" },
      { id: "no",          label: "今はしない",             description: "あとでいつでも追加できます" }
    ]
  })
  \`\`\`
- "add_gallery" が選ばれたら get_layout_outputs → add_asset_to_section でギャラリーに追加する。

## 原則
- 「裏で子アプリを動かし、結果はチャットに表示」する。ユーザーに手作業を促すのは最小限にする。
`;

// ─── 提案書ビルド・プレイブック（システムプロンプトへ注入） ───────────────
// 「〜の提案書/企画書/プレゼンを作って」と頼まれたときに、エージェントが既存ツール
// （create_site_from_template / add_section / update_section / gallery_query /
//  subapp_guide / dsd_create_diagram / start_3d_generation / set_theme / set_motion）
// を使って、建築実務に沿った順序で“最適な提案書”を組み立てるための手順書。
const PROPOSAL_PLAYBOOK = `# 提案書／企画書の自動作成プレイブック

ユーザーが「○○（場所・用途）の提案書（企画書/プレゼン/紹介サイト）を作って」と依頼したら、以下の手順で**自律的に最後まで**組み立てる（途中で過度に確認せず、建築実務の妥当なデフォルトで埋め、最後に要約報告する）。

## 1. サイトの骨組み
- まだ提案書構成でなければ create_site_from_template を family="proposal" で実行（既存サイトがあれば活かし、不足ページ/セクションを add_section で補う）。
- 依頼文から「敷地（住所/エリア）・用途（住宅/集合住宅/店舗等）・規模・与条件」を抽出し、ヒーローとプロジェクト概要(spec)へ反映（update_section で title/body/specRows を記入）。

## 2. 内容を実務の流れで充填（各 update_section の body を具体的に下書き）
1. 敷地・周辺調査(research): 立地特性・周辺環境・アクセス・眺望・採光等を一般知識から記述。住所があれば mapQuery に設定。
2. 法規・与条件(regulation): 用途地域/建蔽率/容積率/高さ制限等の検討項目を specRows で列挙（不明値は「要確認」とし枠組みを提示）。
3. ターゲット(target): 想定利用者像と要求性能を chartData で整理。
4. コンセプト(concept): keywords とステートメントを提案。
5. 検討の過程(process): スタディの流れを steps で。
6. ゾーニング/動線(zoning/flow): 計画方針を callouts で。
7. プラン(layout)・仕様(itemspec/spec): 構成・面積・主要仕様。
8. 比較検討(comparison): 案A/Bの比較。

## 3. 素材の収集・生成
- まず gallery_query で各セクション型に合う既存素材（S.Layout レンダー/S.Image 画像/S.Drawing 図面/S.Diagram 図解）を探して add_asset_to_section で添付。
- 図解が必要なら dsd_create_diagram（必要に応じ dsd_render_manim）で生成。
- 3D が要るなら start_3d_generation を提案・起動。
- 不足している素材は subapp_guide で該当子アプリ（S.Layout=平面/レンダー, S.Image=パース/AI画像, S.Drawing=図面, S.Diagram=ダイアグラム）への作成を案内。

## 4. 仕上げ
- 用途・トーンに合うスタイルへ set_theme（住宅=journal/atelier/salon、ギャラリー/先鋭=gallery/mono/studio 等）、必要に応じ set_motion。
- 最後に「作成したページ/セクション・添付素材・ユーザーが次に手を入れるとよい点（要確認の数値・追加してほしい素材）」を簡潔に箇条書きで報告。

## 原則
- 推測で建築的に妥当な内容を積極的に下書きする（空欄で放置しない）。ただし数値の断定が危険な項目は「要確認」と明記。
- 1ターンに詰め込みすぎず、ツールを段階的に呼ぶ。`;

// ─── カレンダー予定追加プレイブック ──────────────────────────────────────────
const CALENDAR_ADD_PLAYBOOK = `
# カレンダー予定追加プレイブック

ユーザーが「予定を追加して」「カレンダーに入れて」「〇〇をスケジュールに登録して」などのように、**予定・スケジュールの新規追加**を意図するメッセージを送ってきた場合、必ず以下の手順を踏む。

## 手順

1. **まず propose_choices で登録先を確認する**（直接ツールを実行しない）

   \`\`\`
   propose_choices({
     prompt: "どのカレンダーに追加しますか？",
     multiSelect: false,
     choices: [
       { id: "sekkeiya", label: "SEKKEIYA のスケジュール", description: "このプロジェクトの予定として登録。チームと共有・Schedules & Tasks で管理" },
       { id: "google",   label: "Google カレンダー",       description: "外部カレンダーに追加。他のアプリ・デバイスからも確認可能" },
       { id: "both",     label: "両方に追加",              description: "SEKKEIYA とGoogle カレンダー、どちらにも同時登録" }
     ]
   })
   \`\`\`

2. ユーザーが選択したら、その内容に応じて予定情報（タイトル・日付・時間）を確認し実行する:
   - **"sekkeiya"** → schedule_create（SEKKEIYA Firestore に保存）
   - **"google"** → gcal_create_event（Google カレンダーに追加）
   - **"both"** → schedule_create と gcal_create_event を順に実行

3. 予定情報（タイトル・日付・時間・種別）が不明な場合は、ツール実行前に自然な文章で確認する。
   日付が「明日」「来週月曜」などの相対表現の場合は現在日時を基準に解釈してよい。

## 注意
- Google カレンダー選択時、gcal_list_calendars で確認した結果が複数あれば、どのカレンダーに入れるか確認する（primary があればそれを既定として使う）。
- 複数の予定をまとめて追加する依頼（「以下の予定を全部登録して」等）も同じ流れで処理する。
- タスク（作業項目・TODO）の追加依頼は対象外。タスクは task_create で対応し、このフローを経由しない。
`;

// ─── バッチ登録進捗プレイブック（スケジュール/タスク文脈で常時注入） ────────
const BATCH_PROGRESS_PLAYBOOK = `
# バッチ登録（複数件の予定・タスクを順次登録する場合）の必須ルール

**重要：このルールは「2件以上」の登録依頼にのみ適用する。1件だけの追加依頼の場合は即座に schedule_create / task_create を実行し、propose_choices は出さない。**

複数（2件以上）の予定またはタスクを一括・順次登録しているとき（「続きを登録して」「残りをお願い」等の継続リクエストを含む）、**毎ターン必ず以下を守ること**：

## 0. 登録開始前に必ず実行計画を提示して確認する（初回のみ、2件以上の場合のみ）
ユーザーから**複数件（2件以上）**の登録依頼があったとき、まだ一件も登録していない場合は、schedule_create / task_create を実行する前に propose_choices で確認する：

\`\`\`
propose_choices({
  prompt: "合計 N 件の予定を登録します。どのように進めますか？",
  multiSelect: false,
  choices: [
    { id: "batch5",  label: "5件ずつ分けて登録する（推奨）", description: "5件ごとに確認しながら進みます" },
    { id: "all",     label: "まとめて一気に登録する",         description: "全件を一度に登録します（最大5件まで）" },
    { id: "preview", label: "登録内容を先に確認する",          description: "登録予定の一覧を表示してから実行します" }
  ]
})
\`\`\`

"batch5" → 以降のルール（1〜4）通りに5件ずつ登録する。
"all" → 全件を一度に実行（ただしシステムが最大5件に制限する）。
"preview" → 登録予定リストを箇条書きで表示してから再度 propose_choices で確認する。

## 1. 進捗を必ず明示する
ターン末尾のメッセージには必ず以下の形式で書く:
「✅ 今回 X 件登録（累計 Y 件 / 全 Z 件）。残り W 件。」

- X = このターンで新たに登録した件数
- Y = これまでの累計登録件数（会話履歴から引き継ぐ）
- Z = 依頼された全件数（最初に把握した総数）
- W = Z - Y（残り件数）

会話履歴に「○件登録済み」「○件完了」と書かれていれば、その数字を累計の基準にすること。

## 2. 残りがある場合は必ず propose_choices で選択肢を出す（2件以上の依頼のときのみ）
残り件数（W）が 1 件以上、かつ元の依頼が複数件（Z ≥ 2）の場合、メッセージの**直後**に必ず propose_choices を呼ぶ。1件依頼（Z = 1）の場合はこのルールを適用しない：

\`\`\`
propose_choices({
  prompt: "残り W 件の登録をどうしますか？",
  multiSelect: false,
  choices: [
    { id: "continue", label: "続きを登録する（残り W 件）", description: "次の最大5件を引き続き登録します" },
    { id: "stop",     label: "今回はここまでにする",        description: "残りは後でいつでも依頼できます" }
  ]
})
\`\`\`

ユーザーが "continue" を選んだら次のバッチを登録し、同じパターンを繰り返す。
"stop" を選んだら「残り W 件は次回登録できます」と伝えてフローを終了する。

## 3. 1ターンで登録するのは最大 5 件まで
それ以上は propose_choices で中断し、ユーザーに続行を選んでもらう。

## 4. 全件完了したら明示的に終了を宣言する
「✅ 全 Z 件の登録が完了しました！」と伝え、propose_choices は出さない。
`;

const AI_TASK_PLAYBOOK = `
# AIタスク実行プレイブック

メッセージが「【AIタスク実行】」で始まる場合、これは Schedules & Tasks 画面から起動されたAIタスクです。

## 実行ルール
1. タスクの内容を理解し、必要なツールを呼び出して実行する。
2. 実行完了後、**必ず** task_update ツールを呼んで status を "done" に更新する。
   - projectId と taskId はメッセージ本文から取得する。
3. 完了報告は「✅ タスク「タイトル」を完了しました。」の形式で伝える。
4. タスク実行中にエラーが起きた場合は状況を説明し、status は変更しない。
`;

const GLOBAL_SESSION_PLAYBOOK = `
# グローバルセッション（マイページチャット）プレイブック

このチャットはアカウント全体のコンテキストで動作しています（特定プロジェクトに紐付いていません）。

## スケジュール・タスク操作のルール

スケジュールやタスクの**追加・確認・更新**を依頼された場合は、以下の手順に従う：

1. **最初に propose_choices でプロジェクトを選んでもらう**（task_list や task_create を先に呼ばない）
   - availableProjects は各ツールのエラーレスポンスから取得できる
   - 選択肢の形式: '{ id: "<projectId>", label: "<プロジェクト名>に追加" }'
2. ユーザーが選択したら、その projectId を使ってタスク操作を実行する
3. 既存タスクの確認（task_list）も、選択されたプロジェクトに対してのみ行う

## 重要
- プロジェクトを特定せずに task_list や task_create を呼ぶと必ずエラーになる
- propose_choices を先に出すことでユーザー体験が向上する
`;

// ─── agentTurn ツール名 → クライアント実行 ────────────────────────────────
async function dispatchAgentTool(name: string, input: any, dispatch: Function, sessionId?: string | null): Promise<any> {
  const siteStore = (await import('./useProjectSiteStore')).useProjectSiteStore.getState();
  const { buildSiteSnapshot: snap } = await import('../features/sites/siteSnapshot');
  const { listProjectAssets } = await import('../features/sites/projectAssetsApi');
  const { useAppStore } = await import('./useAppStore');
  // チャットセッションのprojectId参照用（require不可なのでtop-levelでimport）
  const { useAIChatStore } = await import('./useAIChatStore');

  /**
   * スケジュール・タスク・プロジェクト系ツール専用の projectId 解決ヘルパー。
   * 優先度: input.projectId → session.projectId → site project id → active project id
   */
  const resolveProjectId = (inputPid?: string): string | undefined => {
    if (inputPid && inputPid !== '-') return inputPid;
    // チャットセッションのprojectIdが最も信頼できる
    if (sessionId) {
      const session = useAIChatStore.getState().sessions.find((s: any) => s.id === sessionId);
      if (session?.projectId && session.projectId !== '__global__') return session.projectId;
      // グローバル/アカウントスコープのセッションはAppStoreへのフォールバックをしない。
      // マイページチャット等から実行した場合はプロジェクトを特定できないため undefined を返し、
      // 呼び出し元で propose_choices 等によりユーザーに確認させる。
      if (session?.projectId === '__global__') return undefined;
    }
    // セッション情報が無い場合のみ AppStore → siteStore にフォールバック
    const appStore = useAppStore.getState();
    const activeProject = appStore.getActiveProject();
    if (activeProject) return activeProject.id;
    if (siteStore.source?.kind === 'project') return siteStore.source.id;
    const projects = appStore.projects;
    if (projects.length === 1) return projects[0].id;
    return undefined;
  };

  /** projectId が解決できない場合に propose_choices でプロジェクトを選ばせるためのエラーオブジェクト */
  const makeProjectRequiredError = () => {
    const projects = useAppStore.getState().projects;
    if (projects.length === 0) return JSON.stringify({ error: 'projectId が必要ですが、プロジェクトが存在しません。先にプロジェクトを作成してください。' });
    if (projects.length === 1) return undefined; // single project は呼び出し元で resolveProjectId 再試行
    return JSON.stringify({
      error: 'projectId が特定できません。propose_choices ツールでユーザーにどのプロジェクトに追加するか確認してください。',
      availableProjects: projects.map((p: any) => ({ id: p.id, name: p.name })),
    });
  };

  // ── verb レジストリ（docs/20）優先。移行済み verb はここで実行し、未移行は下の switch へ。──
  {
    const { VERB_MAP } = await import('./verbRegistry');
    const vd = VERB_MAP.get(name);
    if (vd) {
      return await vd.handler({ input, sessionId, dispatch, resolveProjectId });
    }
  }

  switch (name) {
    case 'site_snapshot': {
      return formatSiteSnapshotForPrompt(snap());
    }
    case 'gallery_query': {
      const projectId = siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id;
      if (!projectId) return '[]';
      try {
        const assets = await listProjectAssets(projectId);
        const filtered = assets.filter(a =>
          (!input.sourceApp || a.sourceApp === input.sourceApp) &&
          (!input.kind || a.kind === input.kind)
        );
        return JSON.stringify(filtered.slice(0, 20));
      } catch { return '[]'; }
    }
    case 'local_assets_list': {
      // LocalAssets/ のファイル一覧。category / kind で絞り込み可能。
      const assets = await listLocalAssets();
      const filtered = assets.filter(a =>
        (!input?.category || a.category.toLowerCase() === String(input.category).toLowerCase()) &&
        (!input?.kind || a.kind === input.kind)
      );
      return JSON.stringify(filtered.slice(0, 100));
    }
    case 'local_assets_read': {
      // LocalAssets 内のテキスト資料を読む。relPath は local_assets_list の relPath。
      const rel = input?.relPath ?? input?.rel_path ?? input?.path;
      if (!rel) return 'relPath が必要です';
      try {
        return await readLocalAssetText(String(rel));
      } catch (e: any) {
        return e?.message || 'read failed';
      }
    }
    // ── S.Library（知識ライブラリ）連携 ──
    case 'library_list': {
      // 既存の知識一覧（重複登録チェック・参照用）。
      try {
        const { getLocalKnowledge } = await import('../features/dsk/api/knowledgeApi');
        const list = await getLocalKnowledge();
        return JSON.stringify(
          list.slice(0, 60).map((e: any) => ({
            localId: e.localId, title: e.title, kind: e.kind, category: e.category, url: e.sourceUrl || null,
          })),
        );
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'library_add_url': {
      // 製品ページ / 電子カタログの URL を S.Library に登録（kind=url）。
      const url = (input?.url || '').trim();
      if (!url) return JSON.stringify({ ok: false, error: 'url が必要です' });
      try {
        const { saveUrlToLibrary } = await import('../features/dsk/lib/libraryActions');
        const entry = await saveUrlToLibrary({
          url,
          title: input?.title || undefined,
          category: input?.category || undefined,
          tags: Array.isArray(input?.tags) ? input.tags : (input?.manufacturer ? [input.manufacturer] : undefined),
          author: input?.manufacturer || input?.author || undefined,
          snapshot: input?.snapshot !== false,
        });
        return JSON.stringify({ ok: true, localId: entry.localId, title: entry.title });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'catalog_product_search': {
      // 索引済みの実在商品（家具/テクスチャ等）をテキスト検索し、結果を共有グリッドでチャットに描画する。
      // 「1サーフェス2入口」: SEKKEIYA Search と同じ retrieval(searchCatalogByText) + ProductResultGrid を Chat 入口から利用。
      const queryText = (input?.query || input?.q || '').toString().trim();
      try {
        const { searchCatalogByText } = await import('../features/dss/catalog/searchCatalog');
        const topN = Math.min(40, Math.max(1, Number(input?.topN) || 24));
        const items = await searchCatalogByText(queryText, topN);
        if (!items.length) {
          return JSON.stringify({ ok: true, count: 0, message: '索引済み商品に一致がありませんでした。S.Libraryで家具ECを索引すると検索できます。' });
        }
        // 実データ（画像base64含む）は非永続ストアへ、チャットメッセージには参照IDのみ。
        const resultId = (globalThis.crypto?.randomUUID?.() ?? `pr_${Date.now()}`);
        const { useChatProductResultsStore } = await import('./useChatProductResultsStore');
        useChatProductResultsStore.getState().setResults(resultId, items as any);
        if (sessionId) {
          useAIChatStore.getState().addMessage({
            sessionId, role: 'ai', source: 'sidebar_chat',
            text: '', ui: { kind: 'product_results', resultId, query: queryText, count: items.length },
          });
        }
        // モデルには要約のみ返す（本文で件数や代表例にコメントできるように）。
        return JSON.stringify({
          ok: true, count: items.length, rendered: true,
          top: items.slice(0, 8).map((it: any) => ({ name: it.label, price: it.price || null, url: it.productUrl || null })),
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'web_list_links': {
      // 指定ページの実在リンク（カタログ/PDFのURL等）を列挙。捏造せずURL一覧を出すための取得手段。
      const url = (input?.url || '').trim();
      if (!url) return JSON.stringify({ ok: false, error: 'url（取得するページ）が必要です' });
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const links = await invoke<any[]>('fetch_page_links', { url, contains: input?.contains || null });
        return JSON.stringify({ ok: true, count: links.length, links: links.slice(0, 80) });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'library_add_pdf': {
      // PDF カタログ（メーカー電子カタログ等）の直リンクURLをダウンロードしてローカル保存。
      const url = (input?.url || '').trim();
      if (!url) return JSON.stringify({ ok: false, error: 'url（PDFの直リンク）が必要です' });
      try {
        const { downloadPdfToLibrary } = await import('../features/dsk/lib/libraryActions');
        const path = await downloadPdfToLibrary({ url, fileName: input?.fileName || input?.title || undefined });
        return JSON.stringify({ ok: true, path, message: 'PDFをS.Library（ローカル）に保存しました' });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'library_save_note': {
      // 調査・要約した内容を Markdown メモとして S.Library に保存。
      const md = input?.markdown ?? input?.body ?? input?.content;
      if (!input?.title || !md) return JSON.stringify({ ok: false, error: 'title と markdown が必要です' });
      try {
        const { saveNoteToLibrary } = await import('../features/dsk/lib/libraryActions');
        const entry = await saveNoteToLibrary({
          title: input.title,
          markdown: String(md),
          category: input?.category || undefined,
          tags: Array.isArray(input?.tags) ? input.tags : undefined,
        });
        return JSON.stringify({ ok: true, localId: entry.localId, title: entry.title });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'search_knowledge': {
      // エージェント型RAG: 外付け脳(S.Library/RAG)をカテゴリで絞って検索し、根拠スニペットを返す。
      const q = (input?.query || input?.q || '').toString().trim();
      if (!q) return JSON.stringify({ ok: false, error: 'query が必要です' });
      try {
        const { searchKnowledge } = await import('../features/ai-studio/lib/knowledgeSearch');
        const r = await searchKnowledge(q, input?.category || undefined, Math.min(8, Math.max(1, Number(input?.topK) || 6)));
        return JSON.stringify(r);
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'create_blog_draft': {
      // 会話の内容を記事の下書きとして S.Blog に作成し、エディタを開く（公開はユーザー確認後）。
      const md = input?.markdown ?? input?.body ?? input?.content;
      if (!input?.title || !md) return JSON.stringify({ ok: false, error: 'title と markdown が必要です' });
      try {
        const { createBlogDraftFromChat } = await import('../features/dsb/lib/blogActions');
        const article = await createBlogDraftFromChat({
          title: String(input.title),
          markdown: String(md),
          excerpt: input?.excerpt || undefined,
          category: input?.category || undefined,
          tags: Array.isArray(input?.tags) ? input.tags : undefined,
        });
        return JSON.stringify({
          ok: true, id: article.id, title: article.title, opened: true,
          message: 'S.Blog に下書きを作成し、エディタを開きました。内容を確認して公開してください。',
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'blog_list': {
      // S.Blog の既存記事を一覧取得（id/タイトル/カテゴリ/状態/抜粋）。記事編集の前に必ず呼ぶ。
      try {
        const { useAuthStore } = await import('./useAuthStore');
        const uid = useAuthStore.getState().currentUser?.uid;
        if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });
        const { listBlogArticles } = await import('../features/dsb/api/blogApi');
        const arts = await listBlogArticles(uid);
        const status = input?.status as string | undefined;
        const filtered = status && status !== 'all' ? arts.filter(a => a.status === status) : arts;
        return JSON.stringify({
          ok: true,
          count: filtered.length,
          articles: filtered.map(a => ({
            id: a.id, title: a.title, category: a.category, status: a.status,
            excerpt: a.excerpt, bodyChars: (a.bodyMarkdown || '').length,
            updatedAt: a.updatedAt,
          })),
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'blog_get': {
      // 1記事の本文(Markdown)全文を取得する。id 不一致時はタイトル部分一致でフォールバック。
      try {
        const { useAuthStore } = await import('./useAuthStore');
        const uid = useAuthStore.getState().currentUser?.uid;
        if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });
        const key = String(input?.id ?? input?.title ?? '').trim();
        if (!key) return JSON.stringify({ ok: false, error: 'id または title が必要です' });
        const { listBlogArticles } = await import('../features/dsb/api/blogApi');
        const arts = await listBlogArticles(uid);
        const a = arts.find(x => x.id === key) ?? arts.find(x => (x.title || '').includes(key));
        if (!a) return JSON.stringify({ ok: false, error: '記事が見つかりません', availableIds: arts.map(x => ({ id: x.id, title: x.title })) });
        return JSON.stringify({
          ok: true, id: a.id, title: a.title, category: a.category, status: a.status,
          tags: a.tags, excerpt: a.excerpt, bodyMarkdown: a.bodyMarkdown || '',
          // カバー画像（リサーチボード等に image カードとして置ける）
          coverUrl: a.coverUrl || null,
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }
    case 'blog_update': {
      // 既存記事の本文/タイトル/抜粋/カテゴリ/タグを更新して保存し、S.Blog エディタで開く。
      // 公開状態は変更しない（公開はユーザーのエディタ操作に委ねる）。
      try {
        const { useAuthStore } = await import('./useAuthStore');
        const uid = useAuthStore.getState().currentUser?.uid;
        if (!uid) return JSON.stringify({ ok: false, error: 'ログインが必要です' });
        const key = String(input?.id ?? input?.title ?? '').trim();
        if (!key) return JSON.stringify({ ok: false, error: 'id または title が必要です' });
        const md = input?.markdown ?? input?.body ?? input?.content;
        const { listBlogArticles, saveBlogArticle } = await import('../features/dsb/api/blogApi');
        const arts = await listBlogArticles(uid);
        const cur = arts.find(x => x.id === key) ?? arts.find(x => (x.title || '').includes(key));
        if (!cur) return JSON.stringify({ ok: false, error: '記事が見つかりません', availableIds: arts.map(x => ({ id: x.id, title: x.title })) });
        const updated = {
          ...cur,
          ...(input?.title != null ? { title: String(input.title) } : {}),
          ...(md != null ? { bodyMarkdown: String(md) } : {}),
          ...(input?.excerpt != null ? { excerpt: String(input.excerpt) } : {}),
          ...(input?.category != null ? { category: String(input.category) } : {}),
          ...(Array.isArray(input?.tags) ? { tags: input.tags } : {}),
          updatedAt: new Date().toISOString(),
        };
        await saveBlogArticle(uid, updated);
        // S.Blog を前面に出し、更新した記事をエディタで開く。
        const app = useAppStore.getState();
        app.setActiveWorkspaceId('blog');
        app.setLastActiveAppScope('3dsb');
        app.setCurrentMainView('workspace');
        const { useDsbStore } = await import('../features/dsb/store/useDsbStore');
        const dsb = useDsbStore.getState();
        await dsb.refresh(uid);
        dsb.startEdit(updated.id);
        return JSON.stringify({
          ok: true, id: updated.id, title: updated.title, opened: true,
          message: 'S.Blog の記事を更新し、エディタを開きました。内容を確認してください。',
        });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message || 'failed' });
      }
    }

    case 'create_site_from_template':
      await siteStore.createFromTemplate(input.family);
      return 'ok';
    case 'add_section':
      await dispatch('SECTION_ADD', { type: input.type, title: input.title, body: input.body });
      return 'ok';
    case 'update_section':
      await dispatch('SECTION_UPDATE', {
        sectionId: input.sectionId,
        patch: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.body !== undefined && { body: input.body }),
          ...(input.variant !== undefined && { variant: input.variant }),
        },
      });
      return 'ok';
    case 'remove_section':
      siteStore.removeSection(input.sectionId);
      return 'ok';
    case 'reorder_sections':
      siteStore.reorderSections(input.orderedIds);
      return 'ok';
    case 'add_asset_to_section': {
      // gallery_query の結果 id から SiteAssetRef を再構築して追加。
      const projectId2 = siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id;
      if (!projectId2) return 'no project';
      const assets2 = await listProjectAssets(projectId2);
      const asset = assets2.find(a => a.id === input.assetId);
      if (!asset) return 'asset not found';
      siteStore.addAssetToSection(input.sectionId, asset);
      return 'ok';
    }
    case 'set_theme':
      siteStore.setPersonality(input.personality);
      return 'ok';
    case 'set_motion': {
      // スクロールモーションのオーバーライド。'auto'/未指定 = 人格の既定に戻す（null）。
      const mode = (input.mode === 'auto' || input.mode == null) ? null : input.mode;
      siteStore.setMotionOverride(mode);
      return 'ok';
    }
    // ── デザイン拡張ツール（バンドル / レイアウトプリセット / モーションプリセット）
    //    サーバ(agentTurn)側でスキーマ公開されれば LLM から呼べる。前方互換で実装。
    case 'apply_bundle':
      siteStore.applyBundle(input.bundleId ?? input.id);
      return 'ok';
    case 'apply_layout_preset':
      siteStore.applyLayoutPreset(input.presetId ?? input.id);
      return 'ok';
    case 'apply_motion_preset':
      siteStore.applyMotionPreset(input.presetId ?? input.id);
      return 'ok';
    case 'subapp_guide': {
      // 欠落アセットの補完先を提案。ユーザーが「開いて」等と返答するまでは遷移しない。
      // 戻り値に誘導先の説明を含め、次ターンでユーザーが承諾したら OPEN_WORKSPACE を呼ぶ。
      const APP_LABEL: Record<string, string> = {
        '3dss': 'S.Model', '3dsl': 'S.Layout', '3dsp': 'S.Slide',
        '3dsc': 'S.Create', '3dsd': 'S.Diagram', '3dsr': 'S.Drawing',
        '3dsi': 'S.Image', '3dsf': 'S.Portfolio',
      };
      return JSON.stringify({
        guided: true,
        target: input.target,
        appLabel: APP_LABEL[input.target] ?? input.target,
        reason: input.reason,
      });
    }
    // ─── S.Diagram (3dsd) ツール（docs/12 §4）────────────────────────────────
    case 'dsd_create_diagram': {
      const projectId = input.projectId ?? siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id;
      if (!projectId) return 'no project';
      const template = (input.template ?? 'layout') as DiagramTemplate;
      const title = input.title ?? '新規ダイアグラム';

      const { defaultDiagramState, applySpecToStore } = await import('../features/dsd/manim/diagramSpecBridge');
      const { saveDsdDiagramState } = await import('../features/dsd/library/dsdDiagramService');

      const state = defaultDiagramState(template, title);
      const diagramId = await saveDsdDiagramState(projectId, state);

      // canvas（useDsdStore）へ反映し、タスク Chat セッションを用意。
      applySpecToStore(state as any);
      const { useAIChatStore } = await import('./useAIChatStore');
      useAIChatStore.getState().getOrCreateTaskSession(projectId, '3dsd', diagramId, title);

      return JSON.stringify({ ok: true, diagramId, template, title });
    }

    case 'dsd_patch_spec': {
      const projectId = siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id;
      const { applySpecToStore, patchStore, storeToSerializable } = await import('../features/dsd/manim/diagramSpecBridge');

      // 完全 spec（新規生成）か patch（部分更新）か。
      let merged;
      if (input.spec) {
        applySpecToStore(input.spec);
        merged = { ...storeToSerializable(), ...input.spec };
      } else if (input.patch) {
        merged = patchStore(input.patch);
      } else {
        return 'spec か patch のいずれかが必要です';
      }

      // 永続化（diagramId が分かれば更新、無ければ現セッションの taskId を試す）。
      let diagramId = input.diagramId as string | undefined;
      if (!diagramId) {
        const { useAIChatStore } = await import('./useAIChatStore');
        const active = useAIChatStore.getState();
        diagramId = active.sessions.find(s => s.id === active.activeSessionId)?.taskId;
      }
      if (projectId && diagramId) {
        try {
          const { saveDsdDiagramState } = await import('../features/dsd/library/dsdDiagramService');
          await saveDsdDiagramState(projectId, merged as any, diagramId);
        } catch (e) { console.warn('[dsd_patch_spec] save skipped:', e); }
      }
      return JSON.stringify({ ok: true, diagramId: diagramId ?? null, applied: true });
    }

    case 'dsd_render_manim': {
      const { storeToSerializable } = await import('../features/dsd/manim/diagramSpecBridge');
      const { renderManimDiagram } = await import('../features/dsd/manim/renderManimService');
      const spec = storeToSerializable();
      try {
        const result = await renderManimDiagram(spec as any, {
          format: input.format ?? 'mp4',
          quality: input.quality ?? 'h',
        });
        return JSON.stringify({ ok: true, ...result });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message ?? 'render failed' });
      }
    }

    // ─── S.Movie v0 自動編集（docs/14 Step 2）───────────────────────────────
    //     サーバ(agentTurn)側でスキーマ公開されれば LLM から呼べる。前方互換で実装。
    case 'movie_sequence_snapshot': {
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      const s = useDsmStore.getState();
      return JSON.stringify({
        clips: s.clips.map((c, i) => ({
          id: c.id, label: c.label ?? null, path: c.path, index: i,
          durationSec: c.durationSec || null, trim: c.trim ?? null,
          transitionAfter: c.transitionAfter ?? null,
        })),
        bgm: s.bgm, overlays: s.overlays, aspect: s.aspect,
        isExporting: s.isExporting, lastOutputPath: s.lastOutputPath,
      });
    }
    case 'movie_add_cut': {
      const path = input?.path;
      if (!path) return JSON.stringify({ ok: false, error: 'path が必要です' });
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      const trim = input.trimInSec != null && input.trimOutSec != null
        ? { inSec: Number(input.trimInSec), outSec: Number(input.trimOutSec) }
        : undefined;
      const id = useDsmStore.getState().addClip(
        { path: String(path), label: input.label, trim },
        input.position != null ? Number(input.position) : undefined,
      );
      return JSON.stringify({ ok: true, clipId: id });
    }
    case 'movie_reorder_cuts': {
      const order: string[] = Array.isArray(input?.order) ? input.order : [];
      if (order.length === 0) return JSON.stringify({ ok: false, error: 'order が空です' });
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      useDsmStore.getState().reorderClips(order);
      return JSON.stringify({ ok: true });
    }
    case 'movie_set_transition': {
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      const s = useDsmStore.getState();
      const type = (input?.type ?? 'xfade') as 'cut' | 'xfade' | 'fade';
      const durationSec = input?.durationSec != null ? Number(input.durationSec) : 1.0;
      // clipId 省略時は「全カット間」に一括適用（チャットの自然な指示に対応）
      const targets: string[] = input?.clipId ? [String(input.clipId)] : s.clips.slice(0, -1).map(c => c.id);
      targets.forEach(id => s.setTransition(id, { type, durationSec }));
      return JSON.stringify({ ok: true, applied: targets.length });
    }
    case 'movie_set_bgm': {
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      useDsmStore.getState().setBgm(
        input?.path ? { path: String(input.path), volume: input.volume != null ? Number(input.volume) : undefined } : null,
      );
      return JSON.stringify({ ok: true });
    }
    case 'movie_add_title': {
      if (!input?.text) return JSON.stringify({ ok: false, error: 'text が必要です' });
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      useDsmStore.getState().addOverlay({
        type: 'title',
        text: String(input.text),
        atSec: input.atSec != null ? Number(input.atSec) : 0,
        durationSec: input.durationSec != null ? Number(input.durationSec) : 3,
        position: input.position,
      });
      return JSON.stringify({ ok: true });
    }
    case 'movie_export': {
      const { useDsmStore } = await import('../features/dsm/store/useDsmStore');
      const s = useDsmStore.getState();
      if (input?.aspect === '16:9' || input?.aspect === '9:16') s.setAspect(input.aspect);
      try {
        const out = await useDsmStore.getState().exportDraft(input?.outputPath);
        return JSON.stringify({ ok: true, outputPath: out });
      } catch (e: any) {
        return JSON.stringify({ ok: false, error: e?.message ?? String(e) });
      }
    }

    // ─── 3D一括生成（image → 3D model）──────────────────────────────
    case 'start_3d_generation': {
      const ids: string[] = Array.isArray(input?.imageIds) ? input.imageIds : [];
      if (ids.length === 0) return JSON.stringify({ ok: false, error: 'imageIds が空です' });

      const { useImagePickerStore } = await import('./useImagePickerStore');
      let items = useImagePickerStore.getState().resolveUrls(ids);

      // ピッカーキャッシュに無いIDは Firestore から downloadUrl を解決（フォールバック）。
      if (items.length < ids.length) {
        const projectId = siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id;
        if (projectId) {
          try {
            const { collection, getDocs, query, where } = await import('firebase/firestore');
            const { db } = await import('../lib/firebase/client');
            const snap = await getDocs(query(
              collection(db, `projects/${projectId}/workFiles`),
              where('appScope', '==', '3dsi'),
            ));
            const found = new Map(items.map(i => [i.id, i]));
            snap.docs.forEach(d => {
              const data: any = d.data();
              if (ids.includes(d.id) && !found.has(d.id) && data.downloadUrl) {
                found.set(d.id, { id: d.id, downloadUrl: data.downloadUrl });
              }
            });
            items = ids.map(id => found.get(id)).filter((x): x is { id: string; downloadUrl: string } => !!x);
          } catch (e) {
            console.warn('[start_3d_generation] url resolve fallback failed:', e);
          }
        }
      }

      if (items.length === 0) return JSON.stringify({ ok: false, error: '対象画像のURLを解決できませんでした' });

      const provider = input?.provider || 'tripo3d';
      const projectId = siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id ?? null;
      const { useBatchGenStore } = await import('./useBatchGenStore');
      const { batchId, total, skipped } = await useBatchGenStore.getState().startBatch(items, { provider, projectId });

      // バッチ開始後の残り枠を計算してツール結果に含める
      let remainingAfter = '不明';
      try {
        const { useAuthStore: useAuthStore3d } = await import('./useAuthStore');
        const uid3d = useAuthStore3d.getState().currentUser?.uid;
        if (uid3d) {
          const { doc: fsDoc3d, getDoc: fsGet3d } = await import('firebase/firestore');
          const { db: db3d } = await import('../lib/firebase/client');
          const { AI_3D_LIMITS } = await import('../features/ai-studio/constants/ai-model-plans');
          const snap3d = await fsGet3d(fsDoc3d(db3d, 'users', uid3d));
          if (snap3d.exists()) {
            const d3d = snap3d.data() as any;
            const plan3d = (d3d.plan || 'free') as string;
            const limit3d = (AI_3D_LIMITS as any)[plan3d]?.tripo3d?.monthly;
            if (limit3d === Infinity) {
              remainingAfter = '無制限';
            } else if (typeof limit3d === 'number') {
              const nowR = new Date();
              const monthStr = `${nowR.getFullYear()}-${String(nowR.getMonth() + 1).padStart(2, '0')}`;
              const usageR = d3d.aiUsage?.tripo3d || {};
              const usedR = usageR.lastMonthlyResetAt === monthStr ? (usageR.monthlyCount || 0) : 0;
              remainingAfter = `${Math.max(0, limit3d - usedR)}件`;
            }
          }
        }
      } catch { /* 取得失敗は無視 */ }

      // チャットにバッチ開始カードを表示。
      const { useAIChatStore } = await import('./useAIChatStore');
      const chat = useAIChatStore.getState();
      if (chat.activeSessionId) {
        chat.addMessage({
          sessionId: chat.activeSessionId, role: 'ai', source: 'sidebar_chat', text: '',
          ui: { kind: 'batch_started', batchId, total, skipped },
        });
      }
      return JSON.stringify({ ok: true, batchId, total, accepted: total - skipped, skipped, remainingAfter });
    }

    // ─── マテリアル生成フロー ────────────────────────────────────────────────
    case 'start_material_generation': {
      let sourcesJson: string = '';
      try { sourcesJson = typeof input?.sources === 'string' ? input.sources : JSON.stringify(input?.sources ?? {}); }
      catch { sourcesJson = '{}'; }

      let sources: any;
      try { sources = JSON.parse(sourcesJson); }
      catch { return JSON.stringify({ ok: false, error: 'sources parse error' }); }

      if (!sources.destination) {
        sources.destination = { type: 'current_project', visibility: 'private' };
      }

      const activeProjectId = siteStore.source?.id ?? useAppStore.getState().getActiveProject()?.id ?? null;
      const destPid =
        sources.destination?.type === 'other_project' && sources.destination?.projectId
          ? sources.destination.projectId
          : activeProjectId;
      if (!destPid) return JSON.stringify({ ok: false, error: 'プロジェクトが選択されていません' });

      // 既存マテリアル一覧を取得
      let existingMaterials: any[] = [];
      try {
        const { collection: col2, getDocs: gd2 } = await import('firebase/firestore');
        const { db: db2 } = await import('../lib/firebase/client');
        const snap2 = await gd2(col2(db2, `projects/${destPid}/materials`));
        existingMaterials = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) { console.warn('[start_material_generation] fetch existing failed', e); }

      const { useMaterialGenStore } = await import('../features/dsmt/store/useMaterialGenStore');
      const genStore = useMaterialGenStore.getState();
      genStore.setGenerating(true);
      genStore.setProgress({ current: 0, total: 0, label: '準備中...' });

      const { generateMaterialsFromSources } = await import('../features/dsmt/data/imageMaterialGen');
      let result: { ok: boolean; created: number; skipped: number; groups: number; reason?: string };
      try {
        result = await generateMaterialsFromSources(
          destPid,
          sources,
          existingMaterials,
          (current, total, label) => genStore.setProgress({ current, total, label }),
        );
      } finally {
        genStore.setGenerating(false);
        genStore.setProgress(null);
      }

      const { useAIChatStore: useAIChatStoreMat } = await import('./useAIChatStore');
      const chatMat = useAIChatStoreMat.getState();
      if (chatMat.activeSessionId) {
        chatMat.addMessage({
          sessionId: chatMat.activeSessionId, role: 'ai', source: 'sidebar_chat', text: '',
          ui: { kind: 'material_gen_done', created: result.created, skipped: result.skipped, totalGroups: result.groups },
        });
      }
      return JSON.stringify({ ok: result.ok, created: result.created, skipped: result.skipped });
    }

    // ─── 家具選定フロー ──────────────────────────────────────────────────────
    case 'furniture_catalog_search': {
      const { scope, roomType, style, maxResults = 30 } = input as {
        scope: 'explore' | 'following' | 'my_public' | 'my_private';
        projectId?: string;
        roomType?: string;
        style?: string;
        maxResults?: number;
      };
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) return JSON.stringify({ error: 'ログインが必要です' });

      const { collection, getDocs, query, where, limit, and: fsAnd, or: fsOr } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');

      const assetsCol = collection(db, 'assets');
      const isPublicFilter = fsOr(where('visibility', '==', 'public'), where('isPublic', '==', true));
      const isModelFilter = where('type', '==', '3d-model');

      const summarize = (m: any) => ({
        id: m.id,
        name: m.title || m.name || 'Untitled',
        category: m.category || '',
        tags: (m.tags || []).slice(0, 6),
        rooms: m.rooms || [],
        thumbnailUrl: m.thumbnailUrl || m.thumbUrl || m.coverUrl || '',
        dimensions: m.dimensions || null,
      });

      const matchesFilter = (m: any) => {
        const haystack = [
          ...(m.tags || []),
          ...(m.rooms || []),
          ...(m.zones || []),
          m.category || '',
        ].map((s: string) => s.toLowerCase());
        if (roomType && !haystack.some(h => h.includes(roomType.toLowerCase()))) return false;
        if (style && !haystack.some(h => h.includes(style.toLowerCase()))) return false;
        return true;
      };

      // 3Dモデルが0件のとき、S.Library の索引済み実在商品グリッドにフォールバック表示する。
      const renderCatalogFallback = async (): Promise<string | null> => {
        try {
          const { searchCatalogByText } = await import('../features/dss/catalog/searchCatalog');
          const fq = [style, roomType].filter(Boolean).join(' ').trim();
          let cat = await searchCatalogByText(fq, 24);
          if (!cat.length) cat = await searchCatalogByText('', 24); // ブラウズ（先頭）
          if (!cat.length) return null;
          const resultId = (globalThis.crypto?.randomUUID?.() ?? `pr_${Date.now()}`);
          const { useChatProductResultsStore } = await import('./useChatProductResultsStore');
          useChatProductResultsStore.getState().setResults(resultId, cat as any);
          if (sessionId) {
            useAIChatStore.getState().addMessage({
              sessionId, role: 'ai', source: 'sidebar_chat', text: '',
              ui: { kind: 'product_results', resultId, query: fq || '家具', count: cat.length },
            });
          }
          return JSON.stringify({
            ok: true, modelCount: 0, fallback: 'catalog_products', count: cat.length, rendered: true,
            note: '公開3Dモデルが0件のため、索引済みの実在商品を表示しました。各商品から購入や「3Dモデルを生成」ができます。',
          });
        } catch { return null; }
      };
      // モデル配列が空なら実在商品にフォールバック。
      const finish = async (arr: any[]): Promise<string> => {
        if (arr.length > 0) return JSON.stringify(arr);
        return (await renderCatalogFallback()) ?? JSON.stringify(arr);
      };

      try {
        if (scope === 'following') {
          const followingSnap = await getDocs(collection(db, 'users', uid, 'following'));
          const followedUids = followingSnap.docs.map(d => d.id);
          if (followedUids.length === 0) return await finish([]);
          const results: any[] = [];
          const BATCH = 10;
          for (let i = 0; i < Math.min(followedUids.length, 30); i += BATCH) {
            const batch = followedUids.slice(i, i + BATCH);
            const bQ = query(assetsCol, fsAnd(isModelFilter, isPublicFilter, where('ownerId', 'in', batch)), limit(maxResults * 2));
            const snap = await getDocs(bQ);
            snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
          }
          return await finish(results.filter(matchesFilter).slice(0, maxResults).map(summarize));
        }

        let q;
        if (scope === 'explore') {
          q = query(assetsCol, fsAnd(isModelFilter, isPublicFilter), limit(maxResults * 3));
        } else if (scope === 'my_public') {
          q = query(assetsCol, fsAnd(isModelFilter, isPublicFilter, where('ownerId', '==', uid)), limit(maxResults * 3));
        } else {
          q = query(assetsCol, where('type', '==', '3d-model'), where('visibility', '==', 'private'), where('ownerId', '==', uid), limit(maxResults * 3));
        }
        const snap = await getDocs(q);
        const models = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return await finish(models.filter(matchesFilter).slice(0, maxResults).map(summarize));
      } catch (e: any) {
        return JSON.stringify({ error: e?.message || 'search failed' });
      }
    }

    case 'add_furniture_to_project': {
      const {
        modelIds,
        scope: logScope,
        roomType: logRoomType,
        style: logStyle,
        selectionMode: logSelectionMode,
      } = input as {
        projectId?: string;
        modelIds: string[];
        scope?: string;
        roomType?: string;
        style?: string;
        selectionMode?: 'auto' | 'manual';
      };
      // 他のプロジェクト系ツールと同様に projectId を解決する。
      // 解決できないとき（複数プロジェクトでアクティブ未確定など）は、単に失敗を返すのではなく
      // propose_choices でユーザーにプロジェクトを選んでもらうためのエラーを返す。
      const targetProjectId = resolveProjectId(input.projectId);
      if (!targetProjectId) {
        return makeProjectRequiredError() ?? JSON.stringify({ ok: false, error: 'projectId が必要です' });
      }
      if (!Array.isArray(modelIds) || modelIds.length === 0) {
        return JSON.stringify({ ok: false, error: 'modelIds が必要です' });
      }
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid || 'unknown';
      const { projectAssetsApi } = await import('../features/projects/api/projectAssetsApi');
      const { doc: fsDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');

      let added = 0;
      const errors: string[] = [];
      const selectedCategories: string[] = [];

      for (const modelId of modelIds) {
        try {
          const snap = await getDoc(fsDoc(db, 'assets', modelId));
          if (!snap.exists()) { errors.push(`${modelId}: not found`); continue; }
          const model = { id: snap.id, ...(snap.data() as any) };
          await projectAssetsApi.saveAssetToProject(targetProjectId, model, uid);
          if (model.category) selectedCategories.push(model.category);
          added++;
        } catch (e: any) {
          errors.push(`${modelId}: ${e?.message || 'error'}`);
        }
      }

      // Layer 1: 行動ログを記録する。
      if (added > 0 && uid !== 'unknown') {
        const { logFurnitureSelection } = await import('../features/ai/furnitureUserLog');
        logFurnitureSelection(uid, {
          projectId: targetProjectId,
          scope: logScope || 'unknown',
          roomType: logRoomType,
          style: logStyle,
          selectedIds: modelIds,
          selectedCategories: [...new Set(selectedCategories)],
          selectionMode: logSelectionMode || 'auto',
          addedCount: added,
        });
      }

      // 追加完了後、S.Model（プロジェクトモデル）を自動で開く。
      if (added > 0) {
        try {
          const appStore = useAppStore.getState();
          appStore.setActiveProjectId(targetProjectId);
          appStore.setModelsScope('project_models');
          const { launchWorkspace } = await import('../features/launcher/launchWorkspace');
          await launchWorkspace({ appScope: '3dss', projectId: targetProjectId, workspaceId: 'models', workspaceName: 'S.Model' });
        } catch (e) {
          console.warn('[add_furniture_to_project] auto-navigate to S.Model failed:', e);
        }
      }

      return JSON.stringify({ ok: true, added, total: modelIds.length, ...(errors.length ? { errors } : {}) });
    }

    // ─── 自動レイアウトフロー ─────────────────────────────────────────────────
    // layout_list / layout_get / get_layout_outputs / layout_create / run_auto_layout は
    // verbRegistry（features/dsl/layout/chat/layoutVerbs.ts）へ移行済み（docs/20 Batch 1）。

    // ─── Google Calendar コネクタ ─────────────────────────────────────────────
    case 'gcal_list_events':
    case 'gcal_create_event':
    case 'gcal_update_event':
    case 'gcal_delete_event':
    case 'gcal_list_calendars': {
      const { useConnectorStore }     = await import('../features/connectors/useConnectorStore');
      const { refreshGoogleToken }    = await import('../features/connectors/google/googleCalendarOAuth');
      const { useAuthStore: authSt }  = await import('./useAuthStore');
      const uid = authSt.getState().currentUser?.uid ?? '';
      if (!uid) return JSON.stringify({ error: 'ログインが必要です' });

      const getValidToken = useConnectorStore.getState().getValidToken;
      const accessToken   = await getValidToken('google_calendar', refreshGoogleToken, uid);
      if (!accessToken) return JSON.stringify({ error: 'Google Calendar が接続されていません。設定 > コネクタ から Google Calendar を接続してください。' });

      const {
        listEvents, createEvent, updateEvent, deleteEvent, listCalendars,
      } = await import('../features/connectors/google/googleCalendarApi');

      try {
        if (name === 'gcal_list_calendars') {
          const result = await listCalendars(accessToken);
          const calendars = (result.items ?? []).map((c: any) => ({ id: c.id, summary: c.summary, primary: c.primary }));
          return JSON.stringify({ calendars });
        }

        if (name === 'gcal_list_events') {
          const result = await listEvents(accessToken, {
            calendarId: input.calendarId,
            timeMin:    input.timeMin,
            timeMax:    input.timeMax,
            q:          input.q,
            maxResults: input.maxResults,
          });
          const events = (result.items ?? []).map((e: any) => ({
            id:    e.id,
            summary: e.summary,
            start: e.start?.dateTime ?? e.start?.date,
            end:   e.end?.dateTime   ?? e.end?.date,
            description: e.description,
            location: e.location,
            colorId: e.colorId,
          }));
          return JSON.stringify({ count: events.length, events });
        }

        if (name === 'gcal_create_event') {
          const start = input.startDateTime
            ? { dateTime: input.startDateTime, timeZone: 'Asia/Tokyo' }
            : { date: input.startDate };
          const end   = input.endDateTime
            ? { dateTime: input.endDateTime, timeZone: 'Asia/Tokyo' }
            : { date: input.endDate ?? input.startDate };
          const created = await createEvent(accessToken, {
            calendarId:  input.calendarId,
            summary:     input.summary,
            description: input.description,
            start,
            end,
            colorId:  input.colorId,
            location: input.location,
          });
          return JSON.stringify({ ok: true, id: created.id, summary: created.summary, htmlLink: created.htmlLink });
        }

        if (name === 'gcal_update_event') {
          const patch: any = {};
          if (input.summary)     patch.summary     = input.summary;
          if (input.description) patch.description = input.description;
          if (input.colorId)     patch.colorId     = input.colorId;
          if (input.location)    patch.location    = input.location;
          if (input.startDateTime) patch.start = { dateTime: input.startDateTime, timeZone: 'Asia/Tokyo' };
          else if (input.startDate) patch.start = { date: input.startDate };
          if (input.endDateTime)   patch.end   = { dateTime: input.endDateTime,   timeZone: 'Asia/Tokyo' };
          else if (input.endDate)   patch.end   = { date: input.endDate };
          const updated = await updateEvent(accessToken, { ...patch, eventId: input.eventId, calendarId: input.calendarId });
          return JSON.stringify({ ok: true, id: updated.id, summary: updated.summary });
        }

        if (name === 'gcal_delete_event') {
          await deleteEvent(accessToken, input.calendarId, input.eventId);
          return JSON.stringify({ ok: true });
        }
      } catch (e: any) {
        return JSON.stringify({ error: e?.message ?? 'Google Calendar API error' });
      }
      return JSON.stringify({ error: 'unknown gcal tool' });
    }

    // ─── スケジュール・タスク管理 ─────────────────────────────────────────────
    case 'schedule_list': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId) return makeProjectRequiredError() ?? JSON.stringify({ error: 'projectId が必要です' });
      const { collection: col, getDocs: gDocs, orderBy: ord, query: fsq } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      try {
        const snap = await gDocs(fsq(col(db, 'projects', projectId, 'schedules'), ord('dueDate', 'asc')));
        const schedules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return JSON.stringify({ projectId, schedules });
      } catch (e: any) { return JSON.stringify({ error: e?.message }); }
    }

    case 'schedule_create': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId) return makeProjectRequiredError() ?? JSON.stringify({ error: 'projectId が必要です' });
      const { collection: col, addDoc: aDoc, serverTimestamp: sts, getDocs: gDocs, query: fsq, where: fsWhere } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid ?? 'unknown';
      try {
        // 重複チェック: title のみで検索（複合インデックス不要）→ dueDate はメモリ内照合
        if (input.title && input.dueDate) {
          try {
            const titleSnap = await gDocs(fsq(
              col(db, 'projects', projectId, 'schedules'),
              fsWhere('title', '==', input.title),
            ));
            const dup = titleSnap.docs.find(d => d.data().dueDate === input.dueDate);
            if (dup) {
              return JSON.stringify({ ok: true, duplicate: true, id: dup.id, title: input.title, dueDate: input.dueDate, message: '既に同名・同日の予定が存在するためスキップしました' });
            }
          } catch { /* 重複チェック失敗は無視して登録を続行 */ }
        }
        const ref = await aDoc(col(db, 'projects', projectId, 'schedules'), {
          title:       input.title,
          description: input.description ?? '',
          dueDate:     input.dueDate,
          startTime:   input.startTime ?? '',
          endTime:     input.endTime ?? '',
          type:        input.type ?? 'other',
          status:      'upcoming',
          createdAt:   sts(),
          createdBy:   uid,
          updatedAt:   sts(),
        });
        return JSON.stringify({ ok: true, id: ref.id, title: input.title, dueDate: input.dueDate });
      } catch (e: any) { return JSON.stringify({ ok: false, error: e?.message }); }
    }

    case 'schedule_update': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId || !input.scheduleId) return JSON.stringify({ error: 'projectId と scheduleId が必要です' });
      const { doc: fsDoc, updateDoc: upDoc, serverTimestamp: sts } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid ?? 'unknown';
      const patch: Record<string, any> = { updatedAt: sts(), updatedBy: uid };
      if (input.title !== undefined)       patch.title = input.title;
      if (input.dueDate !== undefined)     patch.dueDate = input.dueDate;
      if (input.type !== undefined)        patch.type = input.type;
      if (input.startTime !== undefined)   patch.startTime = input.startTime;
      if (input.endTime !== undefined)     patch.endTime = input.endTime;
      if (input.status !== undefined)      patch.status = input.status;
      if (input.description !== undefined) patch.description = input.description;
      try {
        await upDoc(fsDoc(db, 'projects', projectId, 'schedules', input.scheduleId), patch);
        return JSON.stringify({ ok: true, scheduleId: input.scheduleId });
      } catch (e: any) { return JSON.stringify({ ok: false, error: e?.message }); }
    }

    case 'schedule_delete': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId || !input.scheduleId) return JSON.stringify({ error: 'projectId と scheduleId が必要です' });
      const { doc: fsDoc, deleteDoc: dDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      try {
        await dDoc(fsDoc(db, 'projects', projectId, 'schedules', input.scheduleId));
        return JSON.stringify({ ok: true });
      } catch (e: any) { return JSON.stringify({ ok: false, error: e?.message }); }
    }

    case 'task_list': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId) return makeProjectRequiredError() ?? JSON.stringify({ error: 'projectId が必要です' });
      const { collection: col, getDocs: gDocs, orderBy: ord, query: fsq } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      try {
        const snap = await gDocs(fsq(col(db, 'projects', projectId, 'tasks'), ord('createdAt', 'asc')));
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return JSON.stringify({ projectId, tasks });
      } catch (e: any) { return JSON.stringify({ error: e?.message }); }
    }

    case 'task_create': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId) return makeProjectRequiredError() ?? JSON.stringify({ error: 'projectId が必要です' });
      const { collection: col, addDoc: aDoc, serverTimestamp: sts } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid ?? 'unknown';
      try {
        const ref = await aDoc(col(db, 'projects', projectId, 'tasks'), {
          title:       input.title,
          description: input.description ?? '',
          type:        input.type ?? 'manual',
          priority:    input.priority ?? 'medium',
          status:      'todo',
          dueDate:     input.dueDate ?? '',
          startTime:   input.startTime ?? '',
          endTime:     input.endTime ?? '',
          assigneeUid:  input.assigneeUid ?? '',
          assigneeName: input.assigneeName ?? '',
          createdAt:   sts(),
          createdBy:   uid,
          updatedAt:   sts(),
        });
        // 担当者が自分以外なら割り当て通知を送る（失敗は登録自体に影響させない）
        if (input.assigneeUid && input.assigneeUid !== uid) {
          notifyTaskAssigned({
            assigneeUid: input.assigneeUid,
            projectId,
            taskId: ref.id,
            taskTitle: input.title ?? '',
            fromUid: uid,
          }).catch(() => {});
        }
        return JSON.stringify({ ok: true, id: ref.id, title: input.title, assigneeName: input.assigneeName ?? undefined });
      } catch (e: any) { return JSON.stringify({ ok: false, error: e?.message }); }
    }

    case 'task_update': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId || !input.taskId) return JSON.stringify({ error: 'projectId と taskId が必要です' });
      const { doc: fsDoc, updateDoc: upDoc, serverTimestamp: sts } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      const { useAuthStore } = await import('./useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid ?? 'unknown';
      const patch: Record<string, any> = { updatedAt: sts(), updatedBy: uid };
      if (input.title !== undefined)       patch.title = input.title;
      if (input.type !== undefined)        patch.type = input.type;
      if (input.priority !== undefined)    patch.priority = input.priority;
      if (input.status !== undefined)      patch.status = input.status;
      if (input.dueDate !== undefined)     patch.dueDate = input.dueDate;
      if (input.startTime !== undefined)   patch.startTime = input.startTime;
      if (input.endTime !== undefined)     patch.endTime = input.endTime;
      if (input.description !== undefined) patch.description = input.description;
      if (input.assigneeUid !== undefined)  patch.assigneeUid = input.assigneeUid;
      if (input.assigneeName !== undefined) patch.assigneeName = input.assigneeName;
      try {
        await upDoc(fsDoc(db, 'projects', projectId, 'tasks', input.taskId), patch);
        if (input.assigneeUid && input.assigneeUid !== uid) {
          notifyTaskAssigned({
            assigneeUid: input.assigneeUid,
            projectId,
            taskId: input.taskId,
            taskTitle: input.title ?? '',
            fromUid: uid,
          }).catch(() => {});
        }
        return JSON.stringify({ ok: true, taskId: input.taskId });
      } catch (e: any) { return JSON.stringify({ ok: false, error: e?.message }); }
    }

    case 'task_delete': {
      const projectId = resolveProjectId(input.projectId);
      if (!projectId || !input.taskId) return JSON.stringify({ error: 'projectId と taskId が必要です' });
      const { doc: fsDoc, deleteDoc: dDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase/client');
      try {
        await dDoc(fsDoc(db, 'projects', projectId, 'tasks', input.taskId));
        return JSON.stringify({ ok: true });
      } catch (e: any) { return JSON.stringify({ ok: false, error: e?.message }); }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Phase A の legacy フォールバック（agentTurn 不可時）─────────────────
async function fallbackToLegacy(text: string, options: any, sessionId: string | null, aborted?: () => boolean): Promise<OrchestratorResponse> {
  const { parseSiteEditIntent } = await import('./siteEditIntent');
  const { useAIChatStore } = await import('./useAIChatStore');
  const aiChatStore = useAIChatStore.getState();
  const siteSnapshot = buildSiteSnapshot();
  const { useAiProfileStore } = await import('./useAiProfileStore');

  try {
    const activeProfile = useAiProfileStore.getState().aiProfiles.find(p => p.status === 'Active');
    const systemPrompt = activeProfile
      ? await useAiProfileStore.getState().buildCompleteSystemPrompt(activeProfile.id)
      : '';
    const siteSnapshotText = formatSiteSnapshotForPrompt(siteSnapshot);

    const proposeActionFn = httpsCallable(functions, 'proposeDesktopAction');
    const res = await proposeActionFn({ systemPromptContext: `${systemPrompt}\n\n${siteSnapshotText}`, userMessage: text });
    if (aborted?.()) return { intent: 'RESPOND_CHAT', actionType: 'NONE', assistantMessage: '', payload: {} };
    const resultObj = (res.data as any).result as any;

    let actionType = resultObj.actionType || 'RESPOND_CHAT';
    let aiResponseText = resultObj.assistantMessage || '処理を完了しました。';
    let payload = resultObj.payload || {};

    if (siteSnapshot.exists) {
      const siteIntent = parseSiteEditIntent(text, aiResponseText);
      if (siteIntent) { actionType = siteIntent.actionType; payload = siteIntent.payload; aiResponseText = siteIntent.reply; }
    }

    if (sessionId && !aborted?.()) aiChatStore.addMessage({ sessionId, role: 'ai', text: aiResponseText, source: options?.source || 'sidebar_chat' });

    return { intent: 'RESPOND_CHAT', actionType, assistantMessage: aiResponseText, payload, requiresConfirmation: false, riskLevel: 'low' };
  } catch {
    if (aborted?.()) return { intent: 'RESPOND_CHAT', actionType: 'NONE', assistantMessage: '', payload: {} };
    const errorText = 'API通信に失敗しました。時間をおいて再試行してください。';
    if (sessionId) aiChatStore.addMessage({ sessionId, role: 'ai', text: errorText, source: options?.source || 'sidebar_chat' });
    return { intent: 'RESPOND_CHAT', actionType: 'NONE', assistantMessage: errorText };
  }
}
