// 本体 ⇄ プラグイン iframe の postMessage メッセージ形式。
// 本体側（rpc/gateway.ts）とプラグイン側（sdk/guest.ts）の両方が参照する単一定義。

export const RPC_REQ = 'sekkeiya:req' as const;
export const RPC_RES = 'sekkeiya:res' as const;
export const RPC_EVENT = 'sekkeiya:event' as const;

/** 応答が来ないプラグインで本体が待ち続けないための上限。 */
export const RPC_TIMEOUT_MS = 10_000;

export interface RpcRequest {
  type: typeof RPC_REQ;
  /** 応答を突き合わせる ID。 */
  id: string;
  method: string;
  params?: unknown;
}

export type RpcResponse =
  | { type: typeof RPC_RES; id: string; ok: true; result: unknown }
  | { type: typeof RPC_RES; id: string; ok: false; error: string };

/** 本体 → プラグインの一方向通知（context 変更・workFiles 変更・verb 呼び出し）。 */
export interface RpcEvent {
  type: typeof RPC_EVENT;
  name: string;
  payload: unknown;
}

export const isRpcRequest = (v: unknown): v is RpcRequest =>
  !!v && typeof v === 'object'
  && (v as { type?: unknown }).type === RPC_REQ
  && typeof (v as { id?: unknown }).id === 'string'
  && typeof (v as { method?: unknown }).method === 'string';
