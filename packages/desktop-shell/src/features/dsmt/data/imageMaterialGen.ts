/**
 * ローカル素材（LocalAssets/Images/テクスチャ/）および S.Image のテクスチャ画像から S.Material を自動量産する。
 *  - 対象: S.Image(appScope='3dsi') の image で、タグに texture/テクスチャ を含むもの（パース/写真の混入防止）。
 *  - PBRセット化: ファイル名(title)のスロット接尾辞でグルーピング（albedo/normal/roughness/ao/metalness）。
 *  - 自動分類: ベース名＋タグを FINISH_SUBTYPES のキーワードで照合 → category / 仕上げ種別 / 部位(applications)。
 *  - 重複防止: ベース名由来の固定ID `dsmt_imggen_<base>` で upsert（再実行で増えない）。
 *  - テクスチャは S.Image の downloadUrl を maps に参照（再アップロード無し＝ストレージ重複なし）。
 */
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import type { DsmtCategory, DsmtTextureMaps, MaterialApplication } from "../types";
import type { DsmtTextureSlot } from "../api/dsmtUploadService";
import { dsmtUploadService } from "../api/dsmtUploadService";
import { FINISH_SUBTYPES } from "./finishTaxonomy";

const TEXTURE_TAGS = ["texture", "テクスチャ", "tex"];

/**
 * maps に保存してよい「取得可能なリモートURL」か判定する。
 * Firebase Storage 等の http(s) URL のみ true。ローカル参照（asset:// / C:\… / LocalAssets / asset.localhost 等）は
 * 端末固有でファイルが消えると 404 を出す原因になるため Firestore に保存しない。
 */
export function isRemoteUrl(u?: string | null): boolean {
  return !!u && /^https?:\/\//i.test(u) && !/asset\.localhost|tauri\.localhost/.test(u);
}

interface DsiImageLite {
  id: string;
  title: string;
  downloadUrl?: string;
  tags?: string[];
  category?: string;
  mediaType?: string;
}

/** プロジェクトの S.Image から「テクスチャタグ付き画像」を取得する。 */
export async function fetchTextureImages(projectId: string): Promise<DsiImageLite[]> {
  const q = query(collection(db, `projects/${projectId}/workFiles`), where("appScope", "==", "3dsi"), limit(500));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((it: any) => {
      if (it.mediaType && it.mediaType !== "image") return false;
      if (it.status === "archived" || it.isArchived === true) return false;
      if (!it.downloadUrl) return false;
      const tags = (it.tags || []).map((t: string) => String(t).toLowerCase());
      return TEXTURE_TAGS.some((t) => tags.includes(t));
    }) as DsiImageLite[];
}

/** ファイル名/タイトルから PBR スロットを推定（localTextures.slotFromFilename と同方針）。 */
export function slotOf(name: string): DsmtTextureSlot | null {
  const n = name.toLowerCase();
  if (/(normal|nrm|norm)/.test(n) || /[_\-\s]n(\.|_|-|$)/.test(n)) return "normal";
  if (/rough/.test(n)) return "roughness";
  if (/(ao|occlusion|ambientocclusion)/.test(n)) return "ao";
  if (/metal/.test(n)) return "metalness";
  if (/(albedo|basecolor|base_color|diffuse|color|diff)/.test(n)) return "albedo";
  return null;
}

/** タイトルから拡張子・スロット接尾辞を除いたベース名（PBRセットの束ねキー）。 */
export function baseNameOf(title: string): string {
  let t = (title || "");
  // パス区切り（/・\）がある場合は最後のコンポーネントだけ使う
  const slashIdx = Math.max(t.lastIndexOf('/'), t.lastIndexOf('\\'));
  if (slashIdx >= 0) t = t.slice(slashIdx + 1);
  t = t.replace(/\.[a-z0-9]+$/i, ""); // 拡張子
  t = t.replace(/[_\-\s]*(albedo|basecolor|base_color|diffuse|color|normal|nrm|norm|rough(ness)?|ao|occlusion|ambientocclusion|metal(ness)?)\s*$/i, "");
  return t.replace(/[_\-\s]+$/, "").trim() || (title || "untitled");
}

