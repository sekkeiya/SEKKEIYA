// ──────────────────────────────────────────────────────────────────────────────
// テクスチャのグループ化。
// PBR テクスチャは「ベースカラー / ノーマル / ラフネス / AO（＋メタルネス）」が
// ひとまとまりで 1 つのマテリアルを成す。S.Image ではこれらを 1 枚の重ねカードに束ね、
// 一番上にベースカラーを見せる。判定は「サブフォルダ優先 ＋ ファイル名補完」。
// ──────────────────────────────────────────────────────────────────────────────

export type TextureSlot = 'albedo' | 'normal' | 'roughness' | 'ao' | 'metalness';

/** スロットの表示順・ラベル。先頭（albedo）がカードの表紙＝ベースカラー。 */
export const TEXTURE_SLOTS: { key: TextureSlot; label: string; short: string }[] = [
  { key: 'albedo', label: 'ベースカラー', short: 'Base' },
  { key: 'normal', label: 'ノーマル', short: 'Normal' },
  { key: 'roughness', label: 'ラフネス', short: 'Rough' },
  { key: 'ao', label: 'AO', short: 'AO' },
  { key: 'metalness', label: 'メタルネス', short: 'Metal' },
];

export const TEXTURE_SLOT_LABEL: Record<TextureSlot, string> = TEXTURE_SLOTS.reduce(
  (acc, s) => { acc[s.key] = s.label; return acc; },
  {} as Record<TextureSlot, string>,
);

/** ファイル名（拡張子なし）から末尾のスロット語を取り除く際に使うトークン。 */
const SLOT_TOKENS = [
  'basecolor', 'base_color', 'albedo', 'diffuse', 'color', 'col',
  'normal', 'nrm', 'norm', 'nor',
  'roughness', 'rough', 'rgh',
  'ao', 'occlusion', 'ambientocclusion', 'lightmap', 'light_map',
  'metalness', 'metallic', 'metal', 'mtl',
  'height', 'disp', 'displacement', 'bump',
];

// 解像度・付帯トークン（末尾から除去）。マテリアル ID を誤って削らないよう、
// 解像度・倍率・preview 等の「明確に素材名でない語」に限定する（任意桁の数値は剥がさない）。
const NOISE_TOKENS = /^(\d+k|[1248]k|2x|4x|8x|hi|lo|hires|highres|preview|map|tex|texture)$/;

/** ファイル名からテクスチャスロットを推定する（dsmt の slotFromFilename と同等）。 */
export function slotFromFilename(name: string): TextureSlot | null {
  const stem = (name || '').toLowerCase().replace(/\.[^.]+$/, '').trim();
  if (/(^|[_-])(normal|nrm|norm)$|(^|[_-])n$/.test(stem) || stem.includes('normal')) return 'normal';
  if (stem.includes('rough')) return 'roughness';
  if (/(^|[_-])(ao|occlusion|ambientocclusion)$/.test(stem) || stem.includes('occlusion') || stem === 'ao') return 'ao';
  if (stem.includes('lightmap') || stem.includes('light_map')) return 'ao';
  if (stem.includes('metal')) return 'metalness';
  if (stem.includes('albedo') || stem.includes('basecolor') || stem.includes('base_color') || stem.includes('diffuse') || stem.includes('color')) return 'albedo';
  return null;
}

/** ファイル名（拡張子なし）からスロット・解像度トークンを末尾から剥がしてマテリアル名を得る。 */
function materialKeyFromFilename(name: string): string {
  const stem = (name || '').toLowerCase().replace(/\.[^.]+$/, '').trim();
  let parts = stem.split(/[_\-\s]+/).filter(Boolean);
  // 末尾から既知のスロット語・ノイズ語を可能な限り除去
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (SLOT_TOKENS.includes(last) || NOISE_TOKENS.test(last)) {
      parts = parts.slice(0, -1);
    } else {
      break;
    }
  }
  return parts.join('_');
}

