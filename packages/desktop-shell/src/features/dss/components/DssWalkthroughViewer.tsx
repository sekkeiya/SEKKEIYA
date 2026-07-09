import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, CircularProgress, IconButton } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getModelLocalPathCached } from '../../../lib/modelLocalPathCache';
import { LoopAnimator } from '../../shared/walkthrough/LoopAnimator';
import type { LoopAnimSpec } from '../../shared/walkthrough/loopAnim';

const extractCanonicalId = (url: string) => (url.match(/assets%2F([a-f0-9-]+)%2F/)?.[1] || '');
const AXIS_VEC: Record<string, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1),
};

function findNodeByName(root: any, name?: string) {
  if (!root || !name) return null;
  let found: any = null;
  root.traverse((o: any) => { if (!found && o.name && o.name.toLowerCase() === String(name).toLowerCase()) found = o; });
  return found;
}

const openUrlExternal = (raw?: string) => {
  if (!raw) return;
  let u = raw;
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  import('@tauri-apps/plugin-opener').then((m: any) => (m.openUrl ? m.openUrl(u) : window.open(u, '_blank'))).catch(() => window.open(u, '_blank'));
};

/** GLB を Tauri キャッシュ経由で解決（403 回避）。 */
function useResolvedGlbUrl(modelUrl?: string | null): { url: string; loading: boolean } {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!modelUrl) { setUrl(''); return; }
    const canonicalId = extractCanonicalId(modelUrl);
    if (!canonicalId || !modelUrl.includes('firebasestorage')) { setUrl(modelUrl); return; }
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        await invoke('ensure_model_cached', { modelId: canonicalId, model_id: canonicalId, ext: 'glb', downloadUrl: modelUrl });
        const filePath = await getModelLocalPathCached(canonicalId, 'glb');
        if (!mounted) return;
        setUrl(filePath ? convertFileSrc(filePath.replace(/\\/g, '/')) : modelUrl);
      } catch { if (mounted) setUrl(modelUrl); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [modelUrl]);
  return { url, loading };
}

interface GimmickCtl { id: string; label: string; toggle: () => void; }

/**
 * 複数 gimmick(spec) を 1 つのモデルに設定し、クリックで開閉を動かす。
 * GimmickBinder（S.Layout）と同じ hinge トゥイーン / clip 再生ロジックを単体ビューア用に再構成。
 * モデルをクリックすると onPick が呼ばれ、操作アイコン群を出す。
 */
