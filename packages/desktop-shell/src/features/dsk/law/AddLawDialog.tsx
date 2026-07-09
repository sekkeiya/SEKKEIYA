/**
 * AddLawDialog — e-Gov 法令API から法令を取り込むダイアログ。
 * プリセット（建築基準法体系ほか）の複数選択一括取り込み＋法令名検索からの個別取り込み。
 * 取込済みは改正施行日を表示し、再取込み（更新）も同じ導線で行える。
 * 仕様: docs/22_law_library_spec.md §4
 */
import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Checkbox, CircularProgress, InputBase, Chip, Alert,
} from '@mui/material';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useDskStore } from '../store/useDskStore';
import type { LibraryEntry } from '../types';
import { LAW_PRESETS, importLawByTitle, importLaw } from './lawImport';
import { searchLawsByTitle, type EgovLawSummary } from './egovApi';

const LAW_COLOR = '#8d6e63';

interface AddLawDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AddLawDialog: React.FC<AddLawDialogProps> = ({ open, onClose }) => {
  const entries = useDskStore((s) => s.entries);
  const upsert = useDskStore((s) => s.upsert);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<EgovLawSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<{ sev: 'success' | 'error' | 'info'; msg: string } | null>(null);

  // 取込済み法令: タイトル→エントリ（再取込み時の紐付け維持に使う）
  const lawEntries = useMemo(() => {
    const m = new Map<string, LibraryEntry>();
    for (const e of entries) if (e.kind === 'law') m.set(e.title, e);
    return m;
  }, [entries]);

  const toggle = (title: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setResults(null);
    try {
      setResults(await searchLawsByTitle(q));
    } catch (e: any) {
      setReport({ sev: 'error', msg: `検索に失敗しました: ${e?.message ?? e}` });
    } finally {
      setSearching(false);
    }
  };

  const handleImportSelected = async () => {
    const titles = LAW_PRESETS.map((p) => p.title).filter((t) => selected.has(t));
    if (titles.length === 0 || busy) return;
    setBusy(true);
    setReport(null);
    let ok = 0; let fail = 0; let articles = 0;
    for (const [i, title] of titles.entries()) {
      try {
        const r = await importLawByTitle(title, lawEntries.get(title) ?? null, (m) => setProgress(`(${i + 1}/${titles.length}) ${title}: ${m}`));
        upsert(r.entry);
        ok++; articles += r.articleCount;
      } catch (e) {
        console.error('[AddLawDialog] import failed', title, e);
        fail++;
      }
    }
    setBusy(false);
    setProgress('');
    setSelected(new Set());
    setReport({
      sev: fail ? (ok ? 'info' : 'error') : 'success',
      msg: `取り込み完了: ${ok}法令・${articles}条${fail ? ` / 失敗 ${fail}件` : ''}`,
    });
  };

