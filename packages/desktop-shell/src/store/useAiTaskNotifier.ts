/**
 * AIタスク・選択肢のデスクトップ通知管理。
 * - notifyTaskReady: 開始時刻到来時に「今すぐ実行 / 後で」通知
 * - notifyChoices: propose_choices 発生時に選択肢ボタン通知
 * App.tsx で ai-toast-action イベントを listen し、handleToastAction を呼ぶ。
 */
import { invoke } from '@tauri-apps/api/core';

const EVENT_NAME = 'ai-toast-action';
const CIRCLE_NUMS = ['①', '②', '③', '④', '⑤'];

interface PendingTask {
  title: string;
  onExecute: () => void;
}

interface PendingChoices {
  toolUseId: string;
  choices: { id: string; label: string }[];
}

interface PendingBatch {
  doneItems: { imageId: string; glbUrl?: string }[];
}

// キー → コールバック (in-memory, リロード不可)
const pendingTasks   = new Map<string, PendingTask>();
const pendingChoices = new Map<string, PendingChoices>();
const pendingBatches = new Map<string, PendingBatch>();

/** AIタスク開始時刻到来通知。ユーザーが「今すぐ実行」を押したら onExecute() を呼ぶ。 */
export function notifyTaskReady(taskId: string, title: string, onExecute: () => void) {
  const key = `task:${taskId}`;
  pendingTasks.set(key, { title, onExecute });

  invoke('send_toast_notification_with_actions', {
    title: '⏰ AIタスクの実行時刻です',
    body: title,
    buttons: [
      ['今すぐ実行', 'execute'],
      ['後で', 'skip'],
    ],
    key,
    eventName: EVENT_NAME,
  }).catch((e) => console.warn('[AiTaskNotifier] task notify failed:', e));
}

/**
 * propose_choices 発生時の通知。選択肢は通知本文に ①②… で表示し、
 * ボタンクリックで resumeWithChoice を呼ぶ。
 */
export function notifyChoices(
  toolUseId: string,
  prompt: string,
  choices: { id: string; label: string }[],
) {
  const key = `choice:${toolUseId}`;
  const limited = choices.slice(0, 5);
  pendingChoices.set(key, { toolUseId, choices: limited });

  const body = limited.map((c, i) => `${CIRCLE_NUMS[i]} ${c.label}`).join('\n');
  const buttons = limited.map((c, i) => [CIRCLE_NUMS[i], c.id]);

  invoke('send_toast_notification_with_actions', {
    title: `💬 ${prompt}`,
    body,
    buttons,
    key,
    eventName: EVENT_NAME,
  }).catch((e) => console.warn('[AiTaskNotifier] choices notify failed:', e));
}

/**
 * バッチ生成完了通知。「S.Modelsに保存」ボタン付き。
 * doneCount = 完了件数（本文に使用）。
 */
export function notifyBatchComplete(
  batchId: string,
  doneItems: { imageId: string; glbUrl?: string }[],
) {
  if (doneItems.length === 0) return;
  const key = `batch:${batchId}`;
  pendingBatches.set(key, { doneItems });

  invoke('send_toast_notification_with_actions', {
    title: '✅ 3D生成が完了しました',
    body: `${doneItems.length}件のモデルが完成しました`,
    buttons: [
      ['S.Modelsに保存', 'save'],
      ['閉じる', 'dismiss'],
    ],
    key,
    eventName: EVENT_NAME,
  }).catch((e) => console.warn('[AiTaskNotifier] batch notify failed:', e));
}

/** App.tsx の ai-toast-action イベントハンドラから呼ぶ。 */
export async function handleToastAction(action: string, key: string) {
  if (key.startsWith('task:')) {
    const pending = pendingTasks.get(key);
    pendingTasks.delete(key);
    if (!pending) return;
    if (action === 'execute' || action === 'body') {
      pending.onExecute();
    }
    // 'skip' / その他: 何もしない
    return;
  }

  if (key.startsWith('choice:')) {
    const pending = pendingChoices.get(key);
    pendingChoices.delete(key);
    if (!pending) return;
    const choiceId = action === 'body' ? pending.choices[0]?.id : action;
    if (!choiceId) return;
    const { useCoreOrchestrator } = await import('./useCoreOrchestrator');
    await useCoreOrchestrator.getState().resumeWithChoice(pending.toolUseId, [choiceId]);
    return;
  }

  if (key.startsWith('batch:')) {
    const pending = pendingBatches.get(key);
    pendingBatches.delete(key);
    if (!pending) return;
    if (action === 'save' || action === 'body') {
      const { saveBatchDoneItemsToSModels } = await import('./saveBatchToModels');
      await saveBatchDoneItemsToSModels(pending.doneItems);
    }
  }
}
