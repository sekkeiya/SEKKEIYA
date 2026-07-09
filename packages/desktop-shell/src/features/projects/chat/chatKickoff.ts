// UIボタン（例:「SEKKEIYA OS に相談」）からのオーケストレーター・キックオフを、
// 「チャットが実際にある窓」で実行するためのブリッジ。
//
// SEKKEIYA OS をポップアウト窓へ切り出している間（useAppStore.isChatPoppedOut）は、本体で
// オーケストレーターを回しても会話は本体に出ず（本体パネルは畳んでいる）、ポップアウト窓にも
// 届かない。そこで本体はキックオフをポップアウト窓へ委譲（emit）し、窓側が自分のコンテキストで
// オーケストレーターを実行して対話を始める。切り出していないときは従来どおり本体で実行する。
import { useAppStore } from '../../../store/useAppStore';
import type { OrchestratorSource } from '../../../store/useCoreOrchestrator';

// 本体 → ポップアウト窓へ「このキックオフを実行して」と依頼するイベント。
export const CHAT_KICKOFF_EVENT = 'sekkeiya://chat-kickoff';

export interface ChatKickoffPayload {
  /** モデルへ渡すキックオフ指示（hidden 前提＝チャット欄には出さない）。 */
  text: string;
  /** 対話の対象プロジェクト（null=アカウントスコープ）。窓側で activeProject を合わせる。 */
  projectId: string | null;
  source?: OrchestratorSource;
}

/** この窓のコンテキストでキックオフを実行する（本体でもポップアウト窓でも使う実体）。 */
export async function runKickoffHere(p: ChatKickoffPayload): Promise<void> {
  const app = useAppStore.getState();
  if (p.projectId !== undefined && app.activeProjectId !== p.projectId) {
    app.setActiveProjectId(p.projectId);
  }
  // この窓のアクティブセッションが対象プロジェクトのものでない場合があるため
  // （特にポップアウト窓へ委譲したとき）、対象プロジェクトのセッションへ確実に合わせる。
  if (p.projectId) {
    const { useAIChatStore } = await import('../../../store/useAIChatStore');
    const chat = useAIChatStore.getState();
    const active = chat.sessions.find(s => s.id === chat.activeSessionId);
    if (!active || active.projectId !== p.projectId) {
      const existing = chat.getSessionsForProject(p.projectId);
      const sid = existing[0]?.id ?? chat.createSession(p.projectId);
      chat.setActiveSession(sid);
    }
  }
  const { useCoreOrchestrator } = await import('../../../store/useCoreOrchestrator');
  const orch = useCoreOrchestrator.getState();
  if (orch.isProcessing) return; // 処理中の二重キックオフを防ぐ
  await orch.sendMessageToOrchestrator(p.text, { hidden: true, source: p.source ?? 'sidebar_chat' });
}

/**
 * キックオフを「チャットのある場所」へ届ける。
 * @param opts.focus ポップアウト窓を前面化するか（明示ボタン=true / 自動オープン=false でフォーカス奪取を避ける）。
 */
export async function dispatchChatKickoff(p: ChatKickoffPayload, opts?: { focus?: boolean }): Promise<void> {
  const app = useAppStore.getState();
  if (app.isChatPoppedOut) {
    // ポップアウト窓へ委譲。窓側の CHAT_KICKOFF_EVENT リスナーが runKickoffHere を実行する。
    const { emit } = await import('@tauri-apps/api/event');
    if (opts?.focus !== false) {
      const { focusChatWindowIfOpen } = await import('../../../utils/openChatWindow');
      await focusChatWindowIfOpen();
    }
    await emit(CHAT_KICKOFF_EVENT, p);
    return;
  }
  // 本体内チャットで実行（開いてから流す）。
  app.setAIChatOpen(true);
  await runKickoffHere(p);
}