const MultiGimmickRunner: React.FC<{
  url: string;
  gimmicks: any[];
  anim?: LoopAnimSpec | null;
  onReady: (ctls: GimmickCtl[]) => void;
  onToggle: (id: string, open: boolean) => void;
  onPick: () => void;
}> = ({ url, gimmicks, anim, onReady, onToggle, onPick }) => {
  const { scene, animations } = useGLTF(url) as any;
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const animRef = useRef<any>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const hingesRef = useRef<any[]>([]);
  const slidesRef = useRef<any[]>([]);
  const opensRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const list = Array.isArray(gimmicks) ? gimmicks.filter((g) => g && (g.type === 'hinge' || g.type === 'clip' || g.type === 'slide')) : [];
    if (!cloned || !list.length) { onReady([]); return; }

    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;
    const names: string[] = (animations || []).map((a: any) => a.name);
    const hinges: any[] = [];
    const slides: any[] = [];
    const controls: GimmickCtl[] = [];
    opensRef.current = {};

    // mm → ローカル単位換算（GLB がメートルなら ×0.001 相当）
    const _box = new THREE.Box3().setFromObject(cloned);
    const _size = _box.getSize(new THREE.Vector3());
    const _maxDim = Math.max(_size.x, _size.y, _size.z);
    const mmPerUnit = _maxDim > 0 && _maxDim < 20 ? 1000 : 1;

    for (const g of list) {
      const id = g.id;
      opensRef.current[id] = false;
      if (g.type === 'clip') {
        const openName = g.openClip || names.find((n) => /open|door/i.test(n)) || names[0];
        const closeName = g.closeClip || names.find((n) => /close/i.test(n));
        const openClip = animations.find((a: any) => a.name === openName) || animations[0];
        const closeClip = closeName ? animations.find((a: any) => a.name === closeName) : null;
        const playOnce = (clip: any, ts = 1) => {
          if (!clip) return;
          const act = mixer.clipAction(clip);
          act.reset(); act.loop = THREE.LoopOnce; act.clampWhenFinished = true; act.timeScale = ts;
          if (ts < 0) act.time = clip.duration;
          act.enabled = true; act.play();
        };
        const toggle = () => {
          if (!opensRef.current[id]) {
            if (closeClip) mixer.clipAction(closeClip).stop();
            playOnce(openClip, 1); opensRef.current[id] = true;
          } else {
            if (closeClip) { mixer.clipAction(openClip).stop(); playOnce(closeClip, 1); }
            else playOnce(openClip, -1);
            opensRef.current[id] = false;
          }
          onToggle(id, opensRef.current[id]);
        };
        controls.push({ id, label: g.label || 'ドア', toggle });
      } else if (g.type === 'slide') {
        const node = findNodeByName(cloned, g.pivot) || cloned;
        const axisKey = (g.axis || 'y').toLowerCase();
        const dist = (Number(g.distance) || 100) / mmPerUnit;
        const sl = { node, axisKey, base: node.position[axisKey], dist, t: 0, target: 0, speed: 2.2 };
        slides.push(sl);
        const toggle = () => { sl.target = sl.target > 0.5 ? 0 : 1; opensRef.current[id] = sl.target > 0.5; onToggle(id, opensRef.current[id]); };
        controls.push({ id, label: g.label || '動かす', toggle });
      } else {
        const node = findNodeByName(cloned, g.pivot) || cloned;
        const axis = AXIS_VEC[(g.axis || 'y').toLowerCase()] || AXIS_VEC.y;
        const openRad = ((Number(g.openDeg) || 90) * Math.PI) / 180;
        const h = { node, axis, baseQuat: node.quaternion.clone(), openRad, t: 0, target: 0, speed: 2.2 };
        hinges.push(h);
        const toggle = () => { h.target = h.target > 0.5 ? 0 : 1; opensRef.current[id] = h.target > 0.5; onToggle(id, opensRef.current[id]); };
        controls.push({ id, label: g.label || 'ドア', toggle });
      }
    }
    hingesRef.current = hinges;
    slidesRef.current = slides;
    onReady(controls);
    return () => {
      if (mixerRef.current) { mixerRef.current.stopAllAction(); mixerRef.current = null; }
      hingesRef.current = []; slidesRef.current = []; opensRef.current = {}; onReady([]);
    };
  }, [cloned, gimmicks, animations]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (mixerRef.current) mixerRef.current.update(d);
    for (const h of hingesRef.current) {
      const dir = h.target - h.t;
      if (Math.abs(dir) > 1e-4) {
        h.t += Math.sign(dir) * Math.min(Math.abs(dir), h.speed * d);
        h.t = Math.max(0, Math.min(1, h.t));
        const q = new THREE.Quaternion().setFromAxisAngle(h.axis, h.openRad * h.t);
        h.node.quaternion.copy(h.baseQuat).multiply(q);
      }
    }
    for (const sl of slidesRef.current) {
      const dir = sl.target - sl.t;
      if (Math.abs(dir) > 1e-4) {
        sl.t += Math.sign(dir) * Math.min(Math.abs(dir), sl.speed * d);
        sl.t = Math.max(0, Math.min(1, sl.t));
        sl.node.position[sl.axisKey] = sl.base + sl.dist * sl.t;
      }
    }
  });

  return (
    <group ref={animRef} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <primitive object={cloned} />
      <LoopAnimator targetRef={animRef} anim={anim} unit={0.001} />
    </group>
  );
};

interface Props {
  glbUrl?: string | null;
  gimmicks?: any[];
  anim?: LoopAnimSpec | null;
  info?: { description?: string; links?: Array<{ title?: string; url?: string }> } | null;
  /** 家具置き換えの候補（同カテゴリの他モデル）。ボタンで順に差し替え。 */
  swapModels?: Array<{ id?: string; title?: string; glbUrl?: string | null }> | null;
}

/**
 * ウォークスルー閲覧ビュー：3Dモデルをクリックすると操作アイコン群（ⓘ情報・ドア等のギミック）が出る。
 * S.Layout のウォークスルー（ホバー/クリックで操作）と同じ体験を S.Models 上で確認できる。
 */
