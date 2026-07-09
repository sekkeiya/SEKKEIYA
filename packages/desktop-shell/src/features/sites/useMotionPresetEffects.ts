// モーションプリセット個別演出のランタイム。
// プリセット ID に応じて、必要なライブラリ（GSAP / Anime.js / Motion One）だけを
// 動的 import して DOM に適用する。Lenis 慣性スクロール＋GSAP パララックスは
// useSiteMotion 側が担当するため、ここではそれ以外の「プリセット固有の演出」を扱う。
//
// 対応プリセット:
//   GSAP        : mo-text-reveal（見出しの文字スタッガー） / mo-pin-scroll（セクションピン）
//                 mo-clip-reveal（画像クリップ） / mo-marquee（キッカー横流れ）
//   Anime.js    : mo-glitch（見出しグリッチ）
//   Motion One  : mo-soft-stagger（セクション順次フェード） / mo-magnetic（ボタン磁着）
//
// すべて preview 時のみ。失敗時は静かに無視（CSS/Framer のまま）。

import { useEffect } from 'react';
import { findMotionPreset } from './motionPresets';

interface Options {
  scrollerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  presetId: string | undefined;
  enabled: boolean;          // preview かつ reduced でない
  reinitKey: string;         // ページ/セクション/モード変更で再初期化
}

