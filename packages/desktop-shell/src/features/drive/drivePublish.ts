// ── SEKKEIYA Drive アクセス層（Phase 2: 書き込み / publish）──────────────────
//
// 子アプリが「再利用できる成果物（資産）」を Drive に出す唯一の正典ヘルパー
// （＝図の「子アプリ → 出力 → Drive」）。物理的な保存先は今のまま（projectId 指定なら
// projects/{id}/assets、なければ global の assets）で、useAIDriveStore の集約リスナーが
// そのままプールに拾う＝publish 後すぐ driveAccess（読み取り）から橋渡しで取り出せる。
//
// 設計方針（2026-07-09 合意）:
//  - 橋を渡るのは「資産」だけ。作業ファイル（各アプリの編集中ファイル）はこのヘルパーの対象外で、
//    従来どおり各アプリの workFiles に残す。publish するのは “完成した再利用アウトプット” のみ。
//  - 分類が効くよう type/appScope/tags を正規化（assetOutputKind(結果) === kind になるように）。
//  - visibility は既定 'private'（未設定だと My Public/My Private の振り分けが崩れるため明示）。
//
// 既存の手書き保存（addDoc 直書き）はこのヘルパーへ寄せていく。第一号 = useAIRenderGeneration。
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase/client';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { useAIDriveStore, type OutputKind, type AIDriveAsset } from '../../store/useAIDriveStore';

export interface PublishToDriveInput {
  /** 表示名。 */
  name: string;
  /** アウトプット種別（render/model/material/texture/video/…）。分類・種別フィルタに使う。 */
  kind?: OutputKind;
  /** type の明示上書き（kind に該当が無い任意ファイル向け。例 'pdf' / 'file'）。 */
  type?: string;
  /** 既にアップロード済みの本体URL。未指定なら file からアップロードする。 */
  storageUrl?: string;
  /** storageUrl 未指定時にアップロードする画像ファイル（画像系のみ）。 */
  file?: File;
  /** サムネURL（未指定は storageUrl を流用）。 */
  thumbnailUrl?: string;
  /** プロジェクト紐付け。null/未指定なら My Library（global assets）へ。 */
  projectId?: string | null;
  /** 公開可視性。既定 'private'。 */
  visibility?: 'public' | 'private';
  /** 由来の子アプリ scope（'3dsi','3dsc','3dsmt' 等）。分類の補助。 */
  appScope?: string;
  /** 付与タグ。 */
  tags?: string[];
  /** サイズ表記/バイト数。 */
  size?: string | number;
  /** 追加メタ（プロンプト・ジョブID 等）。 */
  metadata?: Record<string, any>;
  /** 重複登録を避けるための由来キー（metadata.sourceRef に格納）。 */
  sourceRef?: Record<string, any>;
}

export interface PublishToDriveResult {
  id: string;
  collectionPath: string;
  storageUrl: string;
}

/** アウトプット種別 → 集約プールでの type（assetOutputKind が種別を復元できる値に正規化）。 */
const KIND_TO_TYPE: Record<OutputKind, string> = {
  model: 'model',
  furniture: 'model',
  render: 'image',
  texture: 'image',
  video: 'video',
  material: 'material',
  layout: 'layout',
  presentation: 'presentation',
  diagram: 'diagram',
  portfolio: 'portfolio',
  article: 'article',
};

/**
 * 再利用できる成果物を Drive（資産）へ publish する。
 * @returns 作成した資産の id と、書き込んだコレクションパス、確定した storageUrl。
 */
export async function publishToDrive(input: PublishToDriveInput): Promise<PublishToDriveResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('ログインが必要です');

  let storageUrl = input.storageUrl;
  if (!storageUrl && input.file) {
    storageUrl = await uploadImageAndGetUrl(input.file);
  }
  if (!storageUrl) throw new Error('publishToDrive: storageUrl か file のいずれかが必要です');

  const type = input.type || (input.kind ? KIND_TO_TYPE[input.kind] : undefined) || 'file';
  const visibility = input.visibility ?? 'private';
  // サムネ: 明示指定を優先。無い場合は画像のみ本体URLを流用（非画像はサムネ無し＝壊れた img を出さない）。
  const thumbnailUrl = input.thumbnailUrl || (type === 'image' ? storageUrl : undefined);

  // テクスチャは assetOutputKind がタグ優先で判定するため 'テクスチャ' タグを保証。
  const tags = [...(input.tags || [])];
  if (input.kind === 'texture' && !tags.includes('テクスチャ')) tags.push('テクスチャ');

  const doc: Record<string, any> = {
    name: input.name,
    type,
    storageUrl,
    thumbnailUrl,
    size: input.size,
    ownerId: uid,
    visibility,
    appScope: input.appScope,
    tags,
    metadata: {
      ...(input.metadata || {}),
      publishedVia: 'driveAccess',
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    },
    createdAt: Date.now(),
  };
  // 画像系は既存互換のため imageUrl も持たせる（resolveAssetPreviewUrl / 既存参照向け）。
  if (type === 'image') doc.imageUrl = storageUrl;
  // Firestore は undefined を受け付けないため除去。
  Object.keys(doc).forEach((k) => doc[k] === undefined && delete doc[k]);

  if (input.projectId) {
    doc.projectId = input.projectId;
    doc.sourceCollection = 'assets';
    const ref = await addDoc(collection(db, 'projects', input.projectId, 'assets'), doc);
    return { id: ref.id, collectionPath: `projects/${input.projectId}/assets`, storageUrl };
  }
  doc.projectId = null;
  doc.sourceCollection = 'global_assets';
  const ref = await addDoc(collection(db, 'assets'), doc);
  return { id: ref.id, collectionPath: 'assets', storageUrl };
}

