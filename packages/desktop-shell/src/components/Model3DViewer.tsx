import React, { Suspense, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

const Model: React.FC<{ url: string }> = ({ url }) => {
  const { scene } = useGLTF(url);
  const cloned = React.useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2 / maxDim;
    c.position.sub(centre.multiplyScalar(scale));
    c.scale.setScalar(scale);
    return c;
  }, [scene]);
  return <primitive object={cloned} />;
};

interface Model3DViewerProps {
  modelUrl: string | null;
  open: boolean;
  onClose: () => void;
}

// フルスクリーンの操作可能な 3D ビューア。open のときだけ Canvas を 1 つマウントする
// （= 同時 WebGL コンテキストは最大 1）。指でドラッグ＝回転 / ピンチ＝ズーム。
const Model3DViewer: React.FC<Model3DViewerProps> = ({ modelUrl, open, onClose }) => {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => { if (open) setLoadError(false); }, [open, modelUrl]);

  if (!open || !modelUrl) return null;

  // ヘッダー/ボトムバーごと全画面で覆うため body へポータル（祖先の transform で fixed が
  // ビューポート基準にならない問題を回避）。
  return createPortal((
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: 13000,
        bgcolor: 'var(--brand-bg)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 上部バー: 左に「戻る」、右に「×」 */}
      <Box sx={{
        position: 'absolute', top: 'env(safe-area-inset-top)', left: 0, right: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 1,
      }}>
        <Box
          component="button"
          onClick={onClose}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            border: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            bgcolor: 'rgba(0,0,0,0.55)', color: 'var(--brand-fg)',
            borderRadius: 999, pl: 1, pr: 1.5, py: 0.75,
            backdropFilter: 'blur(6px)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            '&:active': { opacity: 0.8 },
          }}
        >
          <ArrowBackIosNewRoundedIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'inherit' }}>戻る</Typography>
        </Box>

        <IconButton onClick={onClose} sx={{ color: 'var(--brand-fg)', bgcolor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', '&:active': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {/* 3D */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {loadError ? (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>3D を表示できませんでした</Typography>
          </Box>
        ) : (
          <ModelErrorBoundary onError={() => setLoadError(true)}>
            <Suspense
              fallback={
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress sx={{ color: 'light-dark(rgba(9,95,165,0.7), rgba(144,202,249,0.7))' }} />
                </Box>
              }
            >
              <Canvas
                style={{ position: 'absolute', inset: 0 }}
                camera={{ position: [0, 1, 4.2], fov: 42 }}
                dpr={[1, 2]}
                gl={{ antialias: true, powerPreference: 'low-power', alpha: false, failIfMajorPerformanceCaveat: false }}
                onCreated={({ gl }) => {
                  gl.setClearColor('#05080d');
                  gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setLoadError(true); });
                }}
              >
                <ambientLight intensity={1.1} />
                <hemisphereLight args={['#c8dfff', '#0a0f1a', 1.2]} />
                <directionalLight position={[3, 5, 3]} intensity={1.4} />
                <directionalLight position={[-3, 2, -2]} intensity={0.6} />

                <Suspense fallback={null}>
                  <ModelErrorBoundary onError={() => setLoadError(true)}>
                    <Model url={modelUrl} />
                  </ModelErrorBoundary>
                </Suspense>

                <OrbitControls
                  enablePan={false}
                  enableZoom
                  enableRotate
                  enableDamping
                  dampingFactor={0.1}
                  minDistance={1.6}
                  maxDistance={9}
                  makeDefault
                />
              </Canvas>
            </Suspense>
          </ModelErrorBoundary>
        )}

        {/* 操作ヒント */}
        <Box sx={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom) + 12px)', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>ドラッグで回転 ・ ピンチでズーム</Typography>
        </Box>
      </Box>
    </Box>
  ), document.body);
};

export default Model3DViewer;
