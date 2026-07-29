// プラグインを動かす iframe ホスト（要件65）。
//
// sandbox に allow-same-origin を付けない。付けると iframe が本体と同一オリジンになり、
// 本体の localStorage と Firebase セッションに到達できてしまう＝隔離が見た目だけになる。
// この 1 語が隔離の全てなので、動かないからといって足さないこと。
// 実際の値は sandboxAttribute.ts（.ts なので Vitest で検証可能）に切り出してある。
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { LoadedPlugin } from '../registry/loadPlugins';
import type { PermissionContext } from '../rpc/permissions';
import type { GatewayDeps } from '../rpc/gateway';
import { usePluginBridge } from './usePluginBridge';
import { PLUGIN_IFRAME_SANDBOX } from './sandboxAttribute';

export interface PluginFrameProps {
  plugin: LoadedPlugin;
  projectId: string;
}

// storage.set に上限を設ける理由: localStorage は本体（Firebase Auth のセッション永続化含む）と
// 同じ生ストレージを共有しており、プラグインが際限なく書き込むと QuotaExceededError が
// 本体側の書き込みにも波及しうる。1 値あたりの文字数と 1 プラグインあたりのキー数の両方を制限する。
const PLUGIN_STORAGE_VALUE_MAX_CHARS = 64 * 1024; // 1 値の JSON 文字列長の上限（64KB）
const PLUGIN_STORAGE_MAX_KEYS = 100; // 1 プラグインあたりのキー数の上限

/** プラグインフォルダの entry を asset: URL に変換する。 */
async function entryUrl(plugin: LoadedPlugin): Promise<string> {
  // ここは LoadedPlugin を渡された時点で validateManifest を必ず通っている前提だが、
  // その保証はコードの外側（loadPlugins.ts が唯一の生成経路であること）に依存している。
  // 呼び出し経路が将来増えても iframe に渡す URL の安全性を local に保証できるよう、
  // asset: URL へ変換する直前でもう一度だけ最終防御として検査する（多層防御）。
  const entry = plugin.manifest.entry;
  if (entry.split(/[\\/]/).includes('..')) {
    throw new Error(`プラグインの entry にディレクトリ上位参照(..)が含まれています: ${entry}`);
  }
  if (entry.includes('%')) {
    throw new Error(`プラグインの entry に URL エンコード文字(%)が含まれています: ${entry}`);
  }
  if (entry.includes('\\')) {
    throw new Error(`プラグインの entry にバックスラッシュが含まれています: ${entry}`);
  }
  if (entry.startsWith('/')) {
    throw new Error(`プラグインの entry が絶対パス(/始まり)になっています: ${entry}`);
  }
  if (/^[A-Za-z]:/.test(entry)) {
    throw new Error(`プラグインの entry がドライブレター始まりの絶対パスになっています: ${entry}`);
  }
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  return convertFileSrc(`${plugin.dir}/${entry}`);
}

