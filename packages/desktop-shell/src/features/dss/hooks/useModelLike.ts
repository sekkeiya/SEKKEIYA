import { useCallback, useEffect, useRef, useState } from 'react';
import { readLikeState, toggleModelLike } from '../utils/modelLikes';

export interface UseModelLikeOptions {
  model: any;
  /** 未ログインなら null（または undefined）。 */
  uid: string | null | undefined;
  /**
   * false の間は readLikeState を呼ばない。
   * DssModelCardActionBar のようにホバーされるまで読み取りを遅延させたい呼び出し元向け。
   * 省略時は true（マウント直後から読み込む＝詳細画面向け）。
   */
  enabled?: boolean;
}

export interface UseModelLikeResult {
  liked: boolean;
  favoriteCount: number;
  /**
   * 初回の readLikeState がまだ完了していない（enabled=false の間もこのまま true）。
   * 「一度も要求していない」と「要求したがまだ届いていない」は呼び出し元の enabled で区別する。
   */
  loading: boolean;
  /** トグル処理中（連打防止用）。 */
  toggling: boolean;
  toggleLike: () => Promise<void>;
}

/**
 * assets/{assetId}/likes/{uid} のいいね状態を読み書きする共通フック。
 * DssModelCardActionBar（ホバーで enabled になる）と詳細画面の OverviewSection（常に enabled、
 * 旧 DssDetailActionBar の後継）の両方から使う。初回読み込みが終わるまでは toggleLike を no-op にし、サーバーに既に
 * 存在するいいねを「まだ liked=false のはず」という誤った楽観更新で setDoc（=update 扱いで
 * ルール上 denied）してしまう競合を防ぐ。トグル失敗時はローカルの反転ではなく、サーバーから
 * 再読み込みして真実に収束させる。
 */
export function useModelLike({ model, uid, enabled = true }: UseModelLikeOptions): UseModelLikeResult {
  const [liked, setLiked] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [toggling, setToggling] = useState(false);

  // toggleLike のクロージャから「今の loaded」を見るための ref（依存配列を毎回作り直さないため）。
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setLoaded(false);
    readLikeState(model, uid ?? null)
      .then((s) => {
        if (!mounted) return;
        setLiked(s.liked);
        setFavoriteCount(s.count);
      })
      .catch((err) => {
        // オフライン等で読めなかった場合は liked/count を初期値のまま据え置く
        // （作り物の false/0 をサーバーの真実として確定させない）。
        // loaded だけは必ず true にする — さもないとハートがホバー後
        // 永久に無効化されたままになる。
        console.warn('[useModelLike] initial readLikeState failed', err);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [enabled, model, uid]);

  const toggleLike = useCallback(async () => {
    if (toggling || !uid || !loadedRef.current) return;

    const next = !liked;
    setLiked(next);
    setFavoriteCount((prev) => (next ? prev + 1 : Math.max(prev - 1, 0)));
    setToggling(true);
    try {
      await toggleModelLike(model, uid, next);
    } catch (err) {
      console.error('[useModelLike] toggle failed', err);
      // ロールバックはローカルの反転だけに頼らない。サーバーの真実を読み直して収束させる
      // （例: 既にいいね済みのドキュメントに setDoc=update が飛んで denied になった場合、
      // 単純反転だと「元の状態」ではなく「その時点のローカル値の逆」にしかならず、
      // サーバーの実際の状態とズレたまま固定されてしまう）。
      // readLikeState はオフライン等で読めなければ throw する（作り物の0件を返さない）ので、
      // その場合はこの catch(reErr) で「最後に分かっていた正しい値」へのプレーンな
      // ロールバックにフォールバックする。
      try {
        const s = await readLikeState(model, uid ?? null);
        setLiked(s.liked);
        setFavoriteCount(s.count);
      } catch (reErr) {
        console.error('[useModelLike] re-read after failed toggle also failed', reErr);
        setLiked(!next);
        setFavoriteCount((prev) => (next ? Math.max(prev - 1, 0) : prev + 1));
      }
    } finally {
      setToggling(false);
    }
  }, [toggling, uid, liked, model]);

  return {
    liked,
    favoriteCount,
    loading: !loaded,
    toggling,
    toggleLike,
  };
}
