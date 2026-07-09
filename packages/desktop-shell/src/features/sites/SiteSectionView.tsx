import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, TextField, Chip, Button } from '@mui/material';
import { keyframes } from '@emotion/react';
import { motion } from 'framer-motion';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';

import type { SiteSection, SiteSectionVariant, SiteAssetRef, UnitRow, UnitPickerEntry, ServiceCard } from '../projects/types';
import { SECTION_META } from './siteTemplates';
import type { EditorialTheme } from './editorialThemes';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import { SECTION_PY, HERO_PY, HERO_MINH, MEASURE, PAGE_PX, TYPE, LEADING, TRACK, RATIO } from './designTokens';
import type { MotionConfig } from './designTokens';
import { ChartView, ChartLegend } from './ChartView';
import { WorksGrid } from './WorksGrid';
import { BlogIndex } from './BlogIndex';
import { ProjectLinkSection } from './ProjectLinkSection';
import { CreatorGenres, CreatorModels, ProfileStats } from './ProfileSections';
import { HeroLayoutScene } from './HeroLayoutScene';
import { SiteScroll3DScene } from './SiteScroll3DScene';

interface Props {
  section: SiteSection;
  mode: 'edit' | 'preview';
  selected: boolean;
  theme: EditorialTheme;
  projectName: string;
  /** プロジェクトサイトのとき、S.Layout レンダー取得に使う projectId。 */
  projectId?: string;
  onSelect: () => void;
  onUpdate: (patch: Partial<SiteSection>) => void;
  onRemove: () => void;
  onRemoveAsset: (refId: string) => void;
  onFillSample?: () => void;
  dragHandleProps?: Record<string, any>;
  /** スクロール連動アニメの基準（中央スクロール領域）。 */
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  /** 解決済みモーション設定（強度・パララックス・clip）。 */
  motion?: MotionConfig;
  /** サイト設定で指定したバナー画像 URL（ヒーロー画像が無い場合のフォールバック）。 */
  bannerUrl?: string;
}

// ヒーロー画像のゆっくりズーム（Ken Burns）
const kenburns = keyframes`from { transform: scale(1); } to { transform: scale(1.08); }`;

/**
 * タイトル入力フィールド。モジュールレベルで定義することで React が毎回同一の
 * コンポーネント型と認識し、親の再レンダリング時でもアンマウント→再マウントが
 * 発生せず、カーソル位置を維持できる。
 */
/**
 * テキスト入力共通フック。
 * - onChange: isEditing=true → onDirty()（dirty フラグのみ, site は更新しない）
 * - onBlur:   isEditing=false → onCommit()（store の site を更新）
 * - useEffect: 編集中でないときのみ外部変更を反映（カーソル保護）
 */
function useInlineEditor(committedValue: string) {
  const [value, setValue] = useState(committedValue);
  const committed = useRef(committedValue);
  const isEditing = useRef(false);

  useEffect(() => {
    // 編集中でないとき（blur 後 or 外部変更）のみ外部 committedValue を反映
    if (!isEditing.current && committedValue !== committed.current) {
      committed.current = committedValue;
      setValue(committedValue);
    }
  }, [committedValue]);

  return { value, setValue, committed, isEditing };
}

const SectionTitleEditor = React.memo(function SectionTitleEditor({
  committedValue, onCommit, onDirty, placeholder, inputSx, fieldSx,
}: {
  committedValue: string;
  onCommit: (v: string) => void;
  onDirty: () => void;
  placeholder: string;
  inputSx: object;
  fieldSx?: object;
}) {
  const { value, setValue, committed, isEditing } = useInlineEditor(committedValue);

  return (
    <TextField
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        isEditing.current = true;
        setValue(v);
        onDirty();  // dirty フラグだけ立てる（site は変更しない → 親の再レンダリングなし）
      }}
      onBlur={() => {
        isEditing.current = false;
        if (value !== committed.current) { committed.current = value; onCommit(value); }
      }}
      onClick={(e) => e.stopPropagation()}
      variant="standard"
      fullWidth
      placeholder={placeholder}
      InputProps={{ disableUnderline: true, sx: inputSx }}
      sx={fieldSx}
    />
  );
});

/** 本文入力フィールド。SectionTitleEditor と同じ理由でモジュールレベルに配置。 */
const SectionBodyEditor = React.memo(function SectionBodyEditor({
  committedValue, onCommit, onDirty, inputSx,
}: {
  committedValue: string;
  onCommit: (v: string) => void;
  onDirty: () => void;
  inputSx: object;
}) {
  const { value, setValue, committed, isEditing } = useInlineEditor(committedValue);

  return (
    <TextField
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        isEditing.current = true;
        setValue(v);
        onDirty();
      }}
      onBlur={() => {
        isEditing.current = false;
        if (value !== committed.current) { committed.current = value; onCommit(value); }
      }}
      onClick={(e) => e.stopPropagation()}
      variant="standard"
      fullWidth
      multiline
      placeholder="説明テキストを入力（任意）"
      InputProps={{ disableUnderline: true, sx: inputSx }}
    />
  );
});

/** キッカー（上部小見出し）エディタ。モジュールレベルで定義。 */
const SectionKickerEditor = React.memo(function SectionKickerEditor({
  committedValue, onCommit, onDirty, placeholder, inputSx,
}: {
  committedValue: string;
  onCommit: (v: string) => void;
  onDirty: () => void;
  placeholder: string;
  inputSx: object;
}) {
  const { value, setValue, committed, isEditing } = useInlineEditor(committedValue);

  return (
    <TextField
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        isEditing.current = true;
        setValue(v);
        onDirty();
      }}
      onBlur={() => {
        isEditing.current = false;
        if (value !== committed.current) { committed.current = value; onCommit(value); }
      }}
      onClick={(e) => e.stopPropagation()}
      variant="standard"
      fullWidth
      placeholder={placeholder}
      InputProps={{ disableUnderline: true, sx: inputSx }}
    />
  );
});

