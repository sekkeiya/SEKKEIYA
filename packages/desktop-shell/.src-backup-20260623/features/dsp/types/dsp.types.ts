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
