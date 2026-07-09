import { collection, collectionGroup, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { DsmtMaterial } from '../types';

/** プロジェクト内のマテリアル（type='material'）をライブ購読する。素材ピッカー用。 */
export function subscribeProjectMaterials(projectId: string, cb: (items: DsmtMaterial[]) => void): () => void {
  const q = query(collection(db, `projects/${projectId}/workFiles`), where('appScope', '==', '3dsmt'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((it: any) => it.type === 'material' && it.status !== 'archived' && it.isArchived !== true) as DsmtMaterial[];
      cb(items);
    },
    (err) => { console.error('[dsmtQueries] subscribeProjectMaterials error', err); cb([]); },
  );
}

/**
 * S.Material ライブラリ（全ユーザーの公開マテリアル ＋ 自分の Private マテリアル）を
 * プロジェクト横断（collectionGroup）でライブ購読する。素材ピッカー用。
 * 公開購読と自分購読を併走させ、id で重複排除して返す。
 * クエリ構成は Adapters.tsx の useGlobalMaterialsService と同一（既存の複合 index を再利用）。
 */
export function subscribeMaterialLibrary(userId: string | undefined, cb: (items: DsmtMaterial[]) => void): () => void {
  const wfGroup = collectionGroup(db, 'workFiles');
  let publicItems: DsmtMaterial[] = [];
  let mineItems: DsmtMaterial[] = [];

  const isMaterial = (it: any) => it.type === 'material' && it.status !== 'archived' && it.isArchived !== true;

  const emit = () => {
    const byId = new Map<string, DsmtMaterial>();
    for (const it of publicItems) byId.set(it.id, it);
    for (const it of mineItems) byId.set(it.id, it); // 自分のデータを優先
    cb(Array.from(byId.values()));
  };

  // 全ユーザーの公開マテリアル
  const qPublic = query(wfGroup, where('appScope', '==', '3dsmt'), where('visibility', '==', 'public'), limit(120));
  const unsubPublic = onSnapshot(
    qPublic,
    (snap) => {
      publicItems = snap.docs
        .map((d) => ({ id: d.id, projectId: d.ref.parent.parent?.id, ...(d.data() as any) }))
        .filter(isMaterial) as DsmtMaterial[];
      emit();
    },
    (err) => { console.error('[dsmtQueries] subscribeMaterialLibrary public error', err); publicItems = []; emit(); },
  );

  // 自分のマテリアル（public/private 両方。private は旧データ=visibility未設定も含む）
  let unsubMine: (() => void) | null = null;
  if (userId) {
    const qMine = query(wfGroup, where('appScope', '==', '3dsmt'), where('createdBy', '==', userId), limit(200));
    unsubMine = onSnapshot(
      qMine,
      (snap) => {
        mineItems = snap.docs
          .map((d) => ({ id: d.id, projectId: d.ref.parent.parent?.id, ...(d.data() as any) }))
          .filter(isMaterial) as DsmtMaterial[];
        emit();
      },
      (err) => { console.error('[dsmtQueries] subscribeMaterialLibrary mine error', err); mineItems = []; emit(); },
    );
  }

  return () => { unsubPublic(); if (unsubMine) unsubMine(); };
}