// マテリアル名のトークン → 日本語タグ。建築/インテリア素材の語彙を中心に。
const TAG_DICT: Record<string, string> = {
  // 部位・用途
  wall: '壁', walls: '壁', floor: '床', floors: '床', ceiling: '天井', roof: '屋根',
  exterior: '外装', interior: '内装', facade: 'ファサード', outdoor: '屋外', indoor: '屋内',
  // 素材
  wood: '木', timber: '木', oak: 'オーク', walnut: 'ウォルナット', plywood: '合板',
  woven: '織り', fabric: 'ファブリック', textile: 'テキスタイル', cloth: '布',
  wallcovering: '壁紙', wallpaper: '壁紙', tile: 'タイル', tiles: 'タイル',
  ceramic: 'セラミック', porcelain: '磁器', concrete: 'コンクリート', cement: 'セメント',
  brick: 'レンガ', stone: '石', marble: '大理石', granite: '御影石', terrazzo: 'テラゾー',
  metal: '金属', steel: '鋼', iron: '鉄', aluminum: 'アルミ', copper: '銅', brass: '真鍮',
  plaster: '漆喰', stucco: 'スタッコ', leather: 'レザー', carpet: 'カーペット', rug: 'ラグ',
  paper: '紙', glass: 'ガラス', plastic: 'プラスチック', vinyl: 'ビニル', rubber: 'ゴム',
  // 仕上げ・質感
  matte: 'マット', gloss: '光沢', glossy: '光沢', satin: 'サテン', polished: '研磨',
  rough: 'ラフ', smooth: 'スムース', weathered: '風化', rustic: 'ラスティック',
  // 色
  white: '白', black: '黒', gray: 'グレー', grey: 'グレー', greige: 'グレージュ',
  beige: 'ベージュ', brown: '茶', red: '赤', blue: '青', green: '緑', yellow: '黄',
  earth: 'アース', natural: 'ナチュラル', dark: 'ダーク', light: 'ライト',
};

// ── 用途・部位（どこに使える素材か）の推定 ───────────────────────────────
// 部位カテゴリは S.Layout 自動ラベル / S.Material と同じ正典 4 種に統一する：
//   床 / 内壁 / 外壁 / 天井（= MaterialApplication floor/inner_wall/outer_wall/ceiling）。
// これにより「面ラベル → material.applications → テクスチャ」が同じ語彙で一直線に繋がり、
// 自動マテリアル（autoMaterialPipeline の appMatch）が適切な面に適切な素材を選べる。
// 室内/屋外は内壁/外壁の判定材料 兼 補助表示として別軸で保持する。
export const TEXTURE_APPLICATIONS = ['床', '外床', '内壁', '外壁', '天井'] as const;
export type TextureApplication = (typeof TEXTURE_APPLICATIONS)[number];
export const TEXTURE_ENVIRONMENTS = ['室内', '屋外'] as const;
export type TextureEnvironment = (typeof TEXTURE_ENVIRONMENTS)[number];

/** TextureApplication → S.Material の MaterialApplication キー（連携用）。 */
export const TEXTURE_APP_TO_MATERIAL_KEY: Record<TextureApplication, 'floor' | 'outer_floor' | 'inner_wall' | 'outer_wall' | 'ceiling'> = {
  床: 'floor', 外床: 'outer_floor', 内壁: 'inner_wall', 外壁: 'outer_wall', 天井: 'ceiling',
};

