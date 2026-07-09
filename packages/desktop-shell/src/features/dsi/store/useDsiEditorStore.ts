import { create } from 'zustand';

/**
 * S.Image エディターの「派生系統チャット」状態。
 *
 * 元画像（origin）を親に、各系統（branch = v1, v2, …）が独立した編集会話を持つ。
 * 各系統は自分の最新画像（currentImageUrl）を基点に image-to-image を積み重ねるため、
 * 系統ごとに別方向へ進化できる。良かった系統の画像を S.Image に採用する。
 *
 * 生成は requestAiRender（users/{uid}/aiJobs/{jobId}）を系統ごとに独立ジョブとして走らせ、
 * 複数系統を同時進行できる。ジョブ購読は DsiEditorChat 側の effect が担う。
 */

export interface DsiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  /** assistant: 生成結果画像 URL */
  imageUrl?: string;
  status?: 'running' | 'done' | 'error';
  /** 実行中ジョブ ID（購読対象） */
  jobId?: string | null;
  error?: string;
}

export interface DsiBranch {
  id: string;
  /** 表示名（v1, v2, …） */
  name: string;
  messages: DsiChatMessage[];
  /** この系統の最新画像（未生成なら origin にフォールバック） */
  currentImageUrl: string | null;
}

/** 中央画像上の編集対象矩形（表示中画像に対する正規化座標 0..1） */
export interface DsiRegion { x: number; y: number; w: number; h: number }

interface DsiEditorState {
  originImageUrl: string | null;
  originTitle: string;
  targetProjectId: string | null;
  provider: string;
  branches: DsiBranch[];
  activeBranchId: string | null;
  /** 中央に表示中の画像 URL（ツリーで選択したノード。null は元画像や空状態） */
  selectedImageUrl: string | null;
  /** 編集対象の矩形範囲（正規化）。null は範囲指定なし＝全体 */
  region: DsiRegion | null;
  /** ツールバーの範囲選択モード（ドラッグで矩形を描く） */
  regionMode: boolean;

  initSession: (opts: {
    originImageUrl: string | null;
    originTitle?: string;
    targetProjectId: string | null;
    provider: string;
  }) => void;
  setProvider: (provider: string) => void;
  addBranch: () => string;
  setActiveBranch: (id: string) => void;
  removeBranch: (id: string) => void;
  /** ツリーでノード（元画像 / 各世代画像）を選んで中央表示を切り替える */
  setSelectedImage: (url: string | null) => void;
  setRegion: (region: DsiRegion | null) => void;
  setRegionMode: (on: boolean) => void;

  appendUserMessage: (branchId: string, text: string) => void;
  /** 実行中 assistant メッセージを追加し、その id を返す */
  startAssistant: (branchId: string) => string;
  attachJob: (msgId: string, jobId: string) => void;
  /** jobId から該当 assistant を探し、結果画像で解決＋系統の currentImage を更新 */
  resolveJob: (jobId: string, imageUrl: string) => void;
  failJob: (jobId: string, error: string) => void;

  reset: () => void;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.round(Math.random() * 1e6)}`);

const makeBranch = (name: string, currentImageUrl: string | null): DsiBranch => ({
  id: uid(),
  name,
  messages: [],
  currentImageUrl,
});

export const useDsiEditorStore = create<DsiEditorState>((set, get) => ({
  originImageUrl: null,
  originTitle: '',
  targetProjectId: null,
  provider: 'nanobanana',
  branches: [],
  activeBranchId: null,
  selectedImageUrl: null,
  region: null,
  regionMode: false,

  initSession: ({ originImageUrl, originTitle = '', targetProjectId, provider }) => {
    const first = makeBranch('v1', originImageUrl);
    set({
      originImageUrl,
      originTitle,
      targetProjectId,
      provider,
      branches: [first],
      activeBranchId: first.id,
      selectedImageUrl: originImageUrl,
      region: null,
      regionMode: false,
    });
  },

  setProvider: (provider) => set({ provider }),

  addBranch: () => {
    const { branches, originImageUrl } = get();
    const b = makeBranch(`v${branches.length + 1}`, originImageUrl);
    set({ branches: [...branches, b], activeBranchId: b.id, selectedImageUrl: originImageUrl });
    return b.id;
  },

  setActiveBranch: (id) => {
    const b = get().branches.find((x) => x.id === id);
    set({ activeBranchId: id, selectedImageUrl: b?.currentImageUrl ?? get().originImageUrl });
  },

  setSelectedImage: (url) => set({ selectedImageUrl: url }),

  setRegion: (region) => set({ region }),
  setRegionMode: (on) => set({ regionMode: on }),

  removeBranch: (id) => {
    const { branches, activeBranchId } = get();
    if (branches.length <= 1) return; // 最低1系統は残す
    const next = branches.filter((b) => b.id !== id);
    const nextActiveId = activeBranchId === id ? next[next.length - 1].id : activeBranchId;
    const nextActive = next.find((b) => b.id === nextActiveId);
    set({
      branches: next,
      activeBranchId: nextActiveId,
      ...(activeBranchId === id ? { selectedImageUrl: nextActive?.currentImageUrl ?? get().originImageUrl } : {}),
    });
  },

  appendUserMessage: (branchId, text) => {
    set((s) => ({
      branches: s.branches.map((b) =>
        b.id === branchId
          ? { ...b, messages: [...b.messages, { id: uid(), role: 'user', text }] }
          : b,
      ),
    }));
  },

  startAssistant: (branchId) => {
    const msgId = uid();
    set((s) => ({
      branches: s.branches.map((b) =>
        b.id === branchId
          ? { ...b, messages: [...b.messages, { id: msgId, role: 'assistant', status: 'running', jobId: null }] }
          : b,
      ),
    }));
    return msgId;
  },

  attachJob: (msgId, jobId) => {
    set((s) => ({
      branches: s.branches.map((b) => ({
        ...b,
        messages: b.messages.map((m) => (m.id === msgId ? { ...m, jobId } : m)),
      })),
    }));
  },

  resolveJob: (jobId, imageUrl) => {
    set((s) => {
      let resolvedBranchId: string | null = null;
      const branches = s.branches.map((b) => {
        const hit = b.messages.some((m) => m.jobId === jobId);
        if (!hit) return b;
        resolvedBranchId = b.id;
        return {
          ...b,
          currentImageUrl: imageUrl,
          messages: b.messages.map((m) =>
            m.jobId === jobId ? { ...m, status: 'done' as const, imageUrl, jobId: null } : m,
          ),
        };
      });
      // アクティブ系統の生成なら中央表示を最新へ追従。
      const follow = resolvedBranchId && resolvedBranchId === s.activeBranchId;
      return follow ? { branches, selectedImageUrl: imageUrl } : { branches };
    });
  },

  failJob: (jobId, error) => {
    set((s) => ({
      branches: s.branches.map((b) => ({
        ...b,
        messages: b.messages.map((m) =>
          m.jobId === jobId ? { ...m, status: 'error', error, jobId: null } : m,
        ),
      })),
    }));
  },

  reset: () => set({
    originImageUrl: null,
    originTitle: '',
    targetProjectId: null,
    branches: [],
    activeBranchId: null,
    selectedImageUrl: null,
    region: null,
    regionMode: false,
  }),
}));
