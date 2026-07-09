import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  InputBase, CircularProgress, Chip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { getLocalKnowledge } from '../../dsk/api/knowledgeApi';
import { getSLibraryEntries } from '../../dsk/lib/sLibraryFiles';
import type { LibraryEntry } from '../../dsk/types';
import { MANUFACTURER_PRESETS, detectManufacturerFromUrl } from '../data/manufacturers';

const ACCENT = '#ec407a';

/** S.Library のエントリ（タイトル/URL）からメーカー名を推定。 */
export function guessManufacturer(entry: { title?: string; url?: string }): string {
  const byUrl = detectManufacturerFromUrl(entry.url || '');
  if (byUrl) return byUrl;
  const title = (entry.title || '').toLowerCase();
  for (const m of MANUFACTURER_PRESETS) {
    const base = m.name.replace(/（.*?）/g, '').toLowerCase();
    if (title.includes(base) || m.domains.some((d) => title.includes(d))) return m.name;
  }
  return '';
}

export interface CatalogPick {
  title: string;
  /** Web URL（url種別） or ローカルファイルパス（pdf/book）。 */
  url: string;
  manufacturer: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (pick: CatalogPick) => void;
}

const kindIcon = (e: LibraryEntry) => {
  if (e.kind === 'url') return <LanguageRoundedIcon sx={{ fontSize: 20, color: '#42a5f5' }} />;
  if (e.kind === 'book') return <MenuBookRoundedIcon sx={{ fontSize: 20, color: '#26a69a' }} />;
  return <PictureAsPdfRoundedIcon sx={{ fontSize: 20, color: '#ef5350' }} />;
};

export const SLibraryCatalogPicker: React.FC<Props> = ({ open, onClose, onPick }) => {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getLocalKnowledge().catch(() => []), getSLibraryEntries().catch(() => [])])
      .then(([curated, confidential]) => {
        if (cancelled) return;
        // カタログとして使えるのは URL / PDF / 書籍（本文・リンクを持つもの）。
        const all = [...curated, ...confidential].filter(
          (e) => e.kind === 'url' || e.kind === 'pdf' || e.kind === 'book',
        );
        setEntries(all);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.title} ${e.category} ${(e.tags || []).join(' ')}`.toLowerCase().includes(q));
  }, [entries, search]);

  const pick = (e: LibraryEntry) => {
    const url = e.sourceUrl || e.filePath || '';
    onPick({ title: e.title, url, manufacturer: guessManufacturer({ title: e.title, url }) });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }}>
      <DialogTitle sx={{ pb: 1 }}>S.Library からカタログを選択</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, mb: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
          <InputBase value={search} onChange={(e) => setSearch(e.target.value)} placeholder="タイトル・カテゴリ・タグで検索" sx={{ color: '#fff', fontSize: 13, flex: 1 }} />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', py: 3, textAlign: 'center' }}>
            S.Library に PDF / Web のカタログがありません。先に S.Library へ電子カタログを登録するか、保存先ローカルフォルダに PDF を置いてください。
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 360, overflowY: 'auto' }}>
            {filtered.map((e) => {
              const maker = guessManufacturer({ title: e.title, url: e.sourceUrl || e.filePath || '' });
              return (
                <Box key={e.localId} onClick={() => pick(e)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.25, cursor: 'pointer',
                    bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(236,64,122,0.06)' } }}>
                  {kindIcon(e)}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{e.title}</Typography>
                    <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>{e.sourceUrl || e.relPath || e.category}</Typography>
                  </Box>
                  {e.isConfidential && <FolderRoundedIcon sx={{ fontSize: 14, color: '#26a69a' }} />}
                  {maker && <Chip size="small" label={maker} sx={{ height: 20, fontSize: 10, color: '#fff', bgcolor: `${ACCENT}22`, border: `1px solid ${ACCENT}55` }} />}
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
