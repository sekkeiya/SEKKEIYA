// Global Settings > コネクタ。左=コネクタ一覧（クリックで選択）、右=詳細サイドバー。
// 詳細には「何ができるか」「使い方」「こう言ってみましょう（例文）」を、誰でも分かるように表示する。
// Claude Code（管理者向け）は MCP 経由で開発状況ボードを読み書きする接続で、接続状態は
// /devMeta/claudeMcp のハートビートで可視化する。
import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Chip, CircularProgress, Alert, Divider,
} from '@mui/material';
import CheckCircleRoundedIcon   from '@mui/icons-material/CheckCircleRounded';
import LinkRoundedIcon          from '@mui/icons-material/LinkRounded';
import LinkOffRoundedIcon       from '@mui/icons-material/LinkOffRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ConstructionRoundedIcon  from '@mui/icons-material/ConstructionRounded';
import LightbulbOutlinedIcon    from '@mui/icons-material/LightbulbOutlined';
import PlayArrowRoundedIcon     from '@mui/icons-material/PlayArrowRounded';
import { useAuthStore }        from '../../../store/useAuthStore';
import { useConnectorStore }   from '../../connectors/useConnectorStore';
import { connectGoogleCalendar, refreshGoogleToken } from '../../connectors/google/googleCalendarOAuth';
import { isBlogAdmin }         from '../../dsb/lib/blogAdmin';
import { doc, onSnapshot }     from 'firebase/firestore';
import { db }                  from '../../../lib/firebase/client';

// ─── コネクタ定義＆詳細 ─────────────────────────────────────────────────────────

interface ConnectorDetail {
  overview: string;         // 何ができるか（1〜2文・平易に）
  howto: string[];          // 使い方の手順
  examples?: string[];      // AI に言ってみる例文
  examplesHeading?: string; // 例文グループの見出し（既定「こう言ってみましょう」）
  examples2?: string[];     // 2つ目の例文グループ（対象がもう1つあるとき）
  examples2Heading?: string;
  notes?: string[];         // 補足・注意
}

interface ConnectorDef {
  id:          string;
  label:       string;
  description: string;
  icon:        React.ReactNode;
  available:   boolean;
  comingSoon?: boolean;
  detail:      ConnectorDetail;
}

const CONNECTORS: ConnectorDef[] = [
  {
    id:          'google_calendar',
    label:       'Google Calendar',
    description: 'SEKKEIYA からカレンダーの読み込み・予定の作成・更新・削除ができます。',
    icon:        <CalendarMonthRoundedIcon sx={{ fontSize: 28, color: '#4285F4' }}/>,
    available:   true,
    detail: {
      overview: 'SEKKEIYA の AI（SEKKEIYA Chat など）から、あなたの Google カレンダーを読み書きできます。予定の確認・作成・変更・削除を、言葉で頼むだけで行えます。',
      howto: [
        'このカードの「接続」を押し、Google アカウントでログインして許可します。',
        '接続できたら、SEKKEIYA Chat で予定について言葉で頼むだけです。',
        '連携を止めたいときは、いつでも「切断」を押せます。',
      ],
      examples: [
        '来週の予定を教えて',
        '金曜の15時に〇〇社との打ち合わせを入れて',
        '明日の午後の予定を1時間うしろにずらして',
      ],
      notes: [
        '接続には Google アカウントへのアクセス許可が必要です。',
        '許可した情報はあなたのアカウントに暗号化して保存されます。',
      ],
    },
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
    detail: {
      overview: 'Notion のページやデータベースを参照して、メモ・タスクと SEKKEIYA を連携できるようにする予定です。',
      howto: ['近日公開予定です。公開後、このカードから接続できるようになります。'],
    },
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
    detail: {
      overview: 'Slack のチャンネルにメッセージを送ったり、会話を読んで文脈を把握できるようにする予定です。',
      howto: ['近日公開予定です。'],
    },
  },
];

