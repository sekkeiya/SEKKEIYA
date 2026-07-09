import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, Box, Typography, IconButton, CircularProgress, Button, Checkbox } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageSearchRoundedIcon from '@mui/icons-material/ImageSearchRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { LensResult, LensDiag } from '../utils/lensResultsSearch';
import { openExternalUrl } from '../utils/productImageSearch';

interface Props {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  error?: string | null;
  queryImage?: string | null;     // クエリ（3Dモデルサムネ）プレビュー
  modelTitle?: string | null;
  results: LensResult[];
  diag?: LensDiag | null;         // 診断情報（商品写真セレクタ特定用）
  lensUrl?: string | null;        // ブラウザで開くフォールバック先
  canRegister: boolean;           // 著者のみ relatedLinks へ登録できる
  registering?: boolean;
  /** 選択したリンクを RELATED URLs として登録する。 */
  onRegister: (links: { title: string; url: string; thumbnail?: string; source?: string }[]) => void;
}

/** Google レンズ逆画像検索の結果を一覧表示し、複数選択して関連URLに登録するダイアログ。 */
export const LensResultsDialog: React.FC<Props> = ({
  open, onClose, busy, error, queryImage, modelTitle, results, diag, lensUrl, canRegister, registering, onRegister,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDiag, setShowDiag] = useState(false);

  // 開き直すたびに選択をリセット。
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, results]);

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const selectedLinks = useMemo(
    () => results.filter((r) => selected.has(r.url)).map((r) => ({ title: r.title || r.source, url: r.url, thumbnail: r.thumbnail || undefined, source: r.source || undefined })),
    [results, selected],
  );

  // サムネがうまく出ていない（半分未満）ときだけ診断を出す。通常時は隠す。
  const thumbCount = useMemo(() => results.filter((r) => r.thumbnail).length, [results]);
  const showDiagSection = !!diag && (results.length === 0 || thumbCount < results.length / 2);

  // 自動登録: サムネ付き（似ている確度が高い）を優先して上位5件まで。
  const AUTO_COUNT = 5;
  const autoLinks = useMemo(() => {
    const withThumb = results.filter((r) => r.thumbnail);
    const pool = withThumb.length >= 3 ? withThumb : results;
    return pool.slice(0, AUTO_COUNT).map((r) => ({ title: r.title || r.source, url: r.url, thumbnail: r.thumbnail || undefined, source: r.source || undefined }));
  }, [results]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: '#0b1220', color: '#e5e7eb', border: '1px solid rgba(148,163,184,0.22)', borderRadius: 2 } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <ImageSearchRoundedIcon sx={{ fontSize: 20, color: '#93c5fd' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Google レンズ 検索結果</Typography>
        <Box sx={{ flex: 1 }} />
        {lensUrl && (
          <Button
            size="small"
            startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={() => openExternalUrl(lensUrl)}
            sx={{ color: '#93c5fd', fontSize: 12, textTransform: 'none', mr: 0.5 }}
          >
            ブラウザで開く
          </Button>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ p: 2.5 }}>
        {/* クエリ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {queryImage && (
            <Box sx={{ width: 64, height: 48, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: 'rgba(255,255,255,0.05)' }}>
              <img src={queryImage} alt="query" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.9)' }}>このモデルに似た商品リンク</Typography>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{modelTitle || '選択中のモデル'}</Typography>
          </Box>
        </Box>

        {busy && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 5, justifyContent: 'center' }}>
            <CircularProgress size={20} sx={{ color: '#93c5fd' }} />
            <Typography sx={{ fontSize: 13, color: 'rgba(229,231,235,0.85)' }}>Google レンズで検索中…（初回はモデル読込に時間がかかります）</Typography>
          </Box>
        )}

        {!busy && error && (
          <Typography sx={{ color: '#fca5a5', fontSize: 13, py: 3, textAlign: 'center', whiteSpace: 'pre-wrap' }}>{error}</Typography>
        )}

        {!busy && !error && results.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'rgba(229,231,235,0.8)' }}>検索結果を取得できませんでした。</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(148,163,184,0.8)', mt: 0.5 }}>
              Google レンズの表示が変わった可能性があります。「ブラウザで開く」から直接ご確認ください。
            </Typography>
          </Box>
        )}

        {!busy && !error && results.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5, maxHeight: '52vh', overflowY: 'auto', pr: 0.5 }}>
            {results.map((r) => {
              const isSel = selected.has(r.url);
              return (
                <Box
                  key={r.url}
                  onClick={() => toggle(r.url)}
                  sx={{
                    position: 'relative', borderRadius: 1.5, overflow: 'hidden',
                    border: isSel ? '1.5px solid #60a5fa' : '1px solid rgba(255,255,255,0.08)',
                    bgcolor: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'border-color 0.15s',
                    '&:hover': { borderColor: isSel ? '#60a5fa' : 'rgba(96,165,250,0.5)' },
                  }}
                >
                  <Checkbox
                    checked={isSel}
                    size="small"
                    sx={{ position: 'absolute', top: 2, left: 2, zIndex: 2, color: 'rgba(255,255,255,0.7)', '&.Mui-checked': { color: '#60a5fa' }, bgcolor: 'rgba(0,0,0,0.35)', p: 0.25, borderRadius: 1 }}
                  />
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); openExternalUrl(r.url); }}
                    sx={{ position: 'absolute', top: 2, right: 2, zIndex: 2, color: '#cbd5e1', bgcolor: 'rgba(0,0,0,0.35)', p: 0.5, '&:hover': { color: '#93c5fd', bgcolor: 'rgba(0,0,0,0.55)' } }}
                  >
                    <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <Box sx={{ aspectRatio: '1/1', bgcolor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {r.thumbnail ? (
                      <img src={r.thumbnail} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                    ) : (
                      <LinkRoundedIcon sx={{ fontSize: 28, color: 'rgba(148,163,184,0.6)' }} />
                    )}
                  </Box>
                  <Box sx={{ p: 1 }}>
                    <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600 }}>{r.title || '(タイトルなし)'}</Typography>
                    <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(148,163,184,0.9)' }}>{r.source}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
        {/* 診断: 商品写真のセレクタ特定用。サムネがうまく出ないときだけ表示する。 */}
        {!busy && showDiagSection && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography
              onClick={() => setShowDiag((v) => !v)}
              sx={{ fontSize: 11, color: 'rgba(148,163,184,0.9)', cursor: 'pointer', userSelect: 'none', '&:hover': { color: '#93c5fd' } }}
            >
              {showDiag ? '▾' : '▸'} 診断情報（サムネが出ないとき開いて内容を共有してください）
            </Typography>
            {showDiag && (
              <Box
                component="pre"
                sx={{
                  mt: 1, p: 1.5, maxHeight: 220, overflow: 'auto', borderRadius: 1,
                  bgcolor: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 10.5, lineHeight: 1.5, color: 'rgba(229,231,235,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}
              >
{`anchors=${diag.anchors} external=${diag.external} withImage=${diag.withImage} ready=${diag.ready}\n` +
 `\n== PHOTOS (商品写真候補 → 解決された外部URL) ==\n` +
 (diag.photos || []).map((p, i) =>
   `[${i}] dim=${p.dim} href=${p.href || '(なし)'}\n     ${p.src}`
 ).join('\n') +
 `\n\n== SAMPLE (外部リンクのカード内画像) ==\n` +
 (diag.sample || []).map((s, i) =>
   `\n[${i}] ${s.href}\n` + (s.imgs || []).map((im) =>
     `  - ${im.t} rw=${im.rw ?? '?'} nw=${im.nw ?? '?'} alt="${im.alt || ''}" ${im.src}`
   ).join('\n')
 ).join('\n')}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {!busy && !error && results.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>{selected.size} 件選択中</Typography>
          {!canRegister && (
            <Typography sx={{ fontSize: 11, color: 'rgba(251,146,60,0.9)' }}>※ 自分のモデルのみ登録できます</Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none', fontSize: 13 }}>キャンセル</Button>
          <Button
            variant="outlined"
            disabled={!canRegister || autoLinks.length === 0 || registering}
            onClick={() => onRegister(autoLinks)}
            startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontSize: 13, color: '#93c5fd', borderColor: 'rgba(96,165,250,0.5)', '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(96,165,250,0.1)' } }}
          >
            上位{autoLinks.length}件を自動登録
          </Button>
          <Button
            variant="contained"
            disabled={!canRegister || selected.size === 0 || registering}
            onClick={() => onRegister(selectedLinks)}
            startIcon={registering ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <LinkRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{ textTransform: 'none', fontSize: 13, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
          >
            選択を登録
          </Button>
        </Box>
      )}
    </Dialog>
  );
};
