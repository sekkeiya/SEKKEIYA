/**
 * chatLayoutBridge.ts
 * SEKKEIYA Chat → S.Layout ブリッジ。
 * チャットから layout_create / layout_list / run_auto_layout を駆動する。
 */

import {
  collection, doc, getDoc, getDocs, updateDoc,
  query, where, limit as fsLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import type { BuildingType } from '../types/layoutRules';
import { runAutoLayout } from './autoLayoutService';
import type { ZoneData } from './autoLayoutService';

const WORKSPACE_ID = 'layout';

// ─── 型 ──────────────────────────────────────────────────────────────────────

export interface ChatLayoutSummary {
  id: string;
  name: string;
  planType: 'base' | 'plan' | 'option';
  status: string;
  createdAt?: any;
}

export interface ChatLayoutCreateResult {
  baseId: string;
  planId: string;
  workspaceId: string;
}

export interface ChatAutoLayoutOptions {
  userId: string;
  buildingType?: BuildingType;
  /** 家具ソース（'project' | 'global' 等）。bridge 内では未使用だが呼び出し側の互換のため受ける。 */
  furnitureSource?: string;
  roomWidthMm?: number;
  roomDepthMm?: number;
  onProgress?: (msg: string | null) => void;
}

export interface ChatAutoLayoutResult {
  placedCount: number;
  sessionId: string;
  /** 配置に使った家具候補の総数（0=モデルが1件も見つからなかった。診断用）。 */
  candidateCount: number;
}

/** プランの詳細（チャットからの layout_get 用）。 */
export interface ChatLayoutDetail {
  id: string;
  name: string;
  planType: string;
  status: string;
  itemCount: number;
  hasZones: boolean;
  thumbnailUrl: string | null;
  updatedAt?: any;
}

/** プランの成果物（レンダー等）。サイト添付用。 */
export interface ChatLayoutRender { id: string; url: string; }
export interface ChatLayoutOutputs {
  planId: string;
  name: string;
  thumbnailUrl: string | null;
  renders: ChatLayoutRender[];
  renderCount: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * プロジェクトの BasePlan 一覧を返す（最新20件）
 */
export async function listLayoutsForProject(
  projectId: string
): Promise<ChatLayoutSummary[]> {
  const col = collection(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts');
  // where + orderBy の複合インデックスを避けるため、単一 where で取得し sortOrder は
  // クライアント側で降順ソート（base レイアウトはプロジェクト当たり少数なので問題ない）。
  const q = query(col, where('planType', '==', 'base'));
  const snap = await getDocs(q);
  const sorted = snap.docs
    .slice()
    .sort((a, b) => ((b.data() as any).sortOrder ?? 0) - ((a.data() as any).sortOrder ?? 0))
    .slice(0, 20);
  return sorted.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.name || 'Untitled',
      planType: data.planType,
      status: data.status || 'draft',
      createdAt: data.createdAt,
    };
  });
}

/**
 * Base + Plan を新規作成して IDs を返す
 */
export async function createLayoutForProject(
  projectId: string,
  userId: string,
  name: string
): Promise<ChatLayoutCreateResult> {
  const { createStructureNode } = await import('../utils/workspaceStubs');

  const base = await createStructureNode({
    projectId,
    workspaceId: WORKSPACE_ID,
    userId,
    name,
    planType: 'base',
  });

  const plan = await createStructureNode({
    projectId,
    workspaceId: WORKSPACE_ID,
    userId,
    name: `${name} - Plan 1`,
    planType: 'plan',
    rootBaseId: base.id,
  });

  return { baseId: base.id, planId: plan.id, workspaceId: WORKSPACE_ID };
}

/**
 * 自動レイアウトに渡す家具候補を、プロジェクト→ユーザーのprivate→公開モデルの順で自動取得する。
 * プロジェクトに家具未登録でも、公開/private の 3D モデルから配置できるようにする。
 * （category は autoLayoutService 側で layoutCategory に正規化されるので生のまま渡す。）
 * ※ ローカルモデルは別系統（sources.json）のため v1 では未対応。
 */
