import React, { Suspense, useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Stage } from '@react-three/drei';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getModelLocalPathCached } from '../../../lib/modelLocalPathCache';

function extractCanonicalId(url: string) {
  const match = url.match(/assets%2F([a-f0-9-]+)%2F/);
  if (match && match[1]) {
    return match[1];
  }
  return '';
}

const Model = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} />;
};

interface RightPanelModelViewerProps {
  modelUrl: string;
  versionId?: number | string;
}

export const RightPanelModelViewer: React.FC<RightPanelModelViewerProps> = ({ modelUrl, versionId }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isCaching, setIsCaching] = useState(false);

  useEffect(() => {
    if (!modelUrl) {
      setResolvedUrl('');
      return;
    }
    
    const canonicalId = extractCanonicalId(modelUrl);
    if (!canonicalId || !modelUrl.includes('firebasestorage')) {
      // If it's not a standard Firebase Storage URL we can parse, just use it directly
      setResolvedUrl(modelUrl);
      return;
    }

    let isMounted = true;
    setIsCaching(true);

    const cacheAndResolve = async () => {
      try {
        const cacheKey = versionId ? `${canonicalId}_v${versionId}` : canonicalId;
        await invoke('ensure_model_cached', { 
          modelId: cacheKey, 
          model_id: canonicalId, 
          ext: 'glb', 
          downloadUrl: modelUrl 
        });
        const filePath = await getModelLocalPathCached(cacheKey, 'glb');
        
        if (!isMounted) return;
        
        if (filePath) {
          // Normalizing Windows backslashes to forward slashes is critical for asset.localhost bypassing 403
          const normalizedPath = filePath.replace(/\\/g, '/');
          setResolvedUrl(convertFileSrc(normalizedPath));
        } else {
          setResolvedUrl(modelUrl);
        }
      } catch (err) {
        console.error('[RightPanelModelViewer] Failed to securely cache GLB:', err);
        if (isMounted) setResolvedUrl(modelUrl); // fallback
      } finally {
        if (isMounted) setIsCaching(false);
      }
    };

    cacheAndResolve();

    return () => { isMounted = false; };
  }, [modelUrl, versionId]);

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1.5, overflow: 'hidden' }}>
      {isCaching || !resolvedUrl ? (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Canvas shadows camera={{ position: [5, 5, 5], fov: 45 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.5} adjustCamera={1.3}>
              <Model url={resolvedUrl} />
            </Stage>
            <OrbitControls 
               autoRotate 
               autoRotateSpeed={1.5} 
               enablePan={false} 
               enableZoom={true} 
               makeDefault 
            />
          </Suspense>
        </Canvas>
      )}
    </Box>
  );
};
