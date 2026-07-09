// コネクタの接続状態・トークンを管理する Zustand ストア。
// Firestore: users/{uid}/connectors/{connectorId}
import { create } from 'zustand';
import {
  doc, setDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import type { ConnectorId, ConnectorToken } from './types';

interface ConnectorState {
  /** connectorId → token (null = 未接続 / 未ロード) */
  tokens: Partial<Record<ConnectorId, ConnectorToken | null>>;
  /** Firestore リスナーの購読解除関数 */
  _unsub: Partial<Record<ConnectorId, () => void>>;

  /** ログイン後に呼んで Firestore をリッスン開始 */
  startListening: (uid: string, connectorId: ConnectorId) => void;
  stopListening: (connectorId: ConnectorId) => void;
  stopAll: () => void;

  /** トークンを保存（接続完了後） */
  saveToken: (uid: string, connectorId: ConnectorId, token: ConnectorToken) => Promise<void>;
  /** 切断（Firestore からも削除） */
  disconnect: (uid: string, connectorId: ConnectorId) => Promise<void>;

  /** 有効なアクセストークンを返す（期限切れなら refreshFn で更新後に返す） */
  getValidToken: (
    connectorId: ConnectorId,
    refreshFn: (refreshToken: string) => Promise<{ accessToken: string; expiresIn: number }>,
    uid: string,
  ) => Promise<string | null>;
}

export const useConnectorStore = create<ConnectorState>((set, get) => ({
  tokens: {},
  _unsub: {},

  startListening: (uid, connectorId) => {
    const existing = get()._unsub[connectorId];
    if (existing) existing();

    const ref = doc(db, 'users', uid, 'connectors', connectorId);
    const unsub = onSnapshot(ref, snap => {
      const data = snap.exists() ? (snap.data() as ConnectorToken) : null;
      set(s => ({ tokens: { ...s.tokens, [connectorId]: data } }));
    });
    set(s => ({ _unsub: { ...s._unsub, [connectorId]: unsub } }));
  },

  stopListening: connectorId => {
    const unsub = get()._unsub[connectorId];
    if (unsub) { unsub(); }
    set(s => ({
      _unsub: { ...s._unsub, [connectorId]: undefined },
      tokens: { ...s.tokens, [connectorId]: null },
    }));
  },

  stopAll: () => {
    Object.values(get()._unsub).forEach(u => u?.());
    set({ _unsub: {}, tokens: {} });
  },

  saveToken: async (uid, connectorId, token) => {
    const ref = doc(db, 'users', uid, 'connectors', connectorId);
    await setDoc(ref, { ...token, connectedAt: serverTimestamp() });
  },

  disconnect: async (uid, connectorId) => {
    const ref = doc(db, 'users', uid, 'connectors', connectorId);
    await deleteDoc(ref);
    set(s => ({ tokens: { ...s.tokens, [connectorId]: null } }));
  },

  getValidToken: async (connectorId, refreshFn, uid) => {
    const token = get().tokens[connectorId];
    if (!token) return null;

    // まだ有効（30 秒バッファ）
    if (token.expiresAt > Date.now() + 30_000) return token.accessToken;

    // リフレッシュ
    try {
      const { accessToken, expiresIn } = await refreshFn(token.refreshToken);
      const newToken: ConnectorToken = {
        ...token,
        accessToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };
      const ref = doc(db, 'users', uid, 'connectors', connectorId);
      await setDoc(ref, newToken, { merge: true });
      set(s => ({ tokens: { ...s.tokens, [connectorId]: newToken } }));
      return accessToken;
    } catch (e) {
      console.error('[ConnectorStore] token refresh failed', e);
      return null;
    }
  },
}));
