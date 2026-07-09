// src/features/dsl/hooks/useResolveBaseDocs.ts
// 横断一覧（collectionGroup('layouts')）では Base doc がクエリ条件で
// 漏れることがある（createdBy 未設定 / visibility 違いなど）。一方 Plan/Option は
// rootBaseId を持つので「Plan があれば Base は必ず存在する」。
// ここでは items に存在しない参照先 Base doc だけを個別取得して補完する。
import { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export interface BaseRef {
  projectId: string;
  workspaceId: string;
  baseId: string;
}

export function useResolveBaseDocs(refs: BaseRef[]) {
  const [docs, setDocs] = useState<Map<string, any>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());

  // baseId の集合が変わったときだけ再取得する
  const key = refs.map((r) => r.baseId).filter(Boolean).sort().join(',');

  useEffect(() => {
    let active = true;
    const toFetch = refs.filter(
      (r) =>
        r.baseId && r.projectId && r.workspaceId &&
        !docs.has(r.baseId) && !inFlight.current.has(r.baseId),
    );
    if (toFetch.length === 0) return;

    toFetch.forEach((r) => inFlight.current.add(r.baseId));

    (async () => {
      const updates = new Map<string, any>();
      await Promise.all(
        toFetch.map(async (r) => {
          try {
            const snap = await getDoc(
              doc(db, 'projects', r.projectId, 'workspaces', r.workspaceId, 'layouts', r.baseId),
            );
            if (snap.exists()) {
              updates.set(r.baseId, {
                id: snap.id,
                projectId: r.projectId,
                workspaceId: r.workspaceId,
                ...(snap.data() as object),
              });
            }
          } catch (e) {
            console.warn('[useResolveBaseDocs] fetch failed:', r.baseId, e);
          } finally {
            inFlight.current.delete(r.baseId);
          }
        }),
      );
      if (active && updates.size) {
        setDocs((prev) => new Map([...prev, ...updates]));
      }
    })();

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return docs;
}
