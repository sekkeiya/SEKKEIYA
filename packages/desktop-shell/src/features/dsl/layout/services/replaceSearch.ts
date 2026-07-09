// 商品写真（カタログ/関連リンクのサムネ）に視覚的に似た S.Model 3Dモデルを探す。
//   - CLIP 埋め込み（visionEngine）で商品画像と候補モデルのサムネを比較し、類似度順に返す。
//   - 候補プールは現在ロード済みの AI Drive アセット（3Dモデル）。同カテゴリで事前フィルタ。
//   - 候補サムネの埋め込みはモジュール内でキャッシュ（再検索を高速化）。

import { embedImage, cosineSim } from "../../../../shared/vision/visionEngine";
import { getDriveAssets } from "../../../drive/driveAccess";
import { collection, getDocs, query, where, and as fsAnd, or as fsOr, limit } from "firebase/firestore";
import { db, auth } from "../../../../lib/firebase/client";
import type { CatalogVisionItem } from "../../../dsk/catalog/catalogVisionStore";

export interface RankedModel {
  id: string;
  title: string;
  glbUrl: string;
  thumbUrl: string | null;
  dimensions: any;
  similarity: number; // 0..1
  isLocal?: boolean;
}

// assetId → CLIP 埋め込み（サムネ）。再検索でも使い回す。
const embedCache = new Map<string, number[]>();

