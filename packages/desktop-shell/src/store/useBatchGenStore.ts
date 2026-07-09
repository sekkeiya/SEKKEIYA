// 画像→3Dモデルの「バックグラウンド一括生成」エンジン。
//   - 各画像につき Firebase callable `requestAiGeneration` を1回呼ぶ（= 1ジョブ）。サーバ側で非同期実行されるため非ブロッキング。
//   - 「実行中(submitting + generating)」の合計を MAX_ACTIVE 件に制限し、Tripo の同時実行上限(429)を回避する。
//   - 各ジョブは Firestore users/{uid}/aiJobs/{jobId} を onSnapshot で監視し、完了/失敗を反映。
//   - 今月の残上限を超える分は最初から skipped にし、生成途中で上限レース（resource-exhausted）が出たら残りを skipped に。
//   - 完了したモデルはサーバ側（tripoProvider）が必ず S.Model（root assets）へ保存するので、クライアント保存は不要。
//   - グローバル store ＋ 進捗UIは MainLayout 直下にマウントされるため、画面遷移しても生成は継続する。

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, storage } from '../lib/firebase/client';
import { uploadImageAndGetUrl } from '../lib/firebase/uploadImage';
import { AI_3D_LIMITS, OFFICIAL_EMAILS } from '../features/ai-studio/constants/ai-model-plans';

export type BatchItemStatus =
  | 'queued'
  | 'submitting'
  | 'generating'
  | 'done'
  | 'failed'
  | 'skipped';

export interface BatchItem {
  imageId: string;
  inputImageUrl: string;
  status: BatchItemStatus;
  jobId?: string;
  glbUrl?: string;
  resultAssetId?: string;
  error?: string;
  startedAt?: number;   // generating になった時刻 (ms)
  completedAt?: number; // done/failed になった時刻 (ms)
  rateRetryCount?: number; // 429(同時実行上限)で再キューした回数
}

export interface Batch {
  id: string;
  createdAt: number;
  provider: string;
  projectId: string | null;
  workspaceId: string | null;
  items: BatchItem[];
  total: number;     // 入力枚数
  skipped: number;   // 上限により実行しない枚数
  cancelled?: boolean;
}

interface StartOpts {
  provider?: string;
  projectId?: string | null;
  workspaceId?: string | null;
}

interface BatchGenState {
  batches: Batch[];
  panelOpen: boolean;
  /** 永続データの所有ユーザー uid（アカウント切替時のクリア判定用）。 */
  ownerUid: string | null;
  /** 完了時に自動で S.Model のアップロードダイアログを開く。 */
  autoSaveToModels: boolean;
  setAutoSaveToModels: (v: boolean) => void;
  /** ログインユーザーが変わったら一括生成の状態をクリアする。 */
  ensureOwner: (uid: string | null) => void;
  /** 認証確立後に、生成中ジョブの Firestore リスナを再アタッチ（リロード後の再開）。 */
  resumeActiveJobs: () => void;
  setPanelOpen: (o: boolean) => void;
  startBatch: (
    images: { id: string; downloadUrl: string }[],
    opts?: StartOpts,
  ) => Promise<{ batchId: string; total: number; skipped: number }>;
  cancelBatch: (batchId: string) => void;
  dismissBatch: (batchId: string) => void;
  /** バッチ内の失敗(failed)項目だけ再生成する。 */
  retryFailed: (batchId: string) => void;
  /** 内部: 項目を部分更新 */
  _patchItem: (batchId: string, imageId: string, patch: Partial<BatchItem>) => void;
  /** 内部: バッチを部分更新 */
  _patchBatch: (batchId: string, patch: Partial<Batch>) => void;
}

// Tripo の同時実行タスク数の上限に合わせる。これを超えると Tripo が 429
// (exceeded the limit of generation) を返して当該ジョブが失敗するため、
// 「実行中(submitting + generating)」の合計がこの数を超えないよう投入を絞る。
// ※旧実装は API 呼び出し中だけ数え、generating 移行で即枠を解放していたため
//   Tripo 側に大量のタスクが同時に積まれ 429 で多数失敗していた。
const MAX_ACTIVE = 3;
// 429(同時実行上限)で失敗したジョブをキューへ戻して再試行する上限回数と待機。
// 他タスクの完了で枠が空くまで待つため、回数は多め・間隔は長めに取る。
const MAX_RATE_RETRIES = 30;
const RATE_BACKOFF_MS = 20 * 1000;
// 生成ジョブのタイムアウト: 15分応答なしで自動的に失敗扱いにする
// （サーバ側 pollAiJobs がスタックしたジョブを最大2回自動再起動するため、その猶予を含む）
const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

