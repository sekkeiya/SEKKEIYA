import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import { motion } from 'framer-motion';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';

import type { SiteSection, SiteSectionVariant, SiteAssetRef } from './siteTypes';
import { SECTION_META } from './siteMeta';
import type { EditorialTheme } from './editorialThemes';
import { SECTION_PY, HERO_PY, HERO_MINH, MEASURE, PAGE_PX, TYPE, LEADING, TRACK, RATIO } from './designTokens';
import type { MotionConfig } from './designTokens';
import { ChartView, ChartLegend } from './ChartView';
import { WebWorksGrid, WebProfileGenres, WebProfileModels, WebProfileStats, WebProjectLink } from './PublishedDynamic';

// 公開サイトのセクション描画（デスクトップ SiteSectionView の preview 専用移植）。
// 編集分岐（TextField/Drag/削除/サンプルチップ）は除去し、焼き込みデータで動的セクションを描く。

interface Props {
  section: SiteSection;
  theme: EditorialTheme;
  projectName: string;
  scrollRootRef?: React.RefObject<HTMLElement | null>;
  motion?: MotionConfig;
}

const kenburns = keyframes`from { transform: scale(1); } to { transform: scale(1.08); }`;

function effectiveVariant(section: SiteSection): SiteSectionVariant {
  if (section.variant) return section.variant;
  switch (section.type) {
    case 'hero': return 'hero-fullbleed';
    case 'overview': case 'custom': return 'lead';
    default: return 'feature';
  }
}

