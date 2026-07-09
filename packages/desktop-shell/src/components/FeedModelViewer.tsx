import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// ──────────────────────────────────────────────────────────────────
// Global WebGL-context budget.
// iOS WKWebView can only keep a handful of live WebGL contexts before the
// renderer process is killed (the whole web app reloads → back to login).
// We therefore cap the number of simultaneously-mounted 3D canvases; any
// viewer that can't get a slot shows its static thumbnail until one frees.
// ──────────────────────────────────────────────────────────────────
const MAX_ACTIVE_VIEWERS = 2;
let activeViewers = 0;
const waiters = new Set<() => void>();

function tryAcquireSlot(): boolean {
  if (activeViewers < MAX_ACTIVE_VIEWERS) { activeViewers += 1; return true; }
  return false;
}
function releaseSlot(): void {
  if (activeViewers > 0) activeViewers -= 1;
  // Let one waiting viewer try to claim the freed slot.
  waiters.forEach((w) => w());
}

// ── Error boundary to catch Three.js / useGLTF errors ────────────
class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

// ── Model inner component ────────────────────────────────────────
const Model: React.FC<{ url: string }> = ({ url }) => {
  const { scene } = useGLTF(url);
  const cloned = React.useMemo(() => {
    const c = scene.clone(true);
    // Centre and normalise scale so any model fits nicely in the viewer
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

// ── Main viewer ──────────────────────────────────────────────────
interface FeedModelViewerProps {
  modelUrl: string;
  thumbnailUrl?: string | null;
  height?: string | number;
}

const FeedModelViewer: React.FC<FeedModelViewerProps> = ({
  modelUrl,
  thumbnailUrl,
  height = '75vw',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hasSlot, setHasSlot] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const hasSlotRef = useRef(false);

  // Only consider mounting when actually on screen (no large pre-margin, so we
  // don't spin up canvases for cards that aren't visible yet).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '40px', threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Acquire / release a WebGL slot based on visibility.
  useEffect(() => {
    const wantSlot = inView && !loadError;

    if (!wantSlot) {
      if (hasSlotRef.current) { hasSlotRef.current = false; setHasSlot(false); releaseSlot(); }
      return;
    }
    if (hasSlotRef.current) return;

    let cancelled = false;
    const attempt = () => {
      if (cancelled || hasSlotRef.current) return;
      if (tryAcquireSlot()) { hasSlotRef.current = true; setHasSlot(true); waiters.delete(attempt); }
    };
    waiters.add(attempt);
    attempt();

    return () => { cancelled = true; waiters.delete(attempt); };
  }, [inView, loadError]);

  // Release the slot on unmount.
  useEffect(() => () => {
    if (hasSlotRef.current) { hasSlotRef.current = false; releaseSlot(); }
  }, []);

  const showCanvas = inView && hasSlot && !loadError;

  return (
    <Box
      ref={containerRef}
      sx={{ width: '100%', height, bgcolor: '#060c14', position: 'relative', overflow: 'hidden' }}
    >
      {/* Static thumbnail underlay — visible until/unless a live canvas mounts. */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="model"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>3D</Typography>
        </Box>
      )}

      {/* === 3-D Canvas (only when a slot is available) === */}
      {showCanvas && (
        <ModelErrorBoundary onError={() => setLoadError(true)}>
          <Suspense
            fallback={
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={24} sx={{ color: 'rgba(144,202,249,0.6)' }} />
              </Box>
            }
          >
            <Canvas
              style={{ position: 'absolute', inset: 0 }}
              camera={{ position: [0, 1, 4], fov: 42 }}
              dpr={[1, 1.5]}
              gl={{ antialias: false, powerPreference: 'low-power', alpha: false, failIfMajorPerformanceCaveat: false }}
              onCreated={({ gl }) => {
                gl.setClearColor('#060c14');
                // If the context is lost (iOS memory pressure), fall back to the thumbnail.
                gl.domElement.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault();
                  setLoadError(true);
                });
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
                autoRotate
                autoRotateSpeed={1.6}
                enablePan={false}
                enableZoom={false}
                enableRotate={false}
                makeDefault
              />
            </Canvas>
          </Suspense>
        </ModelErrorBoundary>
      )}
    </Box>
  );
};

export default FeedModelViewer;
