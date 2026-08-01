import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * S.Model 詳細画面: 縦スクロールする本文（`containerRef` の中）を監視し、
 * 「今どのセクションを見ているか」を返すフック。左レール（DetailRail）の
 * アクティブ行ハイライトに使う。
 *
 * 監視対象は `containerRef.current` の子孫のうち `data-section-id` 属性を持ち、
 * その値が `ids` に含まれる要素。IntersectionObserver の `rootMargin`
 * `-20% 0px -70% 0px` により、ビューポート上から20%〜30%の細い帯（＝見出しが
 * 来たら「読んでいる」とみなす位置）を判定バンドとして扱う。
 *
 * - `containerRef.current` がまだ null（初回レンダー時にスクロールコンテナの
 *   ref がまだアタッチされていない）場合は observer を作らず、次のレンダーで
 *   ref が付いたら（`ids` が変化していなくても）再試行できるよう rAF で軽くポーリングする。
 * - `ids` が変わったら（セクション構成が変わったら）全 observer を作り直す。
 * - 複数のセクションが同時にバンド内へ入っている場合は、バンドの基準線
 *   （root の `-20%` の位置）に最も近い top を持つものを採用する。
 * - アンマウント/依存変更時は必ず disconnect し、observer を残さない。
 */
export function useScrollSpy(containerRef: RefObject<HTMLElement | null>, ids: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  // 複数 id が同時に交差した時の「バンドに最も近いもの」判定に使う、直近の交差矩形。
  const rectsRef = useRef<Map<string, DOMRectReadOnly>>(new Map());

  // ids 配列が中身同じでも毎回新しい配列参照で渡されることがあるため、
  // 「実際に中身が変わったときだけ」再 observe するように文字列キーで比較する。
  const idsKey = ids.join('\u0000');

  useEffect(() => {
    const currentIds = idsKey.length ? idsKey.split('\u0000') : [];
    rectsRef.current = new Map();

    if (!currentIds.length) {
      setActiveId(null);
      return;
    }

    // ids が入れ替わった場合、旧 activeId が新しい集合に無ければ最初の id を暫定値にする
    // （observer が交差を検知するまでの間、レールが「どのアクティブ行も無い」表示にならないように）。
    setActiveId((prev) => (prev !== null && currentIds.includes(prev) ? prev : currentIds[0]));

    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let rafId: number | null = null;

    const pickActive = () => {
      let bestId: string | null = null;
      let bestTop = Infinity;
      for (const id of currentIds) {
        const rect = rectsRef.current.get(id);
        if (!rect) continue;
        // バンド内で最も上（= 一番先に読んでいる位置）にあるセクションを優先する。
        if (rect.top < bestTop) {
          bestTop = rect.top;
          bestId = id;
        }
      }
      if (bestId) setActiveId(bestId);
    };

    const setup = () => {
      if (cancelled) return;
      const root = containerRef.current;
      if (!root) {
        // ref がまだアタッチされていない: 次フレームで再試行する。
        rafId = requestAnimationFrame(setup);
        return;
      }

      const elements = currentIds
        .map((id) => root.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`))
        .filter((el): el is HTMLElement => !!el);

      if (!elements.length) {
        rafId = requestAnimationFrame(setup);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.getAttribute('data-section-id');
            if (!id) continue;
            if (entry.isIntersecting) {
              rectsRef.current.set(id, entry.boundingClientRect);
            } else {
              rectsRef.current.delete(id);
            }
          }
          pickActive();
        },
        { root, rootMargin: '-20% 0px -70% 0px' }
      );

      for (const el of elements) observer.observe(el);
    };

    setup();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observer) observer.disconnect();
    };
    // containerRef はミュータブルな RefObject なので依存に含めない（ref オブジェクト自体は不変）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return activeId;
}
