import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Chip, Divider, CircularProgress, LinearProgress, Tooltip, Snackbar, Alert, TextField, Menu, MenuItem, InputBase, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { invoke } from '@tauri-apps/api/core';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import { useDskStore } from '../store/useDskStore';
import { summarizeEntry } from '../lib/summarize';
import { openLocalFileExternally } from '../lib/localFiles';
import { ingestEntryToRag, isEntryIngested } from '../lib/ragIngest';
import { listKnownCategories, isWeakCategory, KIND_LABELS, type LibraryEntry } from '../types';

const ACCENT = '#26a69a';

interface DskRightPanelProps {
  entry: LibraryEntry | null;
  activeProjectId: string | null;
  onOpenViewer: (entry: LibraryEntry) => void;
}

export const DskRightPanel: React.FC<DskRightPanelProps> = ({ entry, activeProjectId, onOpenViewer }) => {
  const patch = useDskStore(s => s.patch);
  const entries = useDskStore(s => s.entries);
  const projects = useAppStore(s => s.projects);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const uid = currentUser?.uid as string | undefined;
  const knowledgeSources = useAiProfileStore(s => s.knowledgeSources);
  const loadKnowledgeSources = useAiProfileStore(s => s.loadKnowledgeSources);
  const [summarizing, setSummarizing] = useState(false);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragStatus, setRagStatus] = useState<string>('');
  /** RAG追加の完了ダイアログ（トーストだと見逃すため明示表示） */
  const [ragResult, setRagResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [visBusy, setVisBusy] = useState(false);
  const [visStatus, setVisStatus] = useState<string>('');
  const [visDone, setVisDone] = useState(false);
  // 進捗バー: null=不確定（巡回中で総数未知）、0-100=確定%（埋め込みフェーズ）
  const [visPct, setVisPct] = useState<number | null>(null);
  const [visPhase, setVisPhase] = useState<'crawl' | 'embed' | null>(null);
  // 「サイトを商品索引化」押下時のカテゴリ跨ぎ選択メニュー
  const [crawlMenuAnchor, setCrawlMenuAnchor] = useState<null | HTMLElement>(null);
  const crawlAbortRef = useRef<AbortController | null>(null);

  // RAG 取り込み済み判定のためナレッジ一覧を一度読み込む。
  useEffect(() => {
    if (uid) loadKnowledgeSources(uid);
  }, [uid, loadKnowledgeSources]);

  if (!entry) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
        <LayersRoundedIcon sx={{ fontSize: 40, opacity: 0.4 }} />
        <Typography sx={{ fontSize: 13, textAlign: 'center' }}>知識を選択すると詳細・要約・紐付けが表示されます</Typography>
      </Box>
    );
  }

  const isPdf = entry.kind === 'book' || entry.kind === 'pdf';
  // 内蔵ビューア/PDF索引化が使えるのは実体が .pdf のときだけ（書類kindでも docx/xlsx 等は対象外）
  const isPdfFile = !!entry.filePath && entry.filePath.toLowerCase().endsWith('.pdf');
  // 動的カテゴリ選択肢（現在値が一覧に無ければ末尾に足して必ず選べるようにする）。
  const categoryOptions = (() => {
    const base = listKnownCategories(entries);
    return entry.category && !base.includes(entry.category) ? [...base, entry.category] : base;
  })();
  const isLocalFile = !!entry.isLocalFile;
  // RAG に取り込めるのは本文を持つ資料（PDF/書籍/メモ/法令、または filePath のある実ファイル）。
  const canAddToRag = isPdf || entry.kind === 'note' || entry.kind === 'law' || !!entry.filePath;
  const alreadyIngested = isEntryIngested(entry, knowledgeSources);
  const linkedSet = new Set(entry.linkedProjectIds);
  const activeLinked = activeProjectId ? linkedSet.has(activeProjectId) : false;

  // カタログPDFを家具クロップ＋CLIP埋め込みで視覚索引化（S.Model 側のローカル照合用）。
  const canVisualIndex = isPdf && isPdfFile;
  const handleVisualIndex = async () => {
    if (!entry.filePath) return;
    setVisBusy(true);
    setVisDone(false);
    setVisStatus('準備中…');
    try {
      const { ingestCatalogEntry } = await import('../catalog/ingestCatalog');
      const meta = await ingestCatalogEntry(
        { localId: entry.localId, title: entry.title, filePath: entry.filePath, kind: entry.kind },
        {
          onProgress: (p) => setVisStatus(`p.${p.page}/${p.totalPages}・商品${p.items}件`),
        },
      );
      setVisDone(true);
      setToast({ msg: `カタログを索引化しました（商品${meta.itemCount}件）`, sev: 'success' });
    } catch (e: any) {
      console.error('[DskRightPanel] visual index failed', e);
      setToast({ msg: e?.message || 'カタログの索引化に失敗しました', sev: 'error' });
    } finally {
      setVisBusy(false);
      setVisStatus('');
    }
  };

  // 登録した Web サイト（家具EC等）を隠しWebViewで巡回→商品を視覚索引化。
  const canCrawlSite = entry.kind === 'url' && !!entry.sourceUrl;
  const handleStopCrawl = async () => {
    crawlAbortRef.current?.abort();
    await invoke('close_all_crawl_webviews').catch(() => {});
    setVisStatus('停止中…');
  };
  const handleCrawlSite = async (crossCategories: boolean) => {
    if (!entry.sourceUrl) return;
    const controller = new AbortController();
    crawlAbortRef.current = controller;
    setVisBusy(true);
    setVisDone(false);
    setVisStatus('巡回開始…');
    setVisPhase('crawl');
    setVisPct(null);
    try {
      const { crawlSiteEntry } = await import('../catalog/crawlSiteToCatalog');
      const { meta, diag } = await crawlSiteEntry(
        { localId: entry.localId, title: entry.title, sourceUrl: entry.sourceUrl, category: entry.category, tags: entry.tags },
        {
          signal: controller.signal,
          // 跨がない=このカテゴリのページネーションのみ（他カテゴリへ波及しない）。跨ぐ=従来の fan-out。
          maxDepth: crossCategories ? 3 : 0,
          onProgress: (p) => {
            if (p.phase === 'crawl') {
              // 総数が未知のフェーズ。バーは不確定表示。
              setVisPhase('crawl');
              setVisPct(null);
              setVisStatus(`巡回中 ${p.pagesVisited}ページ・商品${p.productsFound}件`);
            } else {
              // 埋め込みフェーズ。総数が確定するので % を出す。
              const total = p.total || 0;
              const pct = total > 0 ? Math.min(100, Math.round((p.embedded! / total) * 100)) : 0;
              setVisPhase('embed');
              setVisPct(pct);
              setVisStatus(`索引化中 ${p.embedded}/${total}（${pct}%）`);
            }
          },
        },
      );
      setVisDone(true);
      if (meta.itemCount > 0) {
        setToast({ msg: `サイトを索引化しました（商品${meta.itemCount}件）`, sev: 'success' });
      } else if (diag.pagesResponded === 0) {
        // 抽出データが1件も届いていない＝注入スクリプト不発 or ローカル通信ブロック。
        setToast({ msg: `商品0件。ページ応答0（${diag.pagesVisited}ページ巡回）。WebViewからの通信がブロックされている可能性があります`, sev: 'error' });
      } else if (diag.productLinksSeen === 0) {
        // 届いたが商品リンクを検出できず＝レンダリング未完 or 商品がリンクでない。
        setToast({ msg: `商品0件。${diag.pagesResponded}/${diag.pagesVisited}ページ応答・カテゴリ${diag.categoriesSeen}件検出だが商品リンク0。一覧の描画待ち/抽出を要調整`, sev: 'error' });
      } else {
        setToast({ msg: `商品リンク${diag.productLinksSeen}件検出（画像付き${diag.productsWithImage}）だが索引0。画像取得を要確認`, sev: 'error' });
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setToast({ msg: '巡回を停止しました', sev: 'info' });
      } else {
        console.error('[DskRightPanel] crawl failed', e);
        setToast({ msg: e?.message || 'サイトの巡回に失敗しました', sev: 'error' });
      }
    } finally {
      crawlAbortRef.current = null;
      setVisBusy(false);
      setVisStatus('');
      setVisPhase(null);
      setVisPct(null);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const result = await summarizeEntry(entry);
      const mergedTags = Array.from(new Set([...(entry.tags || []), ...(result.suggestedTags || [])]));
      await patch({
        ...entry,
        summary: result.summary,
        keyPoints: result.keyPoints || [],
        tags: mergedTags,
        category: isWeakCategory(entry.category) && result.suggestedCategory ? result.suggestedCategory : entry.category,
      });
      setToast({ msg: 'AI要約が完了しました', sev: 'success' });
    } catch (e: any) {
      console.error('[DskRightPanel] summarize failed', e);
      setToast({ msg: `要約に失敗しました: ${e?.message ?? e}`, sev: 'error' });
    } finally {
      setSummarizing(false);
    }
  };

  const toggleLinkActive = async () => {
    if (!activeProjectId) return;
    const next = activeLinked
      ? entry.linkedProjectIds.filter(id => id !== activeProjectId)
      : [...entry.linkedProjectIds, activeProjectId];
    try {
      await patch({ ...entry, linkedProjectIds: next });
    } catch (e) {
      console.error('[DskRightPanel] link toggle failed', e);
      setToast({ msg: '紐付けの更新に失敗しました', sev: 'error' });
    }
  };

  const openUrl = async () => {
    if (!entry.sourceUrl) return;
    try {
      const { openUrl: open } = await import('@tauri-apps/plugin-opener');
      await open(entry.sourceUrl);
    } catch (e) {
      console.error('[DskRightPanel] open url failed', e);
      window.open(entry.sourceUrl, '_blank');
    }
  };

  const openFile = async () => {
    if (!entry.filePath) return;
    try {
      await openLocalFileExternally(entry.filePath);
    } catch (e) {
      console.error('[DskRightPanel] open local file failed', e);
      setToast({ msg: 'ファイルを開けませんでした', sev: 'error' });
    }
  };

  const handleAddToRag = async () => {
    if (!uid) {
      setToast({ msg: 'RAGへの追加にはログインが必要です', sev: 'error' });
      return;
    }
    setRagBusy(true);
    try {
      await ingestEntryToRag(entry, uid, (msg) => setRagStatus(msg));
      setRagResult({ ok: true, msg: `「${entry.title}」をRAG（外付け脳）に追加しました。SEKKEIYA OS が回答の根拠に使えるようになります。` });
    } catch (e: any) {
      console.error('[DskRightPanel] add to RAG failed', e);
      setRagResult({ ok: false, msg: `${e?.message ?? e}` });
    } finally {
      setRagBusy(false);
      setRagStatus('');
    }
  };

  // カテゴリ/タグの保存。未登録ローカルファイルは patch（=update_knowledge_entry）が
  // 自動で 3DSK 管理エントリへ昇格させる。
  const commitMeta = async (updates: Partial<LibraryEntry>) => {
    setMetaBusy(true);
    try {
      await patch({ ...entry, ...updates });
    } catch (e: any) {
      console.error('[DskRightPanel] update meta failed', e);
      setToast({ msg: `保存に失敗しました: ${e?.message ?? e}`, sev: 'error' });
    } finally {
      setMetaBusy(false);
    }
  };

  const handleSetCategory = (category: string) => {
    if (category === entry.category) return;
    commitMeta({ category });
  };

  const handleAddTag = () => {
    const next = tagDraft.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
    if (!next.length) return;
    const merged = Array.from(new Set([...(entry.tags || []), ...next]));
    setTagDraft('');
    if (merged.length !== (entry.tags || []).length) commitMeta({ tags: merged });
  };

  const handleRemoveTag = (tag: string) => {
    commitMeta({ tags: (entry.tags || []).filter((t) => t !== tag) });
  };

  const projectName = (id: string) => projects.find((p: any) => p.id === id)?.name || id;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <Box sx={{ p: 2.5 }}>
        <Chip label={KIND_LABELS[entry.kind]} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: ACCENT, color: 'var(--brand-fg)', mb: 1 }} />
        <Typography sx={{ color: 'var(--brand-fg)', fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{entry.title}</Typography>
        {entry.author && <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 12, mt: 0.5 }}>{entry.author}</Typography>}

        {/* Primary actions */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          {isPdf && isPdfFile && (
            <Button fullWidth variant="contained" size="small" startIcon={<MenuBookRoundedIcon />} onClick={() => onOpenViewer(entry)}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4db6ac' } }}>
              開く
            </Button>
          )}
          {entry.kind === 'url' && (
            <Button fullWidth variant="contained" size="small" startIcon={<OpenInNewRoundedIcon />} onClick={openUrl}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4db6ac' } }}>
              元ページを開く
            </Button>
          )}
          {entry.kind === 'law' && (
            <Button fullWidth variant="contained" size="small" startIcon={<GavelRoundedIcon />} onClick={() => onOpenViewer(entry)}
              sx={{ bgcolor: '#8d6e63', '&:hover': { bgcolor: '#a1887f' } }}>
              条文を開く
            </Button>
          )}
          {!!entry.filePath && !isPdfFile && entry.kind !== 'url' && (
            <Button fullWidth variant="contained" size="small" startIcon={<OpenInNewRoundedIcon />} onClick={openFile}
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#4db6ac' } }}>
              ファイルを開く
            </Button>
          )}
        </Box>

        {isLocalFile && entry.relPath && (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: 11, mt: 1, wordBreak: 'break-all' }}>
            LocalAssets/{entry.relPath}
          </Typography>
        )}

        {/* RAG（SEKKEIYA Chat のナレッジ）へ追加 */}
        {canAddToRag && (
          <Box sx={{ mt: 1.5 }}>
            {alreadyIngested && !ragBusy ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<CheckCircleRoundedIcon sx={{ fontSize: 14, color: '#4ade80 !important' }} />}
                  label="RAGに追加済み"
                  size="small"
                  sx={{ height: 24, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                />
                <Tooltip title="最新の内容で再取り込み">
                  <Button size="small" onClick={handleAddToRag} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, minWidth: 0 }}>
                    再追加
                  </Button>
                </Tooltip>
              </Box>
            ) : (
              <Tooltip title={uid ? 'この資料をAIの判断根拠（RAG）として取り込みます' : '先にログインしてください'}>
                <span>
                  <Button
                    fullWidth variant="outlined" size="small"
                    disabled={ragBusy || !uid}
                    startIcon={ragBusy ? <CircularProgress size={14} sx={{ color: 'light-dark(#5908a6, #a855f7)' }} /> : <AutoStoriesRoundedIcon sx={{ fontSize: 16 }} />}
                    onClick={handleAddToRag}
                    sx={{ color: 'light-dark(#470ea0, #c4a3f7)', borderColor: 'rgba(168,85,247,0.5)', '&:hover': { borderColor: '#a855f7', bgcolor: 'rgba(168,85,247,0.08)' } }}
                  >
                    {ragBusy ? (ragStatus || '取り込み中…') : 'RAGに追加'}
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        )}

        {/* カタログ視覚索引（S.Model のローカル商品照合用） */}
        {canVisualIndex && (
          <Box sx={{ mt: 1.5 }}>
            <Tooltip title="このカタログの家具を画像で索引化し、S.Modelで3Dモデルに近い商品を探せるようにします（端末内で完結・初回はモデル読込に時間がかかります）">
              <span>
                <Button
                  fullWidth variant="outlined" size="small"
                  disabled={visBusy}
                  startIcon={visBusy ? <CircularProgress size={14} sx={{ color: 'light-dark(#0676a8, #38bdf8)' }} /> : <MenuBookRoundedIcon sx={{ fontSize: 16 }} />}
                  onClick={handleVisualIndex}
                  sx={{ color: 'light-dark(#0474a9, #7dd3fc)', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}
                >
                  {visBusy ? (visStatus || '索引化中…') : visDone ? 'カタログ照合に索引済み（再索引）' : 'カタログ照合に索引化'}
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}

        {/* Web サイト巡回→商品の視覚索引（S.Model のローカル商品照合用） */}
        {canCrawlSite && (
          <>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
            <Tooltip title="このサイトをアプリ内で巡回し、商品画像を索引化します。S.Modelで3Dモデルに近い実在商品（購入リンク付き）を探せます（端末内・初回はモデル読込に時間がかかります）">
              <span style={{ flex: 1 }}>
                <Button
                  fullWidth variant="outlined" size="small"
                  disabled={visBusy}
                  startIcon={visBusy ? <CircularProgress size={14} sx={{ color: 'light-dark(#0676a8, #38bdf8)' }} /> : <MenuBookRoundedIcon sx={{ fontSize: 16 }} />}
                  onClick={(e) => setCrawlMenuAnchor(e.currentTarget)}
                  sx={{ color: 'light-dark(#0474a9, #7dd3fc)', borderColor: 'rgba(56,189,248,0.5)', '&:hover': { borderColor: '#38bdf8', bgcolor: 'rgba(56,189,248,0.08)' } }}
                >
                  {visBusy ? (visStatus || '巡回中…') : visDone ? '商品照合に索引済み（再巡回）' : 'サイトを商品索引化'}
                </Button>
              </span>
            </Tooltip>
            <Menu
              anchorEl={crawlMenuAnchor}
              open={Boolean(crawlMenuAnchor)}
              onClose={() => setCrawlMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgba(56,189,248,0.25)', maxWidth: 320 } } }}
            >
              <MenuItem
                onClick={() => { setCrawlMenuAnchor(null); handleCrawlSite(false); }}
                sx={{ display: 'block', py: 1, whiteSpace: 'normal' }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>このカテゴリのみ（ページを跨がない）</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>この一覧のページ送りだけを辿る。他ジャンルには波及しません。</Typography>
              </MenuItem>
              <MenuItem
                onClick={() => { setCrawlMenuAnchor(null); handleCrawlSite(true); }}
                sx={{ display: 'block', py: 1, whiteSpace: 'normal' }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>他カテゴリも巡回（ページを跨ぐ）</Typography>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>サイドバー等のカテゴリリンクも辿り、サイト全体を広く索引します。</Typography>
              </MenuItem>
            </Menu>
            {visBusy && (
              <Tooltip title="巡回を停止">
                <Button
                  variant="outlined" size="small"
                  onClick={handleStopCrawl}
                  startIcon={<StopRoundedIcon sx={{ fontSize: 16 }} />}
                  sx={{ color: 'light-dark(#a80606, #fca5a5)', borderColor: 'rgba(248,113,113,0.5)', flexShrink: 0, '&:hover': { borderColor: '#f87171', bgcolor: 'rgba(248,113,113,0.08)' } }}
                >
                  停止
                </Button>
              </Tooltip>
            )}
          </Box>
          {visBusy && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant={visPhase === 'embed' && visPct != null ? 'determinate' : 'indeterminate'}
                value={visPct ?? 0}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'rgba(56,189,248,0.12)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#38bdf8', borderRadius: 3 },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontSize: 11 }}>
                  {visStatus || (visPhase === 'embed' ? '索引化中…' : '巡回中…')}
                </Typography>
                <Typography sx={{ color: 'light-dark(#0474a9, #7dd3fc)', fontSize: 11, fontWeight: 700 }}>
                  {visPhase === 'embed' && visPct != null ? `${visPct}%` : ''}
                </Typography>
              </Box>
            </Box>
          )}
          </>
        )}

        {entry.kind === 'url' && entry.snapshotHtmlPath && (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, mt: 1 }}>
            ✓ HTMLスナップショット保存済み
          </Typography>
        )}
        {isPdf && entry.lastReadPage != null && entry.totalPages ? (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11, mt: 1 }}>
            読書進捗: {entry.lastReadPage + 1} / {entry.totalPages} ページ
          </Typography>
        ) : null}
        {entry.kind === 'law' && (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11, mt: 1 }}>
            改正施行日 {entry.lawRevisionDate ?? '不明'}・e-Gov法令API（更新確認はビューア内）
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />

      {/* 分類・タグ（右サイドバーから編集） */}
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>分類・タグ</Typography>
          {metaBusy && <CircularProgress size={12} sx={{ color: ACCENT }} />}
        </Box>

        <TextField
          select size="small" fullWidth label="カテゴリ"
          value={entry.category || 'その他'}
          onChange={(e) => handleSetCategory(e.target.value)}
          disabled={metaBusy}
          sx={metaFieldSx}
        >
          {categoryOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        {/* タグ追加 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }}>
          <InputBase
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
            placeholder="タグを追加（Enter / カンマ区切り）"
            sx={{ color: 'var(--brand-fg)', fontSize: 12.5, flex: 1 }}
          />
          <Tooltip title="タグを追加">
            <span>
              <Button size="small" onClick={handleAddTag} disabled={metaBusy || !tagDraft.trim()} sx={{ minWidth: 0, color: ACCENT }}>
                <AddRoundedIcon sx={{ fontSize: 18 }} />
              </Button>
            </span>
          </Tooltip>
        </Box>

        {entry.tags?.length > 0 ? (
          <Box sx={{ mt: 1.25, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {entry.tags.map((t) => (
              <Chip
                key={t} label={t} size="small"
                onDelete={metaBusy ? undefined : () => handleRemoveTag(t)}
                sx={{ height: 24, fontSize: 11, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.75)', '& .MuiChip-deleteIcon': { fontSize: 15, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'light-dark(#ad0e00, #ff8a80)' } } }}
              />
            ))}
          </Box>
        ) : (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 11, mt: 1 }}>タグ未設定</Typography>
        )}
      </Box>

      {!isLocalFile && (
      <>
      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />

      {/* AI Summary (Phase C) */}
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>AI分類・要約</Typography>
          <Tooltip title="AIが本文を読み、カテゴリ・タグ・要約を提案します（クラウド送信）">
            <Button size="small" startIcon={summarizing ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
              disabled={summarizing} onClick={handleSummarize} sx={{ color: ACCENT, fontSize: 12 }}>
              {entry.summary ? '再分類・要約' : 'AIで分類・要約'}
            </Button>
          </Tooltip>
        </Box>
        {entry.summary ? (
          <>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.summary}</Typography>
            {entry.keyPoints?.length > 0 && (
              <Box component="ul" sx={{ pl: 2, mt: 1, mb: 0 }}>
                {entry.keyPoints.map((kp, i) => (
                  <Typography component="li" key={i} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontSize: 12, lineHeight: 1.5 }}>{kp}</Typography>
                ))}
              </Box>
            )}
          </>
        ) : (
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: 12 }}>
            まだ要約されていません。要約はプロジェクトへの紐付けや SEKKEIYA AI の設計提案に使われます。
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />

      {/* Project linking (Phase D) */}
      <Box sx={{ p: 2.5 }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 12, fontWeight: 700, letterSpacing: 0.5, mb: 1 }}>プロジェクト紐付け</Typography>
        <Tooltip title={activeProjectId ? '' : '先にプロジェクトを選択してください'}>
          <span>
            <Button size="small" variant={activeLinked ? 'contained' : 'outlined'} startIcon={<LinkRoundedIcon />}
              disabled={!activeProjectId} onClick={toggleLinkActive}
              sx={activeLinked
                ? { bgcolor: ACCENT, '&:hover': { bgcolor: '#4db6ac' } }
                : { color: ACCENT, borderColor: ACCENT, '&:hover': { borderColor: '#4db6ac' } }}>
              {activeLinked ? '現在のPJに紐付け済み' : '現在のPJに紐付ける'}
            </Button>
          </span>
        </Tooltip>
        {entry.linkedProjectIds.length > 0 && (
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {entry.linkedProjectIds.map((id) => (
              <Typography key={id} noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}>・{projectName(id)}</Typography>
            ))}
          </Box>
        )}
      </Box>
      </>
      )}

      {/* RAG追加の完了/失敗ダイアログ（トーストは4秒で消えて見逃すため、結果は明示的に残す） */}
      <Dialog open={!!ragResult} onClose={() => setRagResult(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 380, maxWidth: 520 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          {ragResult?.ok
            ? <CheckCircleRoundedIcon sx={{ color: '#4ade80' }} />
            : <ErrorOutlineRoundedIcon sx={{ color: 'light-dark(#b3261e, #f87171)' }} />}
          {ragResult?.ok ? 'RAGへの追加が完了しました' : 'RAGへの追加に失敗しました'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 13.5, lineHeight: 1.7, wordBreak: 'break-word' }}>
            {ragResult?.msg}
          </Typography>
          {!ragResult?.ok && (
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 11.5, mt: 1.5, lineHeight: 1.6 }}>
              通信状況を確認して「RAGに追加」を再実行してください。繰り返し失敗する場合は上記のエラー内容をお知らせください。
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button variant="contained" onClick={() => setRagResult(null)}
            sx={{ bgcolor: ragResult?.ok ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.15)', color: 'var(--brand-fg)', '&:hover': { bgcolor: ragResult?.ok ? '#4db6ac' : 'rgb(var(--brand-fg-rgb) / 0.25)' } }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ fontSize: 13 }}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};

const metaFieldSx = {
  '& .MuiInputBase-root': { color: 'var(--brand-fg)' },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
  '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
} as const;
