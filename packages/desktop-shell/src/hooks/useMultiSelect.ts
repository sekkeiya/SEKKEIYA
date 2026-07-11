import { useCallback, useRef, useState } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// グリッド共通の複数選択ロジック（S.Image / S.Material / S.Library / S.Movie などで共有）。
//  - 通常クリック      : 単一選択（アンカー更新）
//  - Shift + クリック   : アンカー（無ければクリック位置）からクリック位置までを範囲選択
//  - Ctrl(⌘) + クリック : そのアイテムを選択に追加／解除（トグル、アンカー更新）
//  - clear()           : 全解除（ESC などから呼ぶ）
// 範囲選択には「現在表示中のアイテムIDを表示順に並べた配列（orderedIds）」を渡す。
// 選択集合そのものは単一のソース（selectedIds）に統一し、詳細パネルは「1件選択時」に出す運用にできる。
// ──────────────────────────────────────────────────────────────────────────────

export interface MouseModifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export interface MultiSelectApi {
  /** 選択中のID集合。 */
  selectedIds: Set<string>;
  /** 選択件数。 */
  count: number;
  /** 指定IDが選択中か。 */
  isSelected: (id: string) => boolean;
  /** カードクリック時に呼ぶ。修飾キーに応じて 単一 / 範囲 / トグル。 */
  handleClick: (id: string, e?: MouseModifiers) => void;
  /** 単一選択にする（アンカーも更新）。 */
  selectOnly: (id: string) => void;
  /** 選択を丸ごと置き換える。 */
  setSelected: (ids: string[]) => void;
  /** 全解除。 */
  clear: () => void;
}

/**
 * @param orderedIds 現在表示中のアイテムIDを「表示順」に並べた配列（範囲選択に使用）。
 */
export function useMultiSelect(orderedIds: string[]): MultiSelectApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);
  // 最新の並び順を常に参照（handleClick を安定させつつ範囲計算は最新順で行う）。
  const orderedRef = useRef(orderedIds);
  orderedRef.current = orderedIds;

  const setSelected = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
  const clear = useCallback(() => setSelectedIds((prev) => (prev.size ? new Set() : prev)), []);
  const selectOnly = useCallback((id: string) => { anchorRef.current = id; setSelectedIds(new Set([id])); }, []);

  const handleClick = useCallback((id: string, e?: MouseModifiers) => {
    const ordered = orderedRef.current;
    if (e?.shiftKey) {
      const anchor = anchorRef.current ?? id;
      const a = ordered.indexOf(anchor);
      const b = ordered.indexOf(id);
      if (a < 0 || b < 0) { anchorRef.current = id; setSelectedIds(new Set([id])); return; }
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      setSelectedIds(new Set(ordered.slice(lo, hi + 1)));
      return;
    }
    if (e?.ctrlKey || e?.metaKey) {
      anchorRef.current = id;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      return;
    }
    anchorRef.current = id;
    setSelectedIds(new Set([id]));
  }, []);

  return {
    selectedIds,
    count: selectedIds.size,
    isSelected: (id: string) => selectedIds.has(id),
    handleClick,
    selectOnly,
    setSelected,
    clear,
  };
}