async function buildAvailableFurniture(projectId: string, userId: string): Promise<any[]> {
  const out: any[] = [];
  const seen = new Set<string>();
  const CAP = 200; // private/public それぞれの取得上限
  const push = (a: any) => {
    const key = a.entityId || a.id;
    if (!key || seen.has(key)) return;
    if (!a.glbUrl && !a.entityId) return; // 描画解決できないものは除外
    seen.add(key);
    out.push(a);
  };
  const mapGlobal = (id: string, x: any, source: string) => ({
    id,
    entityId: x.entityId || id,
    title: x.title || x.name || 'Item',
    category: x.category || x.itemType || x.metadata?.category || x.subType || '',
    thumbnailUrl: x.thumbUrl || x.coverUrl || x.thumbnailUrl || x.metadata?.thumbnailUrl || null,
    metadata: x.metadata || {},
    glbUrl: x.glbUrl || x.modelUrl || x.metadata?.glbUrl || null,
    _source: source,
  });

  // 3D モデルらしいもの（type が model 系、または glb/modelUrl を持つ）だけ採用する。
  // 画像・PDF 等が候補に混ざると、配置0点の原因になるうえプレースホルダー代替も発動しない。
  const isModelish = (x: any): boolean => {
    const t = String(x?.type || x?.itemType || '').toLowerCase();
    if (t === '3d-model' || t === 'model') return true;
    return !!(x?.glbUrl || x?.modelUrl || x?.metadata?.glbUrl || x?.metadata?.sizeGlb || x?.metadata?.files);
  };

  // ① プロジェクト登録アセット（最優先）。
  //    getAssets は where('status','!=','archived') を使うが、status フィールドの無い doc は
  //    Firestore の != で除外されてしまう（取りこぼし）。ここでは直接コレクションを読み、
  //    archived のみクライアント側で除外して確実に拾う。
  try {
    const { getProjectAssetsColRef } = await import('../paths/workspacePaths');
    const colRef = getProjectAssetsColRef({ projectId });
    if (colRef) {
      const snap = await getDocs(colRef);
      snap.docs.forEach(d => {
        const a = d.data() as any;
        if (a.status === 'archived' || a.isArchived) return;
        if (!isModelish(a)) return; // 画像・PDF 等の非モデルは家具候補にしない
        push({
          id: d.id,
          entityId: a.entityId || d.id,
          title: a.name || a.title || 'Item',
          category: a.itemType || a.category || a.metadata?.category || '',
          thumbnailUrl: a.thumbnailUrl || a.metadata?.thumbnailUrl || null,
          metadata: a.metadata || {},
          glbUrl: a.modelUrl || a.glbUrl || a.metadata?.glbUrl || null,
          _source: 'project',
        });
      });
    }
  } catch (e) {
    console.warn('[autoLayout] project assets 取得失敗:', e);
  }

  // ② ユーザーの private モデル ＋ ③ 公開モデル（global assets コレクション）。
  // 本命は type=='3d-model' に絞ったクエリ（S.Model の公開フィード useGalleryFeed と同じ形・
  // 等価条件のみで複合インデックス不要）。type を絞らない旧クエリは、公開画像等が
  // 大量にある環境だと fsLimit(CAP) の先頭がモデル以外で埋まり1件も拾えないため、
  // 旧データ（type フィールド無し）救済のフォールバックとして残す。
  // 所有判定は S.Model 本体（DssDashboard）と同じ ownerId / authorId / createdBy の3通り。
  try {
    if (userId) {
      for (const ownerField of ['ownerId', 'authorId', 'createdBy']) {
        try {
          const s = await getDocs(query(
            collection(db, 'assets'),
            where('type', '==', '3d-model'), where(ownerField, '==', userId), fsLimit(CAP),
          ));
          s.docs.forEach(d => push(mapGlobal(d.id, d.data() as any, 'private')));
        } catch { /* フィールド無し環境・インデックス未整備は無視 */ }
      }
    }
    const pubT = await getDocs(query(
      collection(db, 'assets'),
      where('type', '==', '3d-model'), where('visibility', '==', 'public'), fsLimit(CAP),
    ));
    pubT.docs.forEach(d => push(mapGlobal(d.id, d.data() as any, 'public')));

    // ── フォールバック（type フィールドの無い旧データ用・広め取得 + isModelish 篩）──
    if (userId) {
      const ps = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', userId), fsLimit(CAP)));
      ps.docs.forEach(d => { const x = d.data() as any; if (isModelish(x)) push(mapGlobal(d.id, x, 'private')); });
    }
    const pubV = await getDocs(query(collection(db, 'assets'), where('visibility', '==', 'public'), fsLimit(CAP)));
    pubV.docs.forEach(d => { const x = d.data() as any; if (isModelish(x)) push(mapGlobal(d.id, x, 'public')); });
    try {
      const pubI = await getDocs(query(collection(db, 'assets'), where('isPublic', '==', true), fsLimit(CAP)));
      pubI.docs.forEach(d => { const x = d.data() as any; if (isModelish(x)) push(mapGlobal(d.id, x, 'public')); });
    } catch { /* isPublic フィールド無し環境 */ }
  } catch (e) {
    console.warn('[autoLayout] global models 取得失敗:', e);
  }

  const bySource = out.reduce((m: Record<string, number>, a: any) => {
    m[a._source] = (m[a._source] || 0) + 1; return m;
  }, {});
  console.log(`[autoLayout] 家具候補: ${out.length} 件`, bySource);
  return out;
}

