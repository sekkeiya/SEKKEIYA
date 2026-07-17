// useHoverCursor — 3Dシーンのハンドル用ホバーカーソル。
//
// なぜ body ではなく canvas に当てるか:
//   同じビューポート内の他コントローラ（LayoutModeInteractionController / ZoneActiveGizmo /
//   GridPickController など）は gl.domElement.style.cursor を直接書き換える。
//   canvas 自身の cursor は body からの継承より優先されるため、body 側に書いていると
//   「一度 canvas に cursor が設定されると、以後ホバーしても見た目が変わらない」状態になる。
//   （＝数回編集するとカーソルが変わらなくなる不具合の原因）
//   そこで canvas に対して set/clear し、他コントローラと同じ土俵に載せる。
//
// clear() は "" を書いて canvas の指定を外す（他コントローラが後から "default" 等を
// 入れた場合でも、こちらの指定だけを確実に取り除ける）。
import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

export function useHoverCursor() {
  const { gl } = useThree();
  // 自分が今カーソルを掴んでいるか（アンマウント時に自分の指定だけ戻すため）
  const ownedRef = useRef(false);

  const set = useCallback((cursor) => {
    const el = gl?.domElement;
    if (!el) return;
    ownedRef.current = true;
    el.style.cursor = cursor;
  }, [gl]);

  const clear = useCallback(() => {
    const el = gl?.domElement;
    if (!el) return;
    ownedRef.current = false;
    el.style.cursor = "";
  }, [gl]);

  // アンマウント時に自分の指定を残さない
  useEffect(() => () => {
    if (ownedRef.current && gl?.domElement) gl.domElement.style.cursor = "";
  }, [gl]);

  return { set, clear };
}