// ── 「とりあえず放り込む」= 任意ファイルを Drive へ即取り込み（ドロップ/貼り付け用）──────
// 拡張子/MIME から kind または type を推定し、publishToDrive で正規化登録する（＝自動カテゴライズ）。
function classifyStashFile(name: string, mime?: string): { kind?: OutputKind; type?: string; appScope?: string; tag?: string } {
  const n = name.toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|tiff?|avif|heic)$/.test(n)) return { kind: 'render', appScope: '3dsi', tag: '画像' };
  if (m.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|m4v)$/.test(n)) return { kind: 'video', appScope: '3dsi', tag: '動画' };
  if (/\.(glb|gltf|3dm|fbx|obj|stl|blend|usdz?)$/.test(n)) return { kind: 'model', tag: '3Dモデル' };
  // PowerPoint 等のプレゼン → 'presentation'（プレゼン種別に自動分類）。
  if (m.includes('presentation') || /\.(pptx?|ppsx?|potx?|key)$/.test(n)) return { kind: 'presentation', appScope: '3dsp', tag: 'プレゼン' };
  if (m === 'application/pdf' || /\.pdf$/.test(n)) return { type: 'pdf', tag: 'PDF' };
  if (/\.(docx?|rtf|txt|md)$/.test(n)) return { type: 'document', tag: '文書' };
  if (/\.(xlsx?|csv|tsv)$/.test(n)) return { type: 'spreadsheet', tag: '表計算' };
  return { type: 'file', tag: 'ファイル' };
}

/** OOXML（pptx/docx/xlsx）か。内蔵サムネ（docProps/thumbnail.*）を持つ可能性がある。 */
function isOoxml(name: string): boolean {
  return /\.(pptx|ppsx|potx|docx|xlsx)$/i.test(name);
}

/**
 * OOXML ファイルに埋め込まれたプレビュー画像（docProps/thumbnail.jpeg|png）を取り出す。
 * PowerPoint 等が「サムネイルを保存」した場合に入っている。無ければ null。
 * サムネのエントリだけを filter で解凍するので、巨大ファイルでも軽い。
 */
async function extractOoxmlThumbnail(file: File): Promise<File | null> {
  try {
    const { unzipSync } = await import('fflate');
    const buf = new Uint8Array(await file.arrayBuffer());
    const zip = unzipSync(buf, { filter: (f) => /^docProps\/thumbnail\.(jpe?g|png)$/i.test(f.name) });
    const key = Object.keys(zip).find((k) => /^docProps\/thumbnail\.(jpe?g|png)$/i.test(k));
    if (!key) return null;
    const bytes = zip[key];
    if (!bytes || !bytes.length) return null;
    const ext = key.split('.').pop()!.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return new File([bytes], `${file.name}.thumb.${ext === 'png' ? 'png' : 'jpg'}`, { type: mime });
  } catch (e) {
    console.warn('[stash] OOXML サムネ抽出に失敗:', file.name, e);
    return null;
  }
}

/**
 * ドロップ/貼り付けされた任意ファイル群を Drive（My Library もしくは指定プロジェクト）へ取り込む。
 * 拡張子から種別を自動分類し、OOXML は内蔵サムネを抽出してプレビューを付ける。
 * @returns 成功/失敗件数。
 */
/** 重複時の扱い。overwrite=中身を差し替え / rename=別名で保存 / skip=取り込まない。 */
export type DuplicateMode = 'overwrite' | 'rename' | 'skip';

