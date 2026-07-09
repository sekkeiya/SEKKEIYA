import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase/client';
import { useAIChatStore } from './useAIChatStore';
import { useBatchGenStore } from './useBatchGenStore';

/**
 * 永続化されているユーザー固有ストア（AIチャット履歴・3D一括生成）の所有者を現ユーザーに合わせる。
 * uid が変わっていれば（ログアウト/別アカウントログイン）前アカウントのデータをクリアする。
 */
function scopePersistedStoresToUser(uid: string | null): void {
  try { useAIChatStore.getState().ensureOwner(uid); } catch (e) { console.error('scope chat store failed', e); }
  try {
    const bg = useBatchGenStore.getState();
    bg.ensureOwner(uid);
    // 認証確立後にリスナを再アタッチ（リロードで止まって見える生成中ジョブの復旧）。
    if (uid) bg.resumeActiveJobs();
  } catch (e) { console.error('scope batch store failed', e); }
}

/**
 * Tauri バックエンドへ「現在ログイン中のアカウント」を通知する。
 * これに基づき私物データ（3DSS / 3DSK / Projects）の保存先が
 * %USERPROFILE%\SEKKEIYA\Accounts\<表示名>\ 配下に切り替わる。
 * フォルダ名は displayName 優先（未設定なら email ローカル部 → uid）。
 * UI で編集される表示名は Firestore users/{uid}.displayName が正なので、
 * そちらを優先的に取得して渡す（取れなければ Firebase Auth の displayName）。
 * Web ビルド（Tauri 非搭載）では invoke が無いため握りつぶす。
 */
async function syncActiveAccountToNative(user: User | null): Promise<void> {
  try {
    let displayName: string | null = user?.displayName ?? null;
    if (user) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase/client');
        const snap = await getDoc(doc(db, 'users', user.uid));
        const fsName = snap.exists() ? (snap.data() as any)?.displayName : null;
        if (typeof fsName === 'string' && fsName.trim()) displayName = fsName;
      } catch {
        // Firestore 取得失敗時は Auth の displayName をそのまま使う
      }
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_active_account_uid', {
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      displayName,
    });
  } catch (e) {
    // Web / 非 Tauri 環境、または未ログイン初期化時は無視
    if (import.meta.env?.DEV) console.debug('[auth] set_active_account_uid skipped', e);
  }
}

export interface AuthState {
  currentUser: User | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  initializeAuth: () => () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  authLoading: true,
  isAuthenticated: false,
  setUser: (user) => {
    set({ currentUser: user, isAuthenticated: !!user, authLoading: false });
    scopePersistedStoresToUser(user?.uid ?? null);
  },
  initializeAuth: () => {
    return onAuthStateChanged(auth, (user) => {
      set({ currentUser: user, isAuthenticated: !!user, authLoading: false });
      // アカウント切替時は、前アカウントの永続データ（チャット履歴・一括生成）をクリア。
      scopePersistedStoresToUser(user?.uid ?? null);
      // ネイティブ側のアクティブアカウントを同期（ローカル保存先の切替）
      void syncActiveAccountToNative(user);
      // コネクタの Firestore リスナーを開始/停止
      import('../features/connectors/useConnectorStore').then(({ useConnectorStore }) => {
        if (user?.uid) {
          useConnectorStore.getState().startListening(user.uid, 'google_calendar');
        } else {
          useConnectorStore.getState().stopAll();
        }
      });
    });
  },
  logout: async () => {
    try {
      await signOut(auth);
      set({ currentUser: null, isAuthenticated: false });
      void syncActiveAccountToNative(null);
    } catch (e) {
      console.error("Logout failed", e);
    }
  }
}));
