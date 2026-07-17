// Global Settings > 管理者。AI使用量モニター（方式A・自前トラッキング）。
// getAdminUsageSummary CF を呼び、機能別・モデル別・日別のトークン/概算コスト、
// キャッシュ読取比率を表示する。管理者のみ到達（サイドバー＋シェルで二重ガード、CFでも再検証）。
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, ToggleButtonGroup, ToggleButton, CircularProgress,
  Table, TableHead, TableRow, TableCell, TableBody, LinearProgress, Tooltip, IconButton, Button,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import { TtsUsageMeter } from '../../../components/tts/TtsUsageMeter';

// 使用中の各 AI プロバイダのコンソール（使用量・課金・APIキー管理）。
// 概算はアプリ内モニター、正確な請求額・レート上限は各コンソールで確認する。
const CONSOLE_LINKS: { label: string; url: string; note: string }[] = [
  { label: 'Claude（Anthropic）', url: 'https://platform.claude.com/dashboard', note: 'Anthropic の使用量・請求' },
  { label: 'Google AI Studio', url: 'https://aistudio.google.com/apikey', note: 'Gemini API キー・プラン/レート上限' },
  { label: 'Google Cloud', url: 'https://console.cloud.google.com/billing', note: 'Gemini API の課金・使用量（有料時）' },
  { label: 'OpenAI', url: 'https://platform.openai.com/usage', note: 'OpenAI の使用量・請求' },
];

/** Tauri では window.open が効かないため plugin-opener を使う（Web はフォールバック）。 */
function openExternal(url: string) {
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => { if (openUrl) openUrl(url); else window.open(url, '_blank'); })
    .catch(() => { try { window.open(url, '_blank'); } catch { /* noop */ } });
}

type Range = '7d' | '30d' | 'mtd';

interface Bucket {
  key: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheReadRatio: number;
}
interface Summary {
  range: Range;
  days: string[];
  totals: {
    calls: number; totalTokens: number; costUsd: number;
    cacheReadTokens: number; cacheCreationTokens: number; cacheReadRatio: number;
  };
  byFeature: Bucket[];
  byModel: Bucket[];
  byUser: Bucket[];
  userTruncated?: boolean;
  daily: { day: string; calls: number; totalTokens: number; costUsd: number }[];
}

// 円は概算表示用の固定レート換算（正確な請求は Anthropic コンソール）。
const JPY_PER_USD = 150;
const usd = (n: number) => `$${(n || 0).toFixed(n >= 1 ? 2 : 4)}`;
const jpy = (n: number) => `≈¥${Math.round((n || 0) * JPY_PER_USD).toLocaleString('ja-JP')}`;
const num = (n: number) => (n || 0).toLocaleString('en-US');
const pct = (r: number) => `${((r || 0) * 100).toFixed(1)}%`;
const tokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
};

