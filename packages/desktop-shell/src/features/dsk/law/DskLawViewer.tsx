/**
 * DskLawViewer — 法令（kind 'law'）の条文ビューア。
 * 左に章/節TOC、右に条文一覧（条文内フリーワード検索つき）。
 * ヘッダで改正版の更新確認→ワンクリック再取込み。下部に免責を常設。
 * 仕様: docs/22_law_library_spec.md §4.2 / §5
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, IconButton, CircularProgress, Button, InputBase, Tooltip, Chip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import UpdateRoundedIcon from '@mui/icons-material/UpdateRounded';
import type { LibraryEntry } from '../types';
import type { LawDoc, LawArticle } from './lawParse';
import { loadLawDoc, checkLawUpdate, importLawByTitle } from './lawImport';
import { useDskStore } from '../store/useDskStore';

const LAW_COLOR = '#8d6e63';

interface DskLawViewerProps {
  entry: LibraryEntry;
  onClose: () => void;
}

/** 章/節パスでグループ化した条文の塊。 */
interface LawGroup {
  key: string;
  path: string[];
  articles: LawArticle[];
}

function groupArticles(articles: LawArticle[]): LawGroup[] {
  const groups: LawGroup[] = [];
  for (const a of articles) {
    const key = a.path.join(' / ') || '本則';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.articles.push(a);
    else groups.push({ key, path: a.path, articles: [a] });
  }
  return groups;
}

