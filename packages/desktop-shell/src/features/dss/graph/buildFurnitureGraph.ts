// 家具セマンティックグラフ Phase A — 相性グラフの純関数（描画非依存・テスト可能）。
// ------------------------------------------------------------------
// S.Model の家具アイテム配列から、家具同士の関係エッジを算出する。
// ステップ0 の実データ実測（n=50）で確定した設計：
//   - rooms/zones は 94% と密すぎ → 単純共有ではなく Jaccard + ノード毎 top-K に制限。
//   - companionClasses は 72%。ただし中身はセット名（例: ダイニングセット）で、
//     椅子・テーブル双方に重複付与される → subCategory で「補完/代替」を割る。
//   - companionModels は 0% → direct 分岐は残すが現状ほぼ描画されない（将来点灯）。
// エッジ種：
//   direct    : companionModels の id 直参照（最強・現状ほぼ空）
//   companion : companionClasses を共有 かつ subCategory が異なる（椅子×テーブル＝一緒に置く）
//   similar   : subCategory が同一 かつ rooms∪zones の Jaccard ≥ 閾値（椅子×椅子＝置き換え候補）
// 同一ペアには precedence direct > companion > similar で1本だけ張る。
// 相性スコアの定義は furnitureAffinity.ts（単一の正典。選定エンジンと共用）に委譲する。

import {
  toAffinityFields, isDirectCompanion, companionScore, similarScore,
  type AffinityFields,
} from './furnitureAffinity';

export type FurnitureGraphKind = 'direct' | 'companion' | 'similar';

/** 入力アイテム（S.Model の `any` から必要項目だけ narrow に拾う）。*/
export interface FurnitureItemInput {
  id: string;
  title?: string;
  name?: string;
  subCategory?: string;
  mainCategory?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  previewUrl?: string;
  thumbnailFilePath?: { url?: string };
  rooms?: unknown;
  zones?: unknown;
  companionClasses?: unknown;
  companionModels?: unknown;
  [key: string]: unknown;
}

export interface FurnitureGraphNode {
  id: string;
  label: string;
  subCategory: string;
  thumbnailUrl?: string;
  isolated: boolean;
  /** 選択コールバックにそのまま渡すための元アイテム。*/
  raw: FurnitureItemInput;
}

export interface FurnitureGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: FurnitureGraphKind;
  /** 0..1 のスコア（Jaccard 等）。太さ・並び替えに使う。*/
  weight: number;
  /** なぜ繋がるかの人間可読ラベル（例: "同セット: ダイニングセット"）。*/
  reason: string;
}

export interface BuildFurnitureGraphOptions {
  /** 中心アイテム。指定時はここから hops ホップの ego-graph を返す（既定ビュー）。*/
  centerId?: string | null;
  /** ego 展開のホップ数（既定 1）。*/
  hops?: number;
  /** ノード毎に保持するエッジ上限（既定 6）。毛玉化を防ぐ相互 top-K。*/
  perNodeCap?: number;
  /** similar エッジの rooms∪zones Jaccard 閾値（既定 0.5）。*/
  similarJaccardMin?: number;
  /** similar（代替）エッジを含めるか（既定 true）。*/
  includeSimilar?: boolean;
}

export interface FurnitureGraphResult {
  nodes: FurnitureGraphNode[];
  edges: FurnitureGraphEdge[];
  /** 全体グラフでエッジを1本も持たなかった孤立ノード id（=メタ未整備の炙り出し）。*/
  isolatedIds: string[];
  stats: {
    total: number;
    edgeCount: number;
    isolatedCount: number;
    /** ノード毎キャップで落としたエッジ数（沈黙で切らないための可視化用）。*/
    capped: number;
    /** ego 抽出でビューに出したノード数（center 無指定時は非孤立ノード数）。*/
    shownNodes: number;
  };
}

// ---- 表示用ヘルパー（相性ロジックは furnitureAffinity.ts に集約）---------

const pickThumb = (it: FurnitureItemInput): string | undefined =>
  it.thumbnailUrl || it.imageUrl || it.previewUrl || it.thumbnailFilePath?.url || undefined;

const pickLabel = (it: FurnitureItemInput): string =>
  (it.title || it.name || '(無題)').toString();

// ---- 内部レコード（正典の AffinityFields + 表示用の元アイテム）------------

type Rec = AffinityFields & { item: FurnitureItemInput };

const KIND_RANK: Record<FurnitureGraphKind, number> = { direct: 3, companion: 2, similar: 1 };
const pairKey = (a: string, b: string): string => (a < b ? `${a} ${b}` : `${b} ${a}`);

/**
 * 家具の相性グラフを構築する（純関数・副作用なし）。
 * center 指定時は ego-graph（既定）、無指定時は全体の非孤立グラフを返す。
 */