export const PluginFrame: React.FC<PluginFrameProps> = ({ plugin, projectId }) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  React.useEffect(() => {
    let alive = true;
    entryUrl(plugin)
      .then(u => { if (alive) setSrc(`${u}?v=${nonce}`); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [plugin, nonce]);

  const ctx: PermissionContext = useMemo(() => ({
    pluginId: plugin.manifest.id,
    policy: plugin.policy,
    network: plugin.manifest.permissions?.network ?? [],
    chat: plugin.manifest.permissions?.chat ?? false,
  }), [plugin]);

  // 初版は context / ui / storage のみ実接続。workFiles・http・chat は
  // 「未接続」を明示的に返す（黙って空配列を返すと原因が分からなくなる）。
  const deps: GatewayDeps = useMemo(() => {
    const notWired = (what: string) => async (): Promise<never> => {
      throw new Error(`${what} はまだ本体に接続されていません`);
    };
    const storageKey = (key: string) => `plugin:${plugin.manifest.id}:${key}`;
    return {
      // ユーザーは useAppStore ではなく useAuthStore が持つ（GlobalSettingsShell と同じ経路）。
      // uid だけを渡す。User オブジェクトや認証トークンは決して渡さない。
      context: async () => ({
        projectId: projectId || null,
        // getActiveWorkspace() はプラグインタブ表示中は undefined を返す
        // (activeWorkspaceId が 'plugin:<id>' で workspaces 配列に無いため)。
        // プロジェクト名は getActiveProject() から取る。
        projectName: useAppStore.getState().getActiveProject()?.name ?? null,
        userId: useAuthStore.getState().currentUser?.uid ?? null,
        locale: 'ja',
        theme: 'dark' as const,
      }),
      workFiles: {
        list: notWired('workFiles.list'),
        get: notWired('workFiles.get'),
        create: notWired('workFiles.create'),
        update: notWired('workFiles.update'),
        remove: notWired('workFiles.remove'),
      },
      ui: {
        // setSelection/toast/setTitle は「呼べるが黙って何もしない」状態だった:
        //   - setSelection は setPanelSelection('plugin:<id>', ...) を呼ぶが、
        //     RightPanelHost は同じ prefix で return null しているのでどこにも表示されない。
        //   - toast は console.info するだけでユーザーには見えない。
        //   - setTitle は空関数。
        // workFiles 等の未接続 API と同じく明示的に throw して、プラグイン作者が
        // 「成功したのに何も起きない」で原因を追えなくなる状況を避ける。
        setSelection: notWired('ui.setSelection'),
        toast: notWired('ui.toast'),
        confirm: async (message) => window.confirm(message),
        setTitle: notWired('ui.setTitle'),
      },
      http: notWired('http.request'),
      chat: { send: notWired('chat.send') },
      storage: {
        get: async (key) => {
          const raw = localStorage.getItem(storageKey(key));
          return raw === null ? null : JSON.parse(raw) as unknown;
        },
        set: async (key, value) => {
          const fullKey = storageKey(key);
          const serialized = JSON.stringify(value);
          if (serialized.length > PLUGIN_STORAGE_VALUE_MAX_CHARS) {
            throw new Error(
              `storage.set: 値が大きすぎます（${serialized.length} 文字 / 上限 ${PLUGIN_STORAGE_VALUE_MAX_CHARS} 文字）`
            );
          }
          if (localStorage.getItem(fullKey) === null) {
            // 新規キーの追加時だけキー数を数える（既存キーの上書きはカウントを増やさない）。
            const prefix = storageKey('');
            let keyCount = 0;
            for (let i = 0; i < localStorage.length; i++) {
              if (localStorage.key(i)?.startsWith(prefix)) keyCount++;
            }
            if (keyCount >= PLUGIN_STORAGE_MAX_KEYS) {
              throw new Error(
                `storage.set: キー数の上限（${PLUGIN_STORAGE_MAX_KEYS} 件）に達しています`
              );
            }
          }
          localStorage.setItem(fullKey, serialized);
        },
      },
    };
  }, [plugin, projectId]);

  const onBridgeError = useCallback((message: string) => setError(message), []);
  usePluginBridge(frameRef, ctx, deps, onBridgeError);

  if (error) {
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 4 }}>
        <Typography color="error" sx={{ fontWeight: 600 }}>{plugin.manifest.name} を表示できません</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', maxWidth: 520 }}>{error}</Typography>
        <Button size="small" startIcon={<RefreshRoundedIcon />} sx={{ textTransform: 'none' }}
          onClick={() => { setError(null); setNonce(n => n + 1); }}>
          再読み込み
        </Button>
      </Box>
    );
  }

  if (!src) {
    return <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {plugin.manifest.name} v{plugin.manifest.version}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<RefreshRoundedIcon sx={{ fontSize: 14 }} />} sx={{ textTransform: 'none', fontSize: 12 }}
          onClick={() => setNonce(n => n + 1)}>
          再読み込み
        </Button>
      </Box>
      <iframe
        ref={frameRef}
        src={src}
        title={plugin.manifest.name}
        sandbox={PLUGIN_IFRAME_SANDBOX}
        style={{ flex: 1, width: '100%', border: 'none', background: 'transparent' }}
      />
    </Box>
  );
};