// jobId → unsubscribe（zustand state には入れない＝非シリアライズ）
const listeners = new Map<string, () => void>();
// jobId → タイムアウトタイマー
const jobTimers = new Map<string, ReturnType<typeof setTimeout>>();
// 完了通知済みバッチID（セッション内で重複通知しない）
const notifiedBatches = new Set<string>();

// 生成サーバ（Cloud Function → Tripo）がダウンロードできるよう、公開 http(s) URL を保証する。
// S.Image のローカル素材は Tauri の `http://asset.localhost/...`（や asset://）で、サーバからは
// 名前解決できない（getaddrinfo ENOTFOUND asset.localhost）。これらは Storage にアップロードして公開URL化する。
function needsUpload(url: string): boolean {
  // 非 http(s) スキーム（asset:// / blob: / data: / file:）はそのまま要アップロード。
  if (/^(asset|blob|data|file):/i.test(url)) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    // Tauri のローカル資産ホスト・localhost 系はサーバから取得不可。
    return host === 'asset.localhost' || host === 'tauri.localhost' || host.endsWith('.localhost')
      || host === 'localhost' || host === '127.0.0.1';
  } catch {
    return true; // パースできない=ローカル相対等 → 念のためアップロード
  }
}

async function ensurePublicUrl(url: string): Promise<string> {
  if (!needsUpload(url)) return url; // 既に公開URL（Firebase Storage 等）
  // ローカル資産 → webview 内で fetch して bytes を取得しアップロード。
  const res = await fetch(url);
  const blob = await res.blob();
  const ext = (blob.type && blob.type.split('/')[1]) || 'png';
  const file = new File([blob], `batchsrc_${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
  return await uploadImageAndGetUrl(file);
}

function isResourceExhausted(e: any): boolean {
  const code = e?.code || e?.message || '';
  return String(code).includes('resource-exhausted') || String(e?.message || '').includes('上限');
}

function computeRemaining(plan: string, provider: string, aiUsage: any): number {
  const limit = (AI_3D_LIMITS as any)[plan]?.[provider]?.monthly;
  if (limit === undefined) return 0;
  if (limit === Infinity) return Number.MAX_SAFE_INTEGER;
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const usage = aiUsage?.[provider] || {};
  const monthlyCount = usage.lastMonthlyResetAt === currentMonthStr ? (usage.monthlyCount || 0) : 0;
  return Math.max(0, limit - monthlyCount);
}

export const useBatchGenStore = create<BatchGenState>()(
  persist(
    (set, get) => ({
      batches: [],
      panelOpen: false,
      ownerUid: null,
      autoSaveToModels: false,
      setAutoSaveToModels: (v) => set({ autoSaveToModels: v }),
      ensureOwner: (uid) => {
        if (get().ownerUid === uid) return;
        // 所有者が一致しない（ログアウト/別アカウント/旧データ）→ リスナを止めて状態クリア。
        for (const fn of listeners.values()) fn();
        listeners.clear();
        set({ ownerUid: uid, batches: [], panelOpen: false });
      },
      resumeActiveJobs: () => {
        // 認証が確立した後に呼ばれる。生成中ジョブのリスナを（重複なく）再アタッチし、
        // 未送信(submitting/queued)は再送する。リロードで失われたリスナをここで復旧する。
        for (const b of get().batches) {
          if (b.cancelled) continue;
          let needsPump = false;
          for (const it of b.items) {
            if (it.status === 'generating' && it.jobId) {
              watchJob(b.id, it.imageId, it.jobId, it.startedAt); // startedAt で残りタイムアウトを計算
            } else if (it.status === 'submitting') {
              get()._patchItem(b.id, it.imageId, { status: 'queued' });
              needsPump = true;
            }
          }
          if (needsPump || b.items.some((it) => it.status === 'queued')) pump(b.id);
        }
      },
      setPanelOpen: (panelOpen) => set({ panelOpen }),

      _patchItem: (batchId, imageId, patch) => {
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id !== batchId
              ? b
              : { ...b, items: b.items.map((it) => (it.imageId === imageId ? { ...it, ...patch } : it)) },
          ),
        }));

        // バッチ全件完了を検出して通知（1バッチにつき1回のみ）
        if (notifiedBatches.has(batchId)) return;
        const batch = get().batches.find((b) => b.id === batchId);
        if (!batch || batch.cancelled) return;
        const active = batch.items.filter((it) => it.status !== 'skipped');
        if (active.length === 0) return;
        const allSettled = active.every((it) => it.status === 'done' || it.status === 'failed');
        if (!allSettled) return;

        notifiedBatches.add(batchId);
        const doneItems = batch.items.filter((it) => it.status === 'done' && !!it.glbUrl);

        // デスクトップ通知（fire-and-forget）
        import('./useAiTaskNotifier').then(({ notifyBatchComplete }) => {
          notifyBatchComplete(batchId, doneItems);
        }).catch(() => {});

        // 自動保存が有効ならダイアログを即時起動
        if (get().autoSaveToModels && doneItems.length > 0) {
          import('./saveBatchToModels').then(({ saveBatchDoneItemsToSModels }) => {
            saveBatchDoneItemsToSModels(doneItems);
          }).catch(() => {});
        }
      },

      _patchBatch: (batchId, patch) =>
        set((state) => ({
          batches: state.batches.map((b) => (b.id === batchId ? { ...b, ...patch } : b)),
        })),

      startBatch: async (images, opts) => {
        const provider = opts?.provider || 'tripo3d';
        const projectId = opts?.projectId ?? null;
        const workspaceId = opts?.workspaceId ?? null;
        const total = images.length;

        // 残上限の算出（サーバが権威だが、ここで先に切り捨てて警告する）。
        let remaining = 0;
        const uid = auth.currentUser?.uid;
        if (uid) {
          if (OFFICIAL_EMAILS.has(auth.currentUser?.email || '')) {
            remaining = Number.MAX_SAFE_INTEGER;
          } else {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              const data = snap.exists() ? snap.data() : {};
              const plan = (data as any).plan || 'free';
              remaining = computeRemaining(plan, provider, (data as any).aiUsage || {});
            } catch {
              remaining = 0;
            }
          }
        }
        const accept = Math.max(0, Math.min(total, remaining));
        const skipped = total - accept;

        const batchId = crypto.randomUUID();
        const items: BatchItem[] = images.map((img, i) => ({
          imageId: img.id,
          inputImageUrl: img.downloadUrl,
          status: i < accept ? 'queued' : 'skipped',
          ...(i >= accept ? { error: '今月の上限により実行されません' } : {}),
        }));

        const batch: Batch = {
          id: batchId,
          createdAt: Date.now(),
          provider,
          projectId,
          workspaceId,
          items,
          total,
          skipped,
        };

        set((state) => ({ batches: [batch, ...state.batches], panelOpen: true }));
        // ディスパッチ開始（await しない＝非ブロッキング）。
        pump(batchId);

        return { batchId, total, skipped };
      },

      cancelBatch: (batchId) => {
        const { _patchBatch } = get();
        _patchBatch(batchId, { cancelled: true });
        // 未送信(queued)を skipped に。生成中(generating)はサーバ側で継続・保存。
        set((state) => ({
          batches: state.batches.map((b) =>
            b.id !== batchId
              ? b
              : {
                  ...b,
                  items: b.items.map((it) =>
                    it.status === 'queued' ? { ...it, status: 'skipped', error: 'キャンセル' } : it,
                  ),
                },
          ),
        }));
      },

      retryFailed: (batchId) => {
        let any = false;
        set((state) => ({
          batches: state.batches.map((b) => {
            if (b.id !== batchId) return b;
            return {
              ...b,
              cancelled: false,
              items: b.items.map((it) => {
                if (it.status === 'failed') {
                  any = true;
                  return { ...it, status: 'queued', error: undefined, jobId: undefined, glbUrl: undefined };
                }
                return it;
              }),
            };
          }),
        }));
        if (any) {
          set({ panelOpen: true });
          pump(batchId);
        }
      },

      dismissBatch: (batchId) => {
        // リスナを停止して一覧から除去。
        const b = get().batches.find((x) => x.id === batchId);
        b?.items.forEach((it) => {
          if (it.jobId && listeners.has(it.jobId)) {
            listeners.get(it.jobId)!();
            listeners.delete(it.jobId);
          }
        });
        set((state) => ({ batches: state.batches.filter((x) => x.id !== batchId) }));
      },
    }),
    {
      name: 'sekkeiya-batchgen-storage',
      // panelOpen は永続化しない（再起動時は閉じた状態）。
      partialize: (state) => ({ batches: state.batches, ownerUid: state.ownerUid, autoSaveToModels: state.autoSaveToModels }) as any,
      // 注意: ここ（rehydrate 直後）では Firebase auth が未確立で auth.currentUser=null のため、
      // リスナ再アタッチや再送はできない（watchJob/submitOne が uid を必要とする）。
      // 復旧は認証確立後に useAuthStore から resumeActiveJobs() を呼んで行う。
    },
  ),
);

// ─── ディスパッチャ（実行中件数で並列制御）──────────────────────────
// 「実行中」= submitting(送信中) + generating(Tripoで生成中)。これが MAX_ACTIVE
// 未満のときだけ queued を投入する。generating は done/failed になるまで枠を専有し、
// その時 watchJob が pump を呼んで次を投入する。これにより Tripo に同時に積まれる
// タスク数が MAX_ACTIVE を超えず、429(同時実行上限)を回避できる。
function activeCount(b: Batch): number {
  return b.items.filter((it) => it.status === 'submitting' || it.status === 'generating').length;
}

function pump(batchId: string): void {
  const get = useBatchGenStore.getState;
  while (true) {
    const b = get().batches.find((x) => x.id === batchId);
    if (!b || b.cancelled) break;
    if (activeCount(b) >= MAX_ACTIVE) break;
    const next = b.items.find((it) => it.status === 'queued');
    if (!next) break;
    // submitting にマークしてから fire-and-forget。次の反復の activeCount に算入される。
    get()._patchItem(batchId, next.imageId, { status: 'submitting' });
    submitOne(batchId, next.imageId);
  }
}

async function submitOne(batchId: string, imageId: string): Promise<void> {
  const store = useBatchGenStore.getState();
  const b = store.batches.find((x) => x.id === batchId);
  const item = b?.items.find((it) => it.imageId === imageId);
  if (!b || !item) return;
  try {
    // ローカル素材等は公開URL化してからサーバへ渡す（サーバはローカルファイルを取得できない）。
    const inputImageUrl = await ensurePublicUrl(item.inputImageUrl);
    const fn = httpsCallable(functions, 'requestAiGeneration');
    const res = await fn({
      provider: b.provider,
      type: 'image_to_3d',
      inputImageUrl,
      inputImageStoragePath: null,
      targetBoardId: b.workspaceId || null,
      autoPlace: !!(b.projectId && b.workspaceId),
      imageHash: 'batch_' + imageId + '_' + Date.now(),
      projectId: b.projectId || null,
      workspaceId: b.workspaceId || null,
    });
    const data = res.data as any;
    if (!data?.success || !data?.jobId) throw new Error(data?.message || 'ジョブ作成に失敗');
    const now = Date.now();
    store._patchItem(batchId, imageId, { status: 'generating', jobId: data.jobId, startedAt: now });
    watchJob(batchId, imageId, data.jobId, now);
  } catch (e: any) {
    if (isResourceExhausted(e) && !OFFICIAL_EMAILS.has(auth.currentUser?.email || '')) {
      // 月上限レース: この項目と残りの queued を skipped に。
      store._patchItem(batchId, imageId, { status: 'skipped', error: '今月の上限に達しました' });
      useBatchGenStore.setState((state) => ({
        batches: state.batches.map((bb) =>
          bb.id !== batchId
            ? bb
            : {
                ...bb,
                items: bb.items.map((it) =>
                  it.status === 'queued' ? { ...it, status: 'skipped', error: '今月の上限に達しました' } : it,
                ),
              },
        ),
      }));
    } else {
      store._patchItem(batchId, imageId, { status: 'failed', error: e?.message || 'エラー' });
      // submit 自体が失敗 → 枠が空いたので次を投入。
      pump(batchId);
    }
  }
}

function cleanupJob(jobId: string): void {
  listeners.get(jobId)?.();
  listeners.delete(jobId);
  const timer = jobTimers.get(jobId);
  if (timer !== undefined) { clearTimeout(timer); jobTimers.delete(jobId); }
}

function watchJob(batchId: string, imageId: string, jobId: string, startedAt?: number): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  if (listeners.has(jobId)) return; // 二重監視防止

  // タイムアウト: 残り時間を経過時間から計算して設定する
  const elapsed = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const remaining = GENERATION_TIMEOUT_MS - elapsed;
  if (remaining <= 0) {
    // 再開時に既にタイムアウト済みのジョブは即失敗
    useBatchGenStore.getState()._patchItem(batchId, imageId, { status: 'failed', error: 'タイムアウト（15分以上応答なし）', completedAt: Date.now() });
    return;
  }
  const timer = setTimeout(() => {
    jobTimers.delete(jobId);
    if (!listeners.has(jobId)) return;
    cleanupJob(jobId);
    useBatchGenStore.getState()._patchItem(batchId, imageId, { status: 'failed', error: 'タイムアウト（15分以上応答なし）', completedAt: Date.now() });
    // タイムアウト後も pump して次のキューがあれば処理継続
    pump(batchId);
  }, remaining);
  jobTimers.set(jobId, timer);

  const jobRef = doc(db, 'users', uid, 'aiJobs', jobId);
  const unsub = onSnapshot(
    jobRef,
    async (docSnap) => {
      if (!docSnap.exists()) return;
      const jobData = docSnap.data() as any;
      const patch = useBatchGenStore.getState()._patchItem;
      if (jobData.status === 'completed') {
        let finalUrl = jobData.glbUrl;
        if (!finalUrl && jobData.glbStoragePath) {
          try {
            finalUrl = await getDownloadURL(ref(storage, jobData.glbStoragePath));
          } catch {
            /* glbStoragePath が公開URLそのものの場合あり */
            finalUrl = jobData.glbStoragePath;
          }
        }
        cleanupJob(jobId);
        patch(batchId, imageId, { status: 'done', glbUrl: finalUrl, resultAssetId: jobData.resultAssetId, completedAt: Date.now() });
        pump(batchId); // 枠が空いたので次を投入
      } else if (jobData.status === 'failed') {
        cleanupJob(jobId);
        const errorMsg = jobData.errorMessage || '生成に失敗しました';
        if (jobData.errorCode === 'TRIPO_CREDITS_EXHAUSTED') {
          // クレジット残高不足: この項目を失敗にし、残りの未実行をすべてスキップ（無駄打ち防止）。
          patch(batchId, imageId, { status: 'failed', error: errorMsg, completedAt: Date.now() });
          useBatchGenStore.setState((state) => ({
            batches: state.batches.map((bb) =>
              bb.id !== batchId ? bb : {
                ...bb,
                items: bb.items.map((it) =>
                  it.status === 'queued' || it.status === 'submitting'
                    ? { ...it, status: 'skipped', error: 'Tripoクレジット不足のためスキップ' }
                    : it,
                ),
              },
            ),
          }));
        } else if (jobData.errorCode === 'TRIPO_RATE_LIMITED') {
          // 同時実行枠の超過: 課金されないため失敗扱いにせず、枠が空くまで待って再キュー。
          const cur = useBatchGenStore.getState().batches.find((x) => x.id === batchId)?.items.find((it) => it.imageId === imageId);
          const rc = cur?.rateRetryCount || 0;
          if (rc < MAX_RATE_RETRIES) {
            patch(batchId, imageId, { status: 'queued', error: undefined, jobId: undefined, startedAt: undefined, rateRetryCount: rc + 1 });
            setTimeout(() => pump(batchId), RATE_BACKOFF_MS);
          } else {
            patch(batchId, imageId, { status: 'failed', error: 'Tripoの同時生成数の上限により失敗しました（時間をおいて再試行してください）', completedAt: Date.now() });
            pump(batchId);
          }
        } else {
          patch(batchId, imageId, { status: 'failed', error: errorMsg, completedAt: Date.now() });
          pump(batchId); // 枠が空いたので次を投入
        }
      }
    },
    () => {
      cleanupJob(jobId);
      useBatchGenStore.getState()._patchItem(batchId, imageId, { status: 'failed', error: '監視エラー' });
    },
  );
  listeners.set(jobId, unsub);
}
