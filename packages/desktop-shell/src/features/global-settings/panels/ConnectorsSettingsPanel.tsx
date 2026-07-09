import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress,
  Alert, Divider,
} from '@mui/material';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import LinkRoundedIcon          from '@mui/icons-material/LinkRounded';
import LinkOffRoundedIcon       from '@mui/icons-material/LinkOffRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ConstructionRoundedIcon  from '@mui/icons-material/ConstructionRounded';
import { useAuthStore }        from '../../../store/useAuthStore';
import { useConnectorStore }   from '../../connectors/useConnectorStore';
import { connectGoogleCalendar, refreshGoogleToken } from '../../connectors/google/googleCalendarOAuth';

// ─── 各コネクタ定義 ───────────────────────────────────────────────────────────

interface ConnectorDef {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  available:   boolean;
  comingSoon?: boolean;
}

const CONNECTORS: ConnectorDef[] = [
  {
    id:          'google_calendar',
    label:       'Google Calendar',
    description: 'SEKKEIYA OS からカレンダーの読み込み・予定の作成・更新・削除ができます。',
    icon:        <CalendarMonthRoundedIcon sx={{ fontSize: 28, color: '#4285F4' }}/>,
    available:   true,
  },
  {
    id:          'notion',
    label:       'Notion',
    description: 'Notion のページ・データベースを参照し、メモやタスクと連携できます。',
    icon:        <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Typography sx={{ fontWeight: 900, fontSize: 16, color: '#000', lineHeight: 1 }}>N</Typography>
                 </Box>,
    available:   false,
    comingSoon:  true,
  },
  {
    id:          'slack',
    label:       'Slack',
    description: 'Slack のチャンネルにメッセージを送ったり、会話を読んでコンテキストを把握します。',
    icon:        <Box sx={{ width: 28, height: 28, bgcolor: 'rgba(74,21,75,0.2)', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Typography sx={{ fontWeight: 900, fontSize: 14, color: '#E01E5A' }}>#</Typography>
                 </Box>,
    available:   false,
    comingSoon:  true,
  },
];

// ─── ConnectorCard ────────────────────────────────────────────────────────────

interface ConnectorCardProps {
  def:      ConnectorDef;
  uid:      string;
}

const ConnectorCard: React.FC<ConnectorCardProps> = ({ def, uid }) => {
  const { tokens, saveToken, disconnect, startListening, getValidToken } = useConnectorStore();
  const token   = tokens[def.id as 'google_calendar'];
  const isConn  = !!token;
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [email,   setEmail]     = useState<string | null>(null);

  // Google Calendar の email を取得（接続後）
  useEffect(() => {
    if (def.id !== 'google_calendar' || !token) { setEmail(null); return; }
    getValidToken('google_calendar', refreshGoogleToken, uid)
      .then(at => {
        if (!at) return;
        return fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${at}` },
        }).then(r => r.json()).then(d => setEmail(d.email ?? null));
      })
      .catch(() => {});
  }, [token, def.id, uid, getValidToken]);

  const handleConnect = async () => {
    setLoading(true); setError(null);
    try {
      if (def.id === 'google_calendar') {
        const result = await connectGoogleCalendar();
        await saveToken(uid, 'google_calendar', result);
        if (result.email) setEmail(result.email);
      }
    } catch (e: any) {
      setError(e?.message || '接続に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnect(uid, def.id as any);
      setEmail(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{
      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
      border: `1px solid ${isConn ? 'rgba(67,233,123,0.25)' : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
      borderRadius: 3,
      p: 2.5,
      display: 'flex',
      alignItems: 'center',
      gap: 2.5,
      opacity: def.comingSoon ? 0.5 : 1,
    }}>
      {/* Icon */}
      <Box sx={{ flexShrink: 0 }}>{def.icon}</Box>

      {/* Info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand-fg)' }}>
            {def.label}
          </Typography>
          {isConn && (
            <Chip
              icon={<CheckCircleRoundedIcon sx={{ fontSize: '12px !important' }}/>}
              label="接続済み"
              size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(67,233,123,0.14)', color: '#43e97b', border: '1px solid rgba(67,233,123,0.35)' }}
            />
          )}
          {def.comingSoon && (
            <Chip
              icon={<ConstructionRoundedIcon sx={{ fontSize: '11px !important' }}/>}
              label="近日公開"
              size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}
            />
          )}
        </Box>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.5 }}>
          {def.description}
        </Typography>
        {email && (
          <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.5 }}>
            {email} として接続中
          </Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: '0.72rem', bgcolor: 'rgba(250,112,154,0.08)', color: 'light-dark(#a80637, #fa709a)', border: '1px solid rgba(250,112,154,0.2)' }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Action button */}
      {def.available && (
        <Box sx={{ flexShrink: 0 }}>
          {loading ? (
            <CircularProgress size={22} sx={{ color: '#00BFFF' }}/>
          ) : isConn ? (
            <Button
              size="small"
              startIcon={<LinkOffRoundedIcon sx={{ fontSize: '14px !important' }}/>}
              onClick={handleDisconnect}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.5,
                bgcolor: 'rgba(250,112,154,0.1)', color: 'light-dark(#a80637, #fa709a)', border: '1px solid rgba(250,112,154,0.25)', borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(250,112,154,0.2)' } }}>
              切断
            </Button>
          ) : (
            <Button
              size="small"
              startIcon={<LinkRoundedIcon sx={{ fontSize: '14px !important' }}/>}
              onClick={handleConnect}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.5,
                bgcolor: 'rgba(0,191,255,0.12)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.3)', borderRadius: 2,
                '&:hover': { bgcolor: 'rgba(0,191,255,0.22)' } }}>
              接続
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
};

// ─── Panel ────────────────────────────────────────────────────────────────────

export const ConnectorsSettingsPanel: React.FC = () => {
  const uid = useAuthStore(s => s.currentUser?.uid ?? '');
  const { startListening } = useConnectorStore();

  // 接続済みコネクタの Firestore をリッスン
  useEffect(() => {
    if (!uid) return;
    startListening(uid, 'google_calendar');
  }, [uid, startListening]);

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--brand-fg)', mb: 0.75 }}>
          コネクタ
        </Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.6 }}>
          外部サービスを接続すると、SEKKEIYA OS からそのサービスの読み書きができるようになります。<br/>
          接続した情報はアカウントに暗号化して保存されます。
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }}/>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mb: 0.5 }}>
          利用可能なコネクタ
        </Typography>
        {CONNECTORS.map(def => (
          <ConnectorCard key={def.id} def={def} uid={uid}/>
        ))}
      </Box>

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.25)', lineHeight: 1.6 }}>
          接続を解除するといつでも連携を停止できます。<br/>
          Google Calendar の接続には Google アカウントへのアクセス許可が必要です。
        </Typography>
      </Box>
    </Box>
  );
};