/** ウォークスルー共有 URL の入力。S.Layout の「共有」で作った URL を貼り付けて埋め込む。 */
const WalkthroughUrlEditor = React.memo(function WalkthroughUrlEditor({
  theme, onApply,
}: { theme: EditorialTheme; onApply: (url: string) => void }) {
  const [val, setVal] = useState('');
  const trimmed = val.trim();
  const looksValid = /^https?:\/\//i.test(trimmed) && /\/layout\/share\//i.test(trimmed);
  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{
        width: '100%', aspectRatio: '16 / 9', borderRadius: 2, border: `1px dashed ${theme.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3, textAlign: 'center',
      }}
    >
      <Typography sx={{ color: theme.text, fontWeight: 700, fontFamily: theme.bodyFamily }}>本番プレビューを埋め込む</Typography>
      <Typography sx={{ color: theme.subtext, fontSize: '0.8rem', fontFamily: theme.bodyFamily }}>
        S.Layout の「共有」で作成したリンクを貼り付けてください
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, width: '100%', maxWidth: 520 }}>
        <TextField
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://sekkeiya.com/layout/share/..."
          size="small" fullWidth
          sx={{ '& .MuiOutlinedInput-root': { color: theme.text } }}
        />
        <Button
          variant="contained" disabled={!looksValid}
          onClick={() => onApply(trimmed)}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: theme.accent, whiteSpace: 'nowrap', '&:hover': { bgcolor: theme.accent, filter: 'brightness(1.1)' } }}
        >
          埋め込む
        </Button>
      </Box>
      {trimmed && !looksValid && (
        <Typography sx={{ color: '#e57373', fontSize: '0.72rem' }}>共有リンク（/layout/share/...）の URL を入力してください</Typography>
      )}
    </Box>
  );
});

// hero-scroll3d 用：スクロール連動3Dの glTF/glb モデルURLを設定するエディタ。
// 既定値（現在のURL）を初期表示し、空で適用するとプロシージャル表示に戻す。
const Scroll3DModelEditor = React.memo(function Scroll3DModelEditor({
  theme, current, onApply,
}: { theme: EditorialTheme; current: string; onApply: (url: string) => void }) {
  const [val, setVal] = useState(current);
  const trimmed = val.trim();
  const looksValid = trimmed === '' || (/^https?:\/\//i.test(trimmed) && /\.(glb|gltf)(\?|#|$)/i.test(trimmed));
  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, borderRadius: 1.5,
        bgcolor: 'rgba(0,0,0,0.6)', border: `1px solid ${theme.border}`, backdropFilter: 'blur(4px)', maxWidth: 420 }}
    >
      <Typography sx={{ color: '#fff', fontSize: '0.72rem', fontWeight: 700, fontFamily: theme.bodyFamily }}>
        3Dモデル（glb/gltf URL）
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="https://.../model.glb（空でプロシージャル）"
          size="small" fullWidth
          sx={{ '& .MuiOutlinedInput-root': { color: '#fff', fontSize: '0.8rem' } }}
        />
        <Button
          variant="contained" disabled={!looksValid}
          onClick={() => onApply(trimmed)}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: theme.accent, whiteSpace: 'nowrap', '&:hover': { bgcolor: theme.accent, filter: 'brightness(1.1)' } }}
        >
          適用
        </Button>
      </Box>
      {!looksValid && (
        <Typography sx={{ color: '#e57373', fontSize: '0.68rem' }}>glb / gltf の URL を入力してください（空欄でプロシージャル表示）</Typography>
      )}
    </Box>
  );
});

function effectiveVariant(section: SiteSection): SiteSectionVariant {
  if (section.variant) return section.variant;
  switch (section.type) {
    case 'hero': return 'hero-fullbleed';
    case 'overview': case 'custom': return 'lead';
    default: return 'feature';
  }
}

export const SiteSectionView: React.FC<Props> = ({
  section, mode, selected, theme, projectName, projectId,
  onSelect, onUpdate, onRemove, onRemoveAsset, onFillSample, dragHandleProps, scrollRootRef,
  motion: motionCfg, bannerUrl,
}) => {
  // 解決済みモーション（未指定時は静的扱い）
  const mo = motionCfg ?? { enabled: false, reveal: 0, durMs: 0, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], parallax: 0, clip: false, extra: false, smooth: false, mode: 'still' as const };
  const reveals = mode === 'preview' && mo.reveal > 0;
  const parallaxOn = mode === 'preview' && mo.parallax > 0;
  const meta = SECTION_META[section.type];
  const isEdit = mode === 'edit';
  const isHero = section.type === 'hero';
  const variant = effectiveVariant(section);
  const airy = theme.airy;
  const secPy = { xs: SECTION_PY.xs * airy, md: SECTION_PY.md * airy };
  const heroPy = { xs: HERO_PY.xs * airy, md: HERO_PY.md * airy };

  const committedTitle = section.title ?? '';
  const committedBody = section.body ?? '';
  const commitTitle = (v: string) => onUpdate({ title: v });
  const commitBody = (v: string) => onUpdate({ body: v });
  const committedKicker = section.kicker ?? '';
  const commitKicker = (v: string) => onUpdate({ kicker: v });
  // onChange 時は site を変更せず dirty フラグだけ立てる（再レンダリング連鎖を防ぎカーソル保護）
  const markDirty = useProjectSiteStore(s => s.markDirty);

  if (mode === 'preview' && section.hidden) return null;

  const kickerLabel = meta.label;
  const showKicker = !isHero && kickerLabel && kickerLabel !== (section.title ?? '');
  const realAssets = section.assetRefs.filter(a => a.thumbnailUrl && !a.placeholder);
  const coverAsset = realAssets[0] || section.assetRefs[0];

  // 背景色の明暗を判定（EditorialTheme には mode が無いため bg の輝度から推定）
  const isDarkTheme = (() => {
    const hex = (theme.bg || '').trim().replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return false;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128;
  })();

  // 構造化セクションの装飾的見せ方（variant が st-* のとき外枠へ適用）
  const treatmentSx: Record<string, any> = (() => {
    switch (section.variant) {
      case 'st-center':   return { textAlign: 'center' };
      case 'st-surface':  return { bgcolor: theme.surface };
      case 'st-inverted': return { bgcolor: isDarkTheme ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)' };
      case 'st-boxed':    return { border: `1px solid ${theme.border}`, borderRadius: 2, mx: { xs: 1.5, md: 4 }, my: 2 };
      case 'st-divided':  return { borderTop: `2px solid ${theme.accent}` };
      case 'st-accent':   return { borderLeft: `3px solid ${theme.accent}` };
      case 'st-spacious': return { py: { xs: 3, md: 6 } };
      case 'st-rule':     return { borderTop: `1px solid ${theme.text}`, borderBottom: `1px solid ${theme.text}` };
      case 'st-quiet':    return { bgcolor: isDarkTheme ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', opacity: 0.96 };
      default:            return {};
    }
  })();

  /* ---------- 小要素 ---------- */

  const Kicker = ({ onLight }: { onLight: boolean }) => (
    isEdit ? (
      showKicker && (
        <SectionKickerEditor
          committedValue={committedKicker}
          onCommit={commitKicker}
          onDirty={markDirty}
          placeholder={meta.label}
          inputSx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, fontWeight: 600, letterSpacing: theme.kickerUppercase ? TRACK.kickerWide : TRACK.kickerNarrow, textTransform: theme.kickerUppercase ? 'uppercase' : 'none', color: onLight ? theme.subtext : 'rgba(255,255,255,0.7)' }}
        />
      )
    ) : (
      showKicker ? (
        <Typography data-motion-kicker sx={{
          fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, fontWeight: 600, mb: 2,
          letterSpacing: theme.kickerUppercase ? TRACK.kickerWide : TRACK.kickerNarrow,
          textTransform: theme.kickerUppercase ? 'uppercase' : 'none',
          color: onLight ? theme.subtext : 'rgba(255,255,255,0.7)',
        }}>
          {kickerLabel}
        </Typography>
      ) : null
    )
  );

  type HSize = 'displayXL' | 'display' | 'h2';
  const Heading = ({ size, display, onLight }: { size: HSize; display?: boolean; onLight: boolean }) => {
    const fontSize = size === 'displayXL' ? TYPE.displayXL : size === 'display' ? TYPE.display : TYPE.h2;
    const family = display ? theme.displayFamily : theme.headingFamily;
    const weight = display ? theme.headingWeight : Math.min(theme.headingWeight + 100, 800);
    const lineHeight = size === 'h2' ? LEADING.heading : LEADING.display;
    const mb = size === 'h2' ? 2 : 3;
    if (isEdit) {
      return (
        <SectionTitleEditor
          committedValue={committedTitle}
          onCommit={commitTitle}
          onDirty={markDirty}
          placeholder={isHero ? projectName : meta.label}
          inputSx={{ fontFamily: family, fontWeight: weight, letterSpacing: theme.headingLetterSpacing, lineHeight, color: onLight ? theme.text : '#fff', fontSize }}
          fieldSx={{ mb }}
        />
      );
    }
    return (
      <Typography data-motion-heading sx={{
        fontFamily: family, fontWeight: weight, letterSpacing: theme.headingLetterSpacing,
        lineHeight, color: onLight ? theme.text : '#fff', wordBreak: 'break-word', mb, fontSize,
      }}>
        {(section.title && section.title.trim()) || (isHero ? projectName : meta.label)}
      </Typography>
    );
  };

  const BodyText = ({ onLight, large }: { onLight: boolean; large?: boolean }) => {
    if (isEdit) {
      return (
        <SectionBodyEditor
          committedValue={committedBody}
          onCommit={commitBody}
          onDirty={markDirty}
          inputSx={{ fontFamily: theme.bodyFamily, lineHeight: LEADING.body, color: onLight ? theme.subtext : 'rgba(255,255,255,0.82)', fontSize: large ? TYPE.bodyLg : TYPE.body }}
        />
      );
    }
    if (!committedBody || !committedBody.trim()) return null;
    return (
      <Typography sx={{
        fontFamily: theme.bodyFamily, lineHeight: LEADING.body, whiteSpace: 'pre-wrap',
        color: onLight ? theme.subtext : 'rgba(255,255,255,0.82)',
        fontSize: large ? TYPE.bodyLg : TYPE.body,
      }}>
        {committedBody}
      </Typography>
    );
  };

  const AssetTile = ({ ref: a, i, ratio, rounded = false }: { ref: SiteAssetRef; i: number; ratio?: string; rounded?: boolean }) => (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: rounded ? 0.5 : 0, bgcolor: theme.surface, aspectRatio: ratio || RATIO.card, border: `1px solid ${theme.border}`,
      '& img, & video': { transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }, '&:hover img': { transform: 'scale(1.05)' } }}>
      {a.videoUrl ? (
        <Box component="video" src={a.videoUrl} poster={a.thumbnailUrl || undefined}
          muted loop playsInline autoPlay controls={mode === 'preview'}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : a.thumbnailUrl && !a.placeholder ? (
        <Box component="img" src={a.thumbnailUrl} alt={a.title || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <Box sx={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 0.75,
          background: `linear-gradient(135deg, ${theme.accent}22 0%, ${theme.surface} ${45 + (i % 3) * 12}%, ${theme.accent}11 100%)`,
          color: theme.subtext,
        }}>
          <ImageRoundedIcon sx={{ fontSize: 30, opacity: 0.55 }} />
          {a.placeholder && <Chip label="プレースホルダ" size="small" sx={{ height: 17, fontSize: '0.54rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.18)', color: theme.subtext }} />}
        </Box>
      )}
      {isEdit && a.sample && (
        <Chip label="サンプル" size="small" sx={{ position: 'absolute', top: 6, left: 6, height: 17, fontSize: '0.54rem', fontWeight: 800, bgcolor: 'rgba(0,0,0,0.6)', color: '#ffd36b' }} />
      )}
      {isEdit && (
        <Tooltip title="この素材を外す">
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onRemoveAsset(a.id); }}
            sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', '&:hover': { bgcolor: 'rgba(200,60,40,0.8)' } }}>
            <CloseRoundedIcon sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );

  const Caption = ({ a, onLight }: { a: SiteAssetRef; onLight: boolean }) => (
    a.title ? (
      <Typography sx={{ mt: 1.25, fontFamily: theme.bodyFamily, fontSize: TYPE.caption, color: onLight ? theme.subtext : 'rgba(255,255,255,0.6)', letterSpacing: '0.02em' }}>
        {a.title}
      </Typography>
    ) : null
  );

  const SectionHeader = ({ onLight }: { onLight: boolean }) => (
    <Box sx={{ mb: { xs: 4, md: 6 }, maxWidth: MEASURE.text }}>
      {Kicker({ onLight })}
      {Heading({ size: 'h2', onLight })}
      {BodyText({ onLight })}
    </Box>
  );

  const emptyAssetPrompt = isEdit && !meta.textOnly && section.assetRefs.length === 0 ? (
    <Box onClick={(e) => { e.stopPropagation(); onSelect(); }}
      sx={{ p: 5, textAlign: 'center', border: `1px dashed ${selected ? theme.accent : theme.border}`, color: theme.subtext, borderRadius: 0.5 }}>
      <ImageRoundedIcon sx={{ fontSize: 30, mb: 1, opacity: 0.5 }} />
      <Typography sx={{ fontSize: '0.85rem', mb: 1.5, fontFamily: theme.bodyFamily }}>{selected ? '右の素材パネルから追加' : 'クリックして選択 → 素材を追加'}</Typography>
      {onFillSample && (
        <Box component="button" onClick={(e) => { e.stopPropagation(); onFillSample(); }}
          sx={{ cursor: 'pointer', border: `1px solid ${theme.accent}`, background: 'transparent', color: theme.accent, fontWeight: 700, fontSize: '0.78rem', px: 1.5, py: 0.5, borderRadius: 0.5, fontFamily: theme.bodyFamily }}>
          サンプルを入れる
        </Box>
      )}
    </Box>
  ) : null;

  // スクロール連動リビール（プレビュー時のみ。強度は人格/オーバーライドの MotionConfig で決まる）
  // clip: 画像を内包するセクションで cinematic/experimental のとき clip-path で「開く」
  const Reveal = ({ children, clip }: { children: React.ReactNode; clip?: boolean }) => {
    if (!reveals) return <>{children}</>;
    const useClip = clip && mo.clip;
    const initial: Record<string, unknown> = { opacity: 0, y: mo.reveal };
    const animate: Record<string, unknown> = { opacity: 1, y: 0 };
    if (mo.extra) { initial.scale = 0.972; animate.scale = 1; }
    if (useClip) { initial.clipPath = 'inset(14% 0% 14% 0%)'; animate.clipPath = 'inset(0% 0% 0% 0%)'; }
    return (
      <motion.div
        initial={initial}
        whileInView={animate}
        transition={{ duration: mo.durMs / 1000, ease: mo.ease }}
        viewport={{ root: scrollRootRef as any, once: true, amount: 0.15 }}
      >
        {children}
      </motion.div>
    );
  };

  /* ---------- variant 本体 ---------- */

  const renderContent = () => {
    // ===== 構造化セクション（提案書の部品 / 実績） =====
    if (section.type === 'projectlink' && section.projectRef) {
      return <ProjectLinkSection theme={theme} refData={section.projectRef} secPy={secPy} />;
    }

    // ===== ウォークスルー（共有リンクを iframe 埋め込み・操作可能） =====
    if (section.type === 'walkthrough') {
      const url = String(section.embedUrl || '').trim();
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          {url ? (
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 2, overflow: 'hidden', border: `1px solid ${theme.border}`, bgcolor: '#0b1020' }}>
              <Box
                component="iframe"
                src={url}
                title="本番プレビュー"
                allow="fullscreen; pointer-lock; accelerometer; gyroscope; xr-spatial-tracking"
                allowFullScreen
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              />
              {mode === 'edit' && (
                <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1, zIndex: 2 }}>
                  <Button size="small" variant="contained" sx={{ textTransform: 'none', bgcolor: 'rgba(0,0,0,0.6)' }}
                    onClick={(e) => { e.stopPropagation(); onUpdate({ embedUrl: '' }); }}>
                    リンクを変更
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            mode === 'edit'
              ? <WalkthroughUrlEditor theme={theme} onApply={(u) => onUpdate({ embedUrl: u })} />
              : (
                <Box sx={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 2, border: `1px dashed ${theme.border}`, display: 'grid', placeItems: 'center', color: theme.subtext }}>
                  <Typography sx={{ fontFamily: theme.bodyFamily }}>本番プレビューが設定されていません</Typography>
                </Box>
              )
          )}
          {section.body && (
            <Typography sx={{ mt: 2, color: theme.subtext, fontFamily: theme.bodyFamily, whiteSpace: 'pre-wrap' }}>{section.body}</Typography>
          )}
        </Box>
      );
    }

    if (section.type === 'works') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <WorksGrid theme={theme} scope={section.worksScope ?? 'all'} />
        </Box>
      );
    }

    if (section.type === 'blog') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <BlogIndex theme={theme} variant={section.variant} resolved={section.resolvedBlog} />
        </Box>
      );
    }

    if (section.type === 'usergenres') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <CreatorGenres theme={theme} />
        </Box>
      );
    }

    if (section.type === 'usermodels') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <CreatorModels theme={theme} />
        </Box>
      );
    }

    if (section.type === 'profilestats') {
      return (
        <Box sx={{ px: PAGE_PX, py: { xs: secPy.xs * 0.6, md: secPy.md * 0.5 }, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <ProfileStats theme={theme} />
        </Box>
      );
    }

    if (section.type === 'target') {
      const data = section.chartData ?? [];
      const chartType = section.chartType ?? 'donut';
      const unit = chartType === 'radar' ? '' : '%';
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: { xs: 3, md: 6 }, alignItems: 'center' }}>
            <Box><ChartView type={chartType} data={data} theme={theme} /></Box>
            <Box><ChartLegend data={data} theme={theme} unit={unit} /></Box>
          </Box>
        </Box>
      );
    }

    if (section.type === 'concept') {
      const words = section.keywords ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: { xs: secPy.xs * 1.2, md: secPy.md * 1.2 }, maxWidth: 1100, mx: 'auto' }}>
          {Kicker({ onLight: true })}
          {words.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, md: 3 }, mb: 4 }}>
              {words.map((w, i) => (
                <Typography key={i} sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.1, color: i % 2 === 0 ? theme.text : theme.accent, fontSize: { xs: '2rem', md: '3.4rem' } }}>
                  {w}
                </Typography>
              ))}
            </Box>
          )}
          <Box sx={{ maxWidth: MEASURE.text }}>{BodyText({ onLight: true, large: true })}</Box>
        </Box>
      );
    }

    if (section.type === 'process') {
      const steps = section.steps ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 980, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ position: 'relative', pl: { xs: 3, md: 4 } }}>
            <Box sx={{ position: 'absolute', left: { xs: 7, md: 9 }, top: 6, bottom: 6, width: 2, bgcolor: theme.border }} />
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={reveals ? { opacity: 0, x: 18 } : false}
                whileInView={reveals ? { opacity: 1, x: 0 } : undefined}
                transition={{ duration: 0.55, delay: i * 0.05, ease: mo.ease }}
                viewport={{ root: scrollRootRef as any, once: true, amount: 0.4 }}
              >
                <Box sx={{ position: 'relative', pb: { xs: 4, md: 5 } }}>
                  <Box sx={{ position: 'absolute', left: { xs: -24, md: -31 }, top: 4, width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, borderRadius: '50%', bgcolor: theme.bg, border: `2px solid ${theme.accent}` }} />
                  {s.phase && <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, textTransform: 'uppercase', color: theme.accent, mb: 0.75 }}>{s.phase}</Typography>}
                  <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.3rem' }, color: theme.text, mb: 0.75 }}>{s.title}</Typography>
                  {s.body && <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.9rem', lineHeight: 1.85, color: theme.subtext, maxWidth: 620 }}>{s.body}</Typography>}
                </Box>
              </motion.div>
            ))}
          </Box>
        </Box>
      );
    }

    if (section.type === 'references') {
      const refs = section.references ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 900, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ borderTop: `1px solid ${theme.border}` }}>
            {refs.map((r, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 1.5, py: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${theme.border}` }}>
                <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.8rem', fontWeight: 700, color: theme.subtext }}>[{i + 1}]</Typography>
                <Box>
                  <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.92rem', color: theme.text }}>{r.title}</Typography>
                  {r.url && (
                    <Typography component="a" href={r.url} target="_blank" rel="noreferrer"
                      sx={{ display: 'inline-block', mt: 0.25, fontFamily: theme.bodyFamily, fontSize: '0.78rem', color: theme.accent, wordBreak: 'break-all', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {r.url}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    if (section.type === 'spec' || section.type === 'regulation') {
      const rows = section.specRows ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 980, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ borderTop: `1px solid ${theme.border}` }}>
            {rows.map((r, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1.4fr', md: '260px 1fr' }, gap: 2, py: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${theme.border}` }}>
                <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.76rem', letterSpacing: '0.08em', color: theme.subtext, textTransform: theme.kickerUppercase ? 'uppercase' : 'none' }}>{r.label}</Typography>
                <Typography sx={{ fontFamily: theme.headingFamily, fontSize: { xs: '0.98rem', md: '1.15rem' }, color: theme.text }}>{r.value}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    if (section.type === 'itemspec') {
      const items = section.items ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1000, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ borderTop: `1px solid ${theme.border}` }}>
            {items.map((it, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 64px', md: '1.2fr 1.4fr 80px' }, gap: 2, alignItems: 'baseline', py: { xs: 1.5, md: 1.75 }, borderBottom: `1px solid ${theme.border}` }}>
                <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>{it.name}</Typography>
                <Typography sx={{ display: { xs: 'none', md: 'block' }, fontFamily: theme.bodyFamily, fontSize: '0.84rem', color: theme.subtext }}>{it.spec}</Typography>
                <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.82rem', color: theme.accent, textAlign: 'right', fontWeight: 700 }}>{it.qty}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    if (section.type === 'comparison') {
      const cols = section.columns ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1100, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.max(cols.length, 1)}, 1fr)` }, gap: 2.5 }}>
            {cols.map((c, i) => (
              <Box key={i} sx={{ border: `1px solid ${theme.border}`, bgcolor: theme.surface, p: { xs: 2, md: 3 } }}>
                <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, fontSize: '1.4rem', color: theme.text, mb: 2, letterSpacing: theme.headingLetterSpacing }}>{c.title}</Typography>
                {c.rows.map((r, j) => (
                  <Box key={j} sx={{ py: 1, borderTop: j === 0 ? `1px solid ${theme.border}` : 'none', borderBottom: `1px solid ${theme.border}` }}>
                    <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.9rem', color: theme.text }}>{r}</Typography>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      );
    }

    // ===== unitlist（部屋一覧）=====
    if (section.type === 'unitlist') {
      const units: UnitRow[] = section.units ?? [];
      const statusColor = (s: UnitRow['status']) =>
        s === 'available' ? theme.accent : s === 'reserved' ? '#f59e0b' : theme.subtext;
      const statusLabel = (s: UnitRow['status']) =>
        s === 'available' ? '販売中' : s === 'reserved' ? '商談中' : '成約済';
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
            {units.map((u) => (
              <Box key={u.id} sx={{ border: `1px solid ${theme.border}`, bgcolor: theme.surface, p: { xs: 2, md: 2.5 }, opacity: u.status === 'sold' ? 0.55 : 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: 700, fontSize: '1rem', color: theme.text }}>{u.name}</Typography>
                  <Box sx={{ px: 1, py: 0.25, border: `1px solid ${statusColor(u.status)}`, borderRadius: 0.5 }}>
                    <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.68rem', fontWeight: 800, color: statusColor(u.status), letterSpacing: '0.06em' }}>{statusLabel(u.status)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mb: 1.5 }}>
                  {[
                    { k: '間取り', v: u.rooms },
                    { k: '階数', v: `${u.floor}F` },
                    { k: '専有面積', v: `${u.area} ㎡` },
                    ...(u.balconyArea ? [{ k: 'バルコニー', v: `${u.balconyArea} ㎡` }] : []),
                  ].map(({ k, v }) => (
                    <Box key={k}>
                      <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.66rem', color: theme.subtext, letterSpacing: '0.06em' }}>{k}</Typography>
                      <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.9rem', color: theme.text, fontWeight: 600 }}>{v}</Typography>
                    </Box>
                  ))}
                </Box>
                {u.price && (
                  <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, fontSize: '1.1rem', color: theme.accent }}>{u.price}</Typography>
                )}
              </Box>
            ))}
          </Box>
          {units.length === 0 && isEdit && (
            <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.border}`, color: theme.subtext }}>
              <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.85rem' }}>SEKKEIYA Chat で「部屋を追加して」と伝えると住戸データを入力できます</Typography>
            </Box>
          )}
        </Box>
      );
    }

    // ===== unitpicker（区画セレクター）=====
    if (section.type === 'unitpicker') {
      const entries: UnitPickerEntry[] = section.unitEntries ?? [];
      const img = section.assetRefs[0];
      const statusColor = (s: UnitPickerEntry['status']) =>
        s === 'available' ? theme.accent : s === 'reserved' ? '#f59e0b' : theme.subtext;
      const statusLabel = (s: UnitPickerEntry['status']) =>
        s === 'available' ? '販売中' : s === 'reserved' ? '商談中' : '成約済';
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>
            <Box>
              {img ? (
                <Box sx={{ border: `1px solid ${theme.border}`, overflow: 'hidden', aspectRatio: '4/3' }}>
                  {img.thumbnailUrl && !img.placeholder
                    ? <Box component="img" src={img.thumbnailUrl} alt={img.title || ''} sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', p: 1 }} />
                    : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.subtext, bgcolor: theme.surface, flexDirection: 'column', gap: 1 }}>
                        <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.78rem' }}>建物図・配置図</Typography>
                        <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.75rem', opacity: 0.6 }}>S.Drawing から追加</Typography>
                      </Box>}
                </Box>
              ) : (
                <Box sx={{ border: `1px dashed ${theme.border}`, aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.surface, color: theme.subtext }}>
                  <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.82rem' }}>建物図・配置図（S.Drawing から追加）</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {entries.map((e) => (
                <Box key={e.id} sx={{ border: `1px solid ${e.status === 'available' ? theme.accent : theme.border}`, bgcolor: theme.surface, p: { xs: 1.75, md: 2 }, opacity: e.status === 'sold' ? 0.5 : 1, cursor: e.status === 'available' ? 'pointer' : 'default', transition: 'background 0.15s', '&:hover': e.status === 'available' ? { bgcolor: `${theme.accent}15` } : {} }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, fontSize: '1.1rem', color: theme.text }}>{e.label}</Typography>
                    <Box sx={{ px: 0.75, py: 0.2, border: `1px solid ${statusColor(e.status)}`, borderRadius: 0.5 }}>
                      <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.66rem', fontWeight: 800, color: statusColor(e.status) }}>{statusLabel(e.status)}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, mt: 0.75 }}>
                    <Box>
                      <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.64rem', color: theme.subtext }}>建物面積</Typography>
                      <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.88rem', color: theme.text }}>{e.area} ㎡</Typography>
                    </Box>
                    {e.siteArea && (
                      <Box>
                        <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.64rem', color: theme.subtext }}>敷地面積</Typography>
                        <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.88rem', color: theme.text }}>{e.siteArea} ㎡</Typography>
                      </Box>
                    )}
                    {e.price && (
                      <Box>
                        <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.64rem', color: theme.subtext }}>価格</Typography>
                        <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.88rem', color: theme.accent, fontWeight: 700 }}>{e.price}</Typography>
                      </Box>
                    )}
                  </Box>
                  {e.spec && <Typography sx={{ mt: 0.5, fontFamily: theme.bodyFamily, fontSize: '0.78rem', color: theme.subtext }}>{e.spec}</Typography>}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      );
    }

    // ===== services（サービスカード）=====
    if (section.type === 'services') {
      const cards: ServiceCard[] = section.serviceCards ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2.5 }}>
            {cards.map((c, i) => (
              <motion.div
                key={i}
                initial={reveals ? { opacity: 0, y: 16 } : false}
                whileInView={reveals ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.5, delay: i * 0.06, ease: mo.ease }}
                viewport={{ root: scrollRootRef as any, once: true, amount: 0.2 }}
              >
                <Box sx={{ border: `1px solid ${theme.border}`, bgcolor: theme.surface, p: { xs: 2.5, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, transition: 'border-color 0.2s', '&:hover': { borderColor: theme.accent } }}>
                  {c.icon && <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{c.icon}</Typography>}
                  <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: 700, fontSize: { xs: '1rem', md: '1.1rem' }, color: theme.text, letterSpacing: theme.headingLetterSpacing }}>{c.title}</Typography>
                  <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: TYPE.body, lineHeight: LEADING.body, color: theme.subtext, flexGrow: 1 }}>{c.body}</Typography>
                  {c.tags && c.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {c.tags.map((tag) => (
                        <Box key={tag} sx={{ px: 1, py: 0.25, border: `1px solid ${theme.border}`, borderRadius: 0.5 }}>
                          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.65rem', color: theme.subtext, letterSpacing: '0.05em' }}>{tag}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </motion.div>
            ))}
          </Box>
        </Box>
      );
    }

    if (section.type === 'zoning' || section.type === 'flow' || section.type === 'research') {
      const callouts = section.callouts ?? [];
      const img = section.assetRefs[0];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          {SectionHeader({ onLight: true })}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>
            {section.mapQuery ? (
              <Box sx={{ width: '100%', aspectRatio: RATIO.wide, overflow: 'hidden', border: `1px solid ${theme.border}`, borderRadius: 0.5 }}>
                <Box component="iframe" title="site-map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(section.mapQuery)}&z=15&output=embed`}
                  sx={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
              </Box>
            ) : img ? (
              <Box><AssetTile ref={img} i={0} ratio={RATIO.wide} /></Box>
            ) : null}
            <Box>
              {callouts.map((c) => (
                <Box key={c.no} sx={{ display: 'flex', gap: 1.75, py: 2, borderTop: `1px solid ${theme.border}` }}>
                  <Box sx={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${theme.accent}`, color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.kickerFamily, fontWeight: 800, fontSize: '0.82rem' }}>{c.no}</Box>
                  <Box>
                    <Typography sx={{ fontFamily: theme.headingFamily, fontWeight: 700, fontSize: '0.98rem', color: theme.text, mb: 0.5 }}>{c.title}</Typography>
                    <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.85rem', lineHeight: 1.8, color: theme.subtext }}>{c.body}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      );
    }

    // HERO
    if (isHero) {
      // assetRefs に画像があればそれを優先、なければバナー画像をフォールバック
      const assetImgUrl = (coverAsset?.thumbnailUrl && !coverAsset.placeholder) ? coverAsset.thumbnailUrl : null;
      const effectiveCoverUrl = assetImgUrl ?? bannerUrl ?? null;
      const hasImage = !!effectiveCoverUrl;

      if (variant === 'hero-editorial') {
        return (
          <Box sx={{ px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto' }}>
            <Box sx={{ borderBottom: `1px solid ${theme.border}`, pb: 1.5, mb: { xs: 4, md: 6 } }}>
              {isEdit ? (
                <SectionKickerEditor
                  committedValue={committedKicker || `${theme.label} — Project Site`}
                  onCommit={commitKicker}
                  onDirty={markDirty}
                  placeholder={`${theme.label} — Project Site`}
                  inputSx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: theme.kickerUppercase ? TRACK.kickerWide : TRACK.kickerNarrow, color: theme.subtext }}
                />
              ) : (
                <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: theme.kickerUppercase ? TRACK.kickerWide : TRACK.kickerNarrow, textTransform: theme.kickerUppercase ? 'uppercase' : 'none', color: theme.subtext }}>
                  {section.kicker || `${theme.label} — Project Site`}
                </Typography>
              )}
            </Box>
            {Heading({ size: 'displayXL', display: true, onLight: true })}
            <Box sx={{ maxWidth: MEASURE.text, mt: 2 }}>{BodyText({ onLight: true, large: true })}</Box>
            {hasImage && (
              <Box sx={{ mt: { xs: 5, md: 8 }, aspectRatio: RATIO.wide, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                <Box component="img" src={effectiveCoverUrl!} {...(parallaxOn ? { 'data-parallax': '' } : {})} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
          </Box>
        );
      }
      if (variant === 'hero-split') {
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, minHeight: { md: '82vh' } }}>
            <Box sx={{ order: { xs: 1, md: 0 }, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: PAGE_PX, py: heroPy }}>
              <Box sx={{ maxWidth: 560 }}>
                {Heading({ size: 'displayXL', display: true, onLight: true })}
                {BodyText({ onLight: true, large: true })}
              </Box>
            </Box>
            <Box sx={{ order: { xs: 0, md: 1 }, minHeight: { xs: '46vh', md: 'auto' }, position: 'relative', overflow: 'hidden', bgcolor: theme.surface }}>
              {hasImage
                ? <Box component="img" src={effectiveCoverUrl!} {...(parallaxOn ? { 'data-parallax': '' } : {})} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}33, ${theme.surface})` }} />}
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-typographic') {
        return (
          <Box sx={{ minHeight: HERO_MINH, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto' }}>
            {isEdit ? (
              <SectionKickerEditor
                committedValue={committedKicker || `${theme.label} — Project`}
                onCommit={commitKicker}
                onDirty={markDirty}
                placeholder={`${theme.label} — Project`}
                inputSx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, color: theme.subtext }}
              />
            ) : (
              <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, textTransform: 'uppercase', color: theme.subtext, mb: 3 }}>
                {section.kicker || `${theme.label} — Project`}
              </Typography>
            )}
            {Heading({ size: 'displayXL', display: true, onLight: true })}
            <Box sx={{ maxWidth: MEASURE.text, mt: 2 }}>{BodyText({ onLight: true, large: true })}</Box>
          </Box>
        );
      }
      if (variant === 'hero-spec') {
        const specs = section.specRows ?? [];
        const lightText = !hasImage;
        return (
          <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: HERO_MINH, display: 'flex', alignItems: 'flex-end',
            background: hasImage ? undefined : `linear-gradient(135deg, ${theme.accent}26 0%, ${theme.bg} 60%, ${theme.surface} 100%)` }}>
            {hasImage && (
              <>
                <Box component="img" src={effectiveCoverUrl!} {...(parallaxOn ? { 'data-parallax': '' } : {})}
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.1) 100%)' }} />
              </>
            )}
            {/* 右側の番号リスト（スペックのラベル） */}
            {specs.length > 0 && (
              <Box sx={{ position: 'absolute', top: { xs: 16, md: 40 }, right: { xs: 12, md: 32 }, display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'flex-end', zIndex: 2 }}>
                {specs.slice(0, 6).map((r, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.6rem', color: lightText ? theme.subtext : 'rgba(255,255,255,0.6)' }}>{String(i + 1).padStart(2, '0')}</Typography>
                    <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, textTransform: 'uppercase', color: lightText ? theme.text : '#fff' }}>{r.label}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {/* 左下：キッカー＋大見出し＋スペック箇条 */}
            <Box sx={{ position: 'relative', zIndex: 2, px: PAGE_PX, pb: { xs: 5, md: 9 }, pt: 8, width: '100%', maxWidth: MEASURE.hero, mx: 'auto' }}>
              {Heading({ size: 'displayXL', display: true, onLight: lightText })}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, md: 4 }, mt: 2 }}>
                {specs.slice(0, 4).map((r, i) => (
                  <Box key={i}>
                    <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.6rem', letterSpacing: TRACK.kickerWide, textTransform: 'uppercase', color: lightText ? theme.subtext : 'rgba(255,255,255,0.55)' }}>{r.label}</Typography>
                    <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.95rem', color: lightText ? theme.text : '#fff' }}>{r.value}</Typography>
                  </Box>
                ))}
              </Box>
              {isEdit && specs.length === 0 && (
                <Typography sx={{ mt: 2, fontFamily: theme.bodyFamily, fontSize: '0.8rem', color: lightText ? theme.subtext : 'rgba(255,255,255,0.6)' }}>
                  ※ このヒーローは「プロジェクト概要(spec)」のスペック項目を重ねて表示します。spec セクションを追加し項目を入れると反映されます。
                </Typography>
              )}
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-3d') {
        const lightText = true; // 3D シーンは暗背景前提
        return (
          <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: HERO_MINH, display: 'flex', alignItems: 'center',
            background: `radial-gradient(ellipse at 50% 40%, ${theme.surface} 0%, ${theme.bg} 70%)` }}>
            <HeroLayoutScene projectId={projectId} accent={theme.accent} scrollerRef={scrollRootRef ?? { current: null }} />
            <Box sx={{ position: 'relative', zIndex: 1, px: PAGE_PX, py: 8, width: '100%', maxWidth: MEASURE.hero, mx: 'auto' }}>
              {(committedKicker || isEdit) && <Box sx={{ mb: 2 }}>{Kicker({ onLight: lightText })}</Box>}
              {Heading({ size: 'displayXL', display: true, onLight: lightText })}
              <Box sx={{ maxWidth: MEASURE.text, mt: 2 }}>{BodyText({ onLight: lightText, large: true })}</Box>
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-scroll3d') {
        const lightText = true; // 3D シーンは暗背景前提
        const committedModelUrl = String(section.scroll3dModelUrl || '').trim();
        const modelUrl = committedModelUrl || undefined;
        return (
          <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: HERO_MINH, display: 'flex', alignItems: 'flex-end',
            background: `radial-gradient(ellipse at 50% 40%, ${theme.surface} 0%, ${theme.bg} 70%)` }}>
            <SiteScroll3DScene accent={theme.accent} modelUrl={modelUrl} scrollerRef={scrollRootRef ?? { current: null }} />
            {isEdit && (
              <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 3 }}>
                <Scroll3DModelEditor theme={theme} current={committedModelUrl}
                  onApply={(u) => onUpdate({ scroll3dModelUrl: u || null })} />
              </Box>
            )}
            <Box sx={{ position: 'relative', zIndex: 1, px: PAGE_PX, pb: { xs: 5, md: 9 }, pt: 8, width: '100%', maxWidth: MEASURE.hero, mx: 'auto' }}>
              {(committedKicker || isEdit) && <Box sx={{ mb: 2 }}>{Kicker({ onLight: lightText })}</Box>}
              {Heading({ size: 'displayXL', display: true, onLight: lightText })}
              <Box sx={{ maxWidth: MEASURE.text, mt: 2 }}>{BodyText({ onLight: lightText, large: true })}</Box>
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-minimal') {
        return (
          <Box sx={{ minHeight: HERO_MINH, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: PAGE_PX, py: heroPy, maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
            {Heading({ size: 'display', display: true, onLight: true })}
            <Box sx={{ maxWidth: MEASURE.text, mx: 'auto', mt: 2 }}>{BodyText({ onLight: true, large: true })}</Box>
          </Box>
        );
      }
      if (variant === 'hero-centered') {
        return (
          <Box sx={{ px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto', textAlign: 'center' }}>
            {Heading({ size: 'displayXL', display: true, onLight: true })}
            <Box sx={{ maxWidth: MEASURE.text, mx: 'auto', mt: 2 }}>{BodyText({ onLight: true, large: true })}</Box>
            {hasImage && (
              <Box sx={{ mt: { xs: 4, md: 7 }, aspectRatio: RATIO.wide, overflow: 'hidden', borderRadius: 1 }}>
                <Box component="img" src={effectiveCoverUrl!} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
          </Box>
        );
      }
      if (variant === 'hero-left') {
        return (
          <Box sx={{ minHeight: HERO_MINH, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto' }}>
            <Box sx={{ maxWidth: 640 }}>
              {Heading({ size: 'displayXL', display: true, onLight: true })}
              {BodyText({ onLight: true, large: true })}
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-card') {
        return (
          <Box sx={{ position: 'relative', minHeight: HERO_MINH, display: 'flex', alignItems: 'center', justifyContent: 'center', px: PAGE_PX, py: heroPy,
            background: hasImage ? undefined : `linear-gradient(135deg, ${theme.accent}26 0%, ${theme.surface} 70%)` }}>
            {hasImage && (
              <>
                <Box component="img" src={effectiveCoverUrl!} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.35)' }} />
              </>
            )}
            <Box sx={{ position: 'relative', maxWidth: 640, width: '100%', bgcolor: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 2, p: { xs: 3, md: 5 }, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              {Heading({ size: 'display', display: true, onLight: true })}
              {BodyText({ onLight: true, large: true })}
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-duotone') {
        return (
          <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: HERO_MINH, display: 'flex', alignItems: 'flex-end' }}>
            {hasImage ? (
              <>
                <Box component="img" src={effectiveCoverUrl!} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.05)' }} />
                <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}cc, ${theme.bg}99)`, mixBlendMode: 'multiply' }} />
              </>
            ) : (
              <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}, ${theme.bg})` }} />
            )}
            <Box sx={{ position: 'relative', px: PAGE_PX, pb: { xs: 6, md: 10 }, pt: 8, width: '100%', maxWidth: MEASURE.hero, mx: 'auto' }}>
              {Heading({ size: 'displayXL', display: true, onLight: false })}
              <Box sx={{ maxWidth: MEASURE.text }}>{BodyText({ onLight: false, large: true })}</Box>
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-stack') {
        return (
          <Box sx={{ px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto' }}>
            {committedKicker || isEdit ? (
              <Box sx={{ mb: 2 }}>{Kicker({ onLight: true })}</Box>
            ) : null}
            {Heading({ size: 'displayXL', display: true, onLight: true })}
            <Box sx={{ maxWidth: MEASURE.text, mt: 1 }}>{BodyText({ onLight: true, large: true })}</Box>
            {hasImage && (
              <Box sx={{ mt: { xs: 4, md: 7 }, width: '100%', aspectRatio: RATIO.wide, overflow: 'hidden' }}>
                <Box component="img" src={effectiveCoverUrl!} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Box>
            )}
          </Box>
        );
      }
      // hero-fullbleed
      const lightText = !theme.heroOverlay || !hasImage;
      return (
        <Box sx={{ position: 'relative', overflow: 'hidden', minHeight: HERO_MINH, display: 'flex', alignItems: 'flex-end',
          background: hasImage ? undefined : `linear-gradient(135deg, ${theme.accent}33 0%, ${theme.bg} 55%, ${theme.surface} 100%)` }}>
          {hasImage && (
            <>
              <Box component="img" src={effectiveCoverUrl!} {...(parallaxOn ? { 'data-parallax': '' } : {})}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: 'center', animation: (mode === 'preview' && !parallaxOn) ? `${kenburns} 22s ease-in-out infinite alternate` : 'none' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.12) 48%, rgba(0,0,0,0.04) 100%)' }} />
            </>
          )}
          <Box sx={{ position: 'relative', px: PAGE_PX, pb: { xs: 6, md: 10 }, pt: 8, width: '100%', maxWidth: MEASURE.hero, mx: 'auto' }}>
            {Heading({ size: 'displayXL', display: true, onLight: lightText })}
            <Box sx={{ maxWidth: MEASURE.text }}>{BodyText({ onLight: lightText, large: true })}</Box>
          </Box>
        </Box>
      );
    }

    // TEXT（textOnly: overview / custom）
    if (meta.textOnly) {
      if (variant === 'statement') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1000, mx: 'auto' }}>
            {Kicker({ onLight: true })}
            <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.32, color: theme.text, fontSize: TYPE.display }}>
              {(section.body && section.body.trim()) || (section.title || meta.label)}
            </Typography>
            {isEdit && <Box sx={{ mt: 2 }}>{BodyText({ onLight: true })}</Box>}
          </Box>
        );
      }
      if (variant === 'two-column') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1000, mx: 'auto' }}>
            {Kicker({ onLight: true })}{Heading({ size: 'h2', onLight: true })}
            <Box sx={{ columnCount: { xs: 1, md: 2 }, columnGap: 48, mt: 2 }}>{BodyText({ onLight: true })}</Box>
          </Box>
        );
      }
      if (variant === 'quote') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 980, mx: 'auto' }}>
            <Box sx={{ borderLeft: `3px solid ${theme.accent}`, pl: { xs: 2.5, md: 4 } }}>
              <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, fontStyle: 'italic', lineHeight: 1.4, color: theme.text, fontSize: TYPE.display }}>
                {(section.body && section.body.trim()) || (section.title || meta.label)}
              </Typography>
              {section.title && (
                <Typography sx={{ mt: 2.5, fontFamily: theme.kickerFamily, fontSize: TYPE.caption, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.subtext }}>— {section.title}</Typography>
              )}
            </Box>
            {isEdit && <Box sx={{ mt: 2 }}>{BodyText({ onLight: true })}</Box>}
          </Box>
        );
      }
      if (variant === 'three-column') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1100, mx: 'auto' }}>
            {Kicker({ onLight: true })}{Heading({ size: 'h2', onLight: true })}
            <Box sx={{ columnCount: { xs: 1, md: 3 }, columnGap: 40, mt: 2 }}>{BodyText({ onLight: true })}</Box>
          </Box>
        );
      }
      if (variant === 'boxed') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 920, mx: 'auto' }}>
            <Box sx={{ border: `1px solid ${theme.border}`, bgcolor: theme.surface, borderRadius: 2, p: { xs: 3, md: 5 } }}>
              {Kicker({ onLight: true })}{Heading({ size: 'h2', onLight: true })}
              <Box sx={{ mt: 1.5 }}>{BodyText({ onLight: true, large: true })}</Box>
            </Box>
          </Box>
        );
      }
      if (variant === 'centered-text') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.text, mx: 'auto', textAlign: 'center' }}>
            {Kicker({ onLight: true })}{Heading({ size: 'h2', onLight: true })}
            <Box sx={{ mt: 1.5 }}>{BodyText({ onLight: true, large: true })}</Box>
          </Box>
        );
      }
      if (variant === 'display-text') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1000, mx: 'auto' }}>
            <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.18, color: theme.text, fontSize: TYPE.displayXL }}>
              {(section.body && section.body.trim()) || (section.title || meta.label)}
            </Typography>
            {isEdit && <Box sx={{ mt: 2 }}>{BodyText({ onLight: true })}</Box>}
          </Box>
        );
      }
      if (variant === 'manifesto') {
        return (
          <Box sx={{ px: PAGE_PX, py: { xs: secPy.xs * 1.3, md: secPy.md * 1.3 }, maxWidth: 1100, mx: 'auto' }}>
            {Heading({ size: 'displayXL', display: true, onLight: true })}
            <Box sx={{ maxWidth: MEASURE.text, mt: 3 }}>{BodyText({ onLight: true, large: true })}</Box>
          </Box>
        );
      }
      if (variant === 'sidenote') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1100, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.6fr 1fr' }, gap: { xs: 2, md: 6 } }}>
            <Box>{Kicker({ onLight: true })}{Heading({ size: 'h2', onLight: true })}</Box>
            <Box>{BodyText({ onLight: true, large: true })}</Box>
          </Box>
        );
      }
      // lead
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.text, mx: 'auto' }}>
          {Kicker({ onLight: true })}{Heading({ size: 'h2', onLight: true })}
          <Box sx={{ mt: 1.5 }}>{BodyText({ onLight: true, large: true })}</Box>
        </Box>
      );
    }

    // ASSET sections
    const assets = section.assetRefs;
    const wrap = (children: React.ReactNode) => (
      <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
        {SectionHeader({ onLight: true })}
        {emptyAssetPrompt || children}
      </Box>
    );

    if (assets.length === 0) return wrap(null);

    if (variant === 'filmstrip') {
      return wrap(
        <Box sx={{ display: 'flex', gap: 2.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: theme.border, borderRadius: 3 } }}>
          {assets.map((a, i) => (
            <Box key={a.id} sx={{ flex: '0 0 auto', width: { xs: 260, md: 380 } }}>
              <AssetTile ref={a} i={i} ratio={RATIO.film} /><Caption a={a} onLight />
            </Box>
          ))}
        </Box>,
      );
    }

    if (variant === 'duo') {
      return wrap(
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 3, md: 4 } }}>
          {assets.map((a, i) => (<Box key={a.id}><AssetTile ref={a} i={i} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
        </Box>,
      );
    }

    if (variant === 'mosaic') {
      return wrap(
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gridAutoRows: { xs: 130, md: 220 }, gap: 2 }}>
          {assets.map((a, i) => {
            const big = i === 0;
            return (
              <Box key={a.id} sx={{ gridColumn: big ? 'span 2' : 'span 1', gridRow: big ? 'span 2' : 'span 1' }}>
                <Box sx={{ height: '100%' }}><AssetTile ref={a} i={i} ratio="auto" /></Box>
              </Box>
            );
          })}
        </Box>,
      );
    }

    if (variant === 'split') {
      return wrap(
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 5, md: 9 } }}>
          {assets.map((a, i) => {
            const reverse = i % 2 === 1;
            return (
              <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, gap: { xs: 2.5, md: 6 }, alignItems: 'center' }}>
                <Box sx={{ order: { xs: 0, md: reverse ? 2 : 0 } }}><AssetTile ref={a} i={i} ratio={RATIO.film} /></Box>
                <Box sx={{ order: 1 }}>
                  <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, textTransform: theme.kickerUppercase ? 'uppercase' : 'none', color: theme.subtext, mb: 1.5 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Typography>
                  <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: TYPE.body, lineHeight: LEADING.body, color: theme.text }}>
                    {a.title || `${meta.label} ${i + 1}`}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>,
      );
    }

    if (variant === 'band') {
      const [b0, ...brest] = assets;
      return (
        <Box sx={{ py: secPy }}>
          <Box sx={{ px: PAGE_PX, maxWidth: MEASURE.wide, mx: 'auto' }}>{SectionHeader({ onLight: true })}</Box>
          <Box sx={{ width: '100%', aspectRatio: RATIO.wide, overflow: 'hidden' }}>
            <AssetTile ref={b0} i={0} ratio={RATIO.wide} />
          </Box>
          {(b0.title || brest.length > 0) && (
            <Box sx={{ px: PAGE_PX, maxWidth: MEASURE.wide, mx: 'auto', mt: 2.5 }}>
              <Caption a={b0} onLight />
              {brest.length > 0 && (
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${Math.min(brest.length, 3)}, 1fr)` }, gap: 2.5 }}>
                  {brest.map((a, i) => (<Box key={a.id}><AssetTile ref={a} i={i + 1} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      );
    }

    if (variant === 'masonry') {
      return wrap(
        <Box sx={{ columnCount: { xs: 2, md: 3 }, columnGap: 16 }}>
          {assets.map((a, i) => {
            const r = i % 3 === 0 ? RATIO.portrait : i % 2 === 0 ? RATIO.card : RATIO.film;
            return (
              <Box key={a.id} sx={{ breakInside: 'avoid', mb: 2 }}>
                <AssetTile ref={a} i={i} ratio={r} /><Caption a={a} onLight />
              </Box>
            );
          })}
        </Box>,
      );
    }

    if (variant === 'index-list') {
      return wrap(
        <Box>
          {assets.map((a, i) => (
            <Box key={a.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '40px 1fr', md: '72px 140px 1fr' }, gap: { xs: 2, md: 3 }, alignItems: 'center', py: { xs: 2, md: 2.5 }, borderTop: `1px solid ${theme.border}` }}>
              <Typography sx={{ fontFamily: theme.displayFamily, fontSize: { xs: '1.4rem', md: '2rem' }, fontWeight: theme.headingWeight, color: theme.subtext }}>{String(i + 1).padStart(2, '0')}</Typography>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}><AssetTile ref={a} i={i} ratio={RATIO.card} /></Box>
              <Typography sx={{ fontFamily: theme.headingFamily, fontSize: TYPE.h2, fontWeight: Math.min(theme.headingWeight + 100, 800), color: theme.text, letterSpacing: theme.headingLetterSpacing }}>{a.title || `${meta.label} ${i + 1}`}</Typography>
            </Box>
          ))}
          <Box sx={{ borderBottom: `1px solid ${theme.border}` }} />
        </Box>,
      );
    }

    if (variant === 'overlap') {
      return wrap(
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 5, md: 10 } }}>
          {assets.map((a, i) => {
            const rev = i % 2 === 1;
            return (
              <Box key={a.id} sx={{ position: 'relative', minHeight: { md: 360 } }}>
                <Box sx={{ width: { xs: '84%', md: '62%' }, ml: rev ? 'auto' : 0, aspectRatio: RATIO.film }}>
                  <AssetTile ref={a} i={i} ratio={RATIO.film} />
                </Box>
                <Box sx={{
                  position: { md: 'absolute' }, top: { md: '32%' },
                  left: rev ? { md: 0 } : 'auto', right: rev ? 'auto' : { md: 0 },
                  width: { xs: '100%', md: '40%' }, mt: { xs: 1.5, md: 0 },
                  bgcolor: theme.surface, border: `1px solid ${theme.border}`, p: { xs: 2, md: 3 },
                }}>
                  <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, textTransform: 'uppercase', color: theme.subtext, mb: 1 }}>{String(i + 1).padStart(2, '0')}</Typography>
                  <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: TYPE.body, lineHeight: LEADING.body, color: theme.text }}>{a.title || `${meta.label} ${i + 1}`}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>,
      );
    }

    if (variant === 'grid-3') {
      return wrap(
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 1.5, md: 2.5 } }}>
          {assets.map((a, i) => (<Box key={a.id}><AssetTile ref={a} i={i} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
        </Box>,
      );
    }
    if (variant === 'grid-4') {
      return wrap(
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: { xs: 1.25, md: 2 } }}>
          {assets.map((a, i) => (<Box key={a.id}><AssetTile ref={a} i={i} ratio="auto" /><Caption a={a} onLight /></Box>))}
        </Box>,
      );
    }
    if (variant === 'carousel') {
      return wrap(
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', scrollSnapType: 'x mandatory', pb: 1.5, '&::-webkit-scrollbar': { height: 8 }, '&::-webkit-scrollbar-thumb': { bgcolor: theme.border, borderRadius: 4 } }}>
          {assets.map((a, i) => (
            <Box key={a.id} sx={{ flex: '0 0 auto', width: { xs: '82%', md: '60%' }, scrollSnapAlign: 'center' }}>
              <AssetTile ref={a} i={i} ratio={RATIO.wide} /><Caption a={a} onLight />
            </Box>
          ))}
        </Box>,
      );
    }

    // feature（既定）: 先頭を全幅、残りを横並び
    const [head, ...rest] = assets;
    return wrap(
      <Box>
        <Box sx={{ mb: rest.length ? { xs: 3, md: 4 } : 0 }}>
          <AssetTile ref={head} i={0} ratio={RATIO.feature} /><Caption a={head} onLight />
        </Box>
        {rest.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${Math.min(rest.length, 3)}, 1fr)` }, gap: 2.5 }}>
            {rest.map((a, i) => (<Box key={a.id}><AssetTile ref={a} i={i + 1} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
          </Box>
        )}
      </Box>,
    );
  };

  return (
    <Box
      id={`sec-${section.id}`}
      onClick={isEdit ? onSelect : undefined}
      sx={{
        position: 'relative', width: '100%', boxSizing: 'border-box',
        scrollMarginTop: 8,
        cursor: isEdit ? 'pointer' : 'default',
        opacity: section.hidden ? 0.5 : 1,
        color: theme.text,
        borderTop: !isHero ? `1px solid ${theme.border}` : 'none',
        outline: isEdit && selected ? `2px solid ${theme.accent}` : '2px solid transparent',
        outlineOffset: -2,
        transition: 'outline-color 0.15s',
        ...treatmentSx,
      }}
    >
      <Reveal clip={isHero || (!meta.textOnly && section.assetRefs.length > 0)}>{renderContent()}</Reveal>
    </Box>
  );
};
