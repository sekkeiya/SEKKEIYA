import { Editor, createShapeId } from 'tldraw';
import type { AiMoodBoardParams, AiMaterialBoardParams, AiZoningParams, AiSpatialLayoutParams } from './canvasAiService';

/**
 * Helper to generate Tldraw v3 compatible rich text structure
 */
const toRichText = (text: string) => {
  const lines = text.split("\n");
  const content = lines.map((line) => {
    if (!line) {
      return { type: "paragraph" };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: line }]
    };
  });
  return {
    type: "doc",
    content
  };
};

/**
 * Spawns a structured Mood Board layout.
 */
export const spawnMoodBoardTemplate = (editor: Editor, startPoint: { x: number, y: number }, preset: 'modern' | 'minimal' | 'japanese' = 'modern', aiParams?: AiMoodBoardParams) => {
  const { x, y } = startPoint;
  const frameId = createShapeId();
  
  // Create an A3-proportioned Frame
  editor.createShape({
    id: frameId,
    type: 'frame',
    x,
    y: y - 50,
    props: { w: 1190, h: 842, name: aiParams?.title ?? 'Mood Board: Concept 01' }
  } as any);

  // Title Text
  editor.createShapes([
    {
      type: 'text',
      x: x + 40,
      y: y + 40,
      parentId: frameId,
      props: { richText: toRichText(aiParams?.title ?? 'MODERN MINIMALIST CONCEPT'), size: 'xl', font: 'sans', textAlign: 'start' }
    },
    {
      type: 'text',
      x: x + 40,
      y: y + 100,
      parentId: frameId,
      props: { richText: toRichText(aiParams?.subtitle ?? 'Natural light and pure materials forming a tranquil atmosphere.'), size: 'm', font: 'serif', textAlign: 'start', color: 'grey' }
    }
  ] as any);

  // Auto-gridded empty Mood Board shapes (Placeholders for images)
  const cols = 3;
  const rows = 2;
  const gap = 20;
  const bw = 340;
  const bh = 240;
  
  const moodShapes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      moodShapes.push({
        type: 'moodboard',
        x: x + 40 + c * (bw + gap),
        y: y + 180 + r * (bh + gap),
        parentId: frameId,
        props: { w: bw, h: bh, keyword: `${preset} architecture ${r * cols + c}` }
      });
    }
  }
  
  editor.createShapes(moodShapes as any);

  // Add Color Palette at the bottom
  editor.createShapes([{
    type: 'color_palette',
    x: x + 40,
    y: y + 180 + rows * (bh + gap) + 20,
    parentId: frameId,
    props: { w: 400, h: 60, colors: aiParams?.colors ?? ['#FAFAFA', '#E0E0E0', '#9E9E9E', '#616161', '#212121'] }
  }] as any);
}

/**
 * Spawns a structured Material Board layout.
 */
export const spawnMaterialBoardTemplate = (editor: Editor, startPoint: { x: number, y: number }, aiParams?: AiMaterialBoardParams) => {
  const { x, y } = startPoint;
  const frameId = createShapeId();
  
  editor.createShape({
    id: frameId,
    type: 'frame',
    x,
    y,
    props: { w: 1000, h: 700, name: aiParams?.title ?? 'Material Board' }
  } as any);

  editor.createShape({
    type: 'text',
    x: x + 40,
    y: y + 40,
    parentId: frameId,
    props: { richText: toRichText(aiParams?.title ?? 'FINISH MATERIALS'), size: 'l', font: 'sans', textAlign: 'start' }
  } as any);

  const materials = aiParams?.materials ?? [
    { name: 'Oak Flooring', maker: 'WoodCo', specs: 'T=15mm, Matte clear' },
    { name: 'Acoustic Panel', maker: 'QuietRoom', specs: 'Light Grey, 600x600' },
    { name: 'Ceramic Tile', maker: 'StoneWorks', specs: '300x600, Non-slip' },
    { name: 'Steel Accent', maker: 'MetalFab', specs: 'Black Powder Coated' }
  ];

  const materialShapes = materials.map((mat, i) => ({
    type: 'material_card',
    x: x + 40 + i * 220,
    y: y + 120,
    parentId: frameId,
    props: { w: 200, h: 320, materialName: mat.name, maker: mat.maker, specs: mat.specs }
  }));

  editor.createShapes(materialShapes as any);
}

/**
 * Spawns a structured Zoning Layout.
 */
