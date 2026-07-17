// SEKKEIYA Drive のグリッドで、3D モデル（GLB）のサムネを遅延生成して表示する。
// - クラウド GLB: fetch で取得
// - ローカル GLB: fetch(asset://) が CORS 等で失敗したら Rust read_local_binary_file にフォールバック
// 生成は id 単位キャッシュ＋同時2件制限（WebGL コンテキスト枯渇と I/O 集中を防ぐ）。
// 生成前/失敗時は fallback（種別アイコン）を出す。
import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';

const cache = new Map<string, string>();            // id → objectURL
const failed = new Set<string>();                   // 生成失敗した id（再試行しない）
const inflight = new Map<string, Promise<string | null>>();

const MAX_CONCURRENT = 2;
let active = 0;
const waiters: Array<() => void> = [];
async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) { active++; return; }
  await new Promise<void>((r) => waiters.push(r));
  active++;
}
function release(): void {
  active--;
  waiters.shift()?.();
}

async function loadGlbBuffer(glbUrl: string, localPath?: string): Promise<ArrayBuffer | null> {
  // まず fetch（http/https/asset:// とも最速）。失敗したらローカルは Rust 読みへ。
  try {
    const res = await fetch(glbUrl);
    if (res.ok) return await res.arrayBuffer();
  } catch { /* fall through */ }
  if (localPath) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const bytes = await invoke<number[]>('read_local_binary_file', { path: localPath });
      return new Uint8Array(bytes).buffer;
    } catch (e) {
      console.warn('[ModelThumb] local read failed:', localPath, e);
    }
  }
  return null;
}

async function buildThumb(id: string, glbUrl: string, localPath?: string): Promise<string | null> {
  await acquire();
  try {
    const buf = await loadGlbBuffer(glbUrl, localPath);
    if (!buf) return null;
    const file = new File([buf], 'preview.glb', { type: 'model/gltf-binary' });
    const { generateThumbnailFromGlb } = await import('../../features/dss/upload/utils/generateThumbnailFromGlb');
    const { blob } = await generateThumbnailFromGlb(file as any, { width: 512, height: 384 });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('[ModelThumb] failed:', id, e);
    return null;
  } finally {
    release();
  }
}

export const LocalModelThumb: React.FC<{
  id: string;
  glbUrl?: string;
  /** ローカルファイルの実パス（fetch 失敗時の Rust フォールバック用）。 */
  localPath?: string;
  fallback: React.ReactNode;
}> = ({ id, glbUrl, localPath, fallback }) => {
  const [thumb, setThumb] = useState<string | null>(cache.get(id) ?? null);
  const [status, setStatus] = useState<'idle' | 'building' | 'failed'>(failed.has(id) ? 'failed' : 'idle');
  // 可視域ゲート: 画面に見えているカードだけ生成する（数百件の一括レンダによる
  // WebGL 負荷・ログ洪水で dev サーバーが落ちるのを防ぐ）。
  const [visible, setVisible] = useState(false);
  const holderRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumb) return; // 生成済みなら観測不要
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [thumb]);

  useEffect(() => {
    if (!visible || !glbUrl || !id) return;
    if (cache.has(id)) { setThumb(cache.get(id)!); return; }
    if (failed.has(id)) return;
    let cancelled = false;
    setStatus('building');
    let p = inflight.get(id);
    if (!p) { p = buildThumb(id, glbUrl, localPath); inflight.set(id, p); }
    p.then((url) => {
      inflight.delete(id);
      if (url) cache.set(id, url); else failed.add(id);
      if (cancelled) return;
      if (url) { setThumb(url); } else { setStatus('failed'); }
    });
    return () => { cancelled = true; };
  }, [visible, id, glbUrl, localPath]);

  if (!thumb) {
    return (
      <Box ref={holderRef} sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {fallback}
        {/* 生成状況の可視化: 生成中はスピナー、失敗は小さな ⚠ を右下に出す */}
        {status === 'building' && (
          <CircularProgress size={16} thickness={5} sx={{ position: 'absolute', bottom: 8, right: 8, color: '#00BFFF' }} />
        )}
        {status === 'failed' && (
          <Box sx={{ position: 'absolute', bottom: 6, right: 8, fontSize: 12, opacity: 0.7 }} title="サムネ生成に失敗">⚠️</Box>
        )}
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={thumb}
      alt=""
      loading="lazy"
      decoding="async"
      sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
};

export default LocalModelThumb;