// Claude Code（管理者向け）の詳細。使い方をていねいに。
const CLAUDE_CODE_LABEL = 'Claude Code';
const CLAUDE_CODE_DETAIL: ConnectorDetail = {
  overview: 'あなたの PC の Claude Code から、SEKKEIYA の2つのデータを直接読み書きできます —「開発状況」ボード（要求定義・要件定義・スプリント）と「Research & Memo」（メモや根拠を線でつなぐ思考の地図）。AI と相談しながら整理すると、その内容がそのまま反映されます。',
  howto: [
    'デスクトップで Claude Code を起動します（このカードが「接続中」なら準備OK）。',
    '作業フォルダに「040-sekkeiya」を選びます。この連携設定はこのフォルダに入っているため、ここを開いた状態が必要です。',
    '初回だけ「このプロジェクトの連携ツールを使いますか？」と確認が出るので「許可」します（次回以降は自動）。',
    'あとは日本語で指示するだけ。追加・変更した内容は、開発状況画面や Research & Memo にすぐ反映されます。',
  ],
  examplesHeading: '開発状況ボードで',
  examples: [
    '開発状況ボードを見せて',
    '「モバイルで3DSCが重い」という要求を追加して',
    '要件「描画のLOD対応」を追加して、カテゴリはS.Layout、今のスプリントに入れて',
    '要件3をテスト中にして',
    'Sprint 1 を完了して',
  ],
  examples2Heading: 'Research & Memo で',
  examples2: [
    'Research & Memo のメインボードを見せて',
    '「〇〇という仮説」をメモに追加して',
    'その仮説の根拠として「△△のデータ」を追加して、supports でつないで',
    '「データの流れ」ボードを整理して、抜けている論点を教えて',
    '新しいボード「□□の検討」を作って',
  ],
  notes: [
    '新規セッションでも、作業フォルダが「040-sekkeiya」なら同じように使えます。特別な「グループ」を作る必要はありません（作業フォルダ＝プロジェクトの単位です）。',
    'Research & Memo は SEKKEIYA 公式アカウント（hello@sekkeiya.com）のボードが対象です。メモの位置は自動で置かれるので、並びが気になれば「整列」で整えられます。',
    'スマホや claude.ai のチャットからは、この連携は使えません（PC の Claude Code 専用）。外出先で思いつきを放り込むなら、スマホのブラウザで sekkeiya.com にログイン →「開発状況」→ 要求定義に入力するのが手軽です。',
  ],
};

const HEARTBEAT_ACTIVE_MS = 3 * 60e3; // 60秒間隔のハートビートが3分以内なら「接続中」

/** Claude Code(MCP) の接続状態を /devMeta/claudeMcp のハートビートから判定 */
const useClaudeMcpStatus = (enabled: boolean) => {
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(
      doc(db, 'devMeta', 'claudeMcp'),
      (snap) => setLastSeen(snap.data()?.lastSeenAt?.toMillis?.() ?? null),
      () => setLastSeen(null),
    );
    const tick = setInterval(() => setNow(Date.now()), 30e3);
    return () => { unsub(); clearInterval(tick); };
  }, [enabled]);
  const active = lastSeen !== null && now - lastSeen < HEARTBEAT_ACTIVE_MS;
  const lastSeenText = lastSeen !== null
    ? new Date(lastSeen).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  return { active, lastSeenText };
};

// ─── ステータスチップ ─────────────────────────────────────────────────────────
const StatusChip: React.FC<{ kind: 'connected' | 'active' | 'soon' | 'off' }> = ({ kind }) => {
  if (kind === 'soon') {
    return <Chip icon={<ConstructionRoundedIcon sx={{ fontSize: '11px !important' }}/>} label="近日公開" size="small"
      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}/>;
  }
  if (kind === 'off') {
    return <Chip label="未接続" size="small"
      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}/>;
  }
  return <Chip icon={<CheckCircleRoundedIcon sx={{ fontSize: '12px !important' }}/>} label={kind === 'active' ? '接続中' : '接続済み'} size="small"
    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(67,233,123,0.14)', color: '#43e97b', border: '1px solid rgba(67,233,123,0.35)' }}/>;
};

