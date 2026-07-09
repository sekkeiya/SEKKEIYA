import React from 'react';
import {
  Box, Typography, IconButton, Avatar, Button,
  CircularProgress, Tooltip, Popover,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import SystemUpdateRoundedIcon from '@mui/icons-material/SystemUpdateRounded';
import AssignmentIndRoundedIcon from '@mui/icons-material/AssignmentIndRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import { markNotificationRead } from '../api/teamsApi';
import { useAppStore } from '../../../store/useAppStore';
import { useTeamChatStore } from '../../team-chat/store/useTeamChatStore';
import { useNotificationsStore } from '../../../store/useNotificationsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { AppNotification } from '../api/teamsApi';
import { BRAND } from '../../../styles/theme';
import { markUpdateNotified } from '../../../lib/checkForUpdate';

const panelPaper = {
  bgcolor: 'rgba(16,20,30,0.97)',
  backdropFilter: 'blur(20px)',
  border: `1px solid ${BRAND.line}`,
  borderRadius: 3,
  boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
  width: 380,
  maxHeight: 520,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const UpdateNotifCard: React.FC<{ notif: AppNotification }> = ({ notif }) => {
  const { readLocalNotification } = useNotificationsStore();

  const handleDismiss = () => {
    readLocalNotification(notif.id);
    if (notif.latestVersion) markUpdateNotified(notif.latestVersion);
  };

  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: notif.read ? 'transparent' : 'rgba(46,213,115,0.06)',
        borderBottom: `1px solid ${BRAND.line}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(46,213,115,0.2)', flexShrink: 0 }}>
          <SystemUpdateRoundedIcon fontSize="small" sx={{ color: '#2ed573' }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text, lineHeight: 1.4 }}>
            新しいバージョンが利用可能です
          </Typography>
          <Typography sx={{ fontSize: 12, color: BRAND.sub, lineHeight: 1.4, mt: 0.3 }}>
            <Box component="span" sx={{ fontWeight: 600, color: '#2ed573' }}>
              v{notif.latestVersion}
            </Box>
            {' '}がリリースされました
          </Typography>
          {notif.releaseNotes && (
            <Typography sx={{ fontSize: 11, color: BRAND.sub2, lineHeight: 1.5, mt: 0.5 }}>
              {notif.releaseNotes}
            </Typography>
          )}
        </Box>
        {!notif.read && (
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2ed573', flexShrink: 0, mt: 0.5 }} />
        )}
      </Box>
      {!notif.read && (
        <Box sx={{ pl: '52px' }}>
          <Button
            size="small"
            variant="text"
            onClick={handleDismiss}
            sx={{
              color: BRAND.sub2, fontSize: 12, textTransform: 'none', borderRadius: 2,
              '&:hover': { color: BRAND.text, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
            }}
          >
            確認済みにする
          </Button>
        </Box>
      )}
    </Box>
  );
};

const InviteNotifCard: React.FC<{ notif: AppNotification }> = ({ notif }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const { accept, decline } = useNotificationsStore();
  const [busy, setBusy] = React.useState(false);

  const handle = async (action: 'accept' | 'decline') => {
    if (!currentUser || busy) return;
    setBusy(true);
    try {
      if (action === 'accept') {
        await accept({ userId: currentUser.uid, notif });
      } else {
        await decline({ userId: currentUser.uid, notif });
      }
    } catch {
      // error is set on useNotificationsStore.actionError → shown in MiniSidebar Snackbar
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: notif.read ? 'transparent' : 'rgba(52,152,219,0.06)',
        borderBottom: `1px solid ${BRAND.line}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: '#3498db', fontSize: 14 }}>
          <GroupsRoundedIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text, lineHeight: 1.4 }}>
            チームへの招待
          </Typography>
          <Typography sx={{ fontSize: 12, color: BRAND.sub, lineHeight: 1.4 }}>
            <Box component="span" sx={{ fontWeight: 600, color: BRAND.text }}>
              {notif.fromName || 'ユーザー'}
            </Box>
            さんが「
            <Box component="span" sx={{ fontWeight: 600, color: '#3498db' }}>
              {notif.teamName}
            </Box>
            」に招待しています
          </Typography>
        </Box>
        {!notif.read && (
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3498db', flexShrink: 0 }} />
        )}
      </Box>
      {!notif.read && (
        <Box sx={{ display: 'flex', gap: 1, pl: '52px' }}>
          <Button
            size="small"
            variant="contained"
            disabled={busy}
            onClick={() => handle('accept')}
            sx={{
              bgcolor: '#3498db', color: 'var(--brand-fg)', fontWeight: 700, fontSize: 12,
              textTransform: 'none', borderRadius: 2, px: 2,
              '&:hover': { bgcolor: '#2980b9' },
            }}
          >
            {busy ? <CircularProgress size={14} color="inherit" /> : '承認する'}
          </Button>
          <Button
            size="small"
            variant="text"
            disabled={busy}
            onClick={() => handle('decline')}
            sx={{
              color: BRAND.sub2, fontSize: 12, textTransform: 'none', borderRadius: 2,
              '&:hover': { color: BRAND.text, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
            }}
          >
            辞退
          </Button>
        </Box>
      )}
    </Box>
  );
};