export function useMotionPresetEffects({ scrollerRef, contentRef, presetId, enabled, reinitKey }: Options): void {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!enabled || !presetId || !scroller || !content) return;

    let disposed = false;
    let cleanup: () => void = () => {};

    const run = async () => {
      try {
        const effect = findMotionPreset(presetId)?.effect;
        switch (effect) {
          // ───────── GSAP 系 ─────────
          case 'text': {
            const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
              import('gsap'), import('gsap/ScrollTrigger'),
            ]);
            if (disposed) return;
            gsap.registerPlugin(ScrollTrigger);
            // 見出し（h1/h2 相当の大見出し）を単語スパンに分割してスタッガー出現
            const heads = content.querySelectorAll<HTMLElement>('[data-motion-heading], h1, h2');
            const restorers: (() => void)[] = [];
            const triggers: ScrollTrigger[] = [];
            heads.forEach((h) => {
              if (h.dataset.split === '1') return;
              const original = h.innerHTML;
              const text = h.textContent ?? '';
              if (!text.trim()) return;
              h.dataset.split = '1';
              h.innerHTML = text.split(/(\s+)/).map(w =>
                /^\s+$/.test(w) ? w : `<span class="mo-word" style="display:inline-block;will-change:transform,opacity">${w}</span>`
              ).join('');
              const words = h.querySelectorAll<HTMLElement>('.mo-word');
              gsap.set(words, { yPercent: 110, opacity: 0 });
              const tw = gsap.to(words, {
                yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.04,
                scrollTrigger: { trigger: h, scroller, start: 'top 88%', once: true },
              });
              triggers.push(...(tw.scrollTrigger ? [tw.scrollTrigger] : []));
              restorers.push(() => { h.innerHTML = original; delete h.dataset.split; });
            });
            ScrollTrigger.refresh();
            cleanup = () => { triggers.forEach(t => t.kill()); restorers.forEach(r => r()); };
            break;
          }

          case 'pin': {
            const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
              import('gsap'), import('gsap/ScrollTrigger'),
            ]);
            if (disposed) return;
            gsap.registerPlugin(ScrollTrigger);
            // 各セクションを少しだけピン留めしながらフェード（最後の 1 つは除く）
            const secs = Array.from(content.querySelectorAll<HTMLElement>('[id^="sec-"]'));
            const triggers: ScrollTrigger[] = [];
            secs.slice(0, -1).forEach((sec) => {
              const st = ScrollTrigger.create({
                trigger: sec, scroller, start: 'top top', end: '+=40%', pin: true, pinSpacing: false,
                onUpdate: (self) => { gsap.set(sec, { opacity: 1 - self.progress * 0.55, scale: 1 - self.progress * 0.04 }); },
              });
              triggers.push(st);
            });
            ScrollTrigger.refresh();
            cleanup = () => { triggers.forEach(t => t.kill()); secs.forEach(s => gsap.set(s, { clearProps: 'opacity,transform' })); };
            break;
          }

          case 'clip': {
            const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
              import('gsap'), import('gsap/ScrollTrigger'),
            ]);
            if (disposed) return;
            gsap.registerPlugin(ScrollTrigger);
            const imgs = content.querySelectorAll<HTMLElement>('img');
            const tweens: gsap.core.Tween[] = [];
            imgs.forEach((img) => {
              const tw = gsap.fromTo(img,
                { clipPath: 'inset(18% 0% 18% 0%)' },
                { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.out',
                  scrollTrigger: { trigger: img, scroller, start: 'top 85%', once: true } });
              tweens.push(tw);
            });
            ScrollTrigger.refresh();
            cleanup = () => { tweens.forEach(t => { t.scrollTrigger?.kill(); t.kill(); }); imgs.forEach(i => gsap.set(i, { clearProps: 'clipPath' })); };
            break;
          }

          case 'marquee': {
            const { default: gsap } = await import('gsap');
            if (disposed) return;
            // キッカー（小見出し）を横に流す
            const kickers = content.querySelectorAll<HTMLElement>('[data-motion-kicker]');
            const tweens: gsap.core.Tween[] = [];
            kickers.forEach((k) => {
              const tw = gsap.fromTo(k, { xPercent: 8 }, { xPercent: -8, duration: 6, ease: 'sine.inOut', repeat: -1, yoyo: true });
              tweens.push(tw);
            });
            cleanup = () => { tweens.forEach(t => t.kill()); kickers.forEach(k => gsap.set(k, { clearProps: 'transform' })); };
            break;
          }

          // ───────── Anime.js 系 ─────────
          case 'glitch': {
            const anime = await import('animejs');
            if (disposed) return;
            const animate = (anime as any).animate ?? (anime as any).default?.animate;
            if (!animate) return;
            const heads = content.querySelectorAll<HTMLElement>('[data-motion-heading], h1, h2');
            const stops: Array<{ pause?: () => void }> = [];
            heads.forEach((h) => {
              const a = animate(h, {
                translateX: [0, -2, 3, -1, 0],
                opacity: [1, 0.82, 1, 0.9, 1],
                skewX: [0, 1.5, -1.5, 0],
                duration: 1600, delay: 200, loop: true, ease: 'inOut(2)',
              });
              stops.push(a);
            });
            cleanup = () => { stops.forEach(s => { try { s.pause?.(); } catch { /* noop */ } }); heads.forEach(h => { h.style.transform = ''; h.style.opacity = ''; }); };
            break;
          }

          // ───────── Motion One 系 ─────────
          case 'stagger': {
            const motion = await import('motion');
            if (disposed) return;
            const { animate, inView } = motion as any;
            if (!animate || !inView) return;
            const secs = content.querySelectorAll<HTMLElement>('[id^="sec-"]');
            const detachers: Array<() => void> = [];
            secs.forEach((sec) => {
              sec.style.opacity = '0';
              const stop = inView(sec, () => {
                animate(sec, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.6, easing: [0.22, 1, 0.36, 1] });
                return () => {};
              }, { root: scroller, amount: 0.2 });
              detachers.push(typeof stop === 'function' ? stop : () => {});
            });
            cleanup = () => { detachers.forEach(d => d()); secs.forEach(s => { s.style.opacity = ''; s.style.transform = ''; }); };
            break;
          }

          case 'magnetic': {
            const motion = await import('motion');
            if (disposed) return;
            const { animate } = motion as any;
            if (!animate) return;
            const targets = content.querySelectorAll<HTMLElement>('button, a, [data-motion-magnetic]');
            const handlers: Array<{ el: HTMLElement; move: (e: MouseEvent) => void; leave: () => void }> = [];
            targets.forEach((el) => {
              const move = (e: MouseEvent) => {
                const r = el.getBoundingClientRect();
                const dx = (e.clientX - (r.left + r.width / 2)) * 0.25;
                const dy = (e.clientY - (r.top + r.height / 2)) * 0.25;
                animate(el, { transform: `translate(${dx}px, ${dy}px)` }, { duration: 0.2 });
              };
              const leave = () => animate(el, { transform: 'translate(0px, 0px)' }, { duration: 0.4, easing: [0.22, 1, 0.36, 1] });
              el.addEventListener('mousemove', move);
              el.addEventListener('mouseleave', leave);
              handlers.push({ el, move, leave });
            });
            cleanup = () => { handlers.forEach(({ el, move, leave }) => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); el.style.transform = ''; }); };
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.warn('[MotionPreset] 演出の初期化に失敗。フォールバックします。', e);
      }
    };

    run();

    return () => { disposed = true; try { cleanup(); } catch { /* noop */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, enabled, reinitKey]);
}