/**
 * ルールベースで自動レイアウトを実行し、結果を Firestore のプランドキュメントへ保存する。
 */
export async function runAutoLayoutFromChat(
  projectId: string,
  planId: string,
  options: ChatAutoLayoutOptions
): Promise<ChatAutoLayoutResult> {
  const {
    userId,
    buildingType = 'residential',
    roomWidthMm = 5000,
    roomDepthMm = 4000,
    onProgress,
  } = options;

  // 家具候補をプロジェクト→private→公開モデルから自動取得（プロジェクト未登録でも配置可能に）。
  onProgress?.('家具を選定中...');
  const availableAssets = await buildAvailableFurniture(projectId, userId);
  onProgress?.(`家具候補 ${availableAssets.length} 件から配置中...`);

  // 2. ZoneData を部屋全体から生成（1ゾーン = 部屋全体）
  const widthM = roomWidthMm / 1000;
  const depthM = roomDepthMm / 1000;
  const zoneData: ZoneData = {
    zoneId: 'chat_auto_zone',
    polygon: [
      { x: 0,      z: 0 },
      { x: widthM, z: 0 },
      { x: widthM, z: depthM },
      { x: 0,      z: depthM },
    ],
    bounds: { minX: 0, minZ: 0, maxX: widthM, maxZ: depthM },
    buildingType,
  };

  // 3. ルールベースレイアウト実行（rules-only でAI呼び出しをスキップ）
  const { placements, sessionId } = await runAutoLayout(
    zoneData,
    [],
    availableAssets,
    0,
    {
      userId,
      projectId,
      mode: 'rules-only',
      setProgressMessage: onProgress,
      buildingType,
    }
  );

  // 4. PlacementItem[] → layout items 形式へ変換
  const now = Date.now();
  const newItems = placements.map(p => ({
    id: p.id,
    kind: 'model' as const,
    modelId: p.entityId,
    assetId: p.entityId,
    title: p.name || p.snapshot?.title || 'Item',
    name: p.name || p.snapshot?.title || 'Item',
    label: p.name || p.snapshot?.title || 'Item',
    brand: p.snapshot?.brand || '',
    ownerHandle: '',
    type: 'furniture_set',
    subType: '',
    group: '',
    thumbUrl: p.snapshot?.thumbnailUrl,
    glbUrl: p.glbUrl || p.snapshot?.glbUrl || '',
    transform: {
      position: [
        p.transform.position.x,
        p.transform.position.y,
        p.transform.position.z,
      ] as [number, number, number],
      rotation: [
        0,
        (p.transform.rotation.y * Math.PI) / 180,
        0,
      ] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    zoneId: 'chat_auto_zone',
    createdAtMs: now,
  }));

  // 5. Firestore のプランドキュメントへ書き込む
  onProgress?.('レイアウトを保存中...');
  const planRef = doc(
    db,
    'projects', projectId,
    'workspaces', WORKSPACE_ID,
    'layouts', planId
  );
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) {
    throw new Error(`planId "${planId}" が見つかりません (project: ${projectId})`);
  }
  const existingLayout = (planSnap.data() as any)?.layout ?? { items: [] };
  await updateDoc(planRef, {
    layout: { ...existingLayout, items: newItems },
    updatedAt: serverTimestamp(),
  });

  return { placedCount: newItems.length, sessionId, candidateCount: availableAssets.length };
}

// ── レンダー対象の解決（Base → Plan → Option の曖昧性解消）─────────────────────

export interface RenderTargetChoice { id: string; label: string; }
export type RenderTargetResolution =
  | { kind: 'leaf'; leafId: string; baseId: string }   // 一意に定まった（描画可能なリーフ＝Plan/Option）
  | { kind: 'choice'; candidates: RenderTargetChoice[] } // 複数候補 → ユーザーに選ばせる
  | { kind: 'error'; error: string };

/**
 * 与えられた id（Base / Plan / Option いずれか）から、実際にレンダリングすべきリーフ
 * （家具を持つ Plan か Option）を解決する。複数候補があれば choice を返す（黙って推測しない）。
 * - Plan = where(rootBaseId==base, planType==plan)
 * - Option = where(parentPlanId==plan, planType==option)
 */
