// レイアウトの「躯体まわりの状態」永続化。
// projects/{projectId}/layoutState/{baseKey} に
//   - lights（ライティング）
//   - labels（面ラベル: 床/内壁/外壁/天井）
//   - shots / sets（カメラアングル・セット）
// をまとめて保存する。baseKey は Base の id（躯体・ライティング・ラベルは Base 単位で共有）。
// マテリアル仕上げは別途 surfaceFinishApi（layoutKey 単位）で保存される。
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";
import type { LightConfig } from "../store/useLightingStore";
import type { StructureLabel } from "../store/useStructureLabelStore";
import type { Shot, AngleSet } from "../store/useShotStore";
import type { BuildingSpec } from "../store/useBuildingSpecStore";

const sanitize = (s: string) => (s || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
// workspaces 配下に置く（Firestore ルールが workspaces/{document=**} のみメンバーへ
// read/write を許可しているため。project 直下の独自コレクションは permission-denied）。
const statePath = (projectId: string, workspaceId: string, baseKey: string) =>
  `projects/${projectId}/workspaces/${sanitize(workspaceId)}/layoutState/${sanitize(baseKey)}`;

export interface LayoutStateData {
  lights: LightConfig[];
  labels: Record<string, StructureLabel>;
  shots: Shot[];
  sets: AngleSet[];
  buildingSpec?: BuildingSpec | null; // 階高 / CH（Base 単位）
}

// Firestore は undefined を保存できないため JSON 経由で除去する。
function stripUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}

// Firestore は1ドキュメント1MB制限。ショットのサムネイルは 1920×1080 JPEG で数百KBあり、
// そのまま保存すると数枚で上限を超える。保存用に小さく（最大幅240px・JPEG0.6）再エンコードする。
function downscaleDataUrl(dataUrl: string | null | undefined, maxW = 240): Promise<string | null> {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      resolve(dataUrl ?? null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round((img.width || maxW) * scale));
        const h = Math.max(1, Math.round((img.height || maxW) * scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.6));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function shrinkShotThumbnails(shots: Shot[]): Promise<Shot[]> {
  return Promise.all((shots || []).map(async (sh) => ({
    ...sh,
    thumbnail: await downscaleDataUrl(sh.thumbnail, 240),
  })));
}

// 面ラベルの surface.tris（連結三角形の座標配列）はドキュメントを肥大化させるため保存しない。
// tris が無くても矩形(uAxis/vAxis/width/height)でハイライト・コリジョン・マテリアル分類は成立する。
function stripLabelTris(labels: Record<string, StructureLabel>): Record<string, StructureLabel> {
  const out: Record<string, StructureLabel> = {};
  for (const [k, l] of Object.entries(labels || {})) {
    const surface = l?.surface ? { ...l.surface } : l?.surface;
    if (surface && (surface as any).tris) delete (surface as any).tris;
    out[k] = { ...l, surface } as StructureLabel;
  }
  return out;
}

/** ライティング・面ラベル・アングルを保存（上書き）。 */
export async function saveLayoutState(projectId: string, workspaceId: string, baseKey: string, data: LayoutStateData): Promise<void> {
  const shots = await shrinkShotThumbnails(data.shots || []);
  await setDoc(doc(db, statePath(projectId, workspaceId, baseKey)), {
    lights: stripUndefined(data.lights || []),
    labels: stripUndefined(stripLabelTris(data.labels || {})),
    shots: stripUndefined(shots),
    sets: stripUndefined(data.sets || []),
    buildingSpec: stripUndefined(data.buildingSpec || null),
    updatedAt: serverTimestamp(),
  });
}

/** 1 回だけ取得（getDoc）。未保存なら null。 */
export async function loadLayoutState(projectId: string, workspaceId: string, baseKey: string): Promise<LayoutStateData | null> {
  try {
    const snap = await getDoc(doc(db, statePath(projectId, workspaceId, baseKey)));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    return {
      lights: d.lights || [],
      labels: d.labels || {},
      shots: d.shots || [],
      sets: d.sets || [],
      buildingSpec: d.buildingSpec || null,
    };
  } catch (err) {
    console.error("[layoutStateApi] load error", err);
    return null;
  }
}