function glbUrlOf(a: any): string | null {
  return a?.glbUrl || a?.storageUrl || a?.downloadUrl || a?.url || null;
}
function thumbOf(a: any): string | null {
  return a?.thumbnailUrl || a?.thumbUrl || a?.previewUrl || a?.imageUrl || null;
}
function isModel(a: any): boolean {
  // type が 3d-model、または glb らしき URL を持つもの。
  const t = String(a?.type || "").toLowerCase();
  if (t.includes("3d") || t.includes("model")) return true;
  const g = glbUrlOf(a);
  return !!g && /\.(glb|gltf)(\?|#|$)/i.test(g);
}

/**
 * 商品画像に似た S.Model モデルを類似度順に返す。
 * @param productImage 商品サムネ（URL / dataURL / Blob）
 * @param opts.mainCategory / macroCategory 同カテゴリで事前フィルタ
 * @param opts.excludeId 現在の家具自身を除外
 */
export async function findSimilarModels(
  productImage: string | Blob,
  opts: { mainCategory?: string | null; macroCategory?: string | null; excludeId?: string | null; topN?: number; maxCandidates?: number } = {},
): Promise<RankedModel[]> {
  const topN = opts.topN ?? 8;
  const maxCandidates = opts.maxCandidates ?? 40;

  // スコープ非依存の集約プールから3Dモデル候補を取得（driveAccess = 単一の読み取り窓口）。
  // 自分の 非公開＋公開（クラウド）。※他者公開モデルの広域検索は findSimilarModelsBroad が担当。
  const all = getDriveAssets({ media: 'model', layers: ['private', 'public'] }) as any[];
  let cands = all.filter((a) => a && isModel(a) && glbUrlOf(a) && thumbOf(a) && a.id !== opts.excludeId);

  // 同カテゴリで絞る（メイン→マクロの順。一致が少なすぎる場合は緩める）。
  const byMain = opts.mainCategory ? cands.filter((a) => a.mainCategory === opts.mainCategory) : [];
  const byMacro = opts.macroCategory ? cands.filter((a) => a.macroCategory === opts.macroCategory) : [];
  if (byMain.length >= 3) cands = byMain;
  else if (byMacro.length >= 3) cands = byMacro;
  // それ以外は全件（カテゴリ情報が無い/少ない場合のフォールバック）。

  cands = cands.slice(0, maxCandidates);
  if (!cands.length) return [];

  const q = await embedImage(productImage);

  const ranked: RankedModel[] = [];
  for (const a of cands) {
    let emb = embedCache.get(a.id);
    if (!emb) {
      try {
        emb = await embedImage(thumbOf(a) as string);
        embedCache.set(a.id, emb);
      } catch {
        continue; // サムネ取得/埋め込み失敗はスキップ
      }
    }
    ranked.push({
      id: a.id,
      title: a.title || a.name || "モデル",
      glbUrl: glbUrlOf(a) as string,
      thumbUrl: thumbOf(a),
      dimensions: a.dimensions || null,
      similarity: cosineSim(q, emb),
    });
  }
  ranked.sort((x, y) => y.similarity - x.similarity);
  return ranked.slice(0, topN);
}

const tokenize = (s: any): string[] =>
  String(s || "").toLowerCase().split(/[\s/、,_\-]+/).filter(Boolean);

// クラウド候補プール（公開＋自分）のキャッシュ。←→で都度 Firestore を叩かないため。
let cloudPoolCache: { at: number; uid: string | null; models: any[] } | null = null;
const CLOUD_POOL_TTL = 120_000; // 2分
// ローカルモデルのレンダ済みサムネ ObjectURL（id→url）。再レンダ回避。
const localThumbUrlCache = new Map<string, string>();

async function fetchCloudModels(uid: string | null): Promise<any[]> {
  const col = collection(db, "assets");
  const isModelF = where("type", "==", "3d-model");
  const byId = new Map<string, any>();
  const pubSnap = await getDocs(
    query(col, fsAnd(isModelF, fsOr(where("visibility", "==", "public"), where("isPublic", "==", true))), limit(300)),
  );
  pubSnap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  if (uid) {
    const mineSnap = await getDocs(query(col, fsAnd(isModelF, where("ownerId", "==", uid)), limit(300)));
    mineSnap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
  }
  return Array.from(byId.values()).filter((a) => isModel(a) && glbUrlOf(a) && thumbOf(a));
}

async function fetchLocalModels(): Promise<any[]> {
  try {
    const { isTauri } = await import("../../../../lib/platform");
    if (!isTauri()) return [];
    const { invoke, convertFileSrc } = await import("@tauri-apps/api/core");
    const raw = (await invoke("list_local_model_assets")) as any[];
    return (raw || [])
      .map((la) => {
        const cg = la.companionGlbPath || la.companion_glb_path;
        if (!cg) return null; // プレビューGLBが無いものは類似照合対象外
        return {
          id: la.id, title: la.name, isLocal: true,
          topExt: la.ext || la.topExt, localPath: la.path,
          glbUrl: convertFileSrc(String(cg).replace(/\\/g, "/")),
          category: la.subfolder || "", tags: [] as string[],
          dimensions: null,
        };
      })
      .filter(Boolean) as any[];
  } catch (e) {
    console.warn("[findSimilarModelsBroad] local list failed", e);
    return [];
  }
}

/**
 * S.Model（クラウド: 公開＋自分 / ローカル）から、商品に視覚的に似たモデルを探す。
 * クラウドはプールをキャッシュ、ローカルはプレビューGLBをレンダして埋め込み。埋め込みは id 別キャッシュ。
 * カテゴリ/タグ/名前のトークン重なりで事前選別 → CLIP 埋め込みで cosine 類似ランキング。
 */
export async function findSimilarModelsBroad(
  product: CatalogVisionItem,
  opts: { topN?: number; maxCloud?: number; maxLocal?: number } = {},
): Promise<RankedModel[]> {
  const topN = opts.topN ?? 8;
  const maxCloud = opts.maxCloud ?? 36;
  const maxLocal = opts.maxLocal ?? 6; // レンダコストが高いので少数に絞る
  const uid = auth.currentUser?.uid || null;

  // クラウド候補（キャッシュ優先）。
  let cloud: any[];
  if (cloudPoolCache && cloudPoolCache.uid === uid && Date.now() - cloudPoolCache.at < CLOUD_POOL_TTL) {
    cloud = cloudPoolCache.models;
  } else {
    try { cloud = await fetchCloudModels(uid); cloudPoolCache = { at: Date.now(), uid, models: cloud }; }
    catch (e) { console.warn("[findSimilarModelsBroad] cloud query failed", e); cloud = cloudPoolCache?.models || []; }
  }
  const local = await fetchLocalModels();

  // 商品トークンで重なりスコア。
  const prodTokens = new Set<string>([
    ...tokenize(product.category), ...((product.tags || []).flatMap(tokenize)), ...tokenize(product.label),
  ]);
  const overlap = (m: any): number => {
    const mt = new Set<string>([...tokenize(m.category), ...((m.tags || []).flatMap(tokenize)), ...tokenize(m.title || m.name)]);
    let c = 0; mt.forEach((t) => { if (prodTokens.has(t)) c++; });
    return c;
  };

  // クラウド: 重なり優先で maxCloud。ローカル: レンダ高コストなので重なり優先で maxLocal（0件でも少数含める）。
  const pick = (arr: any[], cap: number) => {
    const s = arr.map((m) => ({ m, ov: overlap(m) })).sort((a, b) => b.ov - a.ov);
    const matched = s.filter((x) => x.ov > 0).map((x) => x.m);
    return (matched.length >= 3 ? matched : s.map((x) => x.m)).slice(0, cap);
  };
  const cands = [...pick(cloud, maxCloud), ...pick(local, maxLocal)];
  if (!cands.length) return [];

  // クエリ埋め込み（商品は索引時の CLIP 埋め込みを再利用、無ければ画像から）。
  const q = product.embedding && product.embedding.length ? product.embedding : await embedImage(product.cropDataUrl);

  const ranked: RankedModel[] = [];
  for (const a of cands) {
    let emb = embedCache.get(a.id);
    if (!emb) {
      try {
        if (a.isLocal) {
          // プレビューGLBをレンダして画像化（高コスト・初回のみ。ObjectURL を表示にも流用）。
          const { getModelImageBlob } = await import("../../../dss/utils/productImageSearch");
          const blob = await getModelImageBlob(a);
          if (!blob) continue;
          if (!localThumbUrlCache.has(a.id)) localThumbUrlCache.set(a.id, URL.createObjectURL(blob));
          emb = await embedImage(blob);
        } else {
          emb = await embedImage(thumbOf(a) as string);
        }
        embedCache.set(a.id, emb);
      } catch { continue; }
    }
    ranked.push({
      id: a.id,
      title: a.title || a.name || "モデル",
      glbUrl: glbUrlOf(a) as string,
      thumbUrl: a.isLocal ? (localThumbUrlCache.get(a.id) ?? null) : thumbOf(a),
      dimensions: a.dimensions || null,
      similarity: cosineSim(q, emb),
      isLocal: !!a.isLocal,
    });
  }
  ranked.sort((x, y) => y.similarity - x.similarity);
  return ranked.slice(0, topN);
}