// ─── 選択できるカード（共通の枠） ───────────────────────────────────────────────
const SelectableCard: React.FC<{
  icon: React.ReactNode; label: string; description: string;
  statusKind: 'connected' | 'active' | 'soon' | 'off';
  selected: boolean; dimmed?: boolean; onSelect: () => void;
  action?: React.ReactNode; subline?: string | null; error?: string | null;
}> = ({ icon, label, description, statusKind, selected, dimmed, onSelect, action, subline, error }) => (
  <Paper
    onClick={onSelect}
    sx={{
      bgcolor: selected ? 'rgb(var(--brand-fg-rgb) / 0.06)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
      border: '1px solid',
      borderColor: selected ? 'light-dark(#0875a6, #4fc3f7)'
        : (statusKind === 'connected' || statusKind === 'active') ? 'rgba(67,233,123,0.25)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
      borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2,
      cursor: 'pointer', opacity: dimmed ? 0.6 : 1,
      transition: 'border-color .15s, background-color .15s',
      '&:hover': { borderColor: selected ? 'light-dark(#0875a6, #4fc3f7)' : 'rgb(var(--brand-fg-rgb) / 0.2)' },
    }}
  >
    <Box sx={{ flexShrink: 0 }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand-fg)' }}>{label}</Typography>
        <StatusChip kind={statusKind}/>
      </Box>
      <Typography noWrap sx={{ fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{description}</Typography>
      {subline && <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.25 }}>{subline}</Typography>}
      {error && (
        <Alert severity="error" sx={{ mt: 1, py: 0, fontSize: '0.72rem', bgcolor: 'rgba(250,112,154,0.08)', color: 'light-dark(#a80637, #fa709a)', border: '1px solid rgba(250,112,154,0.2)' }}>{error}</Alert>
      )}
    </Box>
    {action && <Box sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>{action}</Box>}
  </Paper>
);

// ─── 例文グループ（「こう言ってみましょう」） ───────────────────────────────────
const ExampleGroup: React.FC<{ heading: string; items: string[] }> = ({ heading, items }) => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      <PlayArrowRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#0875a6, #4fc3f7)' }}/>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
        {heading}
      </Typography>
    </Box>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((ex, i) => (
        <Box key={i} sx={{ px: 1.25, py: 0.75, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid', borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'var(--brand-fg)', fontStyle: 'italic' }}>「{ex}」</Typography>
        </Box>
      ))}
    </Box>
  </Box>
);

