import type {
  PresentationContent,
  PresentationElement,
  PresentationPage,
  TextElementData,
  ImageElementData,
  ShapeElementData,
} from '../types/dsp.types';

/**
 * 「開いているプレゼンを AI が思いのままに編集する」ための ops アプライヤ（docs/24 フェーズB-4）。
 *
 * チャット（SEKKEIYA OS）で受けた自然言語指示を、モデルが構造化した ops 配列に落とし、
 * ここで **非破壊的に** content へ適用する。手動編集（useDspStore のアクション群）と
 * 同じ結果になるよう、element/page への変更のみを行う純粋関数として実装する。
 *
 * - スロット(slot)に縛られず、任意の要素を対象にできる（スロットは apply_presentation_template の領分）。
 * - 返り値の applied / errors で、モデルに「何が効いて何が失敗したか」をフィードバックする。
 */

export type PresentationEditOp =
  | { op: 'set_text'; elementId: string; text: string }
  | {
      op: 'set_style';
      elementId: string;
      color?: string;
      fontSize?: number | string;
      fontWeight?: string;
      textAlign?: 'left' | 'center' | 'right';
      fill?: string;
      opacity?: number;
      bgcolor?: string;
      borderRadius?: string;
    }
  | { op: 'set_image'; elementId: string; src: string; alt?: string }
  | {
      op: 'move';
      elementId: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      rotation?: number;
      opacity?: number;
    }
  | {
      op: 'add_text';
      pageId?: string;
      text: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      fontSize?: number | string;
      color?: string;
      textAlign?: 'left' | 'center' | 'right';
      fontWeight?: string;
    }
  | {
      op: 'add_shape';
      pageId?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      shapeType?: 'rect' | 'circle';
      fill?: string;
    }
  | { op: 'add_image'; pageId?: string; src: string; alt?: string; x?: number; y?: number; w?: number; h?: number }
  | { op: 'delete_element'; elementId: string }
  | { op: 'add_slide'; afterPageId?: string; name?: string }
  | { op: 'delete_slide'; pageId: string }
  | { op: 'duplicate_slide'; pageId: string };

export interface ApplyOpsResult {
  content: PresentationContent;
  /** 適用に成功した ops の要約（モデルへの確認用） */
  applied: string[];
  /** 失敗した ops とその理由 */
  errors: { index: number; op: string; reason: string }[];
  /** 実際に変更が入ったか */
  changed: boolean;
}

let idSeq = 0;
function newElId(): string {
  return `el-${Date.now().toString(36)}-${(idSeq++).toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}
function newPageId(): string {
  return `page-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;
}

