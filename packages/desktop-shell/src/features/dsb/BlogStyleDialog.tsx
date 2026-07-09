// BlogStyleDialog.tsx — 🎨 ブログのスタイル設定（全記事共通のデザイン）。
// プリセットは文字の説明ではなく「実在の美しい記事」を思わせるミニ誌面プレビューで選ぶ。
// プレビューは articleTheme と同じパレット・書体・見出し装飾で描くため、
// 選んだものがそのままエディタ/公開ページの見え方になる（WYSIWYG な設定画面）。
import React from 'react';
import {
  Box, Typography, TextField, MenuItem, Dialog, DialogContent, DialogActions,
  Button, IconButton, CircularProgress,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { BLOG_STYLE_PRESETS, type BlogStyle } from './types';
import { getArticlePalette, getArticleHeadingFamily } from './articleTheme';

const ACCENT = '#e57373';

// プリセットごとのサンプル誌面。ベンチマークにした実在誌の「らしい」題材で、
// 見出し・リード・要点ボックスがどう組まれるかを一目で伝える。
const SAMPLES: Record<BlogStyle['preset'], {
  benchmark: string;   // お手本にした実在メディア
  kicker: string;
  title: string;
  lead: string;
  h2: string;
  points?: string[];
}> = {
  magazine: {
    benchmark: 'Casa BRUTUS / a+u',
    kicker: 'ARCHITECTURE',
    title: '光の教会——コンクリートに刻まれた十字',
    lead: '大阪・茨木の住宅街に、その教会は静かに建つ。安藤忠雄が選んだのは、装飾を捨て光だけで空間を満たすという決断だった。',
    h2: '暗さが、光を主役にする',
    points: ['開口は十字のスリットのみ', '素材はコンクリートと木だけ'],
  },
  minimal: {
    benchmark: 'Kinfolk',
    kicker: 'LIVING',
    title: '余白と暮らす',
    lead: '持たないことは、選ぶこと。床・壁・光。それだけで構成された住まいには、暮らしの輪郭がはっきりと浮かび上がる。',
    h2: '床・壁・光、それだけの構成',
  },
  tech: {
    benchmark: 'Zenn / Smashing Magazine',
    kicker: 'TUTORIAL',
    title: 'Rhino→Blender レンダリング移行ガイド',
    lead: 'モデリングはRhino、レンダリングはBlender。役割分担を決めると、パース制作のフローは一気に整理できます。',
    h2: '1. エクスポート設定を固める',
    points: ['glTFで書き出す', 'スケールは1:1を維持する'],
  },
  warm: {
    benchmark: '北欧、暮らしの道具店',
    kicker: 'ESSAY',
    title: '北欧の椅子と、10年目の暮らし',
    lead: 'わが家のYチェアは、今日も窓辺にいます。座面のペーパーコードが飴色に変わるまで、家族の時間を支えてくれました。',
    h2: '使い込むほど、家族になる',
  },
};

/** ミニ誌面 — articleTheme と同じパレット/書体/装飾を縮小して描くプリセットの実寸プレビュー。 */
const MiniArticle: React.FC<{ preset: BlogStyle['preset']; accent: string }> = ({ preset, accent }) => {
  const pal = getArticlePalette(preset);
  const head = getArticleHeadingFamily(preset);
  const s = SAMPLES[preset];

  // 見出し装飾（articleTheme の h2 ルールの縮小版）
  const h2Sx: Record<string, any> = {
    magazine: { pt: 0.75, position: 'relative', '&::before': { content: '""', position: 'absolute', top: 0, left: 0, width: 22, height: 2, bgcolor: accent } },
    minimal: { letterSpacing: '0.05em' },
    tech: { pl: 0.75, borderLeft: `2.5px solid ${accent}` },
    warm: { pb: 0.4, borderBottom: `1px dashed ${accent}88`, display: 'inline-block' },
  }[preset];

  return (
    <Box sx={{ bgcolor: pal.bg, px: 2, pt: 1.75, height: 190, overflow: 'hidden', position: 'relative' }}>
      {/* キッカー */}
      {preset === 'magazine' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <Box sx={{ width: 14, height: 2.5, bgcolor: accent }} />
          <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: accent, letterSpacing: '0.3em' }}>{s.kicker}</Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: preset === 'minimal' ? pal.sub : accent, letterSpacing: '0.3em', mb: 0.75 }}>
          {s.kicker}
        </Typography>
      )}
      {/* タイトル */}
      <Typography sx={{ fontFamily: head, fontSize: 13.5, fontWeight: preset === 'minimal' ? 600 : 700, color: pal.heading, lineHeight: 1.45, letterSpacing: '0.02em' }}>
        {s.title}
      </Typography>
      {/* リード */}
      <Typography sx={{ fontSize: 9, lineHeight: 1.9, color: pal.text, mt: 0.9, letterSpacing: '0.02em' }}>
        {s.lead}
      </Typography>
      {/* H2（プリセット固有の装飾） */}
      <Typography sx={{ fontFamily: head, fontSize: 11, fontWeight: 700, color: pal.heading, mt: 1.4, lineHeight: 1.5, ...h2Sx }}>
        {s.h2}
      </Typography>
      {/* 要点ボックス（magazine/tech のみ・blockquote スタイルの縮小版） */}
      {s.points && (
        <Box sx={{
          mt: 1, px: 1.1, py: 0.8, borderRadius: '3px 8px 8px 3px',
          bgcolor: `${accent}0d`, borderLeft: `2px solid ${accent}`,
          ...(preset === 'magazine' ? { border: `1px solid ${accent}2e`, borderLeft: `2px solid ${accent}` } : {}),
        }}>
          {s.points.map((p, i) => (
            <Typography key={p} sx={{ fontSize: 8.5, lineHeight: 1.8, color: pal.text }}>
              <Box component="span" sx={{ color: accent, fontWeight: 800, mr: 0.6 }}>{String(i + 1).padStart(2, '0')}</Box>
              {p}
            </Typography>
          ))}
        </Box>
      )}
      {/* 紙面の続きを感じさせるフェード */}
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, background: `linear-gradient(transparent, ${pal.bg})` }} />
    </Box>
  );
};

