import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

interface Props {
  /** 表示前に確保しておく高さ。スクロールバーが飛ばないように実際の中身に近い値を入れる。 */
  minHeight?: number;
  /** ビューポートからこの距離まで近づいたら描画を始める。 */
  rootMargin?: string;
  children: React.ReactNode;
}

/**
 * 画面外のセクションを、近づくまで描画しないためのラッパー。
 *
 * モデル詳細では「関連モデル」「ギャラリー」などが最大70枚のカードを持つが、
 * 上部のビューアが 80vh を占めるためどれも初期表示では見えていない。
 * それでも即マウントしていたため、詳細画面を開くたびに大量のカード生成と
 * 画像リクエストが走り、表示が重くなっていた。
 *
 * IntersectionObserver が使えない環境では素直にそのまま描画する（機能は落とさない）。
 */
export const DeferUntilVisible: React.FC<Props> = ({ minHeight = 240, rootMargin = '400px', children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShown(true);
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);

  // 描画後は高さを中身に任せる（プレースホルダの minHeight を残すと余白になるため）。
  return <Box ref={ref} sx={shown ? undefined : { minHeight }}>{shown ? children : null}</Box>;
};