export const AdminSettingsPanel = () => {
  const [range, setRange] = useState<Range>('7d');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'getAdminUsageSummary');
      const res = await fn({ range: r });
      const result = (res.data as any)?.result as Summary | undefined;
      if (!result) throw new Error('空のレスポンス');
      setData(result);
    } catch (e: any) {
      setError(e?.message || '取得に失敗しました');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(range); }, [range, load]);

  const sectionSx = {
    p: 3, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
  } as const;

  const totals = data?.totals;
  const maxDaily = Math.max(1, ...(data?.daily || []).map(d => d.costUsd));

  const Card: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
    <Paper elevation={0} sx={{ ...sectionSx, flex: 1, minWidth: 160 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{value}</Typography>
      {sub && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{sub}</Typography>}
    </Paper>
  );

  const BreakdownTable: React.FC<{ title: string; rows: Bucket[]; hint: string; nameHeader?: string }> = ({ title, rows, hint, nameHeader = '名前' }) => {
    const totalCost = rows.reduce((s, r) => s + (r.costUsd || 0), 0) || 1;
    return (
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>{title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>{hint}</Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.7 }}>データがありません。</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{nameHeader}</TableCell>
                <TableCell align="right">回数</TableCell>
                <TableCell align="right">トークン</TableCell>
                <TableCell align="right">概算コスト</TableCell>
                <TableCell align="right">
                  <Tooltip title="キャッシュ読取 ÷ (読取+書込)。高いほどプロンプトキャッシュが効いており割安。">
                    <span>キャッシュ読取率</span>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">構成比</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.key}>
                  <TableCell sx={{ fontWeight: 500 }}>{r.key}</TableCell>
                  <TableCell align="right">{num(r.calls)}</TableCell>
                  <TableCell align="right">{tokens(r.totalTokens)}</TableCell>
                  <TableCell align="right">
                    <Box>{usd(r.costUsd)}</Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{jpy(r.costUsd)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ color: r.cacheReadRatio >= 0.5 ? 'success.main' : (r.cacheReadRatio > 0 ? 'text.primary' : 'warning.main') }}>
                    {(r.cacheReadTokens + r.cacheCreationTokens) > 0 ? pct(r.cacheReadRatio) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ width: 120 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={Math.min(100, (r.costUsd / totalCost) * 100)} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 34, textAlign: 'right' }}>
                        {pct(r.costUsd / totalCost)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AdminPanelSettingsRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>AI使用量モニター</Typography>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup exclusive size="small" value={range} onChange={(_, v: Range | null) => { if (v) setRange(v); }}>
          <ToggleButton value="7d" sx={{ px: 2, textTransform: 'none' }}>7日</ToggleButton>
          <ToggleButton value="30d" sx={{ px: 2, textTransform: 'none' }}>30日</ToggleButton>
          <ToggleButton value="mtd" sx={{ px: 2, textTransform: 'none' }}>今月</ToggleButton>
        </ToggleButtonGroup>
        <IconButton size="small" onClick={() => load(range)} disabled={loading}><RefreshRoundedIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: -1.5 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          自前トラッキングによる概算です。正確な請求額・レート上限は各プロバイダのコンソールをご確認ください。（円は 1USD≈{JPY_PER_USD}円 換算）
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {CONSOLE_LINKS.map((c) => (
            <Tooltip key={c.url} title={c.note} arrow>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewRoundedIcon />}
                onClick={() => openExternal(c.url)}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
              >
                {c.label}
              </Button>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {error && (
        <Paper elevation={0} sx={{ ...sectionSx, borderColor: 'error.main', color: 'error.main' }}>
          取得エラー: {error}
        </Paper>
      )}

      {loading && !data ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : totals ? (
        <>
          {/* サマリーカード */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Card label="概算コスト" value={usd(totals.costUsd)} sub={`${jpy(totals.costUsd)} ・ ${data!.days.length}日間`} />
            <Card label="総トークン" value={tokens(totals.totalTokens)} />
            <Card label="呼び出し回数" value={num(totals.calls)} />
            <Card label="キャッシュ読取率" value={(totals.cacheReadTokens + totals.cacheCreationTokens) > 0 ? pct(totals.cacheReadRatio) : '—'} sub="高いほど割安" />
          </Box>

          {/* 日別推移 */}
          <Paper elevation={0} sx={sectionSx}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>日別 概算コスト</Typography>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120 }}>
              {data!.daily.map(d => (
                <Tooltip key={d.day} title={`${d.day}: ${usd(d.costUsd)} (${jpy(d.costUsd)}) / ${num(d.calls)}回`}>
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                      width: '100%',
                      height: `${Math.max(2, (d.costUsd / maxDaily) * 100)}%`,
                      bgcolor: 'light-dark(#4fc3f7, #2196d6)',
                      borderRadius: 1,
                      transition: 'height .2s',
                    }} />
                  </Box>
                </Tooltip>
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{data!.daily[0]?.day}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{data!.daily[data!.daily.length - 1]?.day}</Typography>
            </Box>
          </Paper>

          <BreakdownTable title="機能別" rows={data!.byFeature} hint="どの機能がコストを食っているか。読取率が低い機能はキャッシュ設計/モデル見直しの候補。" />
          <BreakdownTable title="モデル別" rows={data!.byModel} hint="モデルごとの消費。Sonnet偏重なら安価モデル(Haiku/Gemini)への振り分けを検討。" />
          <BreakdownTable
            title="ユーザー別"
            rows={data!.byUser}
            nameHeader="ユーザー"
            hint={data!.userTruncated
              ? `誰がどれだけ使ったか（コスト降順）。※件数上限に達したため一部のみ集計しています。`
              : `誰がどれだけ使ったか（コスト降順）。生ログ(usageLogs)から集計。`}
          />

          {/* AI音声（TTS）: 合成コストは上の機能別 tts-read 行に計上。ここは自分のアカウントの利用枠 */}
          <Paper elevation={0} sx={sectionSx}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>AI音声（TTS）</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              合成コストは「機能別」の tts-read 行・「モデル別」の gemini-*-tts 行に計上されます。
              以下はこのアカウントの利用枠（5時間/7日のローリング窓）。
            </Typography>
            <TtsUsageMeter dense />
          </Paper>
        </>
      ) : (
        !loading && !error && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>データがまだありません。AIチャット等を使うと記録が貯まります。</Typography>
        )
      )}
    </Box>
  );
};