type Surface = '床' | '壁' | '天井';
// 明示的な部位キーワード（中間表現は床/壁/天井。壁は室内/屋外で内壁/外壁へ振り分ける）。
const SURFACE_KEYWORDS: { keys: string[]; surface: Surface }[] = [
  { keys: ['floor', 'flooring', 'parquet', 'tatami', 'lvt', 'deck', 'terrace', 'patio', '床', 'フロア', 'フローリング', '寄木', 'デッキ', 'テラス', '土間'], surface: '床' },
  { keys: ['ceiling', 'soffit', '天井'], surface: '天井' },
  { keys: ['wall', 'wallpaper', 'wallcovering', 'cloth', 'paneling', 'siding', '壁', '外壁', '壁紙', 'クロス'], surface: '壁' },
];
const OUTDOOR_KEYWORDS = ['exterior', 'outdoor', 'facade', 'siding', 'roof', 'weather', 'deck', 'terrace', 'patio', 'balcony', '外装', '外壁', '屋根', '屋外', 'ファサード', 'デッキ', 'テラス', 'バルコニー', '土間', '外構'];
const INDOOR_KEYWORDS = ['interior', 'indoor', '内装', '室内'];
const MATERIAL_APP_DEFAULTS: { keys: string[]; surfaces: Surface[]; envs: TextureEnvironment[] }[] = [
  { keys: ['plaster', 'stucco', '漆喰', 'スタッコ'],            surfaces: ['壁', '天井'], envs: ['室内'] },
  { keys: ['wallpaper', 'wallcovering', '壁紙', 'クロス'],       surfaces: ['壁'],         envs: ['室内'] },
  { keys: ['carpet', 'rug', 'カーペット', 'ラグ', 'tatami', '畳'], surfaces: ['床'],         envs: ['室内'] },
  { keys: ['flooring', 'parquet', 'フローリング', '寄木'],        surfaces: ['床'],         envs: ['室内'] },
  { keys: ['tile', 'ceramic', 'porcelain', 'mosaic', 'タイル', '磁器', 'モザイク'], surfaces: ['床', '壁'], envs: ['室内', '屋外'] },
  { keys: ['brick', 'stone', 'marble', 'granite', 'レンガ', '石', '大理石', '御影'], surfaces: ['壁'], envs: ['室内', '屋外'] },
  { keys: ['concrete', 'mortar', 'cement', 'コンクリート', 'モルタル', 'セメント'], surfaces: ['床', '壁'], envs: ['室内', '屋外'] },
  { keys: ['wood', 'timber', 'plank', 'oak', 'walnut', '木', '木材'],   surfaces: ['床', '壁'], envs: ['室内'] },
  { keys: ['fabric', 'leather', 'textile', 'ファブリック', '張地', '革', 'レザー'], surfaces: ['壁'], envs: ['室内'] },
  { keys: ['metal', 'steel', 'aluminum', '金属', '鋼', 'アルミ'],       surfaces: ['壁'], envs: ['室内', '屋外'] },
];

/** 名前から中間表現（部位 床/壁/天井 ＋ 場所 室内/屋外）を解析。 */
function analyzeUsage(name: string): { surfaces: Set<Surface>; envs: Set<TextureEnvironment> } {
  const s = (name || '').toLowerCase();
  const surfaces = new Set<Surface>();
  const envs = new Set<TextureEnvironment>();
  for (const r of SURFACE_KEYWORDS) {
    if (r.keys.some((k) => s.includes(k))) surfaces.add(r.surface);
  }
  if (OUTDOOR_KEYWORDS.some((k) => s.includes(k))) envs.add('屋外');
  if (INDOOR_KEYWORDS.some((k) => s.includes(k))) envs.add('室内');
  for (const m of MATERIAL_APP_DEFAULTS) {
    if (!m.keys.some((k) => s.includes(k))) continue;
    if (surfaces.size === 0) m.surfaces.forEach((x) => surfaces.add(x));
    if (envs.size === 0) m.envs.forEach((x) => envs.add(x));
    break;
  }
  if (envs.size === 0) envs.add('室内'); // 内装材が大多数のため既定は室内
  return { surfaces, envs };
}

const APP_ORDER: Record<TextureApplication, number> = { 床: 0, 外床: 1, 内壁: 2, 外壁: 3, 天井: 4 };

/** 部位カテゴリを正規化する（結合ルール＋必ず1つ＋規定順）。
 * - 内壁材は天井にも使えるため、内壁が付いたら天井も自動付与する。
 * - 空にはしない（既定は内壁）。 */
