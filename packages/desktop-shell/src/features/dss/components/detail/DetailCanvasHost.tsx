import type { FC, ReactNode, RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';

/**
 * S.Model 詳細画面: ページ内の複数セクションがそれぞれ3Dプレビューを持ちながら、
 * WebGL コンテキストは常に1つだけに保つための土台コンポーネント。
 *
 * 各セクションは `<DetailViewport>`（= drei `View` の DOM 要素）を通常の DOM フローの中に描画するだけでよく、
 * 実際の3D描画はここに1つだけ置く固定・全面の `<Canvas>` が `<View.Port />` 経由でまとめて行う
 * （drei が各 View のトラッキング要素の `getBoundingClientRect()` を毎フレーム読み、
 * scissor + viewport を切り替えながらそれぞれの矩形へ描画する）。
 *
 * Canvas 自体は詳細画面ルート（position:relative + overflow:hidden）内の absolute + pointerEvents:none
 * にして、ページの通常のスクロール/クリックを一切妨げない。ポインタ操作（OrbitControls のドラッグ等）は
 * `eventSource` に渡されたページ側のスクロール領域が受け取り、drei がその座標を各 View の
 * カメラ/レイキャスターへ変換する。
 *
 * ⚠ position:fixed（ウィンドウ全面）にしないこと。View の描画矩形は各トラッキング要素の
 * getBoundingClientRect() そのままで、スクロールコンテナのクリップを知らない。fixed だと
 * セクションがヘッダー下へスクロールアウトしたとき、アプリのタブバーやヘッダーの上に
 * 3D 描画が漏れて見える（2026-08-01 実機で発生）。absolute なら Canvas 自体が詳細エリアの
 * 外を覆わないため、はみ出した scissor 矩形は描画バッファ外として自然に切り捨てられる。
 * 例外は全画面（elevated）のみ — 全画面コンテナが fixed 100vw/100vh のため、Canvas も
 * fixed へ昇格させる。
 */
export interface DetailCanvasHostProps {
  /** ポインタイベントの発生源（ページ側のスクロールコンテナ等）。drei の View がここへイベントを委譲する。 */
  eventSourceRef: RefObject<HTMLElement>;
  /** ページ本体。内部に 0 個以上の `<DetailViewport>` を含む通常の DOM ツリー。 */
  children: ReactNode;
  /**
   * true の間、共有 Canvas の zIndex を 1301 まで引き上げる（既定は 0）。
   *
   * OverviewSection の「全画面」表示は、通常の DOM overlay とは異なりページ内の他要素より
   * 確実に前面へ出すため zIndex:1300 の昇格された stacking context を持つ（オーバーレイボタンや
   * 背景色を含む）。Canvas がそれより低い z のままだと、全画面コンテナの「不透明な背景色」ごと
   * Canvas より前面に塗られてしまい、3D 描画そのものが黒い矩形の下に隠れる（Finding I2）。
   * 全画面中だけ Canvas をさらに上（1301）へ昇格させることで、Canvas の実際の描画ピクセルは
   * 背景色より前面に出て見えるようになる。全画面コンテナ内のオーバーレイボタン類は、
   * この Canvas よりさらに上（1302）の別要素として実装すること（OverviewSection 参照）。
   */
  elevated?: boolean;
}

export const DetailCanvasHost: FC<DetailCanvasHostProps> = ({ eventSourceRef, children, elevated }) => {
  return (
    <>
      {/* ページ側の DOM。この中に置かれた <DetailViewport>（= <View>）群が、
          自身の getBoundingClientRect() を通じて下の共有 Canvas へ描画位置を伝える。 */}
      {children}

      {/* 唯一の WebGL コンテキスト。ここには <View.Port /> 以外を置かない
          （3Dコンテンツは各 <DetailViewport> 側の <View> 内に書く）。 */}
      <Canvas
        eventSource={eventSourceRef}
        style={{ position: elevated ? 'fixed' : 'absolute', inset: 0, pointerEvents: 'none', zIndex: elevated ? 1301 : 0 }}
        gl={{ antialias: true, alpha: true }}
      >
        <View.Port />
      </Canvas>
    </>
  );
};
