// レンダ基盤クライアント（docs/12 §5）。
// diagram-spec をクラウド Cloud Function `renderManim` に送り、Manim 動画(mp4)を得る。
// 編集中の canvas プレビューには影響しない（書き出し時 / フロー1完了時のみ呼ぶ）。

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import type { DiagramSpec } from './diagramSpecBridge';

export interface ManimRenderResult {
  mp4Url: string;
  gifUrl?: string;
  thumbUrl: string;
  durationSec: number;
}

export interface ManimRenderOpts {
  format?: 'mp4' | 'gif';
  quality?: 'l' | 'm' | 'h';
  aspect?: '16:9' | '1:1' | '9:16';
}

/**
 * spec を Manim でレンダして mp4(+gif) の URL を返す。
 * Cloud 関数 `renderManim` 未デプロイ時は明示的にエラーを投げる（canvas 編集は無影響）。
 * I/F 契約: docs/12 §5。
 */
export async function renderManimDiagram(
  spec: DiagramSpec,
  opts: ManimRenderOpts = {},
): Promise<ManimRenderResult> {
  const fn = httpsCallable(functions, 'renderManim');
  const res = await fn({
    spec,
    format: opts.format ?? 'mp4',
    quality: opts.quality ?? 'h',
    aspect: opts.aspect ?? '16:9',
  });
  const data = ((res.data as any)?.result ?? res.data) as ManimRenderResult | undefined;
  if (!data?.mp4Url) {
    throw new Error('renderManim: 動画URLが返りませんでした（Cloud関数 renderManim 未デプロイの可能性）');
  }
  return data;
}
