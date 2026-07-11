// Global Settings > 学習（管理者専用）。学習サイクルのモニター。
// 構成（AI Studio 準拠の左Lv2ナビと連動）:
//   - Lv2 左サイドバー: 「モデル台帳」＋ カテゴリ→資産のネスト（SettingsSidebar が生成）。
//   - メインエリア: section==='ledger' なら台帳の表、資産名なら その資産の解説。
//   - 右サイドバー: 「分析」タブ（反応ログ日次集計＋①反応の推移/②資産の規模/③学習の梯子）。
// section / onSectionChange は GlobalSettingsShell の activeSub と双方向に連動する。
// 管理者のみ到達（サイドバー＋シェルで二重ガード、CF 側は要認証）。
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Chip, Button, TextField, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, Divider, Tabs, Tab,
} from '@mui/material';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import {
  CATEGORIES, REGISTRY, ASSET_META, RUNGS, COUNT_LABEL,
  statusColor, ACCENT, jstToday, pct,
  type AssetStatus, type CountKey, type LearningAsset,
} from './learningRegistry';

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
/** 期間モード({days:N})のレスポンス。日別推移グラフ用。 */
interface DailyPoint { day: string; impressions: number; clicks: number; events: number; ctr: number | null }
interface RangeResult {
  success: boolean;
  mode: 'range';
  start: string;
  end: string;
  daily: DailyPoint[];
  dailyBySurface?: Record<string, DailyPoint[]>;
  surfaces: Record<string, { impressions: number; clicks: number; ctr: number | null }>;
  eventCount: number;
  userCount: number;
}
/** 件数モード({counts:true})のレスポンス。資産の規模グラフ用。 */
interface CountsResult {
  success: boolean;
  mode: 'counts';
  counts: Partial<Record<CountKey, number | null>>;
  day: string;
}

// ==== 分析タブのグラフカード群 ==============================================

/** グラフ1枚を包む共通カード（見出し＋補足＋本体） */
const GraphCard: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
      display: 'flex', flexDirection: 'column',
    }}
  >
    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>{hint}</Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</Box>
  </Paper>
);

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>{children}</Typography>
);

/** ① 反応の推移 — 選択資産の surface の 表示/クリック/CTR を日別バーで */
const ReactionTrendCard: React.FC<{ series?: DailyPoint[]; wired: boolean; unwiredNote?: string; loading?: boolean; error?: string | null }> = ({ series, wired, unwiredNote, loading, error }) => {
  if (!wired) return <EmptyNote>{unwiredNote || 'この資産はまだ反応ログに配線されていません。'}</EmptyNote>;
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>;
  if (error) return <EmptyNote>取得エラー: {error}</EmptyNote>;
  if (!series || series.length === 0) return <EmptyNote>この期間の反応データがありません。</EmptyNote>;
  const maxImp = Math.max(1, ...series.map(d => d.impressions));
  const ti = series.reduce((s, d) => s + d.impressions, 0);
  const tc = series.reduce((s, d) => s + d.clicks, 0);
  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="body2">表示 <b>{ti.toLocaleString()}</b></Typography>
        <Typography variant="body2">クリック <b>{tc.toLocaleString()}</b></Typography>
        <Typography variant="body2">CTR <b>{ti > 0 ? `${((tc / ti) * 100).toFixed(1)}%` : '—'}</b></Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 96 }}>
        {series.map(d => (
          <Tooltip key={d.day} title={`${d.day}: 表示${d.impressions} / クリック${d.clicks} / CTR ${d.ctr == null ? '—' : `${(d.ctr * 100).toFixed(1)}%`}`}>
            <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Box sx={{
                width: '70%',
                height: `${Math.max(d.impressions > 0 ? 4 : 1, (d.impressions / maxImp) * 100)}%`,
                bgcolor: 'light-dark(rgba(8,117,166,0.25), rgba(79,195,247,0.25))',
                borderRadius: 1, position: 'relative',
              }}>
                <Box sx={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: d.impressions > 0 ? `${(d.clicks / Math.max(1, d.impressions)) * 100}%` : 0,
                  bgcolor: ACCENT, borderRadius: 1,
                }} />
              </Box>
            </Box>
          </Tooltip>
        ))}
      </Box>
      {ti === 0 && <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>薄い棒＝表示、濃い棒＝クリック。まだ棒はありません。</Typography>}
    </>
  );
};