interface BlogStyleDialogProps {
  open: boolean;
  saving: boolean;
  style: BlogStyle;
  onChange: (style: BlogStyle) => void;
  onClose: () => void;
  onSave: () => void;
  /** 図解署名のプレースホルダに使う著者名。 */
  authorName?: string | null;
}

export const BlogStyleDialog: React.FC<BlogStyleDialogProps> = ({ open, saving, style, onChange, onClose, onSave, authorName }) => {
  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="md" fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
      <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontWeight: 800, color: ACCENT }}>🎨 ブログのスタイル</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
            全記事に共通の誌面デザイン。エディタの見た目と「✨デザイン」の整形がこの設定に従います
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>
      <DialogContent sx={{ pt: 1 }}>
        {/* プリセット（統一感）— 実在誌ベンチマークのミニ誌面プレビューで選ぶ */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, letterSpacing: 1 }}>スタイルプリセット</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3 }}>
          {(Object.keys(BLOG_STYLE_PRESETS) as BlogStyle['preset'][]).map((key) => {
            const p = BLOG_STYLE_PRESETS[key];
            const on = style.preset === key;
            // 選択中のプリセットは現在のアクセント色、他は各プリセットの既定色でプレビュー
            const previewAccent = on ? (style.accent || p.accent) : p.accent;
            return (
              <Box key={key}
                onClick={() => onChange({ ...style, preset: key, accent: style.accent === BLOG_STYLE_PRESETS[style.preset].accent ? p.accent : style.accent })}
                sx={{
                  borderRadius: 2.5, overflow: 'hidden', cursor: 'pointer',
                  border: on ? `2px solid ${previewAccent}` : '1px solid rgb(var(--brand-fg-rgb) / 0.14)',
                  outline: on ? `1px solid ${previewAccent}55` : 'none', outlineOffset: 2,
                  transition: 'border-color 0.15s',
                  '&:hover': { borderColor: previewAccent },
                }}>
                <MiniArticle preset={key} accent={previewAccent} />
                <Box sx={{ px: 1.5, py: 1.1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: previewAccent, flexShrink: 0 }} />
                    <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 13 }}>{p.label}</Typography>
                    <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 10.5, ml: 'auto' }}>お手本: {SAMPLES[key].benchmark}</Typography>
                  </Box>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 11, mt: 0.4, lineHeight: 1.5 }}>{p.desc}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* 独自性: アクセント色・署名・ビジュアル量・独自指示 */}
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, letterSpacing: 1 }}>アクセント色（見出し・要点ボックス・図解）</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, alignItems: 'center' }}>
          {['#e57373', '#e6a06f', '#64b5f6', '#81c784', '#ba68c8', '#8b919c'].map((c) => (
            <Box key={c} onClick={() => onChange({ ...style, accent: c })}
              sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                border: style.accent === c ? '3px solid #fff' : '2px solid rgb(var(--brand-fg-rgb) / 0.2)' }} />
          ))}
          <TextField size="small" value={style.accent} onChange={(e) => onChange({ ...style, accent: e.target.value })}
            sx={{ width: 110, ml: 1, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 12, '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }} />
        </Box>

        <TextField
          label="図解の署名（あなたのブログ名など）" fullWidth size="small"
          value={style.brandLabel || ''} onChange={(e) => onChange({ ...style, brandLabel: e.target.value })}
          placeholder={`未設定なら著者名（${authorName || 'BLOG'}）`}
          InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
        />

        <TextField
          select label="挿入するビジュアル" fullWidth size="small"
          value={style.visuals} onChange={(e) => onChange({ ...style, visuals: e.target.value as BlogStyle['visuals'] })}
          InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
        >
          <MenuItem value="none">なし（文章の整形のみ）</MenuItem>
          <MenuItem value="slides">図解スライド（節末のまとめ）</MenuItem>
          <MenuItem value="slides+images">図解＋AI画像（冒頭ヒーロー）</MenuItem>
        </TextField>

        <TextField
          label="文体・トーンの独自指示（任意）" fullWidth size="small" multiline rows={2}
          value={style.customNote || ''} onChange={(e) => onChange({ ...style, customNote: e.target.value })}
          placeholder="例: 絵文字は使わない / 専門用語には短い注釈 / 一文は短めに"
          InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={onSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#000' }} /> : undefined}
          sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#ef9a9a' } }}>
          保存（全記事に適用）
        </Button>
      </DialogActions>
    </Dialog>
  );
};
