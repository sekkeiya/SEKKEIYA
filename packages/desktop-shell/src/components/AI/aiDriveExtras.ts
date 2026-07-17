// AI Drive 拡張: ローカル層の読み込みと、種類（type）ファセットの定義。
// 軸A（ローカル層）と「カテゴリ／絞り込み」UI を支える小さなヘルパー群。

import { isTauri } from '../../lib/platform';
import type { AIDriveAsset } from '../../store/useAIDriveStore';

// ── 種類ファセット（type バケット） ──────────────────────────────
export type TypeBucket = 'model' | 'image' | 'video' | 'material' | 'file';

export const TYPE_FACETS: { key: TypeBucket; label: string; token: string }[] = [
  { key: 'model', label: '3Dモデル', token: '種類: 3Dモデル' },
  { key: 'image', label: '画像', token: '種類: 画像' },
  { key: 'video', label: '動画', token: '種類: 動画' },
  { key: 'material', label: '素材', token: '種類: 素材' },
  { key: 'file', label: '作業ファイル', token: '種類: 作業ファイル' },
];

/** アセットの type を粒度の粗いバケットに丸める。 */
export function assetTypeBucket(a: { type?: string }): TypeBucket {
  const t = (a.type || '').toLowerCase();
  if (t === 'model' || t === '3d-model') return 'model';
  if (t === 'image' || t === 'screenshot' || t === 'cover') return 'image';
  if (t === 'video') return 'video';
  if (t === 'material') return 'material';
  return 'file';
}

/** 種類トークン（'種類: 画像' 等）にアセットが一致するか。 */
export function matchesTypeToken(token: string, a: { type?: string }): boolean {
  const facet = TYPE_FACETS.find((f) => f.token === token);
  if (!facet) return false;
  return assetTypeBucket(a) === facet.key;
}

/** タグが「種類ファセット」のトークンか。 */
export function isTypeToken(tag: string): boolean {
  return TYPE_FACETS.some((f) => f.token === tag);
}

// カテゴリ候補から除外する“非カテゴリ”タグ（種類・システム・由来ラベル等）。
const NON_CATEGORY_TAGS = new Set([
  'ローカル', 'WorkFile', '3D Model (Global)', 'rhino', 'cat',
]);

/** カテゴリ・ファセット候補としてふさわしいタグか（AI:/Rule:/User: や種類・拡張子等は除外）。 */
export function isCategoryTag(tag: string): boolean {
  if (!tag) return false;
  if (isTypeToken(tag)) return false;
  if (NON_CATEGORY_TAGS.has(tag)) return false;
  if (/^(AI|Rule|User|Date|Color|Type|種類)\s*[:：]/.test(tag)) return false;
  if (/^[0-9a-f]{4,8}$/i.test(tag)) return false; // ハッシュ風の短いID（例: 6619b）
  if (/^[A-Z0-9]{2,5}$/.test(tag)) return false;  // 拡張子ラベル（PNG/GLB等）
  return true;
}

// ── ローカル層の読み込み ─────────────────────────────────────────
const norm = (p: string) => (p || '').replace(/\\/g, '/');
const dirOf = (p: string) => norm(p).replace(/\/[^/]*$/, '');

// PBR マップの接尾辞（S.Material の slotFromFilename と同系統）。末尾のこのトークンを
// 剥がした「ベース名」が一致する画像群を 1 つのテクスチャセットとして束ねる。
const MAP_TOKEN = '(?:albedo|basecolor|base_color|diffuse|color|col|normal|nrm|norm|rough(?:ness)?|rgh|metal(?:lic|ness)?|met|ao|occlusion|ambientocclusion|height|disp(?:lacement)?|spec(?:ular)?|gloss(?:iness)?|opacity|alpha|emiss(?:ive|ion)?|bump|lightmap)';
const MAP_SUFFIX_RE = new RegExp(`[ _-]${MAP_TOKEN}$`, 'i');

// アウトプット種別の正典・分類は store に集約（粒度判定 isReusableAsset と共有するため）。
export { OUTPUT_KINDS, OUTPUT_KIND_LABEL, assetOutputKind, type OutputKind } from '../../store/useAIDriveStore';

/** ファイル名（拡張子なし）から末尾の PBR トークンを剥がす。剥がせなければ null。 */
function stripMapSuffix(stem: string): { base: string; token: string } | null {
  const m = stem.match(MAP_SUFFIX_RE);
  if (!m || m.index === undefined) return null;
  return { base: stem.slice(0, m.index), token: m[0].replace(/^[ _-]/, '').toLowerCase() };
}

const isAlbedoToken = (t: string) => /albedo|basecolor|base_color|diffuse|^col|color/.test(t);

/**
 * 端末内 LocalAssets（画像/動画/3Dモデル）を AI Drive のアイテム形へ変換して返す。
 * テクスチャ（同フォルダ・同ベース名の PBR マップ群）は 1 セットに束ねる。
 * 実体はコピーせず asset:// 参照（convertFileSrc）。Tauri 以外では空配列。
 */