export function buildFurnitureGraph(
  itemsRaw: FurnitureItemInput[],
  options: BuildFurnitureGraphOptions = {},
): FurnitureGraphResult {
  const {
    centerId = null,
    hops = 1,
    perNodeCap = 6,
    similarJaccardMin = 0.5,
    includeSimilar = true,
  } = options;

  // 1. 正規化（id 重複はスキップ）。
  const recs: Rec[] = [];
  const seen = new Set<string>();
  for (const it of itemsRaw || []) {
    const id = typeof it?.id === 'string' ? it.id : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    recs.push({ ...toAffinityFields(it), id, item: it });
  }
  const total = recs.length;
  const byId = new Map(recs.map((r) => [r.id, r] as [string, Rec]));

  // 2. 候補ペア生成（転置インデックス）。companionClasses / rooms∪zones を共有するペアのみ検査。
  //    direct は id 直参照なので別途拾う。
  const buckets = new Map<string, string[]>();
  const addBucket = (token: string, id: string) => {
    const arr = buckets.get(token);
    if (arr) arr.push(id);
    else buckets.set(token, [id]);
  };
  for (const r of recs) {
    for (const c of r.companionClasses) addBucket('c ' + c, r.id);
    for (const rz of r.roomsZones) addBucket('r ' + rz, r.id);
  }
  const candidatePairs = new Set<string>();
  for (const ids of buckets.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        candidatePairs.add(pairKey(ids[i], ids[j]));
      }
    }
  }
  // direct（companionModels）は転置に載らないので明示追加。
  for (const r of recs) {
    for (const cid of r.companionIds) {
      if (byId.has(cid) && cid !== r.id) candidatePairs.add(pairKey(r.id, cid));
    }
  }

  // 3. 各候補ペアを1本のエッジに評価（precedence direct > companion > similar）。
  const rawEdges: FurnitureGraphEdge[] = [];
  for (const key of candidatePairs) {
    const [aId, bId] = key.split(' ');
    const a = byId.get(aId)!;
    const b = byId.get(bId)!;

    // direct（companionModels 相互参照）
    if (isDirectCompanion(a, b)) {
      rawEdges.push({
        id: `direct:${key}`, source: aId, target: bId, kind: 'direct', weight: 1,
        reason: '直接指定のセット家具',
      });
      continue;
    }

    // companion（補完＝一緒に置く）: セット共有 かつ 別部材
    const comp = companionScore(a, b);
    if (comp.score > 0) {
      rawEdges.push({
        id: `companion:${key}`, source: aId, target: bId, kind: 'companion', weight: comp.score,
        reason: `同セット: ${comp.shared.slice(0, 2).join('・')}`,
      });
      continue;
    }

    // similar（代替＝置き換え候補）: 同部材 かつ 空間の重なりが閾値以上
    if (includeSimilar) {
      const jz = similarScore(a, b);
      if (jz >= similarJaccardMin && jz > 0) {
        rawEdges.push({
          id: `similar:${key}`, source: aId, target: bId, kind: 'similar', weight: jz,
          reason: `${a.subCategory}・用途が近い`,
        });
      }
    }
  }

  // 4. ノード毎 top-K で毛玉を抑える（どちらかの端点で top-K に入れば残す＝相互 kNN の OR）。
  const perNode = new Map<string, FurnitureGraphEdge[]>();
  for (const e of rawEdges) {
    (perNode.get(e.source) ?? perNode.set(e.source, []).get(e.source)!).push(e);
    (perNode.get(e.target) ?? perNode.set(e.target, []).get(e.target)!).push(e);
  }
  const survivorKeys = new Set<string>();
  for (const [, list] of perNode) {
    list.sort((x, y) => KIND_RANK[y.kind] - KIND_RANK[x.kind] || y.weight - x.weight);
    for (const e of list.slice(0, perNodeCap)) survivorKeys.add(e.id);
  }
  const keptEdges = rawEdges.filter((e) => survivorKeys.has(e.id));
  const capped = rawEdges.length - keptEdges.length;

  // 5. 全体グラフでの孤立判定（ego 抽出前・炙り出し用）。
  const degree = new Map<string, number>();
  for (const e of keptEdges) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1);
    degree.set(e.target, (degree.get(e.target) || 0) + 1);
  }
  const isolatedIds = recs.filter((r) => !degree.get(r.id)).map((r) => r.id);

  // 6. ビューに出すノード集合を決める。
  const adj = new Map<string, Set<string>>();
  for (const e of keptEdges) {
    (adj.get(e.source) ?? adj.set(e.source, new Set()).get(e.source)!).add(e.target);
    (adj.get(e.target) ?? adj.set(e.target, new Set()).get(e.target)!).add(e.source);
  }
  let viewIds: Set<string>;
  if (centerId && byId.has(centerId)) {
    // ego-graph: center から hops ホップ BFS。
    viewIds = new Set([centerId]);
    let frontier = [centerId];
    for (let h = 0; h < Math.max(1, hops); h++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const nb of adj.get(id) || []) {
          if (!viewIds.has(nb)) { viewIds.add(nb); next.push(nb); }
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
  } else {
    // center 無指定: 非孤立ノード全部（孤立はトレイ側で別表示）。
    viewIds = new Set(recs.filter((r) => degree.get(r.id)).map((r) => r.id));
  }

  const nodes: FurnitureGraphNode[] = recs
    .filter((r) => viewIds.has(r.id))
    .map((r) => ({
      id: r.id,
      label: pickLabel(r.item),
      subCategory: r.subCategory,
      thumbnailUrl: pickThumb(r.item),
      isolated: !degree.get(r.id),
      raw: r.item,
    }));
  const viewEdges = keptEdges.filter((e) => viewIds.has(e.source) && viewIds.has(e.target));

  return {
    nodes,
    edges: viewEdges,
    isolatedIds,
    stats: {
      total,
      edgeCount: viewEdges.length,
      isolatedCount: isolatedIds.length,
      capped,
      shownNodes: nodes.length,
    },
  };
}
