import { create } from 'zustand';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/client';

// アカウントサイト（マイページ）のプロフィール周辺で、UI 全体から参照したい
// 軽量な値だけを保持するストア。users/{uid} を onSnapshot で購読し、
// サイトロゴ（accountLogoUrl）などをリアルタイムに反映する。
interface AccountProfileState {
  uid: string | null;
  logoUrl: string | null;
  displayName: string | null;
  _unsub: (() => void) | null;
  /** users/{uid} の購読を開始（同じ uid なら何もしない）。 */
  subscribe: (uid: string) => void;
  /** 購読解除。 */
  unsubscribe: () => void;
  /** 保存直後などに即時反映したいとき用。 */
  setLogoUrl: (url: string | null) => void;
  /** 保存直後などに表示名を即時反映したいとき用。 */
  setDisplayName: (name: string) => void;
}

export const useAccountProfileStore = create<AccountProfileState>((set, get) => ({
  uid: null,
  logoUrl: null,
  displayName: null,
  _unsub: null,

  subscribe: (uid) => {
    if (!uid) return;
    const { uid: current, _unsub } = get();
    if (current === uid && _unsub) return; // 既に同じ uid を購読中
    _unsub?.();

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const d = snap.exists() ? (snap.data() as any) : {};
        set({
          logoUrl: d.accountLogoUrl ?? null,
          displayName: d.displayName ?? null,
        });
      },
      (err) => console.warn('[accountProfile] subscribe failed', err),
    );

    set({ uid, _unsub: unsub });
  },

  unsubscribe: () => {
    get()._unsub?.();
    set({ uid: null, _unsub: null, logoUrl: null, displayName: null });
  },

  setLogoUrl: (url) => set({ logoUrl: url }),
  setDisplayName: (name) => set({ displayName: name }),
}));