export async function loadLocalAiDriveAssets(): Promise<AIDriveAsset[]> {
  if (!isTauri()) return [];
  const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');

  const [imgs, models] = await Promise.all([
    invoke('list_local_image_assets').catch((e) => { console.warn('[AI Drive] local images failed', e); return []; }) as Promise<any[]>,
    invoke('list_local_model_assets').catch((e) => { console.warn('[AI Drive] local models failed', e); return []; }) as Promise<any[]>,
  ]);

  // ※ Rust 側 struct は #[serde(rename_all="camelCase")] のため JS には camelCase で届く
  //   （mediaType / companionGlbPath / modifiedMs / sourceLabel）。snake_case は旧互換で残す。
  const mediaTypeOf = (x: any) => x.mediaType ?? x.media_type;

  // 動画はそのまま個別アイテムに。
  const videoItems: AIDriveAsset[] = (imgs || [])
    .filter((x) => mediaTypeOf(x) === 'video')
    .map((x) => ({
      id: `local:vid:${x.id}`,
      projectId: 'local',
      name: x.name,
      type: 'video',
      storageUrl: convertFileSrc(norm(x.path)),
      thumbnailUrl: undefined,
      tags: ['ローカル', String(x.ext || '').toUpperCase()].filter(Boolean),
      createdAt: 0,
      sourceCollection: 'local',
    } as AIDriveAsset));

  // 画像は「同フォルダ × ベース名」でテクスチャセットへグルーピング。
  type Member = { x: any; token: string };
  const groups = new Map<string, { base: string; members: Member[] }>();
  const singleImages: AIDriveAsset[] = [];

  for (const x of (imgs || [])) {
    if (mediaTypeOf(x) === 'video') continue;
    const stem = String(x.name || '').replace(/\.[^.]+$/, '');
    const stripped = stripMapSuffix(stem);
    if (!stripped || !stripped.base) {
      singleImages.push({
        id: `local:img:${x.id}`,
        projectId: 'local',
        name: x.name,
        type: 'image',
        storageUrl: convertFileSrc(norm(x.path)),
        thumbnailUrl: convertFileSrc(norm(x.path)),
        tags: ['ローカル', String(x.ext || '').toUpperCase()].filter(Boolean),
        createdAt: 0,
        sourceCollection: 'local',
      } as AIDriveAsset);
      continue;
    }
    const key = `${dirOf(x.path)}|${stripped.base.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { base: stripped.base, members: [] });
    groups.get(key)!.members.push({ x, token: stripped.token });
  }

  const setItems: AIDriveAsset[] = [];
  for (const [key, g] of groups) {
    // マップが 1 枚しか無いものはセットにせず個別画像として扱う。
    if (g.members.length < 2) {
      const only = g.members[0].x;
      setItems.push({
        id: `local:img:${only.id}`,
        projectId: 'local',
        name: only.name,
        type: 'image',
        storageUrl: convertFileSrc(norm(only.path)),
        thumbnailUrl: convertFileSrc(norm(only.path)),
        tags: ['ローカル', String(only.ext || '').toUpperCase()].filter(Boolean),
        createdAt: 0,
        sourceCollection: 'local',
      } as AIDriveAsset);
      continue;
    }
    const albedo = g.members.find((m) => isAlbedoToken(m.token)) || g.members[0];
    const albedoUrl = convertFileSrc(norm(albedo.x.path));
    setItems.push({
      id: `local:texset:${key}`,
      projectId: 'local',
      name: g.base.replace(/[ _-]+$/, ''),
      type: 'material',
      storageUrl: albedoUrl,
      thumbnailUrl: albedoUrl,
      tags: ['ローカル', '素材', 'テクスチャ'],
      createdAt: 0,
      sourceCollection: 'local',
      childCount: g.members.length,
      setMembers: g.members.map((m) => ({ name: m.x.name, url: convertFileSrc(norm(m.x.path)), slot: m.token })),
    } as AIDriveAsset);
  }

  const modelItems: AIDriveAsset[] = (models || []).map((x) => {
    const companion = x.companionGlbPath ?? x.companion_glb_path;
    const modified = x.modifiedMs ?? x.modified_ms;
    return {
      id: `local:model:${x.id}`,
      projectId: 'local',
      name: x.name,
      type: '3d-model',
      storageUrl: companion ? convertFileSrc(norm(companion)) : undefined,
      thumbnailUrl: undefined,
      tags: ['ローカル', String(x.ext || '').toUpperCase(), x.sourceLabel ?? x.source_label].filter(Boolean),
      createdAt: typeof modified === 'number' ? modified : 0,
      sourceCollection: 'local',
    } as AIDriveAsset;
  });

  return [...setItems, ...singleImages, ...videoItems, ...modelItems];
}
