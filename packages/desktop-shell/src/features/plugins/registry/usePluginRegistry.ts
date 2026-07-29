// プラグイン一覧を読み込み、リロード機能を提供する React フック。
// 呼び出し元は WorkspaceTabBar.tsx（タブ一覧の生成）と WorkspacePanelContainer.tsx
// （開かれたプラグインの解決）の 2 箇所。両者は別コンポーネントなので、素の useState/useEffect
// では独立した state を持ってしまい、片方が読み込みを終える前にもう片方がまだ空、という
// ズレが起きる（タブが出た直後にクリックすると activePlugin が null のまま無言の空白になる
// レビュー指摘）。そのため読み込み結果はモジュールスコープの共有キャッシュに 1 つだけ持ち、
// 全フックインスタンスがそれを購読する。
//
// - `cache`: 読み込み済みの結果（未読み込みなら null）。
// - `inflight`: 進行中の読み込み Promise（同時に複数箇所からマウントされても fetch は 1 回だけ）。
// - `listeners`: 購読中のフックインスタンス（`reload()` やロード完了時に全員へ通知する）。
//
// 開発モードのリロードボタンから reload() を呼ぶ(要件69)。
import { useCallback, useEffect, useState } from 'react';
import { loadPlugins, type LoadedPlugin, type RejectedPlugin, type LoadResult } from './loadPlugins';

export interface PluginRegistry {
  plugins: LoadedPlugin[];
  rejected: RejectedPlugin[];
  loading: boolean;
  reload: () => void;
}

let cache: LoadResult | null = null;
let inflight: Promise<LoadResult> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** キャッシュが無ければ読み込みを開始する。既に読み込み済み／進行中なら何もしない。 */
function ensureLoaded(): void {
  if (cache || inflight) return;
  inflight = loadPlugins()
    .catch((): LoadResult => ({ loaded: [], rejected: [] }))
    .then(r => {
      cache = r;
      inflight = null;
      notify();
      return r;
    });
}

export function usePluginRegistry(): PluginRegistry {
  // 値そのものは module scope の `cache` から毎レンダー読む。この state は
  // 「再レンダーを起こす」ためだけのトリガーで、値は保持しない。
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    listeners.add(listener);
    ensureLoaded();
    return () => { listeners.delete(listener); };
  }, []);

  // reload() 呼び出し(イベントハンドラ内)でキャッシュと inflight を捨てて読み直し、
  // 全購読者（他コンポーネントのフックインスタンスも含む）へ通知する。
  const reload = useCallback(() => {
    cache = null;
    inflight = null;
    ensureLoaded();
    notify();
  }, []);

  return {
    plugins: cache?.loaded ?? [],
    rejected: cache?.rejected ?? [],
    loading: cache === null,
    reload,
  };
}
