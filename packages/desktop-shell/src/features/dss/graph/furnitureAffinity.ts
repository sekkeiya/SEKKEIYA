// 家具間の相性スコア — 単一の正典（純関数）。
// ------------------------------------------------------------------
// 可視化(buildFurnitureGraph) と 選定エンジン(autoReplace/autoLayout) が共用する。
// ここを1箇所直せば、人が見るグラフと AI が引く候補ランクが同時に更新される（ドリフト防止）。
//
// 関係の定義（ステップ0 実測で確定, docs: project_smodels_semantic_graph）:
//   direct    : companionModels の相互 id 参照（最強・現状ほぼ空）
//   companion : companionClasses 共有 かつ subCategory 相違（椅子×テーブル＝一緒に置く）
//   similar   : subCategory 同一 かつ rooms∪zones 重なり（椅子×椅子＝置換候補）
//   contextOverlap: rooms∪zones の重なりのみ（subCategory 不問。同カテゴリ内ランク用）

export interface AffinityInput {
  id?: string;
  subCategory?: string;
  rooms?: unknown;
  zones?: unknown;
  companionClasses?: unknown;
  companionModels?: unknown;
  materials?: unknown;
  dimensions?: unknown;
  dimensionsMm?: unknown;
  metadata?: { dimensions?: unknown; [k: string]: unknown };
  [key: string]: unknown;
}

export interface Dims3 { w: number; d: number; h: number }

export interface AffinityFields {
  id: string;
  subCategory: string;
  roomsZones: Set<string>;
  companionClasses: Set<string>;
  companionIds: Set<string>;
  /** 正規化済み素材（日英ゆれ吸収, 70%充填）。空 = 未整備。*/
  materials: Set<string>;
  /** 実寸(mm)。null = 未整備（96%は充填済）。*/
  dims: Dims3 | null;
}

export const toStrArray = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter((x): x is string => x.length > 0);
  }
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
};

export const toCompanionIds = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string') {
        return (c as { id: string }).id;
      }
      return '';
    })
    .filter((x) => x.length > 0);
};

/** 2つの文字列集合の Jaccard 係数（両方空なら 0）。 */
export const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
};

// 素材の日英・表記ゆれ吸収（実測値: 木材/Oak/オーク, Leather/革 等）。オークとウォールナットは
// 別セットの判別に効くので粒度は残す（'木材'汎用語は wood に寄せる）。
const MATERIAL_SYNONYMS: Record<string, string> = {
  oak: 'oak', 'オーク': 'oak',
  walnut: 'walnut', 'ウォールナット': 'walnut',
  wood: 'wood', '木材': 'wood', '木': 'wood', '木目': 'wood',
  leather: 'leather', '革': 'leather', 'レザー': 'leather',
  steel: 'steel', 'スチール': 'steel',
  metal: 'metal', '金属': 'metal', aluminum: 'metal', 'アルミ': 'metal',
  glass: 'glass', 'ガラス': 'glass',
  fabric: 'fabric', 'ファブリック': 'fabric', '布': 'fabric', 'ファブリクス': 'fabric',
  plastic: 'plastic', 'プラスチック': 'plastic',
};
const normMaterial = (s: string): string => {
  const raw = s.trim();
  return MATERIAL_SYNONYMS[raw] ?? MATERIAL_SYNONYMS[raw.toLowerCase()] ?? raw.toLowerCase();
};

/** 実寸(mm)を正規化。{width,depth,height} か {x,y,z}。全ゼロ/無効は null。*/
const parseDims = (it: AffinityInput): Dims3 | null => {
  const d: any = it?.dimensions || it?.dimensionsMm || it?.metadata?.dimensions;
  if (!d) return null;
  const w = Number(d.width ?? d.x) || 0;
  const dep = Number(d.depth ?? d.y) || 0;
  const h = Number(d.height ?? d.z) || 0;
  return w > 0 || dep > 0 || h > 0 ? { w, d: dep, h } : null;
};

/** 寸法近接（各軸 min/max 比の平均。1=同寸, 0=大差）。有効軸がなければ null。*/
export const dimSimilarity = (a: Dims3 | null, b: Dims3 | null): number | null => {
  if (!a || !b) return null;
  let acc = 0, cnt = 0;
  for (const k of ['w', 'd', 'h'] as const) {
    const x = a[k], y = b[k];
    if (x > 0 && y > 0) { acc += Math.min(x, y) / Math.max(x, y); cnt++; }
  }
  return cnt ? acc / cnt : null;
};

/** 存在する成分だけを重み付き平均（無い成分は無視＝無回帰）。全部無ければ fallback。*/
const combine = (components: Array<[number | null, number]>, fallback: number): number => {
  let acc = 0, wsum = 0;
  for (const [v, w] of components) {
    if (v != null) { acc += v * w; wsum += w; }
  }
  return wsum > 0 ? acc / wsum : fallback;
};