export function normalizeApplications(apps: TextureApplication[]): TextureApplication[] {
  const set = new Set<TextureApplication>(apps);
  // 先に空フォールバック（既定=内壁）→ その後で結合ルール（内壁→天井）を適用する。
  // 順序が逆だと、推定不能で内壁を既定にしたものに天井が付かない。
  if (set.size === 0) set.add('内壁');
  if (set.has('内壁')) set.add('天井');
  return [...set].sort((a, b) => APP_ORDER[a] - APP_ORDER[b]);
}

/** マテリアル名から部位カテゴリ（正典4種: 床/内壁/外壁/天井）を推定する。 */
export function deriveTextureApplications(name: string): TextureApplication[] {
  const { surfaces, envs } = analyzeUsage(name);
  const apps = new Set<TextureApplication>();
  if (surfaces.has('床')) {
    // 床も場所で内/外を出し分け（屋外→外床、室内→床。既定は床）。
    if (envs.has('屋外')) apps.add('外床');
    if (envs.has('室内') || !envs.has('屋外')) apps.add('床');
  }
  if (surfaces.has('天井')) apps.add('天井');
  if (surfaces.has('壁')) {
    // 壁は場所で内壁/外壁へ振り分け（室内→内壁、屋外→外壁。既定は内壁）。
    if (envs.has('屋外')) apps.add('外壁');
    if (envs.has('室内') || !envs.has('屋外')) apps.add('内壁');
  }
  // 必ず1つ＋結合ルール（内壁→天井）＋規定順に正規化。
  return normalizeApplications([...apps]);
}

/** マテリアル名から場所（室内/屋外）を推定する（補助表示用）。 */
export function deriveTextureEnvironments(name: string): TextureEnvironment[] {
  const { envs } = analyzeUsage(name);
  return (TEXTURE_ENVIRONMENTS as readonly TextureEnvironment[]).filter((e) => envs.has(e));
}

/** マテリアル名からテクスチャの種類タグ（日本語）を導出する。 */
export function deriveTextureTags(name: string): string[] {
  const tokens = (name || '').toLowerCase().split(/[_\-\s]+/).filter(Boolean);
  const tags: string[] = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) continue;            // 連番・IDは除外
    if (NOISE_TOKENS.test(t)) continue;       // 解像度等は除外
    const jp = TAG_DICT[t];
    if (jp) { if (!tags.includes(jp)) tags.push(jp); }
    else if (t.length >= 3) { if (!tags.includes(t)) tags.push(t); } // 辞書外はそのまま
  }
  return tags;
}

export interface TextureGroup {
  /** 安定したグループ ID（selectedImageId に格納するため tex:: 接頭辞付き）。 */
  id: string;
  /** 表示用マテリアル名。 */
  title: string;
  /** カードの表紙（ベースカラー、無ければ先頭のアイテム）。 */
  cover: any;
  /** 含まれる全アイテム（元の画像オブジェクト）。 */
  items: any[];
  /** スロット → アイテム の対応（推定できたもののみ）。 */
  slots: Partial<Record<TextureSlot, any>>;
  /** マテリアル名から導出した種類タグ（日本語）。 */
  tags: string[];
  /** 部位カテゴリ（正典4種: 床/内壁/外壁/天井）。自動ラベル/自動マテリアルと同じ語彙。 */
  applications: TextureApplication[];
  /** 場所（室内/屋外）。内壁/外壁の判定材料 兼 補助表示。 */
  environments: TextureEnvironment[];
  /** 手動で作ったセットか（解除可能）。 */
  manual?: boolean;
  /** 手動セットの ID（manual=true のとき）。 */
  setId?: string;
  category: 'テクスチャ';
}

/** 手動テクスチャセット（useTextureSetStore と同形）。 */
export interface ManualTextureSetInput {
  id: string;
  name: string;
  memberIds: string[];
}