export async function resolveRenderTarget(projectId: string, id: string): Promise<RenderTargetResolution> {
  const col = collection(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts');
  const snap = await getDoc(doc(col, id));
  if (!snap.exists()) return { kind: 'error', error: `"${id}" が見つかりません` };
  const data = snap.data() as any;

  const getOptions = async (planId: string): Promise<{ id: string; name: string }[]> => {
    const s = await getDocs(query(col, where('parentPlanId', '==', planId), where('planType', '==', 'option')));
    return s.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Option' }));
  };

  // Option を直接渡された → それがリーフ。base は rootBaseId（無ければ親プランから）。
  if (data.planType === 'option') {
    let baseId: string | undefined = data.rootBaseId;
    if (!baseId && data.parentPlanId) {
      const ps = await getDoc(doc(col, data.parentPlanId));
      baseId = ps.exists() ? (ps.data() as any).rootBaseId : undefined;
    }
    return { kind: 'leaf', leafId: id, baseId: baseId || id };
  }

  // Plan → option が無ければ Plan 自体、1つなら自動、複数なら選択。
  if (data.planType === 'plan') {
    const opts = await getOptions(id);
    const baseId = data.rootBaseId || id;
    if (opts.length === 0) return { kind: 'leaf', leafId: id, baseId };
    if (opts.length === 1) return { kind: 'leaf', leafId: opts[0].id, baseId };
    return { kind: 'choice', candidates: opts.map(o => ({ id: o.id, label: `${data.name || 'Plan'} / ${o.name}` })) };
  }

  // Base（または不明）→ 配下の Plan/Option をリーフ列挙。
  const plansSnap = await getDocs(query(col, where('rootBaseId', '==', id), where('planType', '==', 'plan')));
  const plans = plansSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Plan' }));
  if (plans.length === 0) return { kind: 'leaf', leafId: id, baseId: id }; // Plan が無ければ Base 躯体のみ描画
  const leaves: RenderTargetChoice[] = [];
  for (const p of plans) {
    const opts = await getOptions(p.id);
    if (opts.length === 0) leaves.push({ id: p.id, label: p.name });
    else for (const o of opts) leaves.push({ id: o.id, label: `${p.name} / ${o.name}` });
  }
  if (leaves.length === 1) return { kind: 'leaf', leafId: leaves[0].id, baseId: id };
  return { kind: 'choice', candidates: leaves };
}

// ── 家具配置の対象解決（Plan 単位。家具配置は Plan の役割でOptionはPlanを継承）─────

export type PlacementResolution =
  | { kind: 'plan'; planId: string; baseId: string }
  | { kind: 'choice'; candidates: { id: string; label: string }[] }
  | { kind: 'error'; error: string };

/**
 * 家具配置の対象を Plan 単位で解決する。
 * - Option を渡されたら親 Plan に解決（家具配置は Plan の役割）。
 * - Plan を渡されたらそれ。
 * - Base を渡されたら配下 Plan を列挙（1つなら自動・複数なら choice）。
 * 候補ラベルは「プロジェクト名 / Base名 / Plan名」で表示する。
 */
export async function resolvePlacementTarget(
  projectId: string,
  id: string,
  projectName: string,
): Promise<PlacementResolution> {
  const col = collection(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts');
  const snap = await getDoc(doc(col, id));
  if (!snap.exists()) return { kind: 'error', error: `"${id}" が見つかりません` };
  const data = snap.data() as any;

  // Option → 親 Plan へ解決
  if (data.planType === 'option') {
    const planId = data.parentPlanId;
    if (!planId) return { kind: 'error', error: 'このオプションの親プランが特定できません' };
    const pSnap = await getDoc(doc(col, planId));
    const baseId = (pSnap.exists() ? (pSnap.data() as any).rootBaseId : data.rootBaseId) || data.rootBaseId;
    return { kind: 'plan', planId, baseId: baseId || planId };
  }

  // Plan → そのまま
  if (data.planType === 'plan') {
    return { kind: 'plan', planId: id, baseId: data.rootBaseId || id };
  }

  // Base → 配下 Plan を列挙
  const baseName = data.name || 'Base';
  const plansSnap = await getDocs(query(col, where('rootBaseId', '==', id), where('planType', '==', 'plan')));
  const plans = plansSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Plan' }));
  if (plans.length === 0) return { kind: 'plan', planId: id, baseId: id }; // Plan が無ければ Base 自体
  if (plans.length === 1) return { kind: 'plan', planId: plans[0].id, baseId: id };
  return { kind: 'choice', candidates: plans.map(p => ({ id: p.id, label: `${projectName} / ${baseName} / ${p.name}` })) };
}

/**
 * プロジェクト内の全 Plan を「プロジェクト名 / Base名 / Plan名」で列挙する（配置先未指定時の選択肢用）。
 */
export async function listPlacementPlans(
  projectId: string,
  projectName: string,
): Promise<{ id: string; label: string; baseId: string }[]> {
  const col = collection(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts');
  const basesSnap = await getDocs(query(col, where('planType', '==', 'base')));
  const out: { id: string; label: string; baseId: string }[] = [];
  for (const b of basesSnap.docs) {
    const baseName = (b.data() as any).name || 'Base';
    const plansSnap = await getDocs(query(col, where('rootBaseId', '==', b.id), where('planType', '==', 'plan')));
    for (const p of plansSnap.docs) {
      out.push({ id: p.id, label: `${projectName} / ${baseName} / ${(p.data() as any).name || 'Plan'}`, baseId: b.id });
    }
  }
  return out;
}

/**
 * プロジェクト内の「描画/配置可能なリーフ（Plan/Option）」を全 Base 横断で列挙する。
 * 配置先や対象が未指定のとき、選択肢として提示するために使う。
 */
export async function listRenderableLeaves(
  projectId: string
): Promise<{ id: string; label: string; baseId: string }[]> {
  const col = collection(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts');
  const basesSnap = await getDocs(query(col, where('planType', '==', 'base')));
  const out: { id: string; label: string; baseId: string }[] = [];
  for (const b of basesSnap.docs) {
    const baseName = (b.data() as any).name || 'Base';
    const plansSnap = await getDocs(query(col, where('rootBaseId', '==', b.id), where('planType', '==', 'plan')));
    for (const p of plansSnap.docs) {
      const planName = (p.data() as any).name || 'Plan';
      const optsSnap = await getDocs(query(col, where('parentPlanId', '==', p.id), where('planType', '==', 'option')));
      if (optsSnap.empty) {
        out.push({ id: p.id, label: `${baseName} / ${planName}`, baseId: b.id });
      } else {
        for (const o of optsSnap.docs) {
          out.push({ id: o.id, label: `${baseName} / ${planName} / ${(o.data() as any).name || 'Option'}`, baseId: b.id });
        }
      }
    }
  }
  return out;
}

/**
 * プラン1件の詳細を返す（家具点数・ゾーン有無・代表サムネ等）。ヘッドレス読取。
 */
export async function getLayoutDetail(
  projectId: string,
  planId: string
): Promise<ChatLayoutDetail> {
  const ref = doc(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error(`planId "${planId}" が見つかりません (project: ${projectId})`);
  }
  const x = snap.data() as any;
  const items = x.layout?.items;
  return {
    id: planId,
    name: x.name || 'Untitled',
    planType: x.planType || 'plan',
    status: x.status || 'draft',
    itemCount: Array.isArray(items) ? items.length : 0,
    hasZones: !!(x.zones?.length || x.zoning),
    thumbnailUrl: x.thumbnailUrl ?? null,
    updatedAt: x.updatedAt ?? null,
  };
}

/**
 * プランの成果物（レンダー画像＋代表サムネ）を返す。サイトのギャラリー/レイアウト
 * セクションへ add_asset_to_section するための入力。ヘッドレス読取。
 * renders: projects/{projectId}/workspaces/layout/layouts/{planId}/renders
 */
export async function getLayoutOutputs(
  projectId: string,
  planId: string
): Promise<ChatLayoutOutputs> {
  const ref = doc(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error(`planId "${planId}" が見つかりません (project: ${projectId})`);
  }
  const x = snap.data() as any;

  const renders: ChatLayoutRender[] = [];
  try {
    const rSnap = await getDocs(
      collection(db, 'projects', projectId, 'workspaces', WORKSPACE_ID, 'layouts', planId, 'renders')
    );
    rSnap.docs.forEach(d => {
      const r = d.data() as any;
      const url = r.url ?? r.downloadUrl ?? r.imageUrl ?? r.storageUrl ?? r.thumbnailUrl;
      if (url) renders.push({ id: d.id, url: url as string });
    });
  } catch {
    /* renders サブコレクション無し → 空 */
  }

  return {
    planId,
    name: x.name || 'Untitled',
    thumbnailUrl: x.thumbnailUrl ?? null,
    renders,
    renderCount: renders.length,
  };
}
