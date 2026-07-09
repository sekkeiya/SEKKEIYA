import { create } from 'zustand';
import type { AppNotification } from '../features/teams/api/teamsApi';
import {
  subscribeToNotifications,
  markAllNotificationsRead,
  acceptInvitation,
  declineInvitation,
} from '../features/teams/api/teamsApi';
import { useTeamsStore } from './useTeamsStore';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { invoke } from '@tauri-apps/api/core';

// Module-level listener handle — not part of Zustand state to avoid serialization issues
let _unsubscribe: (() => void) | null = null;
let _prevNotifIds = new Set<string>();
let _isFirstLoad = true;

async function sendDesktopNotification(notif: AppNotification) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === 'granted';
    }
    if (!granted) return;

    if (notif.type === 'team_invite') {
      await sendNotification({
        title: 'チームへの招待',
        body: `${notif.fromName || 'ユーザー'}さんが「${notif.teamName}」に招待しています`,
      });
    } else if (notif.type === 'member_joined') {
      await sendNotification({
        title: 'メンバーが参加しました',
        body: `${notif.fromName || 'ユーザー'}さんが「${notif.teamName}」に参加しました`,
      });
    } else if (notif.type === 'interview_request') {
      const title = notif.title || '🎤 取材の依頼';
      const body = notif.message || `${notif.fromName || 'AI記者'}から取材の質問が届いています`;
      // Windows: 「取材を開始」ボタン付きトースト（Rust側 winrt）。
      // ボタン／本体クリックで App.tsx が interview-notification-action を受け、
      // アプリを前面化して取材を開く。失敗時（非Windows等）はボタンなしにフォールバック。
      try {
        await invoke('send_toast_notification_with_actions', {
          title,
          body,
          buttons: [['🎤 取材を開始', 'start-interview']],
          key: notif.id,
          eventName: 'interview-notification-action',
        });
        return;
      } catch {
        /* フォールバックへ */
      }
      await sendNotification({ title, body });
    }
  } catch {
    // Desktop notifications are best-effort (e.g. web mode has no Tauri)
  }
}

interface NotificationsState {
  notifications: AppNotification[];
  localNotifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isPanelOpen: boolean;
  actionError: string | null;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  clearActionError: () => void;
  startListening: (userId: string) => void;
  stopListening: () => void;
  accept: (params: { userId: string; notif: AppNotification }) => Promise<void>;
  decline: (params: { userId: string; notif: AppNotification }) => Promise<void>;
  readAll: (userId: string) => Promise<void>;
  addLocalNotification: (notif: AppNotification) => void;
  readLocalNotification: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  localNotifications: [],
  unreadCount: 0,
  isLoading: false,
  isPanelOpen: false,
  actionError: null,

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set(s => ({ isPanelOpen: !s.isPanelOpen })),
  clearActionError: () => set({ actionError: null }),

  startListening: (userId) => {
    // Clean up any existing listener
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
    _prevNotifIds = new Set();
    _isFirstLoad = true;

    set({ isLoading: true });

    _unsubscribe = subscribeToNotifications(userId, async (notifs) => {
      const currentIds = new Set(notifs.map(n => n.id));

      if (!_isFirstLoad) {
        // Send desktop notifications for newly arrived unread notifications
        for (const notif of notifs) {
          if (!_prevNotifIds.has(notif.id) && !notif.read) {
            sendDesktopNotification(notif);
          }
        }
      }

      _isFirstLoad = false;
      _prevNotifIds = currentIds;

      const localUnread = get().localNotifications.filter(n => !n.read).length;
      set({
        notifications: notifs,
        unreadCount: notifs.filter(n => !n.read).length + localUnread,
        isLoading: false,
      });
    });
  },

  stopListening: () => {
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
    _isFirstLoad = true;
    _prevNotifIds = new Set();
  },

  accept: async ({ userId, notif }) => {
    if (!notif.invitationId) {
      console.warn('[accept] invitationId is missing on notif:', notif);
      set({ actionError: '招待情報が見つかりません。通知を再読み込みしてください。' });
      return;
    }
    try {
      await acceptInvitation({
        userId,
        notifId: notif.id,
        teamId: notif.teamId,
        invitationId: notif.invitationId,
      });
      await useTeamsStore.getState().loadTeams(userId);
      // onSnapshot will automatically update notifications state
    } catch (e) {
      console.error('[accept] failed:', e);
      set({ actionError: 'チームへの参加に失敗しました。もう一度お試しください。' });
      throw e;
    }
  },

  decline: async ({ userId, notif }) => {
    if (!notif.invitationId) {
      console.warn('[decline] invitationId is missing on notif:', notif);
      return;
    }
    try {
      await declineInvitation({
        userId,
        notifId: notif.id,
        teamId: notif.teamId,
        invitationId: notif.invitationId,
      });
      // onSnapshot will automatically update notifications state
    } catch (e) {
      console.error('[decline] failed:', e);
      set({ actionError: '辞退処理に失敗しました。' });
      throw e;
    }
  },

  readAll: async (userId) => {
    await markAllNotificationsRead(userId);
    set(s => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      localNotifications: s.localNotifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  addLocalNotification: (notif) => {
    set(s => {
      const already = s.localNotifications.some(n => n.id === notif.id);
      if (already) return s;
      const updated = [notif, ...s.localNotifications];
      const localUnread = updated.filter(n => !n.read).length;
      return {
        localNotifications: updated,
        unreadCount: s.notifications.filter(n => !n.read).length + localUnread,
      };
    });
  },

  readLocalNotification: (id) => {
    set(s => {
      const updated = s.localNotifications.map(n => n.id === id ? { ...n, read: true } : n);
      const localUnread = updated.filter(n => !n.read).length;
      return {
        localNotifications: updated,
        unreadCount: s.notifications.filter(n => !n.read).length + localUnread,
      };
    });
  },
}));
