import { useEffect, useState } from 'react';
import type { DsmtTextureSlot } from '../api/dsmtUploadService';

export interface LocalTexture {
  id: string;
  name: string;          // 例: albedo.png
  url: string;           // asset:// 表示用 URL（convertFileSrc）
  localPath: string;     // 実ファイルパス
  subfolder: string;     // Images/ からの相対サブフォルダ（例: textures/fabric-beige）
  slug: string;          // subfolder の最終セグメント（例: fabric-beige）
  slot: DsmtTextureSlot | null; // ファイル名から推定したスロット
  sizeBytes?: number;
}

/** ファイル名からテクスチャスロットを推定する。 */
export function slotFromFilename(name: string): DsmtTextureSlot | null {
  const stem = (name || '').toLowerCase().replace(/\.[^.]+$/, '').trim();
  if (/(^|[_-])(normal|nrm|norm)$|(^|[_-])n$/.test(stem) || stem.includes('normal')) return 'normal';
  if (stem.includes('rough')) return 'roughness';
  if (/(^|[_-])(ao|occlusion|ambientocclusion)$/.test(stem) || stem.includes('occlusion') || stem === 'ao') return 'ao';
  // lightmap はアンビエントオクルージョンとして扱う
  if (stem.includes('lightmap') || stem.includes('light_map')) return 'ao';
  if (stem.includes('metal')) return 'metalness';
  if (stem.includes('albedo') || stem.includes('basecolor') || stem.includes('base_color') || stem.includes('diffuse') || stem.includes('color')) return 'albedo';
  return null;
}

/** subfolder の最終セグメントを slug として取り出す。 */
function slugOf(subfolder: string): string {
  const parts = (subfolder || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** %USERPROFILE%\SEKKEIYA\LocalAssets\Images を走査してテクスチャ候補を返す。 */
export async function listLocalTextureAssets(): Promise<LocalTexture[]> {
  const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
  const assets: any[] = await invoke('list_local_image_assets');
  return assets
    .filter((a) => a.mediaType !== 'video')
    .map((a) => ({
      id: String(a.id),
      name: String(a.name),
      url: convertFileSrc(String(a.path).replace(/\\/g, '/')),
      localPath: String(a.path),
      subfolder: String(a.subfolder || ''),
      slug: slugOf(String(a.subfolder || '')),
      slot: slotFromFilename(String(a.name)),
      sizeBytes: a.sizeBytes,
    }));
}

/** asset:// URL のテクスチャを fetch して File 化（Storage アップロード用）。 */
export async function fetchAssetAsFile(url: string, name: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`texture fetch failed: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}

/** ローカルテクスチャをロードするフック。 */
export function useLocalTextures() {
  const [textures, setTextures] = useState<LocalTexture[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLocalTextureAssets()
      .then((t) => { if (!cancelled) setTextures(t); })
      .catch((e) => { console.error('[localTextures] load failed', e); if (!cancelled) setTextures([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  return { textures, loading, reload: () => setReloadKey((k) => k + 1) };
}