/** rooms∪zones の重なり。両方未整備なら null（成分として無視させる）。*/
const ctxVal = (a: AffinityFields, b: AffinityFields): number | null =>
  a.roomsZones.size === 0 && b.roomsZones.size === 0 ? null : jaccard(a.roomsZones, b.roomsZones);

/** 素材整合。どちらか未整備なら null（片側だけでは判定しない）。*/
const matVal = (a: AffinityFields, b: AffinityFields): number | null =>
  a.materials.size === 0 || b.materials.size === 0 ? null : jaccard(a.materials, b.materials);

/** 任意の家具アイテム（S.Model `any` / project asset）から相性フィールドを正規化して取り出す。 */
export function toAffinityFields(it: AffinityInput): AffinityFields {
  return {
    id: typeof it?.id === 'string' ? it.id : '',
    subCategory: (it?.subCategory || '').toString().trim(),
    roomsZones: new Set([...toStrArray(it?.rooms), ...toStrArray(it?.zones)]),
    companionClasses: new Set(toStrArray(it?.companionClasses)),
    companionIds: new Set(toCompanionIds(it?.companionModels)),
    materials: new Set(toStrArray(it?.materials).map(normMaterial)),
    dims: parseDims(it),
  };
}

/** direct: companionModels の相互 id 参照があるか。 */
export function isDirectCompanion(a: AffinityFields, b: AffinityFields): boolean {
  return (a.companionIds.has(b.id) && b.id !== '') || (b.companionIds.has(a.id) && a.id !== '');
}

/**
 * companion（補完＝一緒に置く）: companionClasses を共有 かつ subCategory が異なる。
 * base = companionClasses Jaccard（共有1件でも下限 0.34）。これを「文脈(rooms/zones)＋素材整合」で
 * 締める：同じ部屋・同じ素材の椅子×テーブルほど高く、無関係な部屋のペアは抑制（毛玉対策・精度向上）。
 * 文脈も素材も未整備なら refine=1（＝旧挙動: base のまま。無回帰）。非該当は score 0。
 */
export function companionScore(a: AffinityFields, b: AffinityFields): { score: number; shared: string[] } {
  const shared: string[] = [];
  for (const c of a.companionClasses) if (b.companionClasses.has(c)) shared.push(c);
  const subDiffer = a.subCategory !== b.subCategory && a.subCategory !== '' && b.subCategory !== '';
  if (shared.length === 0 || !subDiffer) return { score: 0, shared: [] };

  const base = Math.max(jaccard(a.companionClasses, b.companionClasses), 0.34);
  // 文脈(0.6)＋素材(0.4) の重なり。存在する成分だけ、無ければ neutral=1。
  const refine = combine([[ctxVal(a, b), 0.6], [matVal(a, b), 0.4]], 1);
  // refine=1 → base 維持、refine=0 → base*0.35 まで抑制。
  return { score: base * (0.35 + 0.65 * refine), shared };
}

/**
 * similar（代替＝置換候補）: subCategory 同一。「寸法近接(0.45)＋文脈(0.35)＋素材(0.25)」を
 * 存在成分で重み付き平均。dimensions 96% を主軸に「同じ大きさ・同じ用途・同じ素材の椅子」を高く。
 * 成分が1つも無ければ 0。非該当(subCategory違い)は 0。
 */
export function similarScore(a: AffinityFields, b: AffinityFields): number {
  const subSame = a.subCategory === b.subCategory && a.subCategory !== '';
  if (!subSame) return 0;
  return combine([[dimSimilarity(a.dims, b.dims), 0.45], [ctxVal(a, b), 0.35], [matVal(a, b), 0.25]], 0);
}

/**
 * substituteScore（置換候補ランク・subCategory 不問）: 選定エンジンが「同カテゴリに絞った
 * 候補プール内でどれが元家具に最も近いか」を測る用途。寸法近接(0.45)＋文脈(0.35)＋素材(0.25)。
 * project asset は subCategory を持たないことがあるため subCategory ゲートを掛けない版。
 * 成分が1つも無ければ 0 → 呼び出し側は従来ロジックにフォールバック（無回帰）。
 */
export function substituteScore(a: AffinityFields, b: AffinityFields): number {
  return combine([[dimSimilarity(a.dims, b.dims), 0.45], [ctxVal(a, b), 0.35], [matVal(a, b), 0.25]], 0);
}

/**
 * contextOverlap（文脈フィット）: rooms∪zones の重なりのみ。subCategory は問わない。
 * 素材/寸法を持たない軽量用途向け（現状は substituteScore を推奨）。
 */
export function contextOverlap(a: AffinityFields, b: AffinityFields): number {
  return jaccard(a.roomsZones, b.roomsZones);
}