/** Firestore ドキュメントIDに使える安全なスラグ。 */
export function safeIdPart(s: string): string {
  return s.replace(/[\/\.\#\$\[\]]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

const CATEGORY_KEYWORDS: Record<DsmtCategory, string[]> = {
  wood: ["wood", "木", "oak", "walnut", "ウォールナット", "オーク", "フローリング", "板", "ash", "pine"],
  stone: ["stone", "石", "tile", "タイル", "コンクリート", "concrete", "marble", "大理石", "granite", "モルタル", "サイディング"],
  metal: ["metal", "金属", "steel", "ガルバ", "aluminum", "brass", "真鍮", "鉄", "iron"],
  fabric: ["fabric", "布", "カーペット", "carpet", "cloth", "織", "ファブリック", "linen", "リネン"],
  leather: ["leather", "革", "レザー"],
  plastic: ["plastic", "樹脂", "塩ビ", "vinyl", "pvc"],
  glass: ["glass", "ガラス"],
  paint: ["paint", "塗装", "クロス", "wallpaper", "壁紙", "漆喰", "plaster", "珪藻土"],
  other: [],
};

export interface Classification {
  category: DsmtCategory;
  applications: MaterialApplication[];
  subtypeLabel?: string;
  tagsToAdd: string[];
}

/** ベース名＋タグから category / 部位 / 種別を推定する。 */
export function classifyTexture(text: string): Classification {
  const hay = text.toLowerCase();
  // 1) FINISH_SUBTYPES（仕上げ種別）で最良一致
  let best: (typeof FINISH_SUBTYPES)[number] | null = null;
  let bestScore = 0;
  for (const s of FINISH_SUBTYPES) {
    let score = 0;
    for (const k of [s.label, ...s.keywords]) { if (hay.includes(k.toLowerCase())) score++; }
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (best && bestScore > 0) {
    return { category: best.category, applications: best.applications, subtypeLabel: best.label, tagsToAdd: [best.label] };
  }
  // 2) 素材ジャンルだけでも推定（部位は不明＝空）
  for (const cat of Object.keys(CATEGORY_KEYWORDS) as DsmtCategory[]) {
    if (CATEGORY_KEYWORDS[cat].some((k) => hay.includes(k.toLowerCase()))) {
      return { category: cat, applications: [], tagsToAdd: [] };
    }
  }
  return { category: "other", applications: [], tagsToAdd: [] };
}

export interface ImageGenResult {
  ok: boolean;
  reason?: string;
  created: number;
  groups: number;
}

/**
 * S.Image のテクスチャ画像群から S.Material を一括生成する。
 */
export async function generateMaterialsFromImages(projectId?: string): Promise<ImageGenResult> {
  if (!projectId) return { ok: false, created: 0, groups: 0, reason: "プロジェクトが選択されていません" };

  const images = await fetchTextureImages(projectId);
  if (!images.length) {
    return { ok: false, created: 0, groups: 0, reason: "texture/テクスチャ タグの付いた S.Image 画像が見つかりません" };
  }

  // ベース名でグルーピング
  const groups = new Map<string, DsiImageLite[]>();
  for (const img of images) {
    const base = baseNameOf(img.title || img.id);
    const arr = groups.get(base) || [];
    arr.push(img);
    groups.set(base, arr);
  }

  let created = 0;
  for (const [base, items] of groups.entries()) {
    // maps を組み立て（スロット未判定はアルベド扱い）
    const maps: DsmtTextureMaps = {};
    for (const it of items) {
      const slot = slotOf(it.title || "") ?? (slotOf(base) ?? "albedo");
      // ローカルパスは保存しない（404 ダングリング参照の再発防止）。
      if (!maps[slot] && isRemoteUrl(it.downloadUrl)) maps[slot] = it.downloadUrl;
    }
    if (!maps.albedo) {
      // アルベドが取れない場合は最初の「リモートURLを持つ」画像をアルベドに
      const first = items.find((i) => isRemoteUrl(i.downloadUrl));
      if (first?.downloadUrl) maps.albedo = first.downloadUrl;
    }
    if (!maps.albedo) continue;

    // 分類（ベース名＋全タグ）
    const allTags = Array.from(new Set(items.flatMap((i) => i.tags || [])));
    const cls = classifyTexture(`${base} ${allTags.join(" ")}`);

    const tags = Array.from(new Set([
      ...allTags.filter((t) => !TEXTURE_TAGS.includes(String(t).toLowerCase())),
      ...cls.tagsToAdd,
    ]));

    try {
      await dsmtUploadService.createMaterial(
        projectId,
        {
          title: base,
          category: cls.category,
          params: { baseColor: "#ffffff", roughness: 0.8, metalness: cls.category === "metal" ? 0.6 : 0 },
          tags,
          applications: cls.applications,
          visibility: "private",
          maps, // S.Image の URL を参照（再アップロード無し）
        },
        undefined,
        undefined,
        `dsmt_imggen_${safeIdPart(base)}`, // 固定ID＝再実行で重複せず上書き
      );
      created++;
    } catch (e) {
      console.warn("[imageMaterialGen] create failed", base, e);
    }
  }

  return { ok: created > 0, created, groups: groups.size, reason: created ? undefined : "生成に失敗しました" };
}

// ──────────────────────────────────────────────────────────────────────────────
// ローカルテクスチャ（LocalAssets/Images/テクスチャ/）から S.Material を一括生成。
// ファイルは Firebase Storage へアップロードしてから maps に格納する（asset:// 非保存）。
// ──────────────────────────────────────────────────────────────────────────────

/**
 * LocalAssets/Images/テクスチャ/ 配下のファイルをグループ化して S.Material を一括生成する。
 *
 * グループ化ルール:
 *   - サブフォルダあり（テクスチャ/素材名/basecolor.png）→ サブフォルダ名を素材名とする
 *   - フラット（テクスチャ/素材名_basecolor.png）→ スロット接尾辞を除いたベース名を素材名とする
 *
 * スロット対応: albedo/basecolor, normal, roughness, ao, lightmap(→ao), metalness
 * 重複防止: dsmt_local_<slug> の固定IDで upsert（再実行で増えない・上書き）
 */
export async function generateMaterialsFromLocalTextures(projectId?: string): Promise<ImageGenResult> {
  if (!projectId) return { ok: false, created: 0, groups: 0, reason: "プロジェクトが選択されていません" };

  // Tauri 環境チェック
  let isTauriEnv = false;
  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    isTauriEnv = isTauri();
  } catch { /* noop */ }
  if (!isTauriEnv) return { ok: false, created: 0, groups: 0, reason: "Tauri 環境でのみ利用できます" };

  const { listLocalTextureAssets, fetchAssetAsFile } = await import("../lib/localTextures");

  const all = await listLocalTextureAssets();
  // テクスチャ フォルダ配下のみ対象
  const textures = all.filter((t) => {
    const parts = t.subfolder.replace(/\\/g, "/").split("/").filter(Boolean);
    return parts[0] === "テクスチャ";
  });

  if (!textures.length) {
    return { ok: false, created: 0, groups: 0, reason: "LocalAssets/Images/テクスチャ/ にファイルが見つかりません" };
  }

  // グループキー: サブフォルダが 2 階層以上あれば subfolder 全体、フラットならベース名
  const groups = new Map<string, typeof textures>();
  for (const t of textures) {
    const parts = t.subfolder.replace(/\\/g, "/").split("/").filter(Boolean);
    const key = parts.length >= 2
      ? parts.slice(1).join("/")           // テクスチャ/素材名 → 素材名
      : baseNameOf(t.name);               // フラット → スロット接尾辞なしのベース名
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  let created = 0;
  for (const [groupKey, items] of groups.entries()) {
    // スロットごとに File を用意（先着1枚。ao/lightmap は ao スロットで競合するが先着を使う）
    const files: Partial<Record<DsmtTextureSlot, File>> = {};
    for (const t of items) {
      if (!t.slot) continue;
      if (files[t.slot]) continue; // 先着
      try {
        files[t.slot] = await fetchAssetAsFile(t.url, t.name);
      } catch (e) {
        console.warn("[localTexGen] fetch failed", t.name, e);
      }
    }
    if (!Object.keys(files).length) continue;

    // 素材名 = グループキーの最終セグメント
    const materialName = groupKey.split("/").filter(Boolean).pop() ?? groupKey;
    const cls = classifyTexture(materialName);
    const tags = Array.from(new Set([materialName, ...cls.tagsToAdd]));

    try {
      await dsmtUploadService.createMaterial(
        projectId,
        {
          title: materialName,
          category: cls.category,
          params: {
            baseColor: "#ffffff",
            roughness: files.roughness ? 1.0 : 0.8,
            metalness: files.metalness ? 1.0 : (cls.category === "metal" ? 0.6 : 0),
          },
          tags,
          applications: cls.applications,
          visibility: "private",
        },
        files as Partial<Record<DsmtTextureSlot, File>>,
        undefined,
        `dsmt_local_${safeIdPart(groupKey)}`,
      );
      created++;
    } catch (e) {
      console.warn("[localTexGen] create failed", groupKey, e);
    }
  }

  return { ok: created > 0, created, groups: groups.size, reason: created ? undefined : "生成に失敗しました" };
}

// ──────────────────────────────────────────────────────────────────────────────
// S.Image で選択した画像から直接マテリアルを生成する（S.Image遷移→選択→確定フロー用）
// ──────────────────────────────────────────────────────────────────────────────

import type { DsmtMaterial } from "../types";
import type { PickerImage } from "../../../store/useImagePickerStore";

export interface SelectedImagesGenResult {
  ok: boolean;
  created: number;
  skipped: number;
  groups: number;
  reason?: string;
  /** 生成されたマテリアルのタイトル一覧（結果ダイアログ表示用）。 */
  createdItems?: { id: string; title: string }[];
}

/**
 * S.Image の選択確定済み画像配列からマテリアルを一括生成する。
 * ファイル名からスロット（albedo/normal/roughness/ao）を推定し、同名グループでPBRセットにまとめる。
 */
export async function generateMaterialsFromSelectedImages(
  images: PickerImage[],
  destProjectId: string,
  destVisibility: "public" | "private",
  existingMaterials: DsmtMaterial[],
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<SelectedImagesGenResult> {
  const existingIds = new Set(
    existingMaterials.filter((m) => m.maps?.albedo).map((m) => m.id),
  );

  // id→PickerImage の Map（title/tags を保持）
  const pickerMap = new Map<string, PickerImage>(images.map((i) => [i.id, i]));
  const urlMap = new Map<string, string>(images.map((i) => [i.id, i.downloadUrl]));

  const ids = Array.from(urlMap.keys());
  onProgress?.(0, 0, "画像情報を取得中...");

  // PickerImage に title がない場合のみ Firestore から補完する
  const needsFirestore = ids.filter((id) => !pickerMap.get(id)?.title);
  const wfDocs: Map<string, any> = new Map();
  if (needsFirestore.length > 0) {
    const { collection: col, getDocs: gd, query: q, where: wh } = await import("firebase/firestore");
    const { db } = await import("../../../lib/firebase/client");
    const projectsSnap = await gd(q(col(db, `projects/${destProjectId}/workFiles`), wh("appScope", "==", "3dsi")));
    projectsSnap.docs.forEach((d) => {
      if (needsFirestore.includes(d.id)) wfDocs.set(d.id, d.data());
    });
  }

  // グルーピング: ベース名（スロット接尾辞を除いた名前）でグループ化
  const groups = new Map<string, { id: string; url: string; title: string; tags: string[] }[]>();
  for (const id of ids) {
    const url = urlMap.get(id)!;
    const picker = pickerMap.get(id);
    const data = wfDocs.get(id) as any;
    // PickerImage の title を優先（Firestore lookup はフォールバック）
    const title: string = picker?.title || data?.title || data?.name || id;
    const tags: string[] = picker?.tags || data?.tags || [];
    const base = baseNameOf(title);
    const arr = groups.get(base) || [];
    arr.push({ id, url, title, tags });
    groups.set(base, arr);
  }

  const total = groups.size;
  let current = 0;
  let created = 0;
  let skipped = 0;
  const createdItems: { id: string; title: string }[] = [];

  for (const [base, items] of groups.entries()) {
    current++;
    onProgress?.(current, total, base);

    const fixedId = `dsmt_imggen_${safeIdPart(base)}`;
    if (existingIds.has(fixedId)) { skipped++; continue; }

    const maps: DsmtTextureMaps = {};
    for (const it of items) {
      const slot = slotOf(it.title) ?? (slotOf(base) ?? "albedo");
      if (!maps[slot] && isRemoteUrl(it.url)) maps[slot] = it.url;
    }
    if (!maps.albedo) {
      const first = items.find((i) => isRemoteUrl(i.url));
      if (first?.url) maps.albedo = first.url;
    }
    if (!maps.albedo) { skipped++; continue; }

    const allTags = Array.from(new Set(items.flatMap((i) => i.tags)));
    const cls = classifyTexture(`${base} ${allTags.join(" ")}`);
    const tags = Array.from(new Set([
      ...allTags.filter((t) => !TEXTURE_TAGS.includes(String(t).toLowerCase())),
      ...cls.tagsToAdd,
    ]));

    try {
      await dsmtUploadService.createMaterial(
        destProjectId,
        {
          title: base,
          category: cls.category,
          params: { baseColor: "#ffffff", roughness: 0.8, metalness: cls.category === "metal" ? 0.6 : 0 },
          tags,
          applications: cls.applications,
          visibility: destVisibility,
          maps,
        },
        undefined,
        undefined,
        fixedId,
      );
      created++;
      createdItems.push({ id: fixedId, title: base });
      existingIds.add(fixedId);
    } catch (e) {
      console.warn("[generateMaterialsFromSelectedImages] create failed", base, e);
    }
  }

  if (total === 0) {
    return { ok: false, created: 0, skipped: 0, groups: 0, reason: "生成対象の画像が見つかりませんでした" };
  }
  if (created === 0 && skipped > 0) {
    return { ok: false, created: 0, skipped, groups: total, reason: "allDuplicate" };
  }
  return { ok: created > 0, created, skipped, groups: total, createdItems };
}

// ──────────────────────────────────────────────────────────────────────────────
// ソース横断・重複スキップ付き統合生成関数
// ──────────────────────────────────────────────────────────────────────────────

import type { PickedSources } from "../components/MaterialSourcePickerDialog";

export interface UnifiedGenResult {
  ok: boolean;
  created: number;
  skipped: number;
  groups: number;
  reason?: string;
}

/**
 * ソースピッカーで選択された取得元から S.Material を一括生成する。
 * 既存マテリアルのうち maps.albedo が設定済みのものは固定IDで照合しスキップ（重複防止）。
 * onProgress(current, total, label) で逐次進捗を通知する。
 */
export async function generateMaterialsFromSources(
  projectId: string,
  sources: PickedSources,
  existingMaterials: DsmtMaterial[],
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<UnifiedGenResult> {
  const existingIds = new Set(
    existingMaterials.filter((m) => m.maps?.albedo).map((m) => m.id),
  );

  // 保存先プロジェクトID・公開設定を destination から解決
  const destProjectId =
    sources.destination?.type === "other_project" && sources.destination.projectId
      ? sources.destination.projectId
      : projectId;
  const destVisibility: "public" | "private" =
    sources.destination?.visibility ?? "private";

  // ── フェーズ1: 全グループを先に列挙してトータル件数を確定 ──
  type ImageGroup = { base: string; items: DsiImageLite[]; pid: string };
  type LocalGroup = { key: string; items: { url: string; name: string; slot?: string; subfolder: string }[] };

  const imageGroups: ImageGroup[] = [];
  const imagePids: string[] = [];
  if (sources.types.includes("current_project")) imagePids.push(projectId);
  if (sources.types.includes("other_project")) imagePids.push(...sources.otherProjectIds);

  onProgress?.(0, 0, "テクスチャ画像を取得中...");

  for (const pid of imagePids) {
    const images = await fetchTextureImages(pid);
    const map = new Map<string, DsiImageLite[]>();
    for (const img of images) {
      const base = baseNameOf(img.title || img.id);
      const arr = map.get(base) || [];
      arr.push(img);
      map.set(base, arr);
    }
    for (const [base, items] of map.entries()) {
      imageGroups.push({ base, items, pid });
    }
  }

  let localGroups: LocalGroup[] = [];
  if (sources.types.includes("local")) {
    let isTauriEnv = false;
    try {
      const { isTauri } = await import("@tauri-apps/api/core");
      isTauriEnv = isTauri();
    } catch { /* noop */ }

    if (isTauriEnv) {
      const { listLocalTextureAssets } = await import("../lib/localTextures");
      const all = await listLocalTextureAssets();
      const textures = all.filter((t) => {
        const parts = t.subfolder.replace(/\\/g, "/").split("/").filter(Boolean);
        return parts[0] === "テクスチャ";
      });
      const map = new Map<string, typeof textures>();
      for (const t of textures) {
        const parts = t.subfolder.replace(/\\/g, "/").split("/").filter(Boolean);
        const key = parts.length >= 2 ? parts.slice(1).join("/") : baseNameOf(t.name);
        const arr = map.get(key) ?? [];
        arr.push(t);
        map.set(key, arr);
      }
      for (const [key, items] of map.entries()) {
        localGroups.push({ key, items });
      }
    }
  }

  const totalGroups = imageGroups.length + localGroups.length;
  let current = 0;
  let created = 0;
  let skipped = 0;

  // ── フェーズ2: 画像グループを処理 ──
  for (const { base, items, pid } of imageGroups) {
    current++;
    onProgress?.(current, totalGroups, base);

    const fixedId = `dsmt_imggen_${safeIdPart(base)}`;
    if (existingIds.has(fixedId)) { skipped++; continue; }

    const maps: DsmtTextureMaps = {};
    for (const it of items) {
      const slot = slotOf(it.title || "") ?? (slotOf(base) ?? "albedo");
      if (!maps[slot] && isRemoteUrl(it.downloadUrl)) maps[slot] = it.downloadUrl;
    }
    if (!maps.albedo) {
      const first = items.find((i) => isRemoteUrl(i.downloadUrl));
      if (first?.downloadUrl) maps.albedo = first.downloadUrl;
    }
    if (!maps.albedo) { skipped++; continue; }

    const allTags = Array.from(new Set(items.flatMap((i) => i.tags || [])));
    const cls = classifyTexture(`${base} ${allTags.join(" ")}`);
    const tags = Array.from(new Set([
      ...allTags.filter((t) => !TEXTURE_TAGS.includes(String(t).toLowerCase())),
      ...cls.tagsToAdd,
    ]));

    try {
      await dsmtUploadService.createMaterial(
        destProjectId,
        {
          title: base,
          category: cls.category,
          params: { baseColor: "#ffffff", roughness: 0.8, metalness: cls.category === "metal" ? 0.6 : 0 },
          tags,
          applications: cls.applications,
          visibility: destVisibility,
          maps,
        },
        undefined,
        undefined,
        fixedId,
      );
      created++;
      existingIds.add(fixedId);
    } catch (e) {
      console.warn("[generateMaterialsFromSources] image create failed", base, e);
    }
  }

  // ── フェーズ3: ローカルグループを処理 ──
  if (localGroups.length > 0) {
    const { fetchAssetAsFile } = await import("../lib/localTextures");
    for (const { key: groupKey, items } of localGroups) {
      current++;
      const materialName = groupKey.split("/").filter(Boolean).pop() ?? groupKey;
      onProgress?.(current, totalGroups, materialName);

      const fixedId = `dsmt_local_${safeIdPart(groupKey)}`;
      if (existingIds.has(fixedId)) { skipped++; continue; }

      const files: Partial<Record<DsmtTextureSlot, File>> = {};
      for (const t of items) {
        if (!t.slot || files[t.slot as DsmtTextureSlot]) continue;
        try { files[t.slot as DsmtTextureSlot] = await fetchAssetAsFile(t.url, t.name); }
        catch (e) { console.warn("[generateMaterialsFromSources] local fetch failed", t.name, e); }
      }
      if (!Object.keys(files).length) { skipped++; continue; }

      const cls = classifyTexture(materialName);
      const tags = Array.from(new Set([materialName, ...cls.tagsToAdd]));

      try {
        await dsmtUploadService.createMaterial(
          destProjectId,
          {
            title: materialName,
            category: cls.category,
            params: {
              baseColor: "#ffffff",
              roughness: files.roughness ? 1.0 : 0.8,
              metalness: files.metalness ? 1.0 : (cls.category === "metal" ? 0.6 : 0),
            },
            tags,
            applications: cls.applications,
            visibility: destVisibility,
          },
          files as Partial<Record<DsmtTextureSlot, File>>,
          undefined,
          fixedId,
        );
        created++;
        existingIds.add(fixedId);
      } catch (e) {
        console.warn("[generateMaterialsFromSources] local create failed", groupKey, e);
      }
    }
  }

  if (totalGroups === 0) {
    return { ok: false, created: 0, skipped: 0, groups: 0, reason: "生成対象の画像が見つかりませんでした" };
  }
  if (created === 0 && skipped > 0) {
    return { ok: false, created: 0, skipped, groups: totalGroups, reason: `allDuplicate` };
  }
  return { ok: created > 0, created, skipped, groups: totalGroups };
}