export const PublishedSection: React.FC<Props> = ({ section, theme, projectName, scrollRootRef, motion: motionCfg }) => {
  const mo = motionCfg ?? { enabled: false, reveal: 0, durMs: 0, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], parallax: 0, clip: false, extra: false, smooth: false, mode: 'still' as const };
  const reveals = mo.reveal > 0;
  const parallaxOn = mo.parallax > 0;
  const meta = SECTION_META[section.type];
  const isHero = section.type === 'hero';
  const variant = effectiveVariant(section);
  const airy = theme.airy;
  const secPy = { xs: SECTION_PY.xs * airy, md: SECTION_PY.md * airy };
  const heroPy = { xs: HERO_PY.xs * airy, md: HERO_PY.md * airy };

  if (section.hidden) return null;

  const kickerLabel = meta.label;
  const showKicker = !isHero && kickerLabel && kickerLabel !== (section.title ?? '');
  const realAssets = section.assetRefs.filter(a => a.thumbnailUrl && !a.placeholder);
  const coverAsset = realAssets[0] || section.assetRefs[0];

  /* ---------- 小要素 ---------- */

  const Kicker = ({ onLight }: { onLight: boolean }) => (
    showKicker ? (
      <Typography sx={{
        fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, fontWeight: 600, mb: 2,
        letterSpacing: theme.kickerUppercase ? TRACK.kickerWide : TRACK.kickerNarrow,
        textTransform: theme.kickerUppercase ? 'uppercase' : 'none',
        color: onLight ? theme.subtext : 'rgba(255,255,255,0.7)',
      }}>
        {kickerLabel}
      </Typography>
    ) : null
  );

  type HSize = 'displayXL' | 'display' | 'h2';
  const Heading = ({ size, display, onLight }: { size: HSize; display?: boolean; onLight: boolean }) => {
    const fontSize = size === 'displayXL' ? TYPE.displayXL : size === 'display' ? TYPE.display : TYPE.h2;
    const family = display ? theme.displayFamily : theme.headingFamily;
    const weight = display ? theme.headingWeight : Math.min(theme.headingWeight + 100, 800);
    const lineHeight = size === 'h2' ? LEADING.heading : LEADING.display;
    const mb = size === 'h2' ? 2 : 3;
    return (
      <Typography sx={{
        fontFamily: family, fontWeight: weight, letterSpacing: theme.headingLetterSpacing,
        lineHeight, color: onLight ? theme.text : '#fff', wordBreak: 'break-word', mb, fontSize,
      }}>
        {(section.title && section.title.trim()) || (isHero ? projectName : meta.label)}
      </Typography>
    );
  };

  const BodyText = ({ onLight, large }: { onLight: boolean; large?: boolean }) => {
    if (!section.body || !section.body.trim()) return null;
    return (
      <Typography sx={{
        fontFamily: theme.bodyFamily, lineHeight: LEADING.body, whiteSpace: 'pre-wrap',
        color: onLight ? theme.subtext : 'rgba(255,255,255,0.82)',
        fontSize: large ? TYPE.bodyLg : TYPE.body,
      }}>
        {section.body}
      </Typography>
    );
  };

  const AssetTile = ({ refData: a, i, ratio, rounded = false }: { refData: SiteAssetRef; i: number; ratio?: string; rounded?: boolean }) => (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: rounded ? 0.5 : 0, bgcolor: theme.surface, aspectRatio: ratio || RATIO.card, border: `1px solid ${theme.border}`,
      '& img, & video': { transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }, '&:hover img': { transform: 'scale(1.05)' } }}>
      {a.videoUrl ? (
        <Box component="video" src={a.videoUrl} poster={a.thumbnailUrl || undefined}
          muted loop playsInline autoPlay controls
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
        </Box>
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
      <Kicker onLight={onLight} />
      <Heading size="h2" onLight={onLight} />
      <BodyText onLight={onLight} />
    </Box>
  );

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
    if (section.type === 'projectlink' && section.projectRef) {
      return <WebProjectLink theme={theme} refData={section.projectRef} secPy={secPy} />;
    }

    if (section.type === 'works') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <SectionHeader onLight />
          <WebWorksGrid theme={theme} works={section.resolvedWorks ?? []} />
        </Box>
      );
    }

    if (section.type === 'usergenres') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <SectionHeader onLight />
          {section.resolvedProfile && <WebProfileGenres theme={theme} profile={section.resolvedProfile} />}
        </Box>
      );
    }

    if (section.type === 'usermodels') {
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <SectionHeader onLight />
          {section.resolvedProfile && <WebProfileModels theme={theme} profile={section.resolvedProfile} />}
        </Box>
      );
    }

    if (section.type === 'profilestats') {
      if (!section.resolvedProfile) return null;
      return (
        <Box sx={{ px: PAGE_PX, py: { xs: secPy.xs * 0.6, md: secPy.md * 0.5 }, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <WebProfileStats theme={theme} profile={section.resolvedProfile} />
        </Box>
      );
    }

    if (section.type === 'target') {
      const data = section.chartData ?? [];
      const chartType = section.chartType ?? 'donut';
      const unit = chartType === 'radar' ? '' : '%';
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <SectionHeader onLight />
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
          <Kicker onLight />
          {words.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1.5, md: 3 }, mb: 4 }}>
              {words.map((w, i) => (
                <Typography key={i} sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.1, color: i % 2 === 0 ? theme.text : theme.accent, fontSize: { xs: '2rem', md: '3.4rem' } }}>
                  {w}
                </Typography>
              ))}
            </Box>
          )}
          <Box sx={{ maxWidth: MEASURE.text }}><BodyText onLight large /></Box>
        </Box>
      );
    }

    if (section.type === 'process') {
      const steps = section.steps ?? [];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 980, mx: 'auto' }}>
          <SectionHeader onLight />
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
          <SectionHeader onLight />
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
          <SectionHeader onLight />
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
          <SectionHeader onLight />
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
          <SectionHeader onLight />
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

    if (section.type === 'zoning' || section.type === 'flow' || section.type === 'research') {
      const callouts = section.callouts ?? [];
      const img = section.assetRefs[0];
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
          <SectionHeader onLight />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>
            {section.mapQuery ? (
              <Box sx={{ width: '100%', aspectRatio: RATIO.wide, overflow: 'hidden', border: `1px solid ${theme.border}`, borderRadius: 0.5 }}>
                <Box component="iframe" title="site-map" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(section.mapQuery)}&z=15&output=embed`}
                  sx={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
              </Box>
            ) : img ? (
              <Box><AssetTile refData={img} i={0} ratio={RATIO.wide} /></Box>
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
      const hasImage = coverAsset && coverAsset.thumbnailUrl && !coverAsset.placeholder;
      if (variant === 'hero-editorial') {
        return (
          <Box sx={{ px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto' }}>
            <Box sx={{ borderBottom: `1px solid ${theme.border}`, pb: 1.5, mb: { xs: 4, md: 6 } }}>
              <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: theme.kickerUppercase ? TRACK.kickerWide : TRACK.kickerNarrow, textTransform: theme.kickerUppercase ? 'uppercase' : 'none', color: theme.subtext }}>
                {theme.label} — Project Site
              </Typography>
            </Box>
            <Heading size="displayXL" display onLight />
            <Box sx={{ maxWidth: MEASURE.text, mt: 2 }}><BodyText onLight large /></Box>
            {hasImage && (
              <Box sx={{ mt: { xs: 5, md: 8 }, aspectRatio: RATIO.wide, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                <Box component="img" src={coverAsset!.thumbnailUrl!} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <Heading size="displayXL" display onLight />
                <BodyText onLight large />
              </Box>
            </Box>
            <Box sx={{ order: { xs: 0, md: 1 }, minHeight: { xs: '46vh', md: 'auto' }, position: 'relative', overflow: 'hidden', bgcolor: theme.surface }}>
              {hasImage
                ? <Box component="img" src={coverAsset!.thumbnailUrl!} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}33, ${theme.surface})` }} />}
            </Box>
          </Box>
        );
      }
      if (variant === 'hero-typographic') {
        return (
          <Box sx={{ minHeight: HERO_MINH, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: PAGE_PX, py: heroPy, maxWidth: MEASURE.hero, mx: 'auto' }}>
            <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: TYPE.kicker, letterSpacing: TRACK.kickerWide, textTransform: 'uppercase', color: theme.subtext, mb: 3 }}>
              {theme.label} — Project
            </Typography>
            <Heading size="displayXL" display onLight />
            <Box sx={{ maxWidth: MEASURE.text, mt: 2 }}><BodyText onLight large /></Box>
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
              <Box component="img" src={coverAsset!.thumbnailUrl!}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transformOrigin: 'center', animation: !parallaxOn ? `${kenburns} 22s ease-in-out infinite alternate` : 'none' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.12) 48%, rgba(0,0,0,0.04) 100%)' }} />
            </>
          )}
          <Box sx={{ position: 'relative', px: PAGE_PX, pb: { xs: 6, md: 10 }, pt: 8, width: '100%', maxWidth: MEASURE.hero, mx: 'auto' }}>
            <Heading size="displayXL" display onLight={lightText} />
            <Box sx={{ maxWidth: MEASURE.text }}><BodyText onLight={lightText} large /></Box>
          </Box>
        </Box>
      );
    }

    // TEXT（textOnly: overview / custom）
    if (meta.textOnly) {
      if (variant === 'statement') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1000, mx: 'auto' }}>
            <Kicker onLight />
            <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, lineHeight: 1.32, color: theme.text, fontSize: TYPE.display }}>
              {(section.body && section.body.trim()) || (section.title || meta.label)}
            </Typography>
          </Box>
        );
      }
      if (variant === 'two-column') {
        return (
          <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: 1000, mx: 'auto' }}>
            <Kicker onLight /><Heading size="h2" onLight />
            <Box sx={{ columnCount: { xs: 1, md: 2 }, columnGap: 48, mt: 2 }}><BodyText onLight /></Box>
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
          </Box>
        );
      }
      // lead
      return (
        <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.text, mx: 'auto' }}>
          <Kicker onLight /><Heading size="h2" onLight />
          <Box sx={{ mt: 1.5 }}><BodyText onLight large /></Box>
        </Box>
      );
    }

    // ASSET sections
    const assets = section.assetRefs;
    const wrap = (children: React.ReactNode) => (
      <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
        <SectionHeader onLight />
        {children}
      </Box>
    );

    if (assets.length === 0) return wrap(null);

    if (variant === 'filmstrip') {
      return wrap(
        <Box sx={{ display: 'flex', gap: 2.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: theme.border, borderRadius: 3 } }}>
          {assets.map((a, i) => (
            <Box key={a.id} sx={{ flex: '0 0 auto', width: { xs: 260, md: 380 } }}>
              <AssetTile refData={a} i={i} ratio={RATIO.film} /><Caption a={a} onLight />
            </Box>
          ))}
        </Box>,
      );
    }

    if (variant === 'duo') {
      return wrap(
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: { xs: 3, md: 4 } }}>
          {assets.map((a, i) => (<Box key={a.id}><AssetTile refData={a} i={i} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
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
                <Box sx={{ height: '100%' }}><AssetTile refData={a} i={i} ratio="auto" /></Box>
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
                <Box sx={{ order: { xs: 0, md: reverse ? 2 : 0 } }}><AssetTile refData={a} i={i} ratio={RATIO.film} /></Box>
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
          <Box sx={{ px: PAGE_PX, maxWidth: MEASURE.wide, mx: 'auto' }}><SectionHeader onLight /></Box>
          <Box sx={{ width: '100%', aspectRatio: RATIO.wide, overflow: 'hidden' }}>
            <AssetTile refData={b0} i={0} ratio={RATIO.wide} />
          </Box>
          {(b0.title || brest.length > 0) && (
            <Box sx={{ px: PAGE_PX, maxWidth: MEASURE.wide, mx: 'auto', mt: 2.5 }}>
              <Caption a={b0} onLight />
              {brest.length > 0 && (
                <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${Math.min(brest.length, 3)}, 1fr)` }, gap: 2.5 }}>
                  {brest.map((a, i) => (<Box key={a.id}><AssetTile refData={a} i={i + 1} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
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
                <AssetTile refData={a} i={i} ratio={r} /><Caption a={a} onLight />
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
              <Box sx={{ display: { xs: 'none', md: 'block' } }}><AssetTile refData={a} i={i} ratio={RATIO.card} /></Box>
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
                  <AssetTile refData={a} i={i} ratio={RATIO.film} />
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

    // feature（既定）: 先頭を全幅、残りを横並び
    const [head, ...rest] = assets;
    return wrap(
      <Box>
        <Box sx={{ mb: rest.length ? { xs: 3, md: 4 } : 0 }}>
          <AssetTile refData={head} i={0} ratio={RATIO.feature} /><Caption a={head} onLight />
        </Box>
        {rest.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${Math.min(rest.length, 3)}, 1fr)` }, gap: 2.5 }}>
            {rest.map((a, i) => (<Box key={a.id}><AssetTile refData={a} i={i + 1} ratio={RATIO.card} /><Caption a={a} onLight /></Box>))}
          </Box>
        )}
      </Box>,
    );
  };

  return (
    <Box
      id={`sec-${section.id}`}
      sx={{
        position: 'relative', width: '100%', boxSizing: 'border-box',
        scrollMarginTop: 8,
        color: theme.text,
        borderTop: !isHero ? `1px solid ${theme.border}` : 'none',
      }}
    >
      <Reveal clip={isHero || (!meta.textOnly && section.assetRefs.length > 0)}>{renderContent()}</Reveal>
    </Box>
  );
};
