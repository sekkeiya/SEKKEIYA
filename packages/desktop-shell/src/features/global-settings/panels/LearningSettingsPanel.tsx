// Global Settings > 学習（管理者専用）。学習サイクルのモニター。
// - 反応ログ（reactionLogs）の日次集計を aggregateReactions CF で実行し、
//   surface ごとの impressions / clicks / CTR / rank別 / モデル別を表示する。
// - モデル台帳: 学習資産（モデル・索引・知識資産）の一覧と状態を一元把握する。
// 管理者のみ到達（サイドバー＋シェルで二重ガード、CF 側は要認証）。
import React, { useCallback, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Chip, Button, TextField, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';

// ---- モデル台帳（レジストリ） ------------------------------------------------
// 学習資産の静的台帳。実装が増えたらここに1行追加する（将来は Firestore 化も可）。
// 種別: モデル(A)=重みを持つ判定器 / 索引(B)=埋め込み・検索資産 / 資産(C)=ユーザー固有の知識
type AssetStatus = '稼働' | '収集中' | '構想';
interface LearningAsset {
  name: string;
  kind: 'モデル(A)' | '索引(B)' | '資産(C)' | '集計';
  scope: 'グローバル' | 'コホート' | '個人';
  source: string;      // 学習・構築の材料
  usedBy: string;      // 使用場所
  status: AssetStatus;
  note?: string;
}
const REGISTRY: LearningAsset[] = [
  { name: 'reactionLogs',      kind: '集計',      scope: 'グローバル', source: 'チップ表示/クリック等の暗黙反応', usedBy: '（学習の生データ）',        status: '収集中', note: 'chat-suggest 配線済み。Web 2026-07-10 リリース' },
  { name: 'reactionPatterns',  kind: '集計',      scope: 'グローバル', source: 'reactionLogs（日次）',            usedBy: 'この画面・学習ジョブ',      status: '収集中', note: 'aggregateReactions で手動集計（下のボタン）' },
  { name: 'knowledgeChunks',   kind: '索引(B)',   scope: '個人',      source: 'S.Library / ナレッジソース',       usedBy: 'RAG（Chat 注入）',          status: '稼働' },
  { name: 'driveAssets 埋め込み', kind: '索引(B)', scope: '個人',      source: 'AI Drive のファイル分析',          usedBy: 'Drive 検索',                status: '稼働' },
  { name: 'aiMemory',          kind: '資産(C)',   scope: '個人',      source: '会話からの決定・制約の蒸留',        usedBy: 'agentTurn（_digest 注入）', status: '稼働' },
  { name: 'chip-ranker',       kind: 'モデル(A)', scope: 'グローバル', source: 'reactionLogs（CTR）',             usedBy: 'suggestNextActions',        status: '構想', note: 'データが溜まってから着手' },
  { name: 'chat-router',       kind: 'モデル(A)', scope: 'グローバル', source: 'reactionLogs + usageLogs',        usedBy: 'routeChat（auto 振り分け）', status: '構想' },
  { name: 'ssot-case-index',   kind: '索引(B)',   scope: 'グローバル', source: 'projects / SSOT 設計データ',       usedBy: 'Chat / 類似事例提案',        status: '構想' },
];

// ---- aggregateReactions のレスポンス型（functions/insights/aggregateReactions.js と揃える） ----
interface SurfaceStat {
  impressions: number;
  clicks: number;
  ctr: number | null;
  actions: Record<string, number>;
  byModel: Record<string, { impressions: number; clicks: number }>;
  byRank: Record<string, number>;
  byPlatform: Record<string, number>;
  anonymousEvents: number;
  topClickedLabels: { label: string; count: number }[];
}
interface AggregateResult {
  success: boolean;
  day: string;
  eventCount: number;
  userCount: number;
  surfaces: Record<string, SurfaceStat>;
}

const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
const statusColor: Record<AssetStatus, 'success' | 'info' | 'default'> = {
  '稼働': 'success', '収集中': 'info', '構想': 'default',
};

export const LearningSettingsPanel = () => {
  const [day, setDay] = useState<string>(jstToday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AggregateResult | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'aggregateReactions');
      const res = await fn({ day });
      const r = res.data as AggregateResult | undefined;
      if (!r?.success) throw new Error('集計に失敗しました');
      setResult(r);
    } catch (e: any) {
      setError(e?.message || '集計に失敗しました');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [day]);

  const sectionSx = {
    p: 3, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
  } as const;

  const surfaceEntries = Object.entries(result?.surfaces || {});

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PsychologyRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>学習モニター</Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: -1.5 }}>
        学習サイクルの入力データ（反応ログ）と学習資産の状態を把握します。
        方針: 全体はモデルで、個人は記憶（RAG/メモリ）で。
      </Typography>

      {/* ── モデル台帳 ─────────────────────────────── */}
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>モデル台帳</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          1行＝1学習資産。何が・何のデータで・どこで効いているか。種別: モデル(A)=判定器 / 索引(B)=埋め込み検索 / 資産(C)=ユーザー固有の知識。
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>資産名</TableCell>
              <TableCell>種別</TableCell>
              <TableCell>影響範囲</TableCell>
              <TableCell>材料</TableCell>
              <TableCell>使用場所</TableCell>
              <TableCell>状態</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {REGISTRY.map(a => (
              <TableRow key={a.name}>
                <TableCell sx={{ fontWeight: 500, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {a.note ? <Tooltip title={a.note} arrow><span>{a.name}</span></Tooltip> : a.name}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.kind}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.scope}</TableCell>
                <TableCell>{a.source}</TableCell>
                <TableCell>{a.usedBy}</TableCell>
                <TableCell>
                  <Chip label={a.status} size="small" color={statusColor[a.status]} variant={a.status === '構想' ? 'outlined' : 'filled'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* ── 反応ログ 日次集計 ─────────────────────────── */}
      <Paper elevation={0} sx={sectionSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>反応ログ 日次集計</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              指定日(JST)の reactionLogs を集計し insights/reactionPatterns に保存して表示します。
            </Typography>
          </Box>
          <TextField
            type="date" size="small" value={day}
            onChange={(e) => setDay(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained" size="small" disableElevation
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon />}
            onClick={() => void run()} disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            集計を実行
          </Button>
        </Box>

        {error && (
          <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>エラー: {error}</Typography>
        )}

        {result && (
          <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2"><b>{result.day}</b></Typography>
              <Typography variant="body2">イベント: <b>{result.eventCount.toLocaleString()}</b></Typography>
              <Typography variant="body2">ユーザー: <b>{result.userCount.toLocaleString()}</b></Typography>
            </Box>
            {surfaceEntries.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                この日の反応ログはまだありません。クライアントのリリース後、チップの表示/クリックで貯まります。
              </Typography>
            ) : surfaceEntries.map(([surface, s]) => (
              <Paper key={surface} elevation={0} sx={{ ...sectionSx, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{surface}</Typography>
                  <Typography variant="body2">表示 <b>{s.impressions}</b></Typography>
                  <Typography variant="body2">クリック <b>{s.clicks}</b></Typography>
                  <Typography variant="body2">CTR <b>{pct(s.ctr)}</b></Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>匿名イベント {s.anonymousEvents}</Typography>
                </Box>
                {Object.keys(s.byRank).length > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                    表示順別クリック: {Object.entries(s.byRank).sort((a, b) => Number(a[0]) - Number(b[0])).map(([r, c]) => `#${Number(r) + 1}:${c}`).join('  ')}
                  </Typography>
                )}
                {s.topClickedLabels.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                    {s.topClickedLabels.map(l => (
                      <Chip key={l.label} size="small" variant="outlined" label={`${l.label} ×${l.count}`} />
                    ))}
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};
