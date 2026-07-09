import type { WorkFile } from '../../../features/projects/types';

// Element Data Unions

export type CommonStyleData = {
  border?: string;
  borderRadius?: string;
  boxShadow?: string;
  bgcolor?: string;
  padding?: number;
  fontWeight?: string;
};

export type TextElementData = CommonStyleData & { text: string; fontSize: string; color: string; textAlign: string; };
export type ImageCrop = { imgX: number; imgY: number; imgW: number; imgH: number }; // fractions of element container

export type ImageElementData = CommonStyleData & {
  src: string;
  alt?: string;
  assetId?: string;
  storagePath?: string;
  mimeType?: string;
  name?: string;
  crop?: ImageCrop;
};
export type ShapeElementData = CommonStyleData & { shapeType: 'rect' | 'circle'; fill: string; stroke?: string; };
export type ModelCardElementData = CommonStyleData & { title: string; subtitle?: string; thumbnailUrl: string; sourceLabel?: string; };
export type LineElementData = CommonStyleData & { fill: string; stroke?: string; strokeWidth?: string; strokeDasharray?: string; showArrow?: boolean; startBindingId?: string; endBindingId?: string; };
export type LinkElementData = CommonStyleData & { url: string; text?: string; title?: string; description?: string; thumbnailUrl?: string; color?: string; fontSize?: string; textAlign?: string; };
export type DrawingElementData = CommonStyleData & { pathData: string; stroke: string; strokeWidth: number; };

export type ElementData = TextElementData | ImageElementData | ShapeElementData | ModelCardElementData | LineElementData | LinkElementData | DrawingElementData;

/**
 * テンプレートの「差し替え枠」。この枠を持つ要素は、テンプレ適用時に
 * 中身(text/image)だけを外部（手動フォーム / AI）から流し込める。
 * slot を持たない要素は固定装飾として扱い、差し替え対象にしない。
 */
export interface TemplateSlot {
  /** テンプレ内で一意なキー e.g. "hero-image" */
  id: string;
  /** 意味づけ e.g. "project-title" / "exterior-photo"（AI/自動化のフック） */
  role: string;
  /** 差し替え種別。text は data.text、image は data.src を置換 */
  kind: 'text' | 'image';
  /** UI表示名「外観写真」など */
  label?: string;
  /** 空欄時のガイド文言 */
  placeholder?: string;
}

export interface PresentationElement {
  id: string;
  type: 'text' | 'image' | 'shape' | 'modelCard' | 'line' | 'link' | 'drawing';
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  rotation: number;
  opacity?: number;
  data: ElementData;
  /** テンプレート差し替え枠（任意・後方互換）。text/image 要素にのみ意味を持つ */
  slot?: TemplateSlot;
}

export interface PresentationPage {
  id: string;
  name: string;
  elements: PresentationElement[];
  notes?: string; // スピーカーノート（プレゼン時に参照するメモ）
}

export interface CanvasSize {
  width: number;
  height: number;
  name: string;
}

export interface PresentationContent {
  pages: PresentationPage[];
  canvasSize?: CanvasSize;
  theme?: any; // For future theme expansion
}

// Extension of the SEKKEIYA unified WorkFile
export interface PresentationWorkFile extends WorkFile {
  toolType: 'other' | 'rhino' | 'blender' | 'sketchup' | 'revit'; // Must match WorkFileToolType base, but functionally handled as '3dsp' in appScope.
  appScope?: '3dsp' | string; // Optionally map the exact scope
  type?: 'presentation' | 'canvas' | string;
  content: PresentationContent;
  tags?: string[];
  visibility?: 'public' | 'private';
}