/** プール内で同名（自分・非削除・同スコープ）の既存資産を探す。無ければ null。 */
export function findDriveDuplicate(name: string, projectId?: string | null): AIDriveAsset | null {
  const uid = auth.currentUser?.uid;
  const target = name.trim().toLowerCase();
  const pool = useAIDriveStore.getState().pooledAssets;
  const mine = (a: AIDriveAsset) => a.ownerId === uid || !a.ownerId || a.ownerId === 'unknown';
  const inScope = (a: AIDriveAsset) => projectId
    ? (a.projectId === projectId || (a as any).projectIds?.includes(projectId))
    : (!a.projectId || a.projectId === 'global');
  return pool.find((a) => !a.isDeleted && mine(a) && inScope(a) && (a.name || '').trim().toLowerCase() === target) || null;
}

/** 既存と衝突しない別名を作る（"foo.pptx" → "foo (2).pptx"）。 */
function makeUniqueName(name: string, projectId?: string | null): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (findDriveDuplicate(candidate, projectId)) { n++; candidate = `${base} (${n})${ext}`; }
  return candidate;
}

/** 既存資産の中身を新しいファイルで上書きする（同じ Firestore ドキュメントを更新）。 */
async function overwriteDriveAsset(asset: AIDriveAsset, file: File, thumbnailUrl?: string): Promise<void> {
  const storageUrl = await uploadImageAndGetUrl(file);
  const { doc, updateDoc } = await import('firebase/firestore');
  const sc = asset.sourceCollection || 'assets';
  let ref;
  if (sc === 'global_assets') {
    ref = doc(db, 'assets', asset.id);
  } else if ((sc === 'assets' || sc === 'workFiles') && asset.projectId && asset.projectId !== 'global') {
    ref = doc(db, 'projects', asset.projectId, sc, asset.id);
  } else {
    throw new Error(`overwrite 未対応の sourceCollection=${sc}`);
  }
  const isImg = (asset.type || '').toLowerCase() === 'image';
  await updateDoc(ref, {
    storageUrl,
    ...(thumbnailUrl ? { thumbnailUrl } : (isImg ? { thumbnailUrl: storageUrl } : {})),
    ...(isImg ? { imageUrl: storageUrl } : {}),
    size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    updatedAt: Date.now(),
  });
}

export async function stashFilesToDrive(
  files: File[],
  projectId?: string | null,
  opts: { resolveDuplicate?: (existing: AIDriveAsset, file: File) => Promise<DuplicateMode> } = {},
): Promise<{ ok: number; fail: number; skipped: number; overwritten: number }> {
  let ok = 0;
  let fail = 0;
  let skipped = 0;
  let overwritten = 0;
  for (const f of files) {
    try {
      const c = classifyStashFile(f.name, f.type);

      // 重複判定 → 上書き/別名/スキップを解決。resolver 未指定なら安全側で別名保存。
      const dup = findDriveDuplicate(f.name, projectId);
      let mode: DuplicateMode | null = null;
      if (dup) {
        mode = opts.resolveDuplicate ? await opts.resolveDuplicate(dup, f) : 'rename';
        if (mode === 'skip') { skipped++; continue; }
      }

      // サムネ生成:
      //  1) OOXML の内蔵プレビュー（docProps/thumbnail）があれば最優先で使う。
      //  2) pptx で内蔵サムネが無ければ、1枚目スライドを端末内で描画してサムネにする。
      let thumbnailUrl: string | undefined;
      let thumbFile: File | null = null;
      if (isOoxml(f.name)) {
        thumbFile = await extractOoxmlThumbnail(f);
        if (!thumbFile && /\.pptx$/i.test(f.name)) {
          const { renderPptxThumbnail } = await import('./pptxThumbnail');
          const blob = await renderPptxThumbnail(f);
          if (blob) thumbFile = new File([blob], `${f.name}.thumb.jpg`, { type: 'image/jpeg' });
        }
      }
      if (thumbFile) {
        try { thumbnailUrl = await uploadImageAndGetUrl(thumbFile); }
        catch (e) { console.warn('[stash] サムネのアップロードに失敗:', f.name, e); }
      }

      if (dup && mode === 'overwrite') {
        await overwriteDriveAsset(dup, f, thumbnailUrl);
        overwritten++;
      } else {
        const name = (dup && mode === 'rename') ? makeUniqueName(f.name, projectId) : f.name;
        await publishToDrive({
          name,
          kind: c.kind,
          type: c.type,
          appScope: c.appScope,
          file: f,
          thumbnailUrl,
          projectId: projectId ?? null,
          visibility: 'private',
          size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
          tags: ['放り込み', ...(c.tag ? [c.tag] : [])],
        });
        ok++;
      }
    } catch (e) {
      console.warn('[stashFilesToDrive] failed:', f.name, e);
      fail++;
    }
  }
  return { ok, fail, skipped, overwritten };
}
