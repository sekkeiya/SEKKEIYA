export interface AiMoodBoardParams {
  title: string;
  subtitle: string;
  colors: string[];
}

export interface AiMaterialBoardParams {
  title: string;
  materials: { name: string; maker: string; specs: string }[];
}

export interface AiZoningParams {
  title: string;
  zones: { text: string; name?: string; color: string; areaStr?: string }[];
}

export interface AiSpatialNode {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  props?: Record<string, any>;
}

export interface AiSpatialEdge {
  from: string;
  to: string;
  props?: Record<string, any>;
}

export interface AiSpatialLayoutParams {
  title: string;
  nodes: AiSpatialNode[];
  edges: AiSpatialEdge[];
}

export type CanvasAiResponse = 
  | { type: 'moodboard'; params: AiMoodBoardParams }
  | { type: 'materialboard'; params: AiMaterialBoardParams }
  | { type: 'zoning'; params: AiZoningParams }
  | { type: 'spatial_layout'; params: AiSpatialLayoutParams };

export const executeCanvasAiPrompt = async (prompt: string): Promise<CanvasAiResponse> => {
  // Simulate network generation delay
  await new Promise(r => setTimeout(r, 1500));
  
  if (prompt.includes('レイアウト') || prompt.includes('配置') || prompt.includes('デスク')) {
    // Generate a structured JSON representing exactly X/Y coordinates for 10 desks
    const deskNodes: AiSpatialNode[] = [];
    
    // Create a 5x2 grid of desks
    let idCounter = 1;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        deskNodes.push({
          id: `desk_${idCounter}`,
          type: 'zoning',
          x: col * 120, // specific X coordinate layout
          y: row * 100, // specific Y coordinate layout
          w: 100,
          h: 60,
          props: {
            color: 'var(--brand-fg)',
            text: `Desk ${idCounter}`
          }
        });
        idCounter++;
      }
    }

    return {
      type: 'spatial_layout',
      params: {
        title: 'Auto-Generated spatial JSON layout',
        nodes: deskNodes,
        edges: []
      }
    };
  } else if (prompt.includes('マテリアル')) {
    return {
      type: 'materialboard',
      params: {
        title: prompt,
        materials: [
          { name: '杉無垢材', maker: 'WoodCo', specs: 'T=15mm, オイルフィニッシュ' },
          { name: '漆喰壁', maker: 'NaturalWall', specs: 'オフホワイト, 左官仕上げ' },
          { name: '大谷石', maker: 'StoneWorks', specs: '300x600, 割り肌' },
          { name: '黒皮鉄', maker: 'MetalFab', specs: 'クリアコーティング' }
        ]
      }
    };
  } else if (prompt.includes('ゾーニング')) {
    return {
      type: 'zoning',
      params: {
        title: prompt,
        zones: [
          { text: 'LDK', color: 'light-dark(#ad9c00, #FFF9C4)', areaStr: '30㎡' },
          { text: '寝室', color: 'var(--brand-fg)', areaStr: '12㎡' },
          { text: '水回り', color: 'var(--brand-fg)', areaStr: '8㎡' },
          { text: '玄関', color: 'var(--brand-fg)', areaStr: '5㎡' }
        ]
      }
    };
  } else {
    // Default to Mood Board
    let titleStr = prompt;
    if (prompt.length > 20) titleStr = prompt.substring(0, 20) + '...';
    
    return {
      type: 'moodboard',
      params: {
        title: 'CONCEPT: ' + titleStr,
        subtitle: 'AI automatically composed this mood board based on your input.',
        colors: ['#1A1A1D', '#4E4E50', '#6F2232', '#950740', '#C3073F'] // Random generated palette
      }
    };
  }
};
