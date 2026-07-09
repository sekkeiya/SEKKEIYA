// ── SEKKEIYA Drive アクセス層（Phase 1: 読み取り）────────────────────────────
//
// 「Drive = 保管庫＋橋渡し」を実現するための単一の窓口。子アプリはこのフックを通して
// Drive の資産を取り出す（＝図の「Drive → 入力 → 子アプリ」）。物理ストレージは今のまま
// （assets / projects/*/assets / workFiles / items）で、useAIDriveStore の集約プール
// （pooledAssets, スコープ非依存）の上に、レイヤー/種別/メディアで純粋に絞り込むだけ。
//
// 設計方針（2026-07-09 合意）:
//  - 橋を渡るのは「資産（再利用できるアウトプット）」だけ。作業ファイル・3D配置インスタンスは
//    既定で除外（includeWorkFiles で明示的に含められる）。isReusableAsset で判定。
//  - 既定レイヤー = 自分の「非公開 ＋ ローカル」。公開（own public）・チームはオプトイン。
//    ※他ユーザーの公開資産（Gallery）は現状ストアのプールに無いため Phase 1 では未対象
//      （将来 useGalleryFeed 統合で 'public' に他者分を合流させる）。
//
// この層に寄せる既存の直叩き（Phase 3 で順次移行）:
//   mediaQueries.ts / projectAssetsApi.ts / replaceSearch.ts / PresentsInspector.tsx
import { useEffect, useMemo, useState } from 'react';
import { auth } from '../../lib/firebase/client';
import { useAppStore } from '../../store/useAppStore';
import {
  useAIDriveStore,
  isReusableAsset,
  assetOutputKind,
  type AIDriveAsset,
  type OutputKind,
} from '../../store/useAIDriveStore';
import { loadLocalAiDriveAssets } from '../../components/AI/aiDriveExtras';

/** 所有・ライフサイクルのレイヤー（軸A）。 */
export type DriveLayer = 'private' | 'public' | 'local' | 'team';

/** メディア種別のショートカット。 */
export type DriveMedia = 'image' | 'model' | 'video';

export interface DriveQuery {
  /** 表示するレイヤー。既定 = 自分の非公開 ＋ ローカル（公開/チームはオプトイン）。 */
  layers?: DriveLayer[];
  /** アウトプット種別で絞る（未指定 = 全種別）。 */
  kinds?: OutputKind[];
  /** メディア種別のショートカット（image/model/video）。kinds より緩い横断フィルタ。 */
  media?: DriveMedia;
  /** 作業ファイル・配置インスタンスも含めるか（既定 = false = 資産だけ）。 */
  includeWorkFiles?: boolean;
  /** 指定プロジェクトの資産に限定（未指定 = プール全体）。 */
  projectId?: string | null;
}

const DEFAULT_LAYERS: DriveLayer[] = ['private', 'local'];

/**
 * ピッカー系（各子アプリが「自分の資産から選ぶ」）の標準レイヤー。
 * 自分の 非公開＋公開＋ローカル（他者公開/チームはオプトインなので含めない）。
 */
export const PICKER_LAYERS: DriveLayer[] = ['private', 'public', 'local'];

/** 現在ユーザーの資産か（ownerId 未設定・'unknown' の旧データも自分扱い）。 */
function isMine(a: AIDriveAsset, uid?: string | null): boolean {
  return a.ownerId === uid || !a.ownerId || a.ownerId === 'unknown';
}

/** 資産がどのレイヤーに属するか判定。 */
export function assetLayer(a: AIDriveAsset, uid?: string | null): DriveLayer {
  if (a.sourceCollection === 'local') return 'local';
  if (!isMine(a, uid)) return 'team';
  return a.visibility === 'public' ? 'public' : 'private';
}

/** メディア種別の一致判定（image/model/video）。 */
function mediaMatches(a: AIDriveAsset, media: DriveMedia): boolean {
  const t = (a.type || '').toLowerCase();
  const name = (a.name || '').toLowerCase();
  const kind = assetOutputKind(a);
  if (media === 'image') {
    return t === 'image' || t === 'screenshot' || t === 'cover' || t === 'render'
      || kind === 'render' || kind === 'texture'
      || /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
  }
  if (media === 'model') {
    return t === 'model' || t === '3d-model' || kind === 'model' || kind === 'furniture';
  }
  if (media === 'video') {
    return t === 'video' || kind === 'video';
  }
  return true;
}

