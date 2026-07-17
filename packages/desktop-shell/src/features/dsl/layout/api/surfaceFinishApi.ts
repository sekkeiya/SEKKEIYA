// 躯体面の仕上げ（SurfaceFinish）の永続化。
// projects/{projectId}/workspaces/{workspaceId}/surfaceFinishes/{layoutKey} に保存する。
// ※ workspaces 配下に置く理由: Firestore ルールが workspaces/{document=**} のみ
//    プロジェクトメンバーへ read/write を許可しており、project 直下の独自コレクションは
//    権限拒否される（旧 projects/{pid}/surfaceFinishes は permission-denied だった）。
// layoutKey は Base/Plan/Option の id（躯体はその単位で共有されるため）。

import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";
import type { SurfaceFinish } from "../store/useSurfaceFinishStore";
import type { SurfacePattern } from "../store/useSurfacePatternStore";

const sanitize = (s: string) => (s || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
const finishesPath = (projectId: string, workspaceId: string, layoutKey: string) =>
  `projects/${projectId}/workspaces/${sanitize(workspaceId)}/surfaceFinishes/${sanitize(layoutKey)}`;

export interface SurfaceData {
  finishes: SurfaceFinish[];
  patterns: Record<string, SurfacePattern[]>;
  activePatterns?: Record<string, string | null>;
  /** S.Layout で作図した壁/床の仕上げ（useDrawnFinishStore のスナップショット）。
   *  躯体の面キー方式とは別に、種別（外壁/内壁/床）単位で素材を持つ。 */
  drawnFinishes?: {
    interiorWall?: any | null;
    exteriorWall?: any | null;
    floor?: any | null;
    styleKey?: string | null;
  } | null;
}

/** 現在の仕上げ＋パターンを保存（上書き）。 */
export async function saveSurfaceData(projectId: string, workspaceId: string, layoutKey: string, data: SurfaceData): Promise<void> {
  await setDoc(doc(db, finishesPath(projectId, workspaceId, layoutKey)), {
    finishes: data.finishes,
    patterns: data.patterns,
    activePatterns: data.activePatterns || {},
    drawnFinishes: data.drawnFinishes ?? null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 仕上げ＋パターンを 1 回だけ取得（getDoc）。
 * ライブ購読(onSnapshot)は永続キャッシュ＋多数リスナー環境で Firestore SDK の
 * INTERNAL ASSERTION を誘発するため使わない（保存は明示操作なのでライブ同期不要）。
 */
export async function loadSurfaceData(projectId: string, workspaceId: string, layoutKey: string): Promise<SurfaceData> {
  try {
    const snap = await getDoc(doc(db, finishesPath(projectId, workspaceId, layoutKey)));
    const d = snap.exists() ? (snap.data() as any) : {};
    return {
      finishes: d.finishes || [],
      patterns: d.patterns || {},
      activePatterns: d.activePatterns || {},
      drawnFinishes: d.drawnFinishes || null,
    };
  } catch (err) {
    console.error("[surfaceFinishApi] load error", err);
    return { finishes: [], patterns: {}, activePatterns: {}, drawnFinishes: null };
  }
}
