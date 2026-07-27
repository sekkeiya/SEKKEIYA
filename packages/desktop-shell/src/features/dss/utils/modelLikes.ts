import { doc, getDoc, setDoc, deleteDoc, collection, getCountFromServer, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { getCanonicalModelId } from './modelUtils';

/** いいねは assets/{assetId}/likes/{uid} に1人1ドキュメント。本人だけが自分の分を書ける。 */
function likesPath(model: any): string | null {
  const id = getCanonicalModelId(model) || model?.id;
  return id ? `assets/${id}/likes` : null;
}

/**
 * 自分がいいね済みか、と総件数を読む。未ログインでも件数だけは読める。
 *
 * モデルIDが解決できない（＝そもそもいいね対象が存在しない）場合だけ
 * { liked: false, count: 0 } を返す。オフライン等でサーバーに読みに行けなかった
 * 場合はここで握りつぶさず throw する — 「いいねが0件」と「読めなかった」を
 * 呼び出し側が区別できるようにするため（区別できないと、再読み込みに失敗した
 * ときに作り物の0件をサーバーの真実として表示してしまう）。
 * 呼び出し側（初回ロード／トグル失敗時の再読み込み）で throw をそれぞれの
 * 方針で処理すること。
 */
export async function readLikeState(model: any, uid: string | null): Promise<{ liked: boolean; count: number }> {
  const path = likesPath(model);
  if (!path) return { liked: false, count: 0 };
  const countSnap = await getCountFromServer(collection(db, path));
  const count = countSnap.data().count;
  if (!uid) return { liked: false, count };
  const mine = await getDoc(doc(db, path, uid));
  return { liked: mine.exists(), count };
}

/** いいねを付ける / 外す。失敗時は throw する（呼び出し側で表示を戻すため）。 */
export async function toggleModelLike(model: any, uid: string, nextLiked: boolean): Promise<void> {
  const path = likesPath(model);
  if (!path) throw new Error('モデルIDが解決できませんでした');
  const ref = doc(db, path, uid);
  if (nextLiked) {
    await setDoc(ref, { uid, createdAt: serverTimestamp() });
  } else {
    await deleteDoc(ref);
  }
}
