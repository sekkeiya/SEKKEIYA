/**
 * Converts a standardized Asset object into a strict Canvas Element schema.
 * 
 * Standard Canvas Element Payload:
 * {
 *   id: string,
 *   type: 'image' | 'modelCard' | 'text' | 'shape',
 *   x: string, y: string, w: string, h: string,
 *   zIndex: number, rotation: number, locked: boolean,
 *   source: string (original asset source),
 *   data: object (type-specific payload)
 * }
 */
export const createElementFromAsset = (asset, positionOffset = 0) => {
    const baseOffset = 100 + positionOffset * 20; // diagonal step
    const baseX = baseOffset;
    const baseY = baseOffset;
    
    const baseElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x: baseX,
        y: baseY,
        zIndex: 1,
        rotation: 0,
        locked: false,
        source: asset.source,
        data: {}
    };

    if (asset.assetType === 'image' || asset.assetType === 'generatedImage') {
        return {
            ...baseElement,
            type: 'image',
            w: 400,
            h: 300,
            data: {
                src: asset.previewUrl || asset.thumbnailUrl || 'https://via.placeholder.com/400x300?text=No+Preview',
                alt: asset.title || 'Image',
                title: asset.title || 'Untitled Image'
            }
        };
    } else if (asset.assetType === 'model') {
        return {
            ...baseElement,
            type: 'modelCard',
            w: 240,
            h: 320,
            data: {
                thumbnailUrl: asset.thumbnailUrl || 'https://via.placeholder.com/240x320?text=No+Thumbnail',
                title: asset.title || 'Untitled Model',
                sourceLabel: asset.source || '3D Asset',
                subtitle: asset.description || '',
                metadata: asset.metadata || {}
            }
        };
    } else {
        // Fallback for documents or unknowns
        return {
            ...baseElement,
            type: 'text',
            w: 300,
            h: 60,
            data: {
                text: `[Unsupported Asset: ${asset.title}]`,
                fontSize: '16px',
                fontWeight: 'normal'
            }
        };
    }
};