const TaskAssignedNotifCard: React.FC<{ notif: AppNotification }> = ({ notif }) => (
  <Box
    sx={{
      px: 2.5,
      py: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      bgcolor: notif.read ? 'transparent' : 'rgba(0,191,255,0.06)',
      borderBottom: `1px solid ${BRAND.line}`,
    }}
  >
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(0,191,255,0.15)' }}>
      <AssignmentIndRoundedIcon fontSize="small" sx={{ color: '#00BFFF' }} />
    </Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text, lineHeight: 1.4 }}>
        タスクが割り当てられました
      </Typography>
      <Typography sx={{ fontSize: 12, color: BRAND.sub, lineHeight: 1.4, mt: 0.3 }}>
        <Box component="span" sx={{ fontWeight: 600, color: '#00BFFF' }}>
          {notif.taskTitle || 'タスク'}
        </Box>
        {notif.projectName ? `（${notif.projectName}）` : ''}
        {notif.fromName ? ` — ${notif.fromName}さんから` : ''}
      </Typography>
      <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.3 }}>
        {new Date(notif.createdAt).toLocaleDateString('ja-JP')}
      </Typography>
    </Box>
    {!notif.read && (
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00BFFF', flexShrink: 0 }} />
    )}
  </Box>
);

// 外部URL（Web管理画面）を開く。Tauri では既定ブラウザ、Web ではタブ。
async function openExternal(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    try { window.open(url, '_blank'); } catch { /* noop */ }
  }
}

const InterviewNotifCard: React.FC<{ notif: AppNotification; onClose: () => void }> = ({ notif, onClose }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const startInterview = async () => {
    if (currentUser && !notif.read) {
      try { await markNotificationRead(currentUser.uid, notif.id); } catch { /* noop */ }
    }
    // url が無い旧通知でも articleId から編集URLを組み立てて開く
    const url = notif.url || (notif.articleId ? `https://sekkeiya.com/admin/articles/${notif.articleId}/edit` : '');
    if (url) await openExternal(url);
    onClose();
  };
  return (
    <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5,
      bgcolor: notif.read ? 'transparent' : 'rgba(251,146,60,0.08)', borderBottom: `1px solid ${BRAND.line}` }}>
      <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(251,146,60,0.15)' }}>
        <MicRoundedIcon fontSize="small" sx={{ color: 'light-dark(#aa4e03, #fb923c)' }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: BRAND.text, lineHeight: 1.4 }}>
          {notif.title || '🎤 取材の依頼'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: BRAND.sub, lineHeight: 1.5, mt: 0.3 }}>
          {notif.message || `${notif.fromName || 'AI記者'}から取材の質問が届いています`}
        </Typography>
        <Button size="small" variant="contained" startIcon={<MicRoundedIcon sx={{ fontSize: 15 }} />}
          onClick={startInterview}
          sx={{ mt: 1, bgcolor: '#fb923c', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 1.5, '&:hover': { bgcolor: '#f97316' } }}>
          取材を開始
        </Button>
        <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.6 }}>
          {new Date(notif.createdAt).toLocaleDateString('ja-JP')}
        </Typography>
      </Box>
      {!notif.read && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#fb923c', flexShrink: 0, mt: 1 }} />}
    </Box>
  );
};