export const DssWalkthroughViewer: React.FC<Props> = ({ glbUrl, gimmicks, anim, info, swapModels }) => {
  // 家具置き換え候補（元モデル＋登録分）。swapIndex で現在表示中を切替。
  const swapOptions = useMemo(() => {
    const list = (Array.isArray(swapModels) ? swapModels : []).filter((m) => m && m.glbUrl);
    return [{ id: 'base', title: '元', glbUrl: glbUrl || null }, ...list];
  }, [glbUrl, swapModels]);
  const [swapIndex, setSwapIndex] = useState(0);
  const currentSrc = swapOptions[Math.min(swapIndex, swapOptions.length - 1)]?.glbUrl || glbUrl;

  const { url, loading } = useResolvedGlbUrl(currentSrc);
  const [controls, setControls] = useState<GimmickCtl[]>([]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const hasInfo = !!(info && ((info.description && info.description.trim()) || (Array.isArray(info.links) && info.links.filter((l) => l && l.url).length)));
  const hasSwap = swapOptions.length > 1;
  const hasAnyAction = controls.length > 0 || hasInfo || hasSwap;
  const gimmicksList = Array.isArray(gimmicks) ? gimmicks : [];

  if (!glbUrl) {
    return <Box sx={{ p: 3 }}><Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>GLB が無いためアニメーションを表示できません。</Typography></Box>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ position: 'relative', width: '100%', height: 360, bgcolor: '#05060a', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        {loading || !url ? (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: '#4f8cff' }} /></Box>
        ) : (
          <Canvas shadows camera={{ position: [4, 3, 5], fov: 45 }} onPointerMissed={() => setRevealed(false)}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.5} adjustCamera={1.2}>
                <MultiGimmickRunner key={url} url={url} gimmicks={gimmicksList} anim={anim}
                  onReady={setControls}
                  onToggle={(id, open) => setOpenMap((m) => ({ ...m, [id]: open }))}
                  onPick={() => setRevealed(true)} />
              </Stage>
              <OrbitControls enablePan={false} makeDefault />
            </Suspense>
          </Canvas>
        )}

        {/* クリック前のヒント */}
        {hasAnyAction && !revealed && !infoPanelOpen && (
          <Box sx={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)' }}>
            <TouchAppRoundedIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 11 }}>アイテムをクリックして操作</Typography>
          </Box>
        )}

        {/* 操作アイコン群（クリックで表示） */}
        {revealed && hasAnyAction && (
          <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
            {controls.map((c) => {
              const open = !!openMap[c.id];
              return (
                <Button
                  key={c.id}
                  onClick={() => c.toggle()}
                  startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none', fontWeight: 800, fontSize: 12.5, px: 1.5, py: 0.6, borderRadius: 2, color: '#fff',
                    bgcolor: open ? 'rgba(239,83,80,0.9)' : 'rgba(79,140,255,0.92)', backdropFilter: 'blur(4px)',
                    '&:hover': { bgcolor: open ? 'rgba(239,83,80,1)' : 'rgba(79,140,255,1)' },
                  }}
                >
                  アクション
                </Button>
              );
            })}
            {hasInfo && (
              <Button
                onClick={() => setInfoPanelOpen(true)}
                startIcon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none', fontWeight: 800, fontSize: 12.5, px: 1.5, py: 0.6, borderRadius: 2, color: '#fff',
                  bgcolor: 'rgba(56,189,248,0.92)', backdropFilter: 'blur(4px)',
                  '&:hover': { bgcolor: 'rgba(56,189,248,1)' },
                }}
              >
                情報
              </Button>
            )}
            {hasSwap && (
              <Button
                onClick={() => setSwapIndex((i) => (i + 1) % swapOptions.length)}
                startIcon={<SwapHorizRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{
                  textTransform: 'none', fontWeight: 800, fontSize: 12.5, px: 1.5, py: 0.6, borderRadius: 2, color: '#fff',
                  bgcolor: 'rgba(124,77,255,0.92)', backdropFilter: 'blur(4px)',
                  '&:hover': { bgcolor: 'rgba(124,77,255,1)' },
                }}
              >
                家具を変える
              </Button>
            )}
          </Box>
        )}

        {/* 家具置き換え中ラベル */}
        {hasSwap && swapIndex > 0 && (
          <Box sx={{ position: 'absolute', bottom: 12, right: 12, px: 1.25, py: 0.5, borderRadius: 1, bgcolor: 'rgba(124,77,255,0.85)', color: '#fff' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{swapOptions[swapIndex]?.title || '差し替え中'}</Typography>
          </Box>
        )}

        {/* 情報パネル */}
        {infoPanelOpen && hasInfo && (
          <Box onClick={() => setInfoPanelOpen(false)} sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.45)' }}>
            <Box onClick={(e) => e.stopPropagation()} sx={{ width: 320, maxWidth: '88%', maxHeight: '84%', overflowY: 'auto', p: 2, borderRadius: 2, bgcolor: 'rgba(11,16,32,0.97)', border: '1px solid rgba(56,189,248,0.4)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <InfoOutlinedIcon sx={{ color: '#38bdf8', fontSize: 18 }} />
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14, flex: 1 }}>アイテム情報</Typography>
                <IconButton size="small" onClick={() => setInfoPanelOpen(false)} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
              </Box>
              {info?.description && (
                <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, whiteSpace: 'pre-wrap', mb: 1.5 }}>{info.description}</Typography>
              )}
              {(info?.links || []).filter((l) => l && l.url).map((l, i) => (
                <Box key={i} onClick={() => openUrlExternal(l.url)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, mb: 0.75, borderRadius: 1, cursor: 'pointer', bgcolor: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)', '&:hover': { bgcolor: 'rgba(56,189,248,0.2)' } }}>
                  <LaunchRoundedIcon sx={{ color: '#38bdf8', fontSize: 15 }} />
                  <Typography sx={{ color: '#fff', fontSize: 12, fontWeight: 600, flex: 1 }} noWrap>{l.title || l.url}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 1 }}>
        ドラッグで回転・ホイールでズーム。モデルをクリックすると操作アイコンが表示されます。
      </Typography>
    </Box>
  );
};