/** スロット推定とタグ付けをしてグループ化された 1 件を組み立てる内部ヘルパー。 */
function makeGroup(id: string, title: string, items: any[], opts?: { manual?: boolean; setId?: string }): TextureGroup {
  const slots: Partial<Record<TextureSlot, any>> = {};
  for (const it of items) {
    const slot = slotFromFilename(String(it.name || it.title || ''));
    if (slot && !slots[slot]) slots[slot] = it;
  }
  return {
    id,
    title: title || 'マテリアル',
    cover: slots.albedo || items[0],
    items,
    slots,
    tags: deriveTextureTags(title),
    applications: deriveTextureApplications(title),
    environments: deriveTextureEnvironments(title),
    ...(opts?.manual ? { manual: true, setId: opts.setId } : {}),
    category: 'テクスチャ',
  };
}

/** 「テクスチャをセット化」ボタン用の自動グループ化。
 * マテリアルごとに別フォルダ（中身は basecolor/normal/roughness/ao 等の汎用名）という
 * 一般的な配置を想定し、**同じサブフォルダ**にある複数のテクスチャを 1 セットにまとめる。
 * 2 種以上のスロットを含むフォルダのみ対象（PBR セットらしさの判定）。
 * 直下（サブフォルダ無し）や 1 枚だけのフォルダは対象外。 */
export function autoGroupByFolder(textureImages: any[]): { name: string; memberIds: string[] }[] {
  const buckets = new Map<string, any[]>();
  for (const img of textureImages) {
    const sub = String(img.subfolder || '').replace(/\\/g, '/').replace(/\/+$/, '');
    if (!sub) continue; // フォルダ無し（直下）は自動判定しない
    const arr = buckets.get(sub);
    if (arr) arr.push(img);
    else buckets.set(sub, [img]);
  }
  const out: { name: string; memberIds: string[] }[] = [];
  for (const [sub, items] of buckets) {
    if (items.length < 2) continue;
    // 1 マテリアルの PBR マップは通常 6 枚以内（albedo/normal/roughness/ao/metalness/height）。
    // これを超えるフォルダは複数マテリアルの混在とみなし、誤った巨大セットを作らない。
    if (items.length > 6) continue;
    const slots = new Set(
      items.map((it) => slotFromFilename(String(it.name || it.title || ''))).filter(Boolean),
    );
    if (slots.size < 2) continue; // PBR セットとみなせるのは 2 スロット以上
    const name = sub.split('/').filter(Boolean).pop() || 'テクスチャセット';
    out.push({ name, memberIds: items.map((it) => String(it.id)) });
  }
  return out;
}

/** テクスチャ画像の配列をマテリアル単位のグループに束ねる。
 * 1 マテリアル = ベースカラー / ノーマル / ラフネス / AO（＋メタルネス）の一式。
 * 手動セット（manualSets）が最優先。残りは「同じフォルダ内で、ファイル名から
 * マップ接尾辞を除いた共通名」が一致するもの同士を自動グループ化する。 */
export function buildTextureGroups(textureImages: any[], manualSets: ManualTextureSetInput[] = []): TextureGroup[] {
  const groups: TextureGroup[] = [];
  const usedIds = new Set<string>();

  // 1) 手動セットを最優先で構築（メンバーが2件以上残っているもののみ）。
  const byId = new Map<string, any>();
  for (const img of textureImages) byId.set(String(img.id), img);
  for (const ms of manualSets) {
    const items = ms.memberIds.map((id) => byId.get(String(id))).filter(Boolean);
    if (items.length < 2) continue;
    items.forEach((it) => usedIds.add(String(it.id)));
    groups.push(makeGroup('tex::set::' + ms.id, ms.name, items, { manual: true, setId: ms.id }));
  }

  // 挿入順を保つため Map を使い、キー = フォルダ + マテリアル名。
  const buckets = new Map<string, { items: any[]; matName: string }>();

  for (const img of textureImages) {
    if (usedIds.has(String(img.id))) continue; // 手動セット済みは自動グループから除外
    const sub = String(img.subfolder || '').replace(/\\/g, '/');
    const matName = materialKeyFromFilename(String(img.name || img.title || img.id));
    const key = sub + '::' + matName;
    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(img);
    else buckets.set(key, { items: [img], matName });
  }

  for (const [key, { items, matName }] of buckets) {
    groups.push(makeGroup('tex::' + key, matName, items));
  }

  return groups;
}