const FollowedNotifCard: React.FC<{ notif: AppNotification }> = ({ notif }) => (
  <Box
    sx={{
      px: 2.5,
      py: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      bgcolor: notif.read ? 'transparent' : 'rgba(255,215,64,0.05)',
      borderBottom: `1px solid ${BRAND.line}`,
    }}
  >
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(255,215,64,0.15)' }}>
      <PersonAddAltRoundedIcon fontSize="small" sx={{ color: 'light-dark(#ad8900, #ffd740)' }} />
    </Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, color: BRAND.text, lineHeight: 1.4 }}>
        <Box component="span" sx={{ fontWeight: 600 }}>
          {notif.fromName || 'ユーザー'}
        </Box>
        さんにフォローされました
      </Typography>
      <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.3 }}>
        {new Date(notif.createdAt).toLocaleDateString('ja-JP')}
      </Typography>
    </Box>
    {!notif.read && (
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ffd740', flexShrink: 0 }} />
    )}
  </Box>
);

const ChatMessageNotifCard: React.FC<{ notif: AppNotification; onOpenChat: () => void }> = ({ notif, onOpenChat }) => {
  const currentUser = useAuthStore(s => s.currentUser);

  const handleOpen = async () => {
    // 既読化（onSnapshot 購読でバッジは自動更新される）
    if (currentUser && !notif.read) {
      markNotificationRead(currentUser.uid, notif.id).catch(() => {});
    }
    // 通知から該当チャットを開く
    if (notif.chatKind && notif.chatId) {
      let target = null as import('../../team-chat/store/useTeamChatStore').ChatTarget | null;
      if (notif.chatKind === 'project') {
        target = { kind: 'project', id: notif.chatId, name: notif.chatName || 'プロジェクト' };
      } else if (notif.chatKind === 'dm' && notif.fromUid) {
        target = { kind: 'dm', id: notif.chatId, name: notif.fromName || 'ユーザー', otherUid: notif.fromUid };
      } else if (notif.chatKind === 'team') {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../../../lib/firebase/client');
          const snap = await getDoc(doc(db, 'chats', notif.chatId));
          const memberIds: string[] = snap.exists() ? (snap.data().members ?? []) : [];
          target = { kind: 'team', id: notif.chatId, name: notif.chatName || 'チーム', memberIds };
        } catch { /* 取得失敗時は開かない */ }
      }
      if (target) {
        useTeamChatStore.getState().setTarget(target);
        useAppStore.getState().setTeamChatOpen(true);
        onOpenChat();
      }
    }
  };

  return (
    <Box
      onClick={handleOpen}
      sx={{
        px: 2.5,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        bgcolor: notif.read ? 'transparent' : 'rgba(138,180,248,0.06)',
        borderBottom: `1px solid ${BRAND.line}`,
        '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' },
      }}
    >
      <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(138,180,248,0.15)' }}>
        <ForumRoundedIcon fontSize="small" sx={{ color: 'light-dark(#0a45a4, #8ab4f8)' }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, color: BRAND.text, lineHeight: 1.4 }}>
          <Box component="span" sx={{ fontWeight: 600 }}>
            {notif.fromName || 'ユーザー'}
          </Box>
          さんからメッセージ
          {notif.chatKind !== 'dm' && notif.chatName && (
            <Box component="span" sx={{ color: BRAND.sub }}>（{notif.chatName}）</Box>
          )}
        </Typography>
        {notif.messagePreview && (
          <Typography noWrap sx={{ fontSize: 12, color: BRAND.sub, mt: 0.3 }}>
            {notif.messagePreview}
          </Typography>
        )}
        <Typography sx={{ fontSize: 11, color: BRAND.sub2, mt: 0.3 }}>
          {new Date(notif.createdAt).toLocaleDateString('ja-JP')}
        </Typography>
      </Box>
      {!notif.read && (
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#8ab4f8', flexShrink: 0 }} />
      )}
    </Box>
  );
};

