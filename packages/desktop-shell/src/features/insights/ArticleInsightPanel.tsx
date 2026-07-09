// 記事インサイト・パネル（S.Blog エディタ右ドック）。
//  - 現在の記事に紐づく既存分析を読み込む
//  - 「この記事を分析」で分析（analyzeArticle: CF or mock フォールバック）→ Firestore 保存 → 表示
//  - 表示: 要約 / 多視点スコア（レーダー）/ 論証グラフ（xyflow・拡大可）/ キーワード（バー）
//  - 書き出し: プロジェクトの Research & Memo へ取り込み / 外付け脳（RAG）へ取り込み

import React from 'react';
import {
  Box, Typography, Button, CircularProgress, Tooltip, IconButton,
  Dialog, DialogContent, Menu, MenuItem, ListItemText, Divider,
} from '@mui/material';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { ArticleInsightRepository } from './ArticleInsightRepository';
import { analyzeArticle } from './analyzeArticleApi';
import { importInsightToBoard, ingestInsightToRag } from './insightExport';
import { useAppStore } from '../../store/useAppStore';
import { type ArticleInsight } from './articleInsightTypes';
import { InsightRadar } from './components/InsightRadar';
import { InsightKeywordBars } from './components/InsightKeywordBars';
import { ArgumentGraph, ArgumentGraphLegend } from './components/ArgumentGraph';

const ACCENT = '#b39ddb'; // 分析はS.Blogの赤系と分けて紫（思考・知識のニュアンス）

const ROLE_META: Record<string, { label: string; color: string }> = {
  evidence: { label: '根拠', color: '#e6c34d' },
  interpretation: { label: '解釈', color: '#64b5f6' },
  conclusion: { label: '結論', color: '#e57ea0' },
};

