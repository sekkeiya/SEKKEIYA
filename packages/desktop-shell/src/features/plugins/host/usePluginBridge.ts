// iframe と gateway を postMessage で繋ぐ。
//
// セキュリティ上の要点:
//   - iframe は allow-same-origin を付けないので origin は "null"。
//     従って origin では検証できない。代わりに event.source が自分の iframe の
//     contentWindow と一致することで送り主を特定する。
//   - 送り返すときの targetOrigin は '*'。opaque origin の iframe には
//     具体的な origin を指定できないため（内容は権限チェック済みの応答のみ）。
import { useEffect } from 'react';
import { RPC_EVENT, isRpcRequest, type RpcEvent } from '../sdk/rpcProtocol';
import { handleRpc, type GatewayDeps } from '../rpc/gateway';
import type { PermissionContext } from '../rpc/permissions';

export function usePluginBridge(
  frameRef: React.RefObject<HTMLIFrameElement | null>,
  ctx: PermissionContext,
  deps: GatewayDeps,
  onError: (message: string) => void,
): void {
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || e.source !== frame.contentWindow) return;
      if (!isRpcRequest(e.data)) return;

      handleRpc(e.data, ctx, deps)
        .then(res => { frame.contentWindow?.postMessage(res, '*'); })
        .catch(err => onError(err instanceof Error ? err.message : String(err)));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frameRef, ctx, deps, onError]);
}

/** 本体 → プラグインの一方向通知。 */
export function emitToPlugin(frame: HTMLIFrameElement | null, name: string, payload: unknown): void {
  const event: RpcEvent = { type: RPC_EVENT, name, payload };
  frame?.contentWindow?.postMessage(event, '*');
}