/** ② 資産の規模 — 全カウント対象の件数を横棒で比較（選択資産をハイライト） */
const SizeCard: React.FC<{ counts: CountsResult | null; loading: boolean; error: string | null; activeKey?: CountKey }> = ({ counts, loading, error, activeKey }) => {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>;
  if (error) return <EmptyNote>件数の取得に失敗しました。</EmptyNote>;
  if (!counts) return <EmptyNote>件数データがありません。</EmptyNote>;
  const rows = (Object.keys(COUNT_LABEL) as CountKey[])
    .map(k => ({ key: k, label: COUNT_LABEL[k], value: counts.counts[k] ?? null }))
    .filter(r => r.value != null);
  if (rows.length === 0) return <EmptyNote>件数を取得できるコレクションがありません。</EmptyNote>;
  const max = Math.max(1, ...rows.map(r => r.value as number));
  const activeVal = activeKey ? counts.counts[activeKey] : undefined;
  return (
    <>
      {activeKey != null && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          この資産: <b style={{ fontSize: 20 }}>{activeVal == null ? '—' : (activeVal as number).toLocaleString()}</b> 件
        </Typography>
      )}
      {activeKey == null && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          全体の規模の参考です（この対象は件数では測りません）。
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {rows.map(r => {
          const on = r.key === activeKey;
          return (
            <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ width: 78, flexShrink: 0, color: on ? 'text.primary' : 'text.secondary', fontWeight: on ? 700 : 400 }}>{r.label}</Typography>
              <Box sx={{ flex: 1, height: 14, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                <Box sx={{ width: `${((r.value as number) / max) * 100}%`, height: '100%', bgcolor: on ? ACCENT : 'light-dark(rgba(8,117,166,0.3), rgba(79,195,247,0.3))', borderRadius: 1 }} />
              </Box>
              <Typography variant="caption" sx={{ width: 52, flexShrink: 0, textAlign: 'right', fontFamily: 'monospace' }}>{(r.value as number).toLocaleString()}</Typography>
            </Box>
          );
        })}
      </Box>
    </>
  );
};