interface Props {
  uid?: string;
  articleId?: string | null;
  title: string;
  bodyMarkdown: string;
  excerpt?: string;
  sourceUrl?: string | null;
  /** 記事がプロジェクト記事なら、その projectId（取り込み先の既定候補として先頭に出す）。 */
  defaultProjectId?: string | null;
  onToast?: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const ArticleInsightPanel: React.FC<Props> = ({
  uid, articleId, title, bodyMarkdown, excerpt, sourceUrl, defaultProjectId, onToast,
}) => {
  const [insight, setInsight] = React.useState<ArticleInsight | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [graphOpen, setGraphOpen] = React.useState(false);
  const [importMenuEl, setImportMenuEl] = React.useState<null | HTMLElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [ingesting, setIngesting] = React.useState(false);
  const projects = useAppStore((s) => s.projects);

  // 記事が変わったら既存分析を読み込む
  React.useEffect(() => {
    let alive = true;
    setInsight(null);
    if (!uid || !articleId) return;
    setLoading(true);
    void ArticleInsightRepository.findByArticleId(uid, articleId)
      .then((r) => { if (alive) setInsight(r); })
      .catch(() => { /* 未分析 */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid, articleId]);

  const hasBody = !!bodyMarkdown?.trim() || !!title?.trim();

  const runAnalysis = async () => {
    if (!uid) { onToast?.('分析にはログインが必要です', 'info'); return; }
    if (!hasBody) { onToast?.('分析する本文がありません', 'info'); return; }
    setAnalyzing(true);
    try {
      const { insight: result, usedFallback } = await analyzeArticle({ articleId, title, bodyMarkdown, excerpt, sourceUrl, authorUid: uid });
      // 既存分析があれば同じIDで上書き（1記事1分析）
      if (insight?.id) { result.id = insight.id; result.createdAt = insight.createdAt; }
      await ArticleInsightRepository.save(uid, result);
      setInsight(result);
      onToast?.(
        usedFallback ? '記事を分析しました（簡易エンジン）。' : '記事を分析しました。',
        'success',
      );
    } catch (e: any) {
      onToast?.(`分析に失敗しました: ${e?.message || '不明なエラー'}`, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Phase D: Research & Memo へ取り込み ──
  const doImport = async (projectId: string, projectName: string) => {
    setImportMenuEl(null);
    if (!insight) return;
    setImporting(true);
    try {
      const r = await importInsightToBoard(projectId, insight);
      onToast?.(
        `「${projectName}」の Research & Memo に取り込みました（根拠など${r.items}枚・接続${r.edges}本）`,
        'success',
      );
    } catch (e: any) {
      onToast?.(`取り込みに失敗しました: ${e?.message || '不明なエラー'}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  // ── Phase D: 外付け脳（RAG）へ取り込み ──
  const doIngest = async () => {
    if (!insight || !uid) return;
    setIngesting(true);
    try {
      await ingestInsightToRag(insight, uid);
      const updated: ArticleInsight = { ...insight, ragIngestedAt: new Date().toISOString() };
      await ArticleInsightRepository.save(uid, updated);
      setInsight(updated);
      onToast?.('外付け脳（RAG）に取り込みました。Chat の判断根拠に使われます', 'success');
    } catch (e: any) {
      onToast?.(`RAG取り込みに失敗しました: ${e?.message || '不明なエラー'}`, 'error');
    } finally {
      setIngesting(false);
    }
  };

  // 取り込み先プロジェクト候補（記事のプロジェクトを先頭に）
  const projectOptions = React.useMemo(() => {
    const list = [...projects];
    if (defaultProjectId) {
      list.sort((a, b) => (a.id === defaultProjectId ? -1 : b.id === defaultProjectId ? 1 : 0));
    }
    return list;
  }, [projects, defaultProjectId]);

  const roleCounts = React.useMemo(() => {
    const c: Record<string, number> = { evidence: 0, interpretation: 0, conclusion: 0 };
    insight?.claims.forEach((cl) => { c[cl.role] = (c[cl.role] || 0) + 1; });
    return c;
  }, [insight]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ヘッダー */}
      <Box sx={{ px: 2, pt: 2, pb: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScienceRoundedIcon sx={{ fontSize: 20, color: ACCENT }} />
          <Typography sx={{ fontWeight: 800, fontSize: 15, color: 'var(--brand-fg)' }}>記事を分析</Typography>
          <Box sx={{ flex: 1 }} />
          {insight && (
            <Tooltip title="この記事を再分析する">
              <span>
                <IconButton size="small" disabled={analyzing} onClick={() => void runAnalysis()}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', '&:hover': { color: ACCENT } }}>
                  <RefreshRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
        <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.5 }}>
          記事を「根拠→解釈→結論」に分解し、多視点で分析します。得た根拠は Research &amp; Memo で再利用できます。
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress size={22} sx={{ color: ACCENT }} />
          </Box>
        ) : !insight ? (
          // ── 未分析（空状態） ──
          <Box sx={{ textAlign: 'center', pt: 4 }}>
            <HubRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.2)' }} />
            <Typography sx={{ mt: 1.5, fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
              まだこの記事は分析されていません
            </Typography>
            <Button
              onClick={() => void runAnalysis()}
              disabled={analyzing || !hasBody}
              startIcon={analyzing ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <ScienceRoundedIcon />}
              sx={{ mt: 2, bgcolor: ACCENT, color: '#1a1626', fontWeight: 800, textTransform: 'none', px: 2.5,
                borderRadius: 1.5, '&:hover': { bgcolor: '#9c86c9' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}>
              {analyzing ? '分析中…' : 'この記事を分析'}
            </Button>
            {!hasBody && (
              <Typography sx={{ mt: 1, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                本文を書いてから分析できます
              </Typography>
            )}
          </Box>
        ) : (
          // ── 分析結果（Phase A: サマリ表示。Phase B でグラフ/レーダーに拡張） ──
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {insight.engine === 'mock' && (
              <Box sx={{ px: 1.25, py: 0.75, borderRadius: 1, bgcolor: 'rgba(179,157,219,0.12)', border: '1px solid rgba(179,157,219,0.3)' }}>
                <Typography sx={{ fontSize: 10.5, color: ACCENT, fontWeight: 700 }}>
                  暫定エンジンによる分析です。多視点グラフ表示は次フェーズで有効化されます。
                </Typography>
              </Box>
            )}

            {/* 要約 */}
            <Box>
              <SectionLabel>要約</SectionLabel>
              <Typography sx={{ fontSize: 12.5, color: 'var(--brand-fg)', lineHeight: 1.7 }}>{insight.summary}</Typography>
            </Box>

            {/* 多視点スコア（レーダー） */}
            <Box>
              <SectionLabel>多視点スコア</SectionLabel>
              <InsightRadar scores={insight.scores} />
            </Box>

            {/* 論証グラフ（セマンティックグラフ）— 埋め込み＋拡大 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SectionLabel>論証グラフ</SectionLabel>
                <Box sx={{ flex: 1 }} />
                <Box sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
                  {(['evidence', 'interpretation', 'conclusion'] as const).map((r) => (
                    <Typography key={r} sx={{ fontSize: 10, color: ROLE_META[r].color, fontWeight: 700 }}>
                      {ROLE_META[r].label}{roleCounts[r]}
                    </Typography>
                  ))}
                </Box>
              </Box>
              <Box sx={{ position: 'relative' }}>
                <ArgumentGraph items={insight.graph.items} edges={insight.graph.edges} height={240} />
                <Tooltip title="グラフを拡大">
                  <IconButton size="small" onClick={() => setGraphOpen(true)}
                    sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.35)', color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' } }}>
                    <OpenInFullRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <ArgumentGraphLegend />
              <Typography sx={{ mt: 0.5, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                {insight.graph.edges.length} 本の接続（根拠→結論）を検出
              </Typography>
            </Box>

            {/* キーワード（バーチャート） */}
            {insight.keywords.length > 0 && (
              <Box>
                <SectionLabel>キーワード</SectionLabel>
                <InsightKeywordBars keywords={insight.keywords} />
              </Box>
            )}

            {/* 書き出し（循環を閉じる）: Research & Memo / 外付け脳(RAG) へ */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
              <SectionLabel>この分析を使う</SectionLabel>
              <Tooltip title={projectOptions.length ? '抽出した根拠→結論のカードをプロジェクトの Research & Memo に取り込みます' : 'プロジェクトがありません'}>
                <span style={{ width: '100%' }}>
                  <Button fullWidth disabled={importing || projectOptions.length === 0}
                    onClick={(e) => setImportMenuEl(e.currentTarget)}
                    startIcon={importing ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <HubRoundedIcon />}
                    sx={{ textTransform: 'none', fontSize: 12.5, fontWeight: 700, borderRadius: 1.5, color: ACCENT,
                      border: `1px solid ${ACCENT}66`, bgcolor: `${ACCENT}12`, '&:hover': { bgcolor: `${ACCENT}22` },
                      '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.35)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}>
                    Research &amp; Memo に取り込む
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="分析結果（要約・論点・出典）を RAG に取り込み、Chat が判断根拠として使えるようにします">
                <span style={{ width: '100%' }}>
                  <Button fullWidth disabled={ingesting || !!insight.ragIngestedAt}
                    onClick={() => void doIngest()}
                    startIcon={insight.ragIngestedAt ? <CheckCircleRoundedIcon sx={{ color: '#66bb6a' }} />
                      : ingesting ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <PsychologyRoundedIcon />}
                    sx={{ textTransform: 'none', fontSize: 12.5, fontWeight: 700, borderRadius: 1.5,
                      color: insight.ragIngestedAt ? '#66bb6a' : 'rgb(var(--brand-fg-rgb) / 0.75)',
                      border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
                      '&.Mui-disabled': { color: insight.ragIngestedAt ? '#66bb6a' : 'rgb(var(--brand-fg-rgb) / 0.35)' } }}>
                    {insight.ragIngestedAt ? '外付け脳に取り込み済み' : '外付け脳（RAG）に取り込む'}
                  </Button>
                </span>
              </Tooltip>
            </Box>
            <Menu anchorEl={importMenuEl} open={!!importMenuEl} onClose={() => setImportMenuEl(null)}
              PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', maxHeight: 320, minWidth: 220 } }}>
              <Box sx={{ px: 1.5, py: 0.75, fontSize: 10.5, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                取り込み先プロジェクト
              </Box>
              <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
              {projectOptions.map((p) => (
                <MenuItem key={p.id} onClick={() => void doImport(p.id, p.name)}
                  sx={{ fontSize: 13, color: 'var(--brand-fg)', gap: 1 }}>
                  <span>{p.iconEmoji || '📁'}</span>
                  <ListItemText primary={p.name} primaryTypographyProps={{ fontSize: 13 }} />
                  {p.id === defaultProjectId && (
                    <Typography sx={{ fontSize: 9.5, color: ACCENT, fontWeight: 700 }}>この記事</Typography>
                  )}
                </MenuItem>
              ))}
            </Menu>

            <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textAlign: 'center' }}>
              分析日時: {new Date(insight.generatedAt).toLocaleString('ja-JP')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* 論証グラフの拡大ダイアログ（380px パネルでは狭いので全体探索用） */}
      <Dialog open={graphOpen} onClose={() => setGraphOpen(false)} maxWidth="lg" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', height: '82vh' } }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
          <ScienceRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: 'var(--brand-fg)' }}>
            論証グラフ — {insight?.sourceTitle}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setGraphOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 1.5, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {insight && (
            <>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ArgumentGraph items={insight.graph.items} edges={insight.graph.edges} height="100%" showControls />
              </Box>
              <ArgumentGraphLegend />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ mb: 0.75, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
    color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase' }}>
    {children}
  </Typography>
);
