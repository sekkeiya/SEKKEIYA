import type { PresentationContent, PresentationElement, TemplateSlot } from '../types/dsp.types';

/**
 * テンプレート差し替え枠（スロット）のユーティリティ。
 *
 * - `collectSlots`  … content 内の全スロットを（ページ横断で）列挙する
 * - `fillSlots`     … スロット値マップを流し込んだ新しい content を返す（非破壊）
 *
 * スロットは PresentationElement.slot に付与される。手動フォームからも AI からも
 * 同じ `Record<slotId, value>` を渡せば同じ結果になる（B-2 の apply verb もこれを使う）。
 */

export interface CollectedSlot extends TemplateSlot {
  /** このスロットが属するページID（フォームのグルーピング用） */
  pageId: string;
  /** 現在値（プレースホルダー表示や初期値に使う） */
  currentValue: string;
}

/** text 要素なら data.text、image 要素なら data.src を現在値として返す */
function currentValueOf(el: PresentationElement): string {
  const d = el.data as any;
  if (el.slot?.kind === 'text') return d?.text ?? '';
  if (el.slot?.kind === 'image') return d?.src ?? '';
  return '';
}

/** content 内の全スロットを列挙（重複 slotId は最初の1件のみ） */
export function collectSlots(content: PresentationContent | null | undefined): CollectedSlot[] {
  if (!content?.pages) return [];
  const seen = new Set<string>();
  const out: CollectedSlot[] = [];
  for (const page of content.pages) {
    for (const el of page.elements || []) {
      if (!el.slot?.id) continue;
      if (seen.has(el.slot.id)) continue;
      seen.add(el.slot.id);
      out.push({ ...el.slot, pageId: page.id, currentValue: currentValueOf(el) });
    }
  }
  return out;
}

/** content にスロットが1つでもあるか */
export function hasSlots(content: PresentationContent | null | undefined): boolean {
  if (!content?.pages) return false;
  return content.pages.some(p => (p.elements || []).some(e => !!e.slot?.id));
}

/**
 * スロット値を流し込んだ新しい content を返す（元は変更しない）。
 * @param values slotId → 値（text はプレーン文字列、image は画像URL）。
 *   未指定 or 空文字のスロットは元の内容を維持する。
 * @param imageMeta 任意。image スロットに assetId 等を併せて反映したいとき。
 */
export function fillSlots(
  content: PresentationContent,
  values: Record<string, string>,
  imageMeta?: Record<string, { assetId?: string; name?: string; storagePath?: string }>,
): PresentationContent {
  const clone: PresentationContent = JSON.parse(JSON.stringify(content));
  for (const page of clone.pages) {
    for (const el of page.elements || []) {
      const slot = el.slot;
      if (!slot?.id) continue;
      const v = values[slot.id];
      if (v == null || v === '') continue; // 未入力は据え置き
      const d = el.data as any;
      if (slot.kind === 'text') {
        d.text = v;
      } else if (slot.kind === 'image') {
        d.src = v;
        const meta = imageMeta?.[slot.id];
        if (meta) {
          if (meta.assetId !== undefined) d.assetId = meta.assetId;
          if (meta.name !== undefined) d.name = meta.name;
          if (meta.storagePath !== undefined) d.storagePath = meta.storagePath;
        }
      }
    }
  }
  return clone;
}