/** ③ 学習の梯子・成熟度 — 6段のどこまで来たか＋状態 */
const LadderCard: React.FC<{ rung: number; status: AssetStatus }> = ({ rung, status }) => {
  const barColor = status === '稼働' || status === 'PoC完了・本番統合' ? ACCENT
    : status === '収集中' ? 'light-dark(rgba(8,117,166,0.5), rgba(79,195,247,0.5))'
    : 'text.disabled';
  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>
        現在 <b style={{ fontSize: 20 }}>{rung}</b> / 6 段目 ・ <b>{RUNGS[rung - 1]}</b>
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25 }}>
        {RUNGS.map((label, i) => {
          const reached = i < rung;
          const current = i === rung - 1;
          return (
            <Tooltip key={label} title={`${i + 1}段目: ${label}`}>
              <Box sx={{
                flex: 1, height: 10, borderRadius: 1,
                bgcolor: reached ? barColor : 'action.hover',
                outline: current ? '2px solid' : 'none',
                outlineColor: ACCENT, outlineOffset: 1,
              }} />
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>1 収集</Typography>
        <Chip label={status} size="small" color={statusColor[status]} variant={status === '構想' ? 'outlined' : 'filled'} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>6 FT</Typography>
      </Box>
    </>
  );
};

interface Props {
  /** GlobalSettingsShell の activeSub。'ledger' か 資産名。 */
  section?: string;
  /** Lv2 と同期して選択を変える（台帳の行クリック→左ナビも追従）。 */
  onSectionChange?: (section: string) => void;
}

export const LearningSettingsPanel = ({ section = 'ledger', onSectionChange }: Props) => {
  const selected: LearningAsset | undefined = section === 'ledger' ? undefined : REGISTRY.find(a => a.name === section);
  const showLedger = section === 'ledger' || !selected;

  // ---- 分析タブのデータ ----
  const [day, setDay] = useState<string>(jstToday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AggregateResult | null>(null);
  const [range, setRangeData] = useState<RangeResult | null>(null);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [counts, setCounts] = useState<CountsResult | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const fn = httpsCallable(functions, 'aggregateReactions');
      try {
        const res = await fn({ days: 14 });
        if (alive) setRangeData(res.data as RangeResult);
      } catch (e: any) {
        if (alive) setRangeError(e?.message || '取得に失敗しました');
      } finally {
        if (alive) setRangeLoading(false);
      }
      try {
        const res = await fn({ counts: true });
        if (alive) setCounts(res.data as CountsResult);
      } catch (e: any) {
        if (alive) setCountsError(e?.message || '取得に失敗しました');
      } finally {
        if (alive) setCountsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const meta = selected ? ASSET_META[selected.name] : undefined;
  // 台帳(ledger)選択時は全 surface 合算(global)の推移を出す。
  const trendSeries = !selected
    ? range?.daily
    : meta?.surface === 'global'
      ? range?.daily
      : meta?.surface
        ? range?.dailyBySurface?.[meta.surface]
        : undefined;
  const trendWired = !selected ? true : !!meta?.surface;

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

  const surfaceEntries = Object.entries(result?.surfaces || {});

  /** 詳細セクション（見出し＋本文）。メインの解説で使う。 */
  const DetailSection: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.8, ...(mono ? { fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' } : {}) }}>
        {children}
      </Typography>
    </Box>
  );

  const sectionSx = {
    p: 3, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
  } as const;

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* ── メイン: モデル台帳（表）／ 選択資産の解説 ─────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* ヘッダ（固定） */}
        <Box sx={{ px: 4, pt: 4, pb: 2, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyRoundedIcon sx={{ color: ACCENT }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>AI学習モニター</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            学習サイクルの入力データ（反応ログ）と学習資産の状態を把握します。
            方針: 全体はモデルで、個人は記憶（RAG/メモリ）で。
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, px: 4, pb: 3, display: 'flex', overflow: 'hidden' }}>
          {showLedger ? (
            /* モデル台帳（表） */
            <Paper elevation={0} sx={{ ...sectionSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ flexShrink: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>モデル台帳</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  1行＝1学習資産。何が・何のデータで・どこで効いているか。行または左のナビをクリックすると詳細が開きます。
                  種別: モデル(A)=判定器 / 索引(B)=埋め込み検索 / 資産(C)=ユーザー固有の知識 / 生成(D)=画像などの生成モデル。
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <Table size="small" stickyHeader>
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
                    {CATEGORIES.map(c => {
                      const rows = REGISTRY.filter(a => a.cat === c.key);
                      if (rows.length === 0) return null;
                      return (
                        <React.Fragment key={c.key}>
                          <TableRow>
                            <TableCell colSpan={6} sx={{ bgcolor: 'light-dark(rgba(8,117,166,0.06), rgba(79,195,247,0.06))', py: 0.75 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: ACCENT }}>{c.label}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>{c.desc}</Typography>
                            </TableCell>
                          </TableRow>
                          {rows.map(a => (
                            <TableRow
                              key={a.name}
                              hover
                              onClick={() => onSectionChange?.(a.name)}
                              sx={{ cursor: 'pointer' }}
                            >
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
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          ) : selected ? (
            /* 選択資産の解説 */
            <Paper elevation={0} sx={{ ...sectionSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'auto' }}>
              <Box>
                <Typography variant="caption" sx={{ color: ACCENT, fontWeight: 700 }}>
                  {CATEGORIES.find(c => c.key === selected.cat)?.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}>
                  {selected.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                  <Chip label={selected.status} size="small" color={statusColor[selected.status]} variant={selected.status === '構想' ? 'outlined' : 'filled'} />
                  <Chip label={selected.kind} size="small" variant="outlined" />
                  <Chip label={selected.scope} size="small" variant="outlined" />
                </Box>
                {selected.note && (
                  <Typography variant="body2" sx={{ color: 'info.main', mt: 1 }}>{selected.note}</Typography>
                )}
              </Box>
              <Divider />
              <DetailSection label="これは何？">{selected.summary}</DetailSection>
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: 'light-dark(rgba(8,117,166,0.08), rgba(79,195,247,0.08))',
                border: '1px solid', borderColor: 'light-dark(rgba(8,117,166,0.3), rgba(79,195,247,0.3))',
              }}>
                <Typography variant="caption" sx={{ color: ACCENT, letterSpacing: '0.08em', fontWeight: 700 }}>
                  何が良くなる？
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.8 }}>{selected.benefit}</Typography>
              </Box>
              <DetailSection label="仕組み">{selected.how}</DetailSection>
              {selected.location && <DetailSection label="データの場所" mono>{selected.location}</DetailSection>}
              <DetailSection label="材料">{selected.source}</DetailSection>
              <DetailSection label="使用場所">{selected.usedBy}</DetailSection>
              {selected.ladder && <DetailSection label="学習の梯子">{selected.ladder}</DetailSection>}
              {selected.next && <DetailSection label="次の一歩">{selected.next}</DetailSection>}
            </Paper>
          ) : null}
        </Box>
      </Box>

      {/* ── 右サイドバー: 分析タブ（反応ログ集計＋グラフ） ─────────── */}
      <Box
        sx={{
          width: 380, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <Tabs value={0} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider', minHeight: 44, '& .MuiTab-root': { minHeight: 44 } }}>
          <Tab label="分析" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', fontWeight: 700 }}>
              対象
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: ACCENT }}>
              {selected ? selected.name : 'モデル台帳（全体）'}
            </Typography>
          </Box>

          {/* 反応ログ 日次集計（管理者の手動ジョブ） */}
          <Paper elevation={0} sx={{ ...sectionSx, p: 2 }}>
            <Tooltip title="指定日(JST)の reactionLogs を集計して insights/reactionPatterns に保存する管理者用の手動ジョブ。反応の生ログを日次でまとめ、グラフの材料にします。">
              <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', fontWeight: 700, cursor: 'help' }}>
                反応ログ 日次集計
              </Typography>
            </Tooltip>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              <TextField type="date" size="small" value={day} onChange={(e) => setDay(e.target.value)} sx={{ width: 150 }} />
              <Button
                variant="outlined" size="small" disableElevation
                startIcon={loading ? <CircularProgress size={13} color="inherit" /> : <PlayArrowRoundedIcon />}
                onClick={() => void run()} disabled={loading}
                sx={{ textTransform: 'none' }}
              >
                集計を実行
              </Button>
            </Box>
            {error && <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1 }}>エラー: {error}</Typography>}
            {result && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                <b>{result.day}</b> ・ イベント {result.eventCount.toLocaleString()} ・ ユーザー {result.userCount.toLocaleString()}
                {surfaceEntries.length > 0
                  ? ` ・ ${surfaceEntries.map(([sf, s]) => `${sf} 表示${s.impressions}/クリック${s.clicks}/CTR ${pct(s.ctr)}`).join(' ／ ')}`
                  : ' ・ この日の反応ログはまだありません'}
              </Typography>
            )}
          </Paper>

          <GraphCard title="① 反応の推移" hint="直近14日の 表示・クリック・CTR">
            <ReactionTrendCard
              series={trendSeries}
              wired={trendWired}
              loading={rangeLoading}
              error={rangeError}
              unwiredNote={selected?.name === 'chat-router'
                ? 'chat 本体の surface 配線待ち（応答の書き直し/再生成を記録してから）。'
                : 'この資産はまだ反応ログに配線されていません。'}
            />
          </GraphCard>
          <GraphCard title="② 資産の規模" hint="現在の件数（コレクション横断）">
            <SizeCard counts={counts} loading={countsLoading} error={countsError} activeKey={meta?.countKey} />
          </GraphCard>
          {selected && (
            <GraphCard title="③ 学習の梯子・成熟度" hint="6段のどこまで来たか＋状態">
              <LadderCard rung={meta?.rung ?? 1} status={selected.status} />
            </GraphCard>
          )}
        </Box>
      </Box>
    </Box>
  );
};
