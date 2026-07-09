// サイト本体（プレビュー/公開ビュー）のスクロール演出ランタイム。
// 役割を 2 つに限定して堅牢化:
//   1. Lenis による慣性スムーズスクロール（config.smooth のとき）
//   2. GSAP ScrollTrigger による「ヒーロー画像パララックス」（[data-parallax] 要素）
// リビール（要素の出現）は Framer Motion 側（SiteSectionView）が担当し、ここでは扱わない。
//
// 重要な前提:
//   - 編集モード / prefers-reduced-motion / still のときは config.enabled=false で何もしない
//   - Lenis は wrapper(=スクロール領域) の scrollTop を実際に動かすため、
//     IntersectionObserver（Framer whileInView・スクロールスパイ）も従来どおり動作する
//   - 初期化はすべて try/catch で囲み、失敗時はネイティブスクロールへフォールバック

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import type { MotionConfig } from './designTokens';

gsap.registerPlugin(ScrollTrigger);

interface Options {
  /** スクロールするコンテナ（overflow-y:auto の要素）。 */
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** スクローラ内の単一コンテンツラッパ（Lenis content）。 */
  contentRef: React.RefObject<HTMLElement | null>;
  config: MotionConfig;
  /** ページ/セクション/モード変更時に再初期化するためのキー。 */
  reinitKey: string;
}

export function useSiteMotion({ scrollerRef, contentRef, config, reinitKey }: Options): void {
  const wantParallax = config.parallax > 0;
  const wantSmooth = config.smooth;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content || !config.enabled || (!wantSmooth && !wantParallax)) return;

    let lenis: Lenis | null = null;
    let tickerFn: ((time: number) => void) | null = null;
    const tweens: gsap.core.Tween[] = [];

    try {
      // 1) 慣性スムーズスクロール
      if (wantSmooth) {
        lenis = new Lenis({
          wrapper: scroller,
          content,
          duration: 1.05,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
        });
        lenis.on('scroll', ScrollTrigger.update);
        tickerFn = (time: number) => { lenis?.raf(time * 1000); };
        gsap.ticker.add(tickerFn);
        gsap.ticker.lagSmoothing(0);
      }

      // 2) ヒーロー画像パララックス（[data-parallax] = 画像要素。親は overflow:hidden）
      if (wantParallax) {
        // scale ヘッドルーム内で yPercent をスクラブ。gap を出さないよう shift を抑える。
        const shift = Math.min(config.parallax * 45, 11); // %
        const els = content.querySelectorAll<HTMLElement>('[data-parallax]');
        els.forEach((el) => {
          gsap.set(el, { scale: 1.24, force3D: true });
          tweens.push(
            gsap.fromTo(
              el,
              { yPercent: -shift },
              {
                yPercent: shift,
                ease: 'none',
                scrollTrigger: {
                  trigger: el.parentElement || el,
                  scroller,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            ),
          );
        });
      }

      ScrollTrigger.refresh();
    } catch (e) {
      console.warn('[SiteMotion] 初期化に失敗。ネイティブスクロールにフォールバックします。', e);
    }

    return () => {
      tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
      if (tickerFn) { gsap.ticker.remove(tickerFn); gsap.ticker.lagSmoothing(500, 33); }
      try { lenis?.destroy(); } catch { /* noop */ }
      // パララックスで設定した transform を素に戻す
      const content2 = contentRef.current;
      if (content2) {
        content2.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => gsap.set(el, { clearProps: 'transform' }));
      }
      ScrollTrigger.refresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reinitKey, config.enabled, wantSmooth, wantParallax, config.parallax]);
}