// ─── 右サイドバー（詳細） ───────────────────────────────────────────────────────
const DetailSidebar: React.FC<{
  icon: React.ReactNode; label: string; statusKind: 'connected' | 'active' | 'soon' | 'off';
  detail: ConnectorDetail;
}> = ({ icon, label, statusKind, detail }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
    {/* ヘッダ */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ flexShrink: 0 }}>{icon}</Box>
      <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-fg)' }}>{label}</Typography>
      <StatusChip kind={statusKind}/>
    </Box>
    {/* 概要 */}
    <Typography sx={{ fontSize: '0.85rem', color: 'rgb(var(--brand-fg-rgb) / 0.75)', lineHeight: 1.7 }}>
      {detail.overview}
    </Typography>

    {/* 使い方 */}
    <Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 1 }}>
        使い方
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {detail.howto.map((step, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
            <Box sx={{ flexShrink: 0, width: 20, height: 20, mt: 0.1, borderRadius: '50%', bgcolor: 'light-dark(rgba(8,117,166,0.14), rgba(79,195,247,0.16))', color: 'light-dark(#0875a6, #4fc3f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
              {i + 1}
            </Box>
            <Typography sx={{ fontSize: '0.82rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)', lineHeight: 1.6 }}>{step}</Typography>
          </Box>
        ))}
      </Box>
    </Box>

    {/* 例文（1〜2グループ） */}
    {detail.examples && detail.examples.length > 0 && (
      <ExampleGroup heading={detail.examplesHeading ?? 'こう言ってみましょう'} items={detail.examples}/>
    )}
    {detail.examples2 && detail.examples2.length > 0 && (
      <ExampleGroup heading={detail.examples2Heading ?? 'こう言ってみましょう'} items={detail.examples2}/>
    )}

    {/* メモ */}
    {detail.notes && detail.notes.length > 0 && (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <LightbulbOutlinedIcon sx={{ fontSize: 16, color: 'light-dark(#bf7a2e, #ffd740)' }}/>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
            メモ
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {detail.notes.map((n, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', mt: 0.9, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.4)' }}/>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.65)', lineHeight: 1.6 }}>{n}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    )}
  </Box>
);

const CLAUDE_ICON = (
  <Box sx={{ flexShrink: 0, width: 28, height: 28, borderRadius: 1, bgcolor: 'rgba(217,119,87,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#D97757', lineHeight: 1 }}>✳</Typography>
  </Box>
);

// ─── Panel ────────────────────────────────────────────────────────────────────

export const ConnectorsSettingsPanel: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const uid = currentUser?.uid ?? '';
  const isAdmin = isBlogAdmin(currentUser);
  const { tokens, saveToken, disconnect, startListening } = useConnectorStore();
  const mcp = useClaudeMcpStatus(isAdmin);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    startListening(uid, 'google_calendar');
  }, [uid, startListening]);

  // 既定の選択（管理者は Claude Code、それ以外は Google Calendar）
  const activeId = selectedId ?? (isAdmin ? 'claude_code' : 'google_calendar');
  const gcalConnected = !!tokens['google_calendar'];

  const handleGcalConnect = async () => {
    setGcalLoading(true); setGcalError(null);
    try {
      const result = await connectGoogleCalendar();
      await saveToken(uid, 'google_calendar', result);
    } catch (e: any) {
      setGcalError(e?.message || '接続に失敗しました');
    } finally { setGcalLoading(false); }
  };
  const handleGcalDisconnect = async () => {
    setGcalLoading(true);
    try { await disconnect(uid, 'google_calendar' as any); } finally { setGcalLoading(false); }
  };

  const statusOfConnector = (def: ConnectorDef): 'connected' | 'soon' | 'off' =>
    def.comingSoon ? 'soon' : (def.id === 'google_calendar' && gcalConnected) ? 'connected' : 'off';

  // 選択中の詳細を解決
  const selectedView = (() => {
    if (activeId === 'claude_code') {
      return { icon: CLAUDE_ICON, label: CLAUDE_CODE_LABEL, statusKind: (mcp.active ? 'active' : 'off') as const, detail: CLAUDE_CODE_DETAIL };
    }
    const def = CONNECTORS.find(c => c.id === activeId) ?? CONNECTORS[0];
    return { icon: def.icon, label: def.label, statusKind: statusOfConnector(def), detail: def.detail };
  })();

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', minHeight: 0 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--brand-fg)', mb: 0.75 }}>コネクタ</Typography>
        <Typography sx={{ fontSize: '0.82rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.6 }}>
          外部サービスを接続すると、SEKKEIYA からそのサービスの読み書きができるようになります。
          カードを選ぶと、右側に使い方が表示されます。
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mb: 2 }}/>

      {/* 2カラム: 左=一覧 / 右=詳細 */}
      <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
        {/* 左: コネクタ一覧 */}
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', pr: 0.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            利用可能なコネクタ
          </Typography>
          {CONNECTORS.map(def => {
            const status = statusOfConnector(def);
            const action = def.available ? (
              gcalLoading ? <CircularProgress size={22} sx={{ color: '#00BFFF' }}/> :
              gcalConnected ? (
                <Button size="small" startIcon={<LinkOffRoundedIcon sx={{ fontSize: '14px !important' }}/>} onClick={handleGcalDisconnect}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.5, bgcolor: 'rgba(250,112,154,0.1)', color: 'light-dark(#a80637, #fa709a)', border: '1px solid rgba(250,112,154,0.25)', borderRadius: 2, '&:hover': { bgcolor: 'rgba(250,112,154,0.2)' } }}>切断</Button>
              ) : (
                <Button size="small" startIcon={<LinkRoundedIcon sx={{ fontSize: '14px !important' }}/>} onClick={handleGcalConnect}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.5, bgcolor: 'rgba(0,191,255,0.12)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.3)', borderRadius: 2, '&:hover': { bgcolor: 'rgba(0,191,255,0.22)' } }}>接続</Button>
              )
            ) : undefined;
            return (
              <SelectableCard
                key={def.id} icon={def.icon} label={def.label} description={def.description}
                statusKind={status} selected={activeId === def.id} dimmed={def.comingSoon}
                onSelect={() => setSelectedId(def.id)} action={action}
                error={def.id === 'google_calendar' ? gcalError : null}
              />
            );
          })}

          {/* 管理者向け: Claude Code */}
          {isAdmin && (
            <>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 1 }}>
                管理者向け
              </Typography>
              <SelectableCard
                icon={CLAUDE_ICON} label={CLAUDE_CODE_LABEL}
                description="Claude Code から開発状況ボードと Research & Memo を読み書きします。"
                statusKind={mcp.active ? 'active' : 'off'}
                selected={activeId === 'claude_code'} onSelect={() => setSelectedId('claude_code')}
                subline={mcp.active ? 'MCP サーバー稼働中' : (mcp.lastSeenText ? `最終接続: ${mcp.lastSeenText}` : '未接続')}
              />
            </>
          )}
        </Box>

        {/* 右: 詳細サイドバー */}
        <Box sx={{
          width: 400, flexShrink: 0, overflowY: 'auto',
          borderLeft: '1px solid', borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', pl: 3,
        }}>
          <DetailSidebar
            icon={selectedView.icon} label={selectedView.label}
            statusKind={selectedView.statusKind} detail={selectedView.detail}
          />
        </Box>
      </Box>
    </Box>
  );
};
