import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Chip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { DsmtProduct } from '../types';
import { detectManufacturerFromUrl } from '../data/manufacturers';

const ACCENT = '#ec407a';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 取り込んだドラフト商品（複数）を確定。 */
  onImport: (products: DsmtProduct[]) => void;
}

/** URL からホスト名を取り出す（失敗時は空）。 */
function hostOf(url: string): string {
  try { return new URL(url.trim()).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/**
 * URL（複数行）から商品ドラフトを生成するダイアログ。
 * 現状はドメインからメーカーを自動判定し、URL・メーカーを埋めたドラフトを作る（手動補完前提）。
 * 価格・性能の本格的なカタログ自動抽出は AI 抽出サービス接続後に対応予定（試験的）。
 */
export const ProductImportDialog: React.FC<Props> = ({ open, onClose, onImport }) => {
  const [text, setText] = useState('');

  const urls = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));

  const handleImport = () => {
    const products: DsmtProduct[] = urls.map((url) => {
      const host = hostOf(url);
      const maker = detectManufacturerFromUrl(url);
      return {
        id: crypto.randomUUID(),
        manufacturer: maker,
        name: host || '取り込み商品',
        url,
        priceUnit: '㎡',
        source: 'url-import',
      };
    });
    onImport(products);
    setText('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}>
      <DialogTitle sx={{ pb: 1 }}>URL / カタログから取り込み</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 1, p: 1.25, mb: 2, borderRadius: 1.5, bgcolor: 'rgba(66,165,245,0.08)', border: '1px solid rgba(66,165,245,0.25)' }}>
          <InfoOutlinedIcon sx={{ fontSize: 18, color: 'light-dark(#095fa5, #42a5f5)', flexShrink: 0, mt: 0.2 }} />
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.75)', lineHeight: 1.6 }}>
            商品ページ / デジタルカタログの URL を 1 行に 1 つ貼り付けてください。ドメインからメーカーを自動判定し、ドラフトを作成します。
            価格・耐久・防火などの詳細はカード上で補完してください（カタログ本文からの自動抽出は今後 AI 連携で対応予定）。
          </Typography>
        </Box>

        <TextField
          fullWidth multiline minRows={6} placeholder={'https://www.sangetsu.co.jp/...\nhttps://www.lixil.co.jp/...'}
          value={text} onChange={(e) => setText(e.target.value)}
          sx={{ '& .MuiInputBase-input': { color: 'var(--brand-fg)', fontSize: 12.5, fontFamily: 'monospace' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
        />

        {urls.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.75 }}>{urls.length} 件を取り込みます（メーカー自動判定）</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {urls.map((u, i) => {
                const maker = detectManufacturerFromUrl(u);
                return (
                  <Chip key={i} size="small" label={maker || hostOf(u) || 'unknown'}
                    sx={{ height: 22, fontSize: 10.5, color: 'var(--brand-fg)', bgcolor: maker ? `${ACCENT}22` : 'rgb(var(--brand-fg-rgb) / 0.08)', border: `1px solid ${maker ? `${ACCENT}55` : 'rgb(var(--brand-fg-rgb) / 0.18)'}` }} />
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button variant="contained" disabled={urls.length === 0} onClick={handleImport}
          sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#f06292' }, textTransform: 'none' }}>
          {urls.length || ''} 件を取り込む
        </Button>
      </DialogActions>
    </Dialog>
  );
};
