import {
  collection, collectionGroup,
  query, where, orderBy, limit as qLimit,
  getDocs,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "@/shared/config/firebase";

/** 現在ログイン中か判定（Firebase Auth の同期状態を使う） */
const isSignedIn = () => {
  try { return !!getAuth().currentUser; } catch { return false; }
};

/**
 * 公開成果物タイプの定義
 * /assets コレクションに visibility:'public' で書かれたものをすべてカバーする。
 * 各子アプリのコレクションも同じ形式で扱う。
 */
export const ASSET_TYPE_META = {
  // 3DSS — 3D Shape Share
  "3d-model":           { label: "3D モデル",       color: "#7C3AED", app: "3DSS" },
  // 3DSC — Shape Creator（家具テンプレート）
  "furniture-template": { label: "造作家具",           color: "#F59E0B", app: "3DSC" },
  // 3DSL — Shape Layout
  "layout-plan":        { label: "レイアウト",        color: "#EC4899", app: "3DSL" },
  // 3DSL — レンダリング静止画（Cycles/Standard）
  "layout-render":      { label: "パース",             color: "#EC4899", app: "3DSL" },
  // 3DSP — Shape Presentation
  "presentation":       { label: "プレゼン",          color: "#0EA5E9", app: "3DSP" },
  // 3DSD — Shape Diagram
  "diagram-state":      { label: "ダイアグラム",        color: "#10B981", app: "3DSD" },
  // その他（/assets に直接書かれる汎用タイプ）
  image:                { label: "AIパース",           color: "#0EA5E9", app: "" },
  render:               { label: "レンダリング",        color: "#0EA5E9", app: "" },
  diagram:              { label: "図面",               color: "#10B981", app: "" },
  drawing:              { label: "図面",               color: "#10B981", app: "" },
  layout:               { label: "レイアウト",          color: "#EC4899", app: "" },
  document:             { label: "書類",               color: "#6B7280", app: "" },
};

export const getTypeMeta = (type) =>
  ASSET_TYPE_META[type] ?? { label: type ?? "その他", color: "#6B7280", app: "" };

// ─── 共通ユーティリティ ───────────────────────────────────────────────────────

const millis = (ts) =>
  ts?.toMillis?.() ??
  (ts?._seconds ? ts._seconds * 1000 : 0) ??
  (typeof ts === "number" ? ts : 0) ??
  0;

/**
 * 各コレクションのドキュメントを共通の GalleryItem 形式に正規化する。
 * sourceType を指定すると type フィールドを上書きできる（自前の type 名がない場合）。
 */
const normalize = (id, data, sourceType = null) => {
  const type = sourceType || data?.type || "unknown";
  const latest = data?.versions?.[String(data?.latestVersion)] || null;
  // layout-render の URL フィールドは thumbnailUrl でなく url（layoutRendersApi.ts 参照）
  const isImage = ["image", "render", "layout-render"].includes(type);

  const thumbnailUrl =
    data?.thumbnailUrl ||
    latest?.thumbnailUrl ||
    (isImage ? (data?.url || data?.downloadUrl || "") : "") ||
    data?.thumbnailFilePath?.url ||
    "";

  return {
    id,
    type,
    title: data?.title || data?.shotName || data?.name || data?.diagramTitle || "Untitled",
    thumbnailUrl,
    downloadUrl: data?.downloadUrl || data?.url || data?.glbUrl || latest?.downloadUrl || "",
    glbUrl: data?.glbUrl || latest?.glbUrl || "",
    format: data?.format || data?.style || "",
    macroCategory:
      data?.macroCategory || data?.mainCategory || data?.category || data?.presentationType || "",
    tags: Array.isArray(data?.tags) ? data.tags : [],
    author:
      data?.ownerName || data?.author || data?.createdByName ||
      data?.creatorName || "Creator",
    ownerPhotoUrl: data?.ownerPhotoUrl || data?.creatorPhotoUrl || "",
    favoriteCount: Number(data?.favoriteCount || data?.likeCount || 0),
    _sortTs: millis(data?.updatedAt) || millis(data?.createdAt),
    // 子アプリ情報（フィルター用）
    appScope: data?.appScope || ASSET_TYPE_META[type]?.app || "",
  };
};

/** クエリを実行し、失敗したら [] を返す（インデックス未作成・権限不足等への耐性） */
const safeDocs = async (q, label) => {
  try {
    return (await getDocs(q)).docs;
  } catch (e) {
    if (import.meta?.env?.MODE === "development") {
      console.warn(`[publicAssets] ${label} failed:`, e.code, e.message?.slice(0, 80));
    }
    return [];
  }
};

// ─── 3DSS: /assets ────────────────────────────────────────────────────────────

async function fetchAssets(max, typeFilter) {
  const constraints = [where("visibility", "==", "public"), qLimit(Math.min(max, 200))];
  if (typeFilter) constraints.splice(1, 0, where("type", "==", typeFilter));
  const docs = await safeDocs(query(collection(db, "assets"), ...constraints), "assets");
  return docs.map((d) => normalize(d.id, d.data()));
}

// ─── 3DSC: workFiles (appScope:'3dsc') ───────────────────────────────────────
// 造作家具は workFiles コレクションに appScope:'3dsc' で保存される。
// RightPanelHost で visibility:'public'|'private' を書き込む。
// 2フィールド等値フィルター（appScope + visibility）で composite index 不要。
// ルール: /projects/{pid}/workFiles は isSignedIn() で OK。
async function fetchFurnitureTemplates(max) {
  // workFiles/appScope:'3dsc' ─ ギャラリー用メイン取得
  const workFileDocs = isSignedIn() ? await safeDocs(
    query(
      collectionGroup(db, "workFiles"),
      where("appScope", "==", "3dsc"),
      where("visibility", "==", "public"),
      qLimit(Math.min(max, 100)),
    ),
    "furniture(3dsc-workFiles)",
  ) : [];

  // /furnitureTemplates コレクション（旧スキーマとの互換性）
  const templateDocs = await safeDocs(
    query(
      collection(db, "furnitureTemplates"),
      where("visibility", "==", "public"),
      qLimit(Math.min(max, 100)),
    ),
    "furniture(furnitureTemplates)",
  );

  return [
    ...workFileDocs.map((d) => normalize(d.id, d.data(), "furniture-template")),
    ...templateDocs.map((d) => normalize(d.id, d.data(), "furniture-template")),
  ];
}

// ─── 3DSP: collectionGroup 'items' (type: 'presentation') ────────────────────
// ルール更新: type=='presentation' かつ visibility が未設定 or 'public' → 公開扱い
// createPresentation は visibility を 'public' にデフォルト設定しているが、
// 古いデータはフィールドが存在しない場合があるため visibility フィルターを外し、
// 明示的に 'private' に設定されたものだけクライアント側で除外する。
async function fetchPresentations(max) {
  const docs = await safeDocs(
    query(
      collectionGroup(db, "items"),
      where("type", "==", "presentation"),
      qLimit(Math.min(max, 100)),
    ),
    "presentations",
  );
  return docs
    .filter((d) => d.data().visibility !== "private") // 明示的に非公開のものは除外
    .map((d) => normalize(d.id, d.data(), "presentation"));
}

// ─── 3DSL: collectionGroup 'layouts' ─────────────────────────────────────────
// ルール: isSignedIn() 必須 → 未認証ユーザーはスキップ
// rawDocs=true のときは正規化せず生ドキュメントを返す（renders 取得用）
async function fetchLayouts(max, { rawDocs = false } = {}) {
  if (!isSignedIn()) return [];
  const docs = await safeDocs(
    query(
      collectionGroup(db, "layouts"),
      where("visibility", "==", "public"),
      qLimit(Math.min(max, 100)),
    ),
    "layouts",
  );
  if (rawDocs) return docs;
  return docs.map((d) => normalize(d.id, d.data(), "layout-plan"));
}

// ─── 3DSL renders: 公開レイアウトのワークスペース配下から直接取得 ─────────────────
// 旧レンダーは createdBy/visibility フィールドがなく collectionGroup では見つからない。
// 代わりに: ① 公開レイアウト → ② ワークスペース内の全プランを列挙 → ③ 各プランのrenders取得
// これにより Plan 1 / Shot 2 / Shot 3 など子プランのレンダーも取得できる。
async function fetchLayoutRenders(max) {
  if (!isSignedIn()) return [];

  // 公開レイアウトドキュメント（ワークスペース情報抽出用）
  const layoutDocs = await fetchLayouts(max, { rawDocs: true });
  if (!layoutDocs.length) return [];

  // 各レイアウトが属するワークスペースの一意なパスを収集
  const workspaces = new Map(); // "pid/wid" → { projectId, workspaceId }
  for (const d of layoutDocs) {
    const segs = d.ref.path.split("/");
    const projectId = segs[1];
    const workspaceId = segs[3];
    if (projectId && workspaceId) {
      workspaces.set(`${projectId}/${workspaceId}`, { projectId, workspaceId });
    }
  }

  const results = [];

  await Promise.all(
    Array.from(workspaces.values()).map(async ({ projectId, workspaceId }) => {
      // ワークスペース内の全レイアウト（Base/Plan/Option すべて）を取得
      const layoutsPath = `projects/${projectId}/workspaces/${workspaceId}/layouts`;
      // eslint-disable-next-line no-console
      console.log("[fetchLayoutRenders] querying:", layoutsPath);
      const allPlanDocs = await safeDocs(
        query(collection(db, layoutsPath), qLimit(50)),
        `plans(${workspaceId.slice(0, 8)})`,
      );
      // eslint-disable-next-line no-console
      console.log("[fetchLayoutRenders] plans found:", allPlanDocs.length);

      // 各プランの renders サブコレクションを取得
      await Promise.all(
        allPlanDocs.map(async (planDoc) => {
          const rendersPath = `${layoutsPath}/${planDoc.id}/renders`;
          const renderDocs = await safeDocs(
            query(collection(db, rendersPath), qLimit(20)),
            `renders(${planDoc.id.slice(0, 8)})`,
          );
          renderDocs.forEach((d) => {
            const data = d.data();
            // eslint-disable-next-line no-console
            console.log("[fetchLayoutRenders] plan:", planDoc.id.slice(0,8), "render:", d.id.slice(0,8), "vis:", data.visibility, "shotName:", data.shotName);
            // 明示的に非公開のものだけ除外（未設定は公開扱い）
            if (data.visibility !== "private") {
              results.push(normalize(d.id, data, "layout-render"));
            }
          });
        }),
      );
    }),
  );

  return results;
}

// ─── 3DSD: collectionGroup 'workFiles' (appScope:'3dsd') ─────────────────────
// DsdRightPanel が visibility:'public'|'private' を書き込む
// 2フィールド等値フィルター（appScope + visibility）で composite index 不要
async function fetchDiagrams(max) {
  if (!isSignedIn()) return [];
  const docs = await safeDocs(
    query(
      collectionGroup(db, "workFiles"),
      where("appScope", "==", "3dsd"),
      where("visibility", "==", "public"),
      qLimit(Math.min(max, 100)),
    ),
    "diagrams(3dsd)",
  );
  return docs.map((d) => normalize(d.id, d.data(), "diagram-state"));
}

// ─── 3DSP: collectionGroup 'workFiles' (appScope:'3dsp') ─────────────────────
// DspDashboard が visibility:'public'|'private' を書き込む
// 2フィールド等値フィルター（appScope + visibility）で composite index 不要
async function fetchDspPresentations(max) {
  if (!isSignedIn()) return [];
  const docs = await safeDocs(
    query(
      collectionGroup(db, "workFiles"),
      where("appScope", "==", "3dsp"),
      where("visibility", "==", "public"),
      qLimit(Math.min(max, 100)),
    ),
    "presentations(3dsp)",
  );
  return docs.map((d) => normalize(d.id, d.data(), "presentation"));
}

// ─── 公開 API ────────────────────────────────────────────────────────────────

/**
 * 全子アプリの公開成果物をまとめて取得してソート済み配列で返す。
 *
 * @param {number}      max        最大件数（各ソースごとに適用し、最後に全体を max に切り詰める）
 * @param {string|null} typeFilter 特定 type のみ絞り込む場合に指定
 */
export async function fetchPublicGalleryItems(max = 60, typeFilter = null) {
  try {
    const perSource = Math.ceil(max * 1.5); // 重複・失敗を考慮してやや多めに取得

    let allItems;
    if (typeFilter) {
      const fetchers = {
        "furniture-template": () => fetchFurnitureTemplates(perSource),
        "layout-plan":        () => fetchLayouts(perSource),
        "layout-render":      () => fetchLayoutRenders(perSource),
        "presentation":       async () => {
          const [web, dsp] = await Promise.all([fetchPresentations(perSource), fetchDspPresentations(perSource)]);
          return [...web, ...dsp];
        },
        "diagram-state":      () => fetchDiagrams(perSource),
      };
      if (fetchers[typeFilter]) {
        allItems = await fetchers[typeFilter]();
      } else {
        allItems = await fetchAssets(perSource, typeFilter);
      }
    } else {
      // 全ソースを並行取得
      const [assets, templates, webPresentations, layouts, layoutRenders, dspPresentations, diagrams] = await Promise.all([
        fetchAssets(perSource, null),
        fetchFurnitureTemplates(perSource),
        fetchPresentations(perSource),     // 3DSP web app (items コレクション)
        fetchLayouts(perSource),
        fetchLayoutRenders(perSource),     // 3DSL レンダリング静止画
        fetchDspPresentations(perSource),  // 3DSP desktop (workFiles/appScope:3dsp)
        fetchDiagrams(perSource),          // 3DSD desktop (workFiles/appScope:3dsd)
      ]);
      allItems = [...assets, ...templates, ...webPresentations, ...layouts, ...layoutRenders, ...dspPresentations, ...diagrams];
    }

    // 重複排除（id が衝突することは基本ないが念のため）
    const seen = new Set();
    const unique = allItems.filter((it) => {
      const key = `${it.type}:${it.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // サムネイル有り → いいね数 → 更新日時 の降順
    unique.sort((a, b) => {
      if ((!!b.thumbnailUrl) !== (!!a.thumbnailUrl)) return b.thumbnailUrl ? 1 : -1;
      if (b.favoriteCount !== a.favoriteCount) return b.favoriteCount - a.favoriteCount;
      return b._sortTs - a._sortTs;
    });

    return unique.slice(0, max);
  } catch (e) {
    console.error("[fetchPublicGalleryItems] error:", e);
    return [];
  }
}

/** 後方互換エイリアス */
export const fetchPublicAssetModels = (max) => fetchPublicGalleryItems(max, "3d-model");
