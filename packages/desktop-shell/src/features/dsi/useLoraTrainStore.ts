/**
 * LoRA 学習のグローバル状態（モデル製造ライン）。
 * コンポーネントローカルだと画面遷移で表示が消える＆完了ハンドリングが迷子になるため、
 * 学習の実行・進捗ポーリング・完了時の台帳登録をストア（モジュールスコープ）で持つ。
 * 学習プロセス自体は Rust 側で動くので、画面を移動しても学習は継続する。
 */
import { create } from 'zustand';
import { updateLoraModel, type LoraModel } from './loraModels';

export interface LoraTrainProgress {
  phase: 'loading' | 'caching' | 'training';
  step?: number;
  total?: number;
  remaining?: string;
}

/** 完了/失敗/キャンセルの通知（パネルがダイアログ表示してクリアする） */
export interface LoraTrainNotice {
  kind: 'done' | 'error' | 'cancelled';
  modelName: string;
  base: string;
  /** done のとき: 重みの保存先（ローカルパス or URL） */
  weights?: string;
  /** error のとき: エラー詳細 */
  detail?: string;
  /** 学習にかかった時間（分） */
  minutes?: number;
}

interface LoraTrainState {
  running: boolean;
  cancelling: boolean;
  modelId: string | null;
  modelName: string;
  base: 'FLUX' | 'SDXL' | string;
  dataset: string;
  progress: LoraTrainProgress | null;
  notice: LoraTrainNotice | null;
  start: (model: LoraModel, dataset: string, trigger: string) => Promise<void>;
  cancel: () => Promise<void>;
  clearNotice: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let startedAt = 0;

export const useLoraTrainStore = create<LoraTrainState>((set, get) => ({
  running: false,
  cancelling: false,
  modelId: null,
  modelName: '',
  base: 'FLUX',
  dataset: '',
  progress: null,
  notice: null,

  clearNotice: () => set({ notice: null }),

  cancel: async () => {
    if (!get().running || get().cancelling) return;
    set({ cancelling: true });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('lora_train_cancel');
      // 学習側の invoke が Err で戻り、catch 側が cancelling を見てキャンセル扱いにする。
    } catch (e: any) {
      set({ cancelling: false });
      window.alert('中断に失敗しました: ' + String(e?.message || e));
    }
  },

  start: async (model, dataset, trigger) => {
    if (get().running) return;
    startedAt = performance.now();
    set({
      running: true, cancelling: false, modelId: model.id, modelName: model.name, base: model.base,
      dataset, progress: null, notice: null,
    });

    const { invoke } = await import('@tauri-apps/api/core');

    // SDXL はログから進捗（フェーズ + step/total/残り時間）をポーリング。
    if (model.base === 'SDXL') {
      pollTimer = setInterval(async () => {
        try {
          const p = await invoke<LoraTrainProgress | null>('lora_sdxl_train_progress', { dataset });
          if (get().running) set({ progress: p ?? { phase: 'loading' } });
        } catch { /* ログ未生成の間は無視 */ }
      }, 3000);
    }

    const minutes = () => Math.max(1, Math.round((performance.now() - startedAt) / 60000));
    try {
      const weights = model.base === 'SDXL'
        ? await invoke<string>('lora_train_sdxl', { dataset, trigger, steps: 1200 })
        : await invoke<string>('lora_train', { dataset });
      await updateLoraModel(model.id, { weightsUrl: weights });
      set({ notice: { kind: 'done', modelName: model.name, base: model.base, weights, minutes: minutes() } });
    } catch (e: any) {
      if (get().cancelling) {
        set({ notice: { kind: 'cancelled', modelName: model.name, base: model.base, minutes: minutes() } });
      } else {
        set({ notice: { kind: 'error', modelName: model.name, base: model.base, detail: String(e?.message || e) } });
      }
    } finally {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      set({ running: false, cancelling: false, progress: null });
    }
  },
}));