// ── 購読の保証 ──────────────────────────────────────────────
// 子アプリが AI Drive パネルを開かずにこのフックを使っても資産が空にならないよう、
// 初回に集約リスナーを張る。subscribeToAssets は内部の globalSubscribedKeys で
// 二重張りを防ぐため複数回呼んでも安全。uid が変わったら張り直す。
let ensuredUid: string | null = null;
export function ensureDriveSubscription(): void {
  const uid = auth.currentUser?.uid || null;
  if (!uid || ensuredUid === uid) return;
  ensuredUid = uid;
  const st = useAppStore.getState();
  useAIDriveStore.getState().subscribeToAssets(st.activeProjectId ?? null, uid, st.projects);
}

// ローカル層は端末内スキャンが重いため、セッション内で一度だけ読み込んでキャッシュ共有。
let localCache: Promise<AIDriveAsset[]> | null = null;
function loadLocalCached(): Promise<AIDriveAsset[]> {
  if (!localCache) localCache = loadLocalAiDriveAssets().catch(() => []);
  return localCache;
}

/** 集約プールを指定条件で純粋に絞り込む共通ロジック（フック版・非フック版で共有）。 */
function applyDriveFilter(pool: AIDriveAsset[], layers: DriveLayer[], q: DriveQuery, uid?: string | null): AIDriveAsset[] {
  const layerSet = new Set(layers);
  const kindSet = q.kinds ? new Set<OutputKind>(q.kinds) : null;
  return pool
    .filter(a => {
      if (a.isDeleted) return false;
      if (!q.includeWorkFiles && !isReusableAsset(a)) return false;
      if (!layerSet.has(assetLayer(a, uid))) return false;
      if (q.projectId && a.projectId !== q.projectId
        && !((a as any).projectIds?.includes(q.projectId))) return false;
      if (kindSet) {
        const k = assetOutputKind(a);
        if (!k || !kindSet.has(k)) return false;
      }
      if (q.media && !mediaMatches(a, q.media)) return false;
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * 非フックのプール読み取り（async 関数など React の外から使う）。
 * 同期プール（クラウド）だけを対象にする（ローカル層は非同期読み込みのため含めない）。
 * 呼び出し時に購読を保証するが、プール未populateなら現時点の内容（空の場合あり）を返す。
 */
export function getDriveAssets(q: DriveQuery = {}): AIDriveAsset[] {
  ensureDriveSubscription();
  const layers = (q.layers ?? DEFAULT_LAYERS).filter(l => l !== 'local');
  const uid = auth.currentUser?.uid;
  return applyDriveFilter(useAIDriveStore.getState().pooledAssets, layers, q, uid);
}

/**
 * getDriveAssets の非同期版。購読を保証し、プールが populate されるまで（または timeout まで）待ってから返す。
 * Chat の verb など「初回で空を返したくない」文脈向け（プールが既に埋まっていれば即返す）。
 */
export async function getDriveAssetsAsync(q: DriveQuery = {}, opts: { timeoutMs?: number } = {}): Promise<AIDriveAsset[]> {
  ensureDriveSubscription();
  const timeoutMs = opts.timeoutMs ?? 2500;
  if (useAIDriveStore.getState().pooledAssets.length === 0) {
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; unsub(); clearTimeout(timer); resolve(); };
      const unsub = useAIDriveStore.subscribe((s) => { if (s.pooledAssets.length > 0) finish(); });
      const timer = setTimeout(finish, timeoutMs);
    });
  }
  return getDriveAssets(q);
}

/**
 * Drive から資産を取り出す React フック（Phase 1: 読み取り）。
 * useAIDriveStore の集約プールを、指定レイヤー/種別/メディアで純粋に絞り込んで返す。
 */
export function useDriveAssets(q: DriveQuery = {}): { assets: AIDriveAsset[]; loading: boolean } {
  const layers = q.layers ?? DEFAULT_LAYERS;
  const wantLocal = layers.includes('local');

  const pooled = useAIDriveStore(s => s.pooledAssets);
  const loading = useAIDriveStore(s => s.isLoading);
  const [local, setLocal] = useState<AIDriveAsset[]>([]);

  // クラウド集約リスナーを保証（初回のみ）。
  useEffect(() => { ensureDriveSubscription(); }, []);

  // ローカル層（要求時のみ・キャッシュ共有）。
  useEffect(() => {
    if (!wantLocal) { setLocal([]); return; }
    let active = true;
    loadLocalCached().then(items => { if (active) setLocal(items); });
    return () => { active = false; };
  }, [wantLocal]);

  // 安定した依存キー（配列の参照差で無駄な再計算をしないため）。
  const layersKey = layers.join(',');
  const kindsKey = q.kinds ? q.kinds.join(',') : '';

  const assets = useMemo(() => {
    const uid = auth.currentUser?.uid;
    const pool = wantLocal ? [...pooled, ...local] : pooled;
    return applyDriveFilter(pool, layers, q, uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pooled, local, wantLocal, layersKey, kindsKey, q.media, q.includeWorkFiles, q.projectId]);

  return { assets, loading };
}
