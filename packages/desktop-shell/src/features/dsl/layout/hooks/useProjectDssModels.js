import { useEffect, useMemo, useState } from "react";
import { collection, limit as fsLimit, onSnapshot, query, where, getDoc, doc } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";

function safeStr(v, fb = "") {
  return typeof v === "string" && v.trim() ? v : fb;
}

// assets コレクションには 3Dモデル以外（画像/レンダー/ブログカバー等）も混在するため、
// 家具ライブラリには 3Dモデルのみを通す。type=='3d-model' を基本とし、
// type が無い旧データは GLB/GLTF を指す URL の有無でフォールバック判定する。
function isThreeDModel(a) {
  if (!a) return false;
  const t = String(a.type || "").toLowerCase();
  if (t === "3d-model" || t === "model" || t.includes("3d")) return true;
  if (t) return false; // 画像/動画/ブログ等の明示 type は除外
  const g = a.glbUrl || a.downloadUrl || a.url || a.files?.glb?.url || a.files?.glb?.downloadUrl;
  return !!g && /\.(glb|gltf)(\?|#|$)/i.test(String(g));
}

import { useAuthStore } from "../../../../store/useAuthStore";

export function useProjectDssModels({ projectId, enabled = true, limit = 240 } = {}) {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState([]);
  
  const currentUser = useAuthStore((s) => s.currentUser);
  const userId = currentUser?.uid;

  useEffect(() => {
    if (!enabled || !userId) {
      setModels([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const targetPath = `assets`;
    const q = query(
      collection(db, targetPath),
      where("ownerId", "==", userId),
      fsLimit(Math.max(1, Number(limit) || 240))
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const fetchedItems = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Resolve references to global assets if `assetRef` exists
        const resolvedItems = await Promise.all(
          fetchedItems.map(async (item) => {
            let merged = { ...item };
            if (item.assetRef) {
              try {
                const assetSnap = await getDoc(doc(db, "assets", item.assetRef));
                if (assetSnap.exists()) {
                  merged = { ...assetSnap.data(), ...merged, resolvedRef: true };
                }
              } catch (e) {
                console.error("[useProjectDssModels] Failed to fetch asset for model", e);
              }
            }
            
            return {
              id: merged.id,
              ...merged,
              name: safeStr(merged.name, merged.id),
              title: safeStr(merged.title, merged.name),
              brand: safeStr(merged.brand, ""),
              ownerHandle: safeStr(merged.ownerHandle, ""),
              // Make sure to pick up unified schemas "thumbnailUrl" as well。
              // coverUrl（ブログ/記事カバー用フィールド）はフォールバックに含めない：
              // 無関係な画像が家具タイルに混入する原因になるため。
              thumbUrl: safeStr(merged.thumbUrl || merged.thumbnailUrl, ""),
              type: safeStr(merged.modelType || merged.type, ""),
              subType: safeStr(merged.subType, ""),
              group: safeStr(merged.group || merged.category, ""),
              tags: Array.isArray(merged.tags) ? merged.tags : [],
              updatedAt: merged.updatedAt || merged.createdAt || null,
              raw: merged,
            };
          })
        );

        // 返却オブジェクトの type は modelType（家具カテゴリ）優先で上書きされるため、
        // 判定は生データ（raw = 本来の type:'3d-model'）で行う。
        setModels(resolvedItems.filter((x) => isThreeDModel(x.raw)));
        setLoading(false);
      },
      (err) => {
        console.warn("[useProjectDssModels] snapshot error:", err);
        setModels([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [enabled, limit, userId]);

  return useMemo(() => ({ models, loading }), [models, loading]);
}
