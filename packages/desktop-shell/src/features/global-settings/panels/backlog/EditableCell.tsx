// backlog/EditableCell.tsx — 表示と編集を分離したテーブルセル。
//
// 目的（性能）: 開発状況テーブルは 1 行あたり Select×4 + Autocomplete×2 の重量コントロールを
// 持つ。これを常時マウントすると N 行で ~6N 個の MUI コントロール（＋Popper/Modal の準備）が
// 生き続け、初期表示とスクロール/列幅ドラッグが重くなる。そこで非編集時は「見た目だけの軽量
// ノード」を描き、クリック（または Enter/Space）で初めて実コントロールをマウントする。
// 実コントロールは autoOpen で即プルダウンを開くので、体験は「1 クリックで開く」ままにする。
//
// 同時に編集中にできるセルはモジュールスコープの `active` で 1 つに制限する。各コントロールは
// 自前の閉じ経路（Select: onClose / Autocomplete: onClose('selectOption'|'blur'|'escape')）で
// close() を呼ぶが、万一取りこぼしても編集中セルが積み上がらないための保険（＝常時マウント ≤1）。
//
// ※ ここでは document の mousedown による「外側クリックで閉じる」を敢えて行わない。
//    MUI の Menu / Autocomplete のポップアップは portal（このノードの外側）に描かれるため、
//    mousedown で unmount すると候補クリックの mouseup/click が届かず「選べない」不具合になる。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

export interface EditableCellProps {
  /** 非編集時に見せる軽量ノード（Badge/Dot＋ラベル or Dash）。閉じたコントロールの見た目と一致させる。
   *  role="button" の accessible name はこのノードの text content から取る（aria-label は付けない）。
   *  aria-label を足すと視覚上の現在値が読み上げられなくなるため（例:「種別を編集, ボタン」だけになり
   *  実際の値が聞こえない）、常に「見えている内容がそのまま名前になる」形を保つこと。 */
  display: React.ReactNode;
  /** 編集時にマウントする実コントロール。確定/キャンセル時に close() を呼ぶ。 */
  children: (close: () => void) => React.ReactNode;
}

/** 現在編集中のセル（の setEditing）。useState の setter は React が同一参照を保証するので識別子に使える。 */
let active: React.Dispatch<React.SetStateAction<boolean>> | null = null;

export const EditableCell: React.FC<EditableCellProps> = ({ display, children }) => {
  const [editing, setEditing] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const restoreFocus = useRef(false); // 閉じたらセルへフォーカスを戻すか（マウス/キーボードどちらの開始でも true）

  const close = useCallback(() => {
    if (active === setEditing) active = null;
    setEditing(false);
  }, []);

  const beginEdit = useCallback(() => {
    if (active && active !== setEditing) active(false); // 直前に開いていたセルを閉じる
    active = setEditing;
    restoreFocus.current = true;
    setEditing(true);
  }, []);

  // アンマウント時に登録を残さない（削除された行の setter を後から呼ばないため）。
  useEffect(() => () => { if (active === setEditing) active = null; }, []);

  // 編集を閉じた後、フォーカスがどこにも無い（実コントロールが消えて body に落ちた）ときだけ
  // セルへ戻す。クリック起点でもキーボード起点でも同じ扱い。他のセル/要素が既にフォーカスを
  // 取っている場合は奪わない。
  useEffect(() => {
    if (editing || !restoreFocus.current) return;
    restoreFocus.current = false;
    if (document.activeElement === document.body || document.activeElement === null) boxRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <Box
        ref={boxRef}
        role="button"
        tabIndex={0}
        onClick={() => beginEdit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beginEdit(); }
        }}
        sx={{
          // minHeight 26 = 編集時のコントロール（Select 24 / Autocomplete 26）と同じ高さ。
          // 表示⇄編集で行の高さが跳ねないようにする。
          display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, minHeight: 26,
          px: 0.5, borderRadius: 0.5, overflow: 'hidden', cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '1px solid', outlineColor: 'light-dark(#0875a6, #4fc3f7)', outlineOffset: '-1px' },
        }}
      >
        {display}
      </Box>
    );
  }

  return (
    // Escape の保険（Select の Menu / Autocomplete は自前で Escape を握って onClose を出すので、
    // ここに届くのは実コントロールが処理しなかった場合だけ）。
    <Box
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
      sx={{ width: '100%', minWidth: 0 }}
    >
      {children(close)}
    </Box>
  );
};