const GenericNotifCard: React.FC<{ notif: AppNotification }> = ({ notif }) => (
  <Box
    sx={{
      px: 2.5,
      py: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      bgcolor: notif.read ? 'transparent' : 'rgba(52,152,219,0.06)',
      borderBottom: `1px solid ${BRAND.line}`,
    }}
  >
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', fontSize: 14 }}>
      <GroupsRoundedIcon fontSize="small" sx={{ color: BRAND.sub }} />
    </Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, color: BRAND.text, lineHeight: 1.4 }}>
        <Box component="span" sx={{ fontWeight: 600 }}>
          {notif.fromName || 'ユーザー'}
        </Box>
        さんが「{notif.teamName}」に参加しました
      </Typography>
      <Typography sx={{ fontSize: 11, color: BRAND.sub2 }}>
        {new Date(notif.createdAt).toLocaleDateString('ja-JP')}
      </Typography>
    </Box>
    {!notif.read && (
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3498db', flexShrink: 0 }} />
    )}
  </Box>
);

export const NotificationPanel: React.FC<{
  anchorEl: HTMLElement | null;
  onClose: () => void;
}> = ({ anchorEl, onClose }) => {
  const { notifications, localNotifications, isLoading, unreadCount, readAll } = useNotificationsStore();
  const allNotifications = [...localNotifications, ...notifications];
  const currentUser = useAuthStore(s => s.currentUser);

  const handleReadAll = async () => {
    if (!currentUser) return;
    await readAll(currentUser.uid);
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      slotProps={{ paper: { sx: panelPaper } }}
      sx={{ ml: 1 }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${BRAND.line}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsRoundedIcon sx={{ fontSize: 18, color: BRAND.sub }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text }}>
            通知
          </Typography>
          {unreadCount > 0 && (
            <Box
              sx={{
                bgcolor: '#3498db', color: 'var(--brand-fg)', borderRadius: '10px',
                px: 0.8, py: 0.1, fontSize: 11, fontWeight: 700, lineHeight: '18px',
                minWidth: 18, textAlign: 'center',
              }}
            >
              {unreadCount}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {unreadCount > 0 && (
            <Tooltip title="全て既読にする">
              <IconButton onClick={handleReadAll} size="small" sx={{ color: BRAND.sub2 }}>
                <DoneAllRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose} size="small" sx={{ color: BRAND.sub2 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} sx={{ color: '#3498db' }} />
          </Box>
        ) : allNotifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsRoundedIcon sx={{ fontSize: 40, color: BRAND.sub2, mb: 1 }} />
            <Typography sx={{ fontSize: 13, color: BRAND.sub2 }}>通知はありません</Typography>
          </Box>
        ) : (
          allNotifications.map(notif =>
            notif.type === 'update_available' ? (
              <UpdateNotifCard key={notif.id} notif={notif} />
            ) : notif.type === 'team_invite' ? (
              <InviteNotifCard key={notif.id} notif={notif} />
            ) : notif.type === 'task_assigned' ? (
              <TaskAssignedNotifCard key={notif.id} notif={notif} />
            ) : notif.type === 'followed' ? (
              <FollowedNotifCard key={notif.id} notif={notif} />
            ) : notif.type === 'chat_message' ? (
              <ChatMessageNotifCard key={notif.id} notif={notif} onOpenChat={onClose} />
            ) : notif.type === 'interview_request' ? (
              <InterviewNotifCard key={notif.id} notif={notif} onClose={onClose} />
            ) : (
              <GenericNotifCard key={notif.id} notif={notif} />
            )
          )
        )}
      </Box>
    </Popover>
  );
};