/** fontSize は "24px" 形式の文字列に正規化する（数値・単位なしも許容）。 */
function normFontSize(v: number | string | undefined): string | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'number') return `${Math.round(v)}px`;
  return /^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}px` : v;
}

/** content 全ページから element を探し、所属ページとインデックスを返す。 */
function findElement(content: PresentationContent, elementId: string) {
  for (const page of content.pages) {
    const idx = (page.elements || []).findIndex((e) => e.id === elementId);
    if (idx !== -1) return { page, idx, el: page.elements[idx] };
  }
  return null;
}

function targetPage(content: PresentationContent, pageId?: string): PresentationPage | null {
  if (pageId) return content.pages.find((p) => p.id === pageId) || null;
  return content.pages[0] || null;
}

/** 新規要素の既定 bbox（canvas に対する中央寄せの妥当な初期値）。 */
function defaultBox(content: PresentationContent, w = 400, h = 120) {
  const cw = content.canvasSize?.width ?? 1280;
  const ch = content.canvasSize?.height ?? 720;
  return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w, h };
}

/**
 * ops を content に **非破壊的に** 適用する。元の content は変更しない。
 * 未知の op / 対象不明はスキップして errors に積み、他の ops は続行する（部分適用）。
 */
export function applyPresentationOps(
  source: PresentationContent,
  ops: PresentationEditOp[] | null | undefined,
): ApplyOpsResult {
  const content: PresentationContent = JSON.parse(JSON.stringify(source));
  const applied: string[] = [];
  const errors: { index: number; op: string; reason: string }[] = [];

  if (!Array.isArray(ops) || ops.length === 0) {
    return { content, applied, errors, changed: false };
  }

  ops.forEach((raw, index) => {
    const op = (raw as any)?.op as string;
    const fail = (reason: string) => errors.push({ index, op: op || '(none)', reason });
    try {
      switch (op) {
        case 'set_text': {
          const found = findElement(content, (raw as any).elementId);
          if (!found) return fail(`要素が見つかりません: ${(raw as any).elementId}`);
          if (found.el.type !== 'text') return fail('text 要素ではありません');
          (found.el.data as TextElementData).text = String((raw as any).text ?? '');
          applied.push(`テキスト更新 ${found.el.id}`);
          return;
        }
        case 'set_style': {
          const r = raw as Extract<PresentationEditOp, { op: 'set_style' }>;
          const found = findElement(content, r.elementId);
          if (!found) return fail(`要素が見つかりません: ${r.elementId}`);
          const d = found.el.data as any;
          if (r.color !== undefined) d.color = r.color;
          const fs = normFontSize(r.fontSize);
          if (fs !== undefined) d.fontSize = fs;
          if (r.fontWeight !== undefined) d.fontWeight = r.fontWeight;
          if (r.textAlign !== undefined) d.textAlign = r.textAlign;
          if (r.fill !== undefined) d.fill = r.fill;
          if (r.bgcolor !== undefined) d.bgcolor = r.bgcolor;
          if (r.borderRadius !== undefined) d.borderRadius = r.borderRadius;
          if (r.opacity !== undefined) found.el.opacity = Math.max(0, Math.min(100, r.opacity));
          applied.push(`スタイル更新 ${found.el.id}`);
          return;
        }
        case 'set_image': {
          const r = raw as Extract<PresentationEditOp, { op: 'set_image' }>;
          const found = findElement(content, r.elementId);
          if (!found) return fail(`要素が見つかりません: ${r.elementId}`);
          if (found.el.type !== 'image') return fail('image 要素ではありません');
          if (!r.src) return fail('src が必要です');
          const d = found.el.data as ImageElementData;
          d.src = r.src;
          if (r.alt !== undefined) d.alt = r.alt;
          applied.push(`画像差し替え ${found.el.id}`);
          return;
        }
        case 'move': {
          const r = raw as Extract<PresentationEditOp, { op: 'move' }>;
          const found = findElement(content, r.elementId);
          if (!found) return fail(`要素が見つかりません: ${r.elementId}`);
          if (r.x !== undefined) found.el.x = Math.round(r.x);
          if (r.y !== undefined) found.el.y = Math.round(r.y);
          if (r.w !== undefined) found.el.w = Math.max(1, Math.round(r.w));
          if (r.h !== undefined) found.el.h = Math.max(1, Math.round(r.h));
          if (r.rotation !== undefined) found.el.rotation = r.rotation;
          if (r.opacity !== undefined) found.el.opacity = Math.max(0, Math.min(100, r.opacity));
          applied.push(`位置/サイズ更新 ${found.el.id}`);
          return;
        }
        case 'add_text': {
          const r = raw as Extract<PresentationEditOp, { op: 'add_text' }>;
          const page = targetPage(content, r.pageId);
          if (!page) return fail(`ページが見つかりません: ${r.pageId ?? '(先頭)'}`);
          const box = defaultBox(content, r.w ?? 500, r.h ?? 100);
          const el: PresentationElement = {
            id: newElId(),
            type: 'text',
            x: r.x ?? box.x,
            y: r.y ?? box.y,
            w: r.w ?? box.w,
            h: r.h ?? box.h,
            zIndex: page.elements.length,
            rotation: 0,
            opacity: 100,
            data: {
              text: String(r.text ?? ''),
              fontSize: normFontSize(r.fontSize) ?? '28px',
              color: r.color ?? '#1d1d1f',
              textAlign: r.textAlign ?? 'left',
              fontWeight: r.fontWeight ?? '400',
            } as TextElementData,
          };
          page.elements.push(el);
          applied.push(`テキスト追加 ${el.id}`);
          return;
        }
        case 'add_shape': {
          const r = raw as Extract<PresentationEditOp, { op: 'add_shape' }>;
          const page = targetPage(content, r.pageId);
          if (!page) return fail(`ページが見つかりません: ${r.pageId ?? '(先頭)'}`);
          const box = defaultBox(content, r.w ?? 300, r.h ?? 200);
          const el: PresentationElement = {
            id: newElId(),
            type: 'shape',
            x: r.x ?? box.x,
            y: r.y ?? box.y,
            w: r.w ?? box.w,
            h: r.h ?? box.h,
            zIndex: page.elements.length,
            rotation: 0,
            opacity: 100,
            data: { shapeType: r.shapeType ?? 'rect', fill: r.fill ?? 'rgba(0,0,0,0.06)' } as ShapeElementData,
          };
          page.elements.push(el);
          applied.push(`図形追加 ${el.id}`);
          return;
        }
        case 'add_image': {
          const r = raw as Extract<PresentationEditOp, { op: 'add_image' }>;
          const page = targetPage(content, r.pageId);
          if (!page) return fail(`ページが見つかりません: ${r.pageId ?? '(先頭)'}`);
          if (!r.src) return fail('src が必要です');
          const box = defaultBox(content, r.w ?? 480, r.h ?? 320);
          const el: PresentationElement = {
            id: newElId(),
            type: 'image',
            x: r.x ?? box.x,
            y: r.y ?? box.y,
            w: r.w ?? box.w,
            h: r.h ?? box.h,
            zIndex: page.elements.length,
            rotation: 0,
            opacity: 100,
            data: { src: r.src, alt: r.alt ?? '' } as ImageElementData,
          };
          page.elements.push(el);
          applied.push(`画像追加 ${el.id}`);
          return;
        }
        case 'delete_element': {
          const r = raw as Extract<PresentationEditOp, { op: 'delete_element' }>;
          const found = findElement(content, r.elementId);
          if (!found) return fail(`要素が見つかりません: ${r.elementId}`);
          found.page.elements.splice(found.idx, 1);
          applied.push(`要素削除 ${r.elementId}`);
          return;
        }
        case 'add_slide': {
          const r = raw as Extract<PresentationEditOp, { op: 'add_slide' }>;
          const page: PresentationPage = {
            id: newPageId(),
            name: r.name || `スライド ${content.pages.length + 1}`,
            elements: [],
          };
          if (r.afterPageId) {
            const at = content.pages.findIndex((p) => p.id === r.afterPageId);
            if (at === -1) return fail(`ページが見つかりません: ${r.afterPageId}`);
            content.pages.splice(at + 1, 0, page);
          } else {
            content.pages.push(page);
          }
          applied.push(`スライド追加 ${page.id}`);
          return;
        }
        case 'delete_slide': {
          const r = raw as Extract<PresentationEditOp, { op: 'delete_slide' }>;
          const at = content.pages.findIndex((p) => p.id === r.pageId);
          if (at === -1) return fail(`ページが見つかりません: ${r.pageId}`);
          if (content.pages.length <= 1) return fail('最後の1枚は削除できません');
          content.pages.splice(at, 1);
          applied.push(`スライド削除 ${r.pageId}`);
          return;
        }
        case 'duplicate_slide': {
          const r = raw as Extract<PresentationEditOp, { op: 'duplicate_slide' }>;
          const at = content.pages.findIndex((p) => p.id === r.pageId);
          if (at === -1) return fail(`ページが見つかりません: ${r.pageId}`);
          const src = content.pages[at];
          const copy: PresentationPage = {
            ...JSON.parse(JSON.stringify(src)),
            id: newPageId(),
            name: `${src.name} (Copy)`,
            elements: (src.elements || []).map((e) => ({ ...JSON.parse(JSON.stringify(e)), id: newElId() })),
          };
          content.pages.splice(at + 1, 0, copy);
          applied.push(`スライド複製 ${copy.id}`);
          return;
        }
        default:
          return fail(`未知の op: ${op}`);
      }
    } catch (e: any) {
      fail(e?.message || '適用中に例外');
    }
  });

  return { content, applied, errors, changed: applied.length > 0 };
}
