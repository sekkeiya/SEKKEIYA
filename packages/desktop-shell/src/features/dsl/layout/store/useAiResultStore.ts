import { create } from 'zustand';

export type AiResultStatus = 'success' | 'warning' | 'skip' | 'info';

export interface AiResultItem {
  /** 工程名（例: 自動レイアウト） */
  label: string;
  status: AiResultStatus;
  /** 補足（件数・スタイル名・スキップ理由など） */
  detail?: string;
}

/** 生成された成果物（パース／動画）のサムネイル一覧 */
export interface AiMedia {
  perspectives: { name: string; thumbnail: string | null }[];
  videos: { name: string; poster: string | null; status: string }[];
}

/**
 * 「AI実行（おまかせ）」の生成結果サマリを保持し、完了時にダイアログでまとめて表示するためのストア。
 */
interface AiResultState {
  open: boolean;
  /** 実行したテイスト/スタイル名（おまかせ等） */
  styleLabel?: string;
  /** 全体の成否（途中で問題があったか） */
  hadError: boolean;
  results: AiResultItem[];
  media: AiMedia;
  show: (
    results: AiResultItem[],
    opts?: { styleLabel?: string; hadError?: boolean; media?: AiMedia },
  ) => void;
  close: () => void;
}

const EMPTY_MEDIA: AiMedia = { perspectives: [], videos: [] };

export const useAiResultStore = create<AiResultState>((set) => ({
  open: false,
  styleLabel: undefined,
  hadError: false,
  results: [],
  media: EMPTY_MEDIA,
  show: (results, opts) =>
    set({
      open: true,
      results,
      styleLabel: opts?.styleLabel,
      hadError: !!opts?.hadError,
      media: opts?.media ?? EMPTY_MEDIA,
    }),
  close: () => set({ open: false }),
}));
