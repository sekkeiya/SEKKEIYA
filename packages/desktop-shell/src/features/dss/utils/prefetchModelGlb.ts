import { invoke } from '@tauri-apps/api/core';
import { getDownloadUrlForModel } from './modelUtils';

// RightPanelModelViewer と同じキーでキャッシュさせるため、同じ抽出ロジックを使う
const extractCanonicalId = (url: string) => (url.match(/assets%2F([a-f0-9-]+)%2F/)?.[1] || '');

const inFlight = new Set<string>();

/** モデルのGLBをバックグラウンドでローカルキャッシュへ先読みする（←/→ナビの即時表示用）。 */
export function prefetchModelGlb(model: any): void {
  if (!model) return;
  const url = getDownloadUrlForModel(model, 'glb');
  if (!url || !url.includes('firebasestorage')) return;
  const canonicalId = extractCanonicalId(url);
  if (!canonicalId || inFlight.has(canonicalId)) return;
  inFlight.add(canonicalId);
  invoke('ensure_model_cached', {
    modelId: canonicalId,
    model_id: canonicalId,
    ext: 'glb',
    downloadUrl: url,
  })
    .catch(() => {})
    .finally(() => inFlight.delete(canonicalId));
}
