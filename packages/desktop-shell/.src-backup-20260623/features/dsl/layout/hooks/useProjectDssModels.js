import { useEffect, useMemo, useState } from "react";
import { collection, limit as fsLimit, onSnapshot, query, where, getDoc, doc } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

function safeStr(v, fb = "") {
  return typeof v === "string" && v.trim() ? v : fb;
}

import { useAuthStore } from "@desktop/store/useAuthStore";

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
              // Make sure to pick up unified schemas "thumbnailUrl" as well
              thumbUrl: safeStr(merged.thumbUrl || merged.thumbnailUrl || merged.coverUrl, ""),
              type: safeStr(merged.modelType || merged.type, ""),
              subType: safeStr(merged.subType, ""),
              group: safeStr(merged.group || merged.category, ""),
              tags: Array.isArray(merged.tags) ? merged.tags : [],
              updatedAt: merged.updatedAt || merged.createdAt || null,
              raw: merged,
            };
          })
        );

        setModels(resolvedItems);
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
