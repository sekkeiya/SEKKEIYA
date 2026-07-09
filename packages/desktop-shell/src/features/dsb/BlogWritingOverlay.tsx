/**
 * BlogWritingOverlay — 「議論から記事を生成」中〜完了直後の執筆演出。
 *
 * generating=true の間: ✍ ペンが走り、スケルトン行が次々と現れる「書いている最中」の演出。
 * 生成完了（generating→false で本文が入った）: 実際の本文をタイプライター表示で
 * 「書かれていく」様子を見せ、書き終わるとフェードアウトして実エディタへ引き継ぐ。
 * いつでも「スキップ」で即エディタに移れる。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Fade } from '@mui/material';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';

const ACCENT = '#e57373';

interface BlogWritingOverlayProps {
  /** synthesize 実行中か */
  generating: boolean;
  /** 現在の本文（生成完了でここに入る） */
  bodyMarkdown: string;
  /** タイトル（生成完了でタイプ表示の見出しに使う） */
  title: string;
}

type Phase = 'idle' | 'writing' | 'typing';

/** タイプ表示用に Markdown 記号を軽く落とす（読みやすさ優先・本文はそのまま） */
const stripMd = (md: string) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // リンク→テキスト
    .replace(/^#{1,6}\s*/gm, '')               // 見出し記号（改行で段落感は残る）
    .replace(/[*_`]/g, '');

export const BlogWritingOverlay: React.FC<BlogWritingOverlayProps> = ({ generating, bodyMarkdown, title }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState(0); // タイプ済み文字数
  const fullTextRef = useRef('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasGeneratingRef = useRef(false);

  // generating の立ち上がり/立ち下がりで演出フェーズを遷移
  useEffect(() => {
    if (generating) {
      wasGeneratingRef.current = true;
      setPhase('writing');
      setTyped(0);
      return;
    }
    if (wasGeneratingRef.current) {
      wasGeneratingRef.current = false;
      const text = stripMd(bodyMarkdown || '').trim();
      if (text) {
        fullTextRef.current = text;
        setPhase('typing'); // 完成本文をタイプライターで「書いていく」
      } else {
        setPhase('idle');   // 生成失敗など → 演出なしで戻す
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  // タイプライター進行（1tickごとに数文字ずつ・全体で3〜5秒に収まる速度へ自動調整）
  useEffect(() => {
    if (phase !== 'typing') return;
    const total = fullTextRef.current.length;
    if (total === 0) { setPhase('idle'); return; }
    const step = Math.max(6, Math.ceil(total / 160)); // 約160tick（30ms間隔≒4.8s）で書き切る
    const t = setInterval(() => {
      setTyped((n) => {
        const next = n + step;
        if (next >= total) {
          clearInterval(t);
          setTimeout(() => setPhase('idle'), 700); // 書き終わり → ひと呼吸おいて実エディタへ
          return total;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(t);
  }, [phase]);

  // タイプに合わせて自動スクロール
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [typed]);

  if (phase === 'idle') return null;

  return (
    <Fade in>
      <Box sx={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column',
        bgcolor: 'background.default', px: 5, py: 4 }}>
        {/* ヘッダー: 執筆中インジケーター */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
          <EditNoteRoundedIcon sx={{ fontSize: 20, color: ACCENT,
            animation: 'sekkeiyaPen 1.1s ease-in-out infinite',
            '@keyframes sekkeiyaPen': { '0%,100%': { transform: 'rotate(-6deg)' }, '50%': { transform: 'rotate(8deg) translateY(-2px)' } } }} />
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: ACCENT }}>
            {phase === 'writing' ? 'AIが議論をもとに執筆しています…' : '書き上がった記事を清書しています…'}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {phase === 'typing' && (
            <Button size="small" onClick={() => setPhase('idle')}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontSize: 11.5 }}>
              スキップ
            </Button>
          )}
        </Box>

        {phase === 'writing' ? (
          // 生成待ち: スケルトン行が「書かれていく」ように順に現れてはループ
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Box sx={{ width: '55%', height: 26, borderRadius: 1.5, mb: 3,
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.10)', animation: 'sekkeiyaShimmer 1.6s ease-in-out infinite',
              '@keyframes sekkeiyaShimmer': { '0%,100%': { opacity: 0.5 }, '50%': { opacity: 1 } } }} />
            {Array.from({ length: 10 }).map((_, i) => (
              <Box key={i} sx={{ height: 13, borderRadius: 1, mb: 1.5,
                width: `${[92, 86, 95, 60, 0, 88, 94, 78, 90, 45][i]}%`,
                ...(i === 4 ? { bgcolor: 'transparent' } : {
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                  opacity: 0,
                  animation: `sekkeiyaLineIn 4.5s ease-out ${i * 0.45}s infinite`,
                }),
                '@keyframes sekkeiyaLineIn': {
                  '0%': { opacity: 0, transform: 'translateX(-6px)' },
                  '8%': { opacity: 1, transform: 'none' },
                  '85%': { opacity: 1 },
                  '100%': { opacity: 0.15 },
                } }} />
            ))}
          </Box>
        ) : (
          // タイプライター: 生成された本文が書かれていく
          <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}>
            {title && (
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-fg)', mb: 2, lineHeight: 1.4 }}>
                {title}
              </Typography>
            )}
            <Typography component="div" sx={{ fontSize: 14.5, lineHeight: 2, color: 'rgb(var(--brand-fg-rgb) / 0.85)', whiteSpace: 'pre-wrap' }}>
              {fullTextRef.current.slice(0, typed)}
              <Box component="span" sx={{ display: 'inline-block', width: '2px', height: '1.05em', ml: 0.25, verticalAlign: '-0.15em',
                bgcolor: ACCENT, animation: 'sekkeiyaCaret 0.8s step-end infinite',
                '@keyframes sekkeiyaCaret': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
            </Typography>
          </Box>
        )}
      </Box>
    </Fade>
  );
};