export const spawnZoningConceptTemplate = (editor: Editor, startPoint: { x: number, y: number }, aiParams?: AiZoningParams) => {
  const { x, y } = startPoint;
  const frameId = createShapeId();
  
  editor.createShape({
    id: frameId,
    type: 'frame',
    x,
    y,
    props: { w: 800, h: 600, name: aiParams?.title ?? 'Zoning Concept' }
  } as any);

  if (aiParams?.zones) {
    // Dynamic generation from AI params
    const zoneShapes = aiParams.zones.map((zone, i) => {
      // Basic scattered layout
      const zx = x + 100 + (i % 3) * 220;
      const zy = y + 100 + Math.floor(i / 3) * 220;
      return {
        type: 'zoning',
        x: zx,
        y: zy,
        parentId: frameId,
        props: { w: 180, h: 180, text: zone.text, color: zone.color }
      };
    });
    editor.createShapes(zoneShapes as any);

    // Simple connecting arrows between consecutive zones
    for (let i = 0; i < aiParams.zones.length - 1; i++) {
        const ax = x + 100 + (i % 3) * 220 + 180; // Right edge
        const ay = y + 100 + Math.floor(i / 3) * 220 + 90; // Mid height
        editor.createShapes([{
            type: 'arrow',
            x: ax, y: ay,
            parentId: frameId,
            props: { dash: 'dashed', color: 'red', size: 's', start: { x: 0, y: 0 }, end: { x: 40, y: 0 } }
        }] as any);
    }
  } else {
    // Default manual layout
    editor.createShape({
      type: 'zoning',
      x: x + 300,
      y: y + 200,
      parentId: frameId,
      props: { w: 200, h: 200, text: 'LDK', color: '#FFF9C4' }
    } as any);

    editor.createShape({
      type: 'zoning',
      x: x + 350,
      y: y + 450,
      parentId: frameId,
      props: { w: 100, h: 100, text: 'ENT', color: '#F5F5F5' }
    } as any);

    editor.createShape({
      type: 'zoning',
      x: x + 100,
      y: y + 200,
      parentId: frameId,
      props: { w: 150, h: 150, text: 'BATH', color: '#E1F5FE' }
    } as any);

    editor.createShapes([
      {
        type: 'arrow',
        x: x + 400,
        y: y + 450,
        parentId: frameId,
        props: { dash: 'dashed', color: 'red', size: 'm', start: { x: 0, y: 0 }, end: { x: 0, y: -50 } }
      },
      {
        type: 'arrow',
        x: x + 300,
        y: y + 300,
        parentId: frameId,
        props: { dash: 'dashed', color: 'red', size: 'm', start: { x: 0, y: 0 }, end: { x: -50, y: 0 } }
      }
    ] as any);
  }
}

/**
 * Spawns a layout based on deterministic X/Y JSON parsing.
 */
export const spawnSpatialLayoutTemplate = (editor: Editor, startPoint: { x: number, y: number }, aiParams?: AiSpatialLayoutParams) => {
  const { x, y } = startPoint;
  const frameId = createShapeId();
  
  // Calculate bounding box if nodes exist
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
  if (aiParams?.nodes && aiParams.nodes.length > 0) {
    minX = Math.min(...aiParams.nodes.map(n => n.x));
    minY = Math.min(...aiParams.nodes.map(n => n.y));
    maxX = Math.max(...aiParams.nodes.map(n => n.x + n.w));
    maxY = Math.max(...aiParams.nodes.map(n => n.y + n.h));
  }

  const padding = 100;
  const frameW = Math.max(800, (maxX - minX) + padding * 2);
  const frameH = Math.max(600, (maxY - minY) + padding * 2);

  editor.createShape({
    id: frameId,
    type: 'frame',
    x,
    y,
    props: { w: frameW, h: frameH, name: aiParams?.title ?? 'Spatial Generation' }
  } as any);

  if (aiParams?.nodes) {
    // Offset all nodes to be centered inside the frame (relative to frame top-left)
    const localOffsetX = padding - minX;
    const localOffsetY = padding - minY;

    const shapes = aiParams.nodes.map(node => {
      return {
        id: createShapeId(node.id),
        type: node.type,
        x: node.x + localOffsetX,
        y: node.y + localOffsetY,
        parentId: frameId,
        props: {
          w: node.w,
          h: node.h,
          ...node.props
        }
      };
    });

    editor.createShapes(shapes as any);

    if (aiParams.edges && aiParams.edges.length > 0) {
      const edges = aiParams.edges.map(edge => {
        return {
          type: 'arrow',
          parentId: frameId,
          props: {
            start: { type: 'binding', isExact: false, boundShapeId: createShapeId(edge.from) },
            end: { type: 'binding', isExact: false, boundShapeId: createShapeId(edge.to) },
            ...edge.props
          }
        };
      });
      editor.createShapes(edges as any);
    }
  }
}

