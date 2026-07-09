// S.Library クラウド受信箱ドレイン（Desktop 専用）。
// ハイブリッド方式の「回収」側。ブラウザ拡張→Web(/clip)→Firestore bookmarkInbox に
// 積まれた本人分の項目を、Desktop アプリ起動中に購読し、既存のローカル保存
// パイプラインで S.Library に取り込んでから受信箱の項目を削除する。
// （Web ではローカル保存できないので、必ず isTauri ガードで Desktop のみ実行）
import { collection, query, where, onSnapshot, deleteDoc, doc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { isTauri } from '../../../lib/platform';
import { processIncomingBookmark, type IncomingBookmark } from './bookmarkBridge';

const COLLECTION = 'bookmarkInbox';

/** 二重処理を防ぐため、回収中／回収済みの docId を覚えておく。 */
const inFlight = new Set<string>();

/** 受信箱ドキュメント1件を取り込み、成功したら受信箱から削除する。 */
async function drainOne(docId: string, data: any): Promise<void> {
  if (inFlight.has(docId)) return;
  inFlight.add(docId);
  const payload: IncomingBookmark = {
    url: String(data?.url ?? ''),
    title: data?.title ?? '',
    ogImage: data?.ogImage ?? '',
    selection: data?.selection ?? '',
    favicon: data?.favicon ?? '',
  };
  try {
    await processIncomingBookmark(payload);
    // ローカル保存できたらクラウド受信箱から消す（クラウドには残さない）。
    await deleteDoc(doc(db, COLLECTION, docId));
  } catch (e) {
    console.warn('[inboxDrain] drain failed, will retry on next snapshot', e);
    // 失敗時は inFlight から外し、次のスナップショットで再試行できるようにする。
    inFlight.delete(docId);
  }
}

/**
 * クラウド受信箱ドレインを起動する。ログイン中の uid を購読し、uid が変わるたびに
 * Firestore リスナーを張り替える。返り値でアンサブスクライブ（uid購読＋現リスナー）。
 * Web/非Tauri では何もしない（ローカル保存不可のため）。
 */
export function installInboxDrain(): () => void {
  if (!isTauri()) return () => {};

  let fsUnsub: Unsubscribe | null = null;
  let currentUid: string | null = null;

  const startFor = (uid: string | null) => {
    if (uid === currentUid) return;
    currentUid = uid;
    if (fsUnsub) { fsUnsub(); fsUnsub = null; }
    if (!uid) return;
    try {
      const q = query(collection(db, COLLECTION), where('ownerId', '==', uid));
      fsUnsub = onSnapshot(q, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            void drainOne(change.doc.id, change.doc.data());
          }
        });
      }, (err) => {
        console.warn('[inboxDrain] snapshot error', err);
      });
    } catch (e) {
      console.warn('[inboxDrain] listen setup failed', e);
    }
  };

  // 初期 uid＋以降の変化を購読。
  startFor(useAuthStore.getState().currentUser?.uid ?? null);
  const storeUnsub = useAuthStore.subscribe((s) => {
    startFor(s.currentUser?.uid ?? null);
  });

  return () => {
    storeUnsub();
    if (fsUnsub) fsUnsub();
  };
}