export const DskLawViewer: React.FC<DskLawViewerProps> = ({ entry, onClose }) => {
  const upsert = useDskStore((s) => s.upsert);
  const [doc, setDoc] = useState<LawDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMsg, setBusyMsg] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setError(null);
    loadLawDoc(entry)
      .then((d) => { if (alive) setDoc(d); })
      .catch((e) => { if (alive) setError(e?.message ?? String(e)); });
    return () => { alive = false; };
  }, [entry]);

  const groups = useMemo(() => (doc ? groupArticles(doc.articles) : []), [doc]);

  // フリーワード: 条番号（「28」「第二十八条」）・見出し・本文にマッチする条だけ残す
  const filteredGroups = useMemo(() => {
    const q = query.trim();
    if (!q) return groups;
    const match = (a: LawArticle) =>
      a.title.includes(q) || (a.caption ?? '').includes(q) || a.text.includes(q) || a.num === q;
    return groups
      .map((g) => ({ ...g, articles: g.articles.filter(match) }))
      .filter((g) => g.articles.length > 0);
  }, [groups, query]);

  const totalHits = useMemo(
    () => filteredGroups.reduce((s, g) => s + g.articles.length, 0),
    [filteredGroups],
  );

  const scrollToGroup = (key: string) => {
    const el = contentRef.current?.querySelector(`[data-law-group="${CSS.escape(key)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCheckUpdate = async () => {
    setBusy(true);
    setBusyMsg('更新確認中…');
    try {
      const r = await checkLawUpdate(entry);
      if (r.hasUpdate) {
        setHasUpdate(true);
        setUpdateMsg(`改正版があります（改正施行日 ${r.latestDate}）`);
      } else {
        setHasUpdate(false);
        setUpdateMsg(r.latestDate ? `最新版です（改正施行日 ${r.latestDate}）` : '更新情報を取得できませんでした');
      }
    } catch (e: any) {
      setUpdateMsg(`更新確認に失敗しました: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
      setBusyMsg('');
    }
  };

  const handleReimport = async () => {
    setBusy(true);
    try {
      const { entry: updated } = await importLawByTitle(entry.title, entry, (m) => setBusyMsg(m));
      upsert(updated);
      const d = await loadLawDoc(updated);
      setDoc(d);
      setHasUpdate(false);
      setUpdateMsg(`最新版に更新しました（改正施行日 ${d.revisionDate ?? '不明'}）`);
    } catch (e: any) {
      setUpdateMsg(`再取込みに失敗しました: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
      setBusyMsg('');
    }
  };

  const openEgov = async () => {
    if (!entry.sourceUrl) return;
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(entry.sourceUrl);
    } catch {
      window.open(entry.sourceUrl, '_blank');
    }
  };

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'light-dark(rgba(248,246,243,0.98), rgba(8,12,12,0.96))', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', flexShrink: 0 }}>
        <GavelRoundedIcon sx={{ color: LAW_COLOR, fontSize: 22 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 16, fontWeight: 800 }}>{entry.title}</Typography>
          <Typography noWrap sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 11 }}>
            {entry.author}
            {entry.lawRevisionDate ? `・改正施行日 ${entry.lawRevisionDate}` : ''}
            {doc ? `・本則 全${doc.articles.length}条・取得 ${doc.fetchedAt.slice(0, 10)}` : ''}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {updateMsg && (
          <Chip label={updateMsg} size="small"
            sx={{ height: 22, fontSize: 11, fontWeight: 600, maxWidth: 360,
              bgcolor: hasUpdate ? 'rgba(255,179,0,0.18)' : 'rgb(var(--brand-fg-rgb) / 0.08)',
              color: hasUpdate ? 'light-dark(#8a5b00, #ffd54f)' : 'rgb(var(--brand-fg-rgb) / 0.7)' }} />
        )}
        {hasUpdate ? (
          <Button size="small" variant="contained" disabled={busy}
            startIcon={busy ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <UpdateRoundedIcon />}
            onClick={handleReimport}
            sx={{ bgcolor: LAW_COLOR, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#a1887f' } }}>
            {busy ? (busyMsg || '更新中…') : '最新版に更新'}
          </Button>
        ) : (
          <Button size="small" variant="outlined" disabled={busy}
            startIcon={busy ? <CircularProgress size={14} sx={{ color: LAW_COLOR }} /> : <UpdateRoundedIcon />}
            onClick={handleCheckUpdate}
            sx={{ color: LAW_COLOR, borderColor: `${LAW_COLOR}88`, '&:hover': { borderColor: LAW_COLOR } }}>
            {busy ? (busyMsg || '確認中…') : '更新確認'}
          </Button>
        )}
        {entry.sourceUrl && (
          <Tooltip title="e-Gov 法令検索で開く">
            <IconButton size="small" onClick={openEgov} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
              <OpenInNewRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
        <IconButton onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {/* 本体 */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* TOC */}
        <Box sx={{ width: 280, flexShrink: 0, borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', overflowY: 'auto', py: 1.5 }}>
          {groups.map((g) => (
            <Box key={g.key} onClick={() => scrollToGroup(g.key)}
              sx={{ px: 2, py: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.75)', fontWeight: 600, lineHeight: 1.4 }}>
                {g.path.length ? g.path[g.path.length - 1] : '本則'}
              </Typography>
              {g.path.length > 1 && (
                <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{g.path.slice(0, -1).join(' / ')}</Typography>
              )}
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>{g.articles.length}条</Typography>
            </Box>
          ))}
        </Box>

        {/* 条文 */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* 検索 */}
          <Box sx={{ px: 3, py: 1.25, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', maxWidth: 420, flex: 1 }}>
              <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
              <InputBase value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="条文内を検索（例: 採光 / 第二十八条 / 28）"
                sx={{ color: 'var(--brand-fg)', fontSize: 13, flex: 1 }} />
            </Box>
            {query.trim() && (
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{totalHits}条ヒット</Typography>
            )}
          </Box>

          <Box ref={contentRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 4, py: 2 }}>
            {error ? (
              <Typography sx={{ color: 'light-dark(#b3261e, #ff8a80)', fontSize: 13 }}>{error}</Typography>
            ) : !doc ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress sx={{ color: LAW_COLOR }} />
              </Box>
            ) : (
              filteredGroups.map((g) => (
                <Box key={g.key} data-law-group={g.key} sx={{ mb: 3 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: LAW_COLOR, borderBottom: `1px solid ${LAW_COLOR}44`, pb: 0.5, mb: 1.5, position: 'sticky', top: -16, bgcolor: 'light-dark(rgba(248,246,243,0.98), rgba(8,12,12,0.96))', zIndex: 1 }}>
                    {g.key}
                  </Typography>
                  {g.articles.map((a) => (
                    <Box key={a.num} sx={{ mb: 2.25 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: 'var(--brand-fg)' }}>
                        {a.title}
                        {a.caption && <Box component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontWeight: 600, ml: 0.75 }}>{a.caption}</Box>}
                      </Typography>
                      <Typography sx={{ fontSize: 13, lineHeight: 1.9, color: 'rgb(var(--brand-fg-rgb) / 0.85)', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                        {a.text}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))
            )}
          </Box>

          {/* 免責（常設） */}
          <Box sx={{ px: 3, py: 1, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', lineHeight: 1.5 }}>
              本文は e-Gov 法令検索（法令API）から取得した参考情報です。改正が反映されていない場合があります。
              法適合の最終判断は建築士・特定行政庁・指定確認検査機関にご確認ください。
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
