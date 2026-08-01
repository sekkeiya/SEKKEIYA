// コンテンツ領域の実測幅を返すフック（spec §1）。
// ビューポート幅ではなく実測を使う理由: サイドバー 224px は Tauri のみ描画されるため、
// 同じ窓幅でも Web と Desktop で使える幅が 224px 違う。実測ならホスト差を自動で吸収できる。
import { useEffect, useRef, useState } from 'react';

export function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0); // 0 = 計測前（呼び出し側は「制限なし」として扱う）
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      // border-box で測る: 呼び出し側はこの Box の padding を可変にするため、
      // content-box だと「padding が変わる→実測が変わる→padding が変わる」の振動になる。
      const w = e?.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth ?? 0;
      // 小数の揺れで毎フレーム再レンダーしないよう整数に丸める
      setWidth(prev => (Math.round(w) === prev ? prev : Math.round(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