  const handleImportOne = async (law: EgovLawSummary) => {
    if (busy) return;
    setBusy(true);
    setReport(null);
    try {
      const r = await importLaw(law, lawEntries.get(law.lawTitle) ?? null, (m) => setProgress(`${law.lawTitle}: ${m}`));
      upsert(r.entry);
      setReport({ sev: 'success', msg: `「${law.lawTitle}」を取り込みました（${r.articleCount}条）` });
    } catch (e: any) {
      console.error('[AddLawDialog] import failed', law.lawTitle, e);
      setReport({ sev: 'error', msg: `取り込みに失敗しました: ${e?.message ?? e}` });
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const importedChip = (title: string) => {
    const e = lawEntries.get(title);
    if (!e) return null;
    return (
      <Chip icon={<CheckCircleRoundedIcon sx={{ fontSize: 12, color: '#4ade80 !important' }} />}
        label={`取込済${e.lawRevisionDate ? `（改正 ${e.lawRevisionDate}）` : ''}`} size="small"
        sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(34,197,94,0.14)', color: '#4ade80' }} />
    );
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <GavelRoundedIcon sx={{ color: LAW_COLOR }} />
        法令を取り込む（e-Gov 法令API）
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1.5 }}>
          e-Gov 法令検索の公式APIから現行の条文を条単位で取り込み、「法規」棚に保存します。
          取込済みの法令を選ぶと最新版へ更新されます（プロジェクト紐付けは維持）。
        </Typography>

        {/* プリセット */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase', mb: 0.5 }}>
          建築・設計の主要法令
        </Typography>
        <Box sx={{ border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 1.5, mb: 2 }}>
          {LAW_PRESETS.map((p) => (
            <Box key={p.title} onClick={() => !busy && toggle(p.title)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, cursor: busy ? 'default' : 'pointer',
                borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', '&:last-of-type': { borderBottom: 'none' },
                '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' } }}>
              <Checkbox size="small" checked={selected.has(p.title)} disabled={busy}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&.Mui-checked': { color: LAW_COLOR } }} />
              <Typography sx={{ fontSize: 13, color: 'var(--brand-fg)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
                {p.note && <Box component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11, ml: 0.75 }}>（{p.note}）</Box>}
              </Typography>
              {importedChip(p.title)}
            </Box>
          ))}
        </Box>

        {/* 法令名検索 */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase', mb: 0.5 }}>
          その他の法令を検索
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', flex: 1 }}>
            <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
            <InputBase value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              placeholder="法令名で検索（例: 宅地造成、駐車場法）"
              sx={{ color: 'var(--brand-fg)', fontSize: 13, flex: 1 }} />
          </Box>
          <Button size="small" variant="outlined" disabled={searching || busy || !query.trim()} onClick={handleSearch}
            sx={{ color: LAW_COLOR, borderColor: `${LAW_COLOR}88`, flexShrink: 0, '&:hover': { borderColor: LAW_COLOR } }}>
            {searching ? <CircularProgress size={16} sx={{ color: LAW_COLOR }} /> : '検索'}
          </Button>
        </Box>
        {results && (
          <Box sx={{ border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 1.5, mt: 1, maxHeight: 200, overflowY: 'auto' }}>
            {results.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.45)', p: 1.5 }}>該当する法令がありません。</Typography>
            ) : results.map((r) => (
              <Box key={r.lawId} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75,
                borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', '&:last-of-type': { borderBottom: 'none' } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 12.5, color: 'var(--brand-fg)', fontWeight: 600 }}>{r.lawTitle}</Typography>
                  <Typography noWrap sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                    {r.lawNum}{r.revisionDate ? `・改正施行 ${r.revisionDate}` : ''}
                  </Typography>
                </Box>
                {importedChip(r.lawTitle)}
                <Button size="small" disabled={busy} startIcon={<DownloadRoundedIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => handleImportOne(r)}
                  sx={{ color: LAW_COLOR, fontSize: 11, flexShrink: 0, minWidth: 0 }}>
                  {lawEntries.has(r.lawTitle) ? '更新' : '取り込む'}
                </Button>
              </Box>
            ))}
          </Box>
        )}

        {report && (
          <Alert severity={report.sev} onClose={() => setReport(null)} sx={{ mt: 1.5, fontSize: 12.5, py: 0.25 }}>
            {report.msg}
          </Alert>
        )}
        <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1.5, lineHeight: 1.5 }}>
          ※取得した条文は参考情報です。法適合の最終判断は建築士・特定行政庁・指定確認検査機関にご確認ください。
          附則・告示・条例は対象外です（条例はPDF/URLとして「知識を追加」から登録できます）。
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0, gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>閉じる</Button>
        <Button variant="contained" disabled={busy || selected.size === 0}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: 'var(--brand-fg)' }} /> : <DownloadRoundedIcon />}
          onClick={handleImportSelected}
          sx={{ bgcolor: LAW_COLOR, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#a1887f' },
            '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}>
          {busy ? (progress || '取り込み中…') : `選択を取り込み（${selected.size}）`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
