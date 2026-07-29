// RPC の処理本体。プラグインからのメッセージはすべてここを通る（唯一の関門）。
//
// 本体機能は GatewayDeps で注入するため、この関数は純粋で iframe 無しにテストできる。
// 役割は 3 つだけ:
//   1. メソッドが公開面にあるか確認する
//   2. 権限を検査する（checkPermission）
//   3. appScope を強制付与して本体へ委譲し、例外を ok:false へ畳む
import { RPC_RES, type RpcRequest, type RpcResponse } from '../sdk/rpcProtocol';
import {
  RPC_METHODS,
  type RpcMethod, type PluginContext, type WorkFileRecord,
  type HttpRequest, type HttpResponse, type ToastLevel,
} from '../sdk/publicApi';
import { checkPermission, requestedScope, type PermissionContext } from './permissions';

export interface GatewayDeps {
  context: () => Promise<PluginContext>;
  workFiles: {
    list: (q: { appScope: string; limit?: number }) => Promise<WorkFileRecord[]>;
    get: (args: { appScope: string; id: string }) => Promise<WorkFileRecord | null>;
    create: (args: { appScope: string; name: string; data: Record<string, unknown> }) => Promise<WorkFileRecord>;
    update: (args: { appScope: string; id: string; name?: string; data?: Record<string, unknown> }) => Promise<WorkFileRecord>;
    remove: (args: { appScope: string; id: string }) => Promise<void>;
  };
  ui: {
    setSelection: (item: unknown) => Promise<void>;
    toast: (message: string, level: ToastLevel) => Promise<void>;
    confirm: (message: string) => Promise<boolean>;
    setTitle: (title: string) => Promise<void>;
  };
  http: (req: HttpRequest) => Promise<HttpResponse>;
  chat: { send: (text: string) => Promise<void> };
  storage: { get: (key: string) => Promise<unknown>; set: (key: string, value: unknown) => Promise<void> };
}

const ok = (id: string, result: unknown): RpcResponse => ({ type: RPC_RES, id, ok: true, result });
const fail = (id: string, error: string): RpcResponse => ({ type: RPC_RES, id, ok: false, error });

const asObject = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : {};

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

const HTTP_METHODS: readonly HttpRequest['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const isHttpMethod = (v: string): v is NonNullable<HttpRequest['method']> =>
  (HTTP_METHODS as readonly string[]).includes(v);

/** 値が文字列のエントリだけを残す（ヘッダは補助情報なので拒否ではなく除外に留める）。 */
const stringHeaders = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, value] of Object.entries(asObject(v))) {
    if (typeof k === 'string' && typeof value === 'string') out[k] = value;
  }
  return out;
};

const isRpcMethod = (m: string): m is RpcMethod => (RPC_METHODS as readonly string[]).includes(m);

async function dispatch(
  method: RpcMethod,
  p: Record<string, unknown>,
  ctx: PermissionContext,
  deps: GatewayDeps,
): Promise<unknown> {
  switch (method) {
    case 'context.get':
      return deps.context();

    case 'workFiles.list':
      return deps.workFiles.list({
        appScope: requestedScope(p, ctx.pluginId),
        limit: typeof p.limit === 'number' ? p.limit : undefined,
      });

    case 'workFiles.get': {
      const id = str(p.id);
      if (!id) throw new Error('id を指定してください');
      return deps.workFiles.get({ appScope: requestedScope(p, ctx.pluginId), id });
    }

    case 'workFiles.create': {
      const name = str(p.name);
      if (!name) throw new Error('name を指定してください');
      // appScope は常に自分の id。プラグインの指定は採用しない
      return deps.workFiles.create({ appScope: ctx.pluginId, name, data: asObject(p.data) });
    }

    case 'workFiles.update': {
      const id = str(p.id);
      if (!id) throw new Error('id を指定してください');
      return deps.workFiles.update({
        appScope: ctx.pluginId,
        id,
        name: str(p.name) ?? undefined,
        data: p.data === undefined ? undefined : asObject(p.data),
      });
    }

    case 'workFiles.remove': {
      const id = str(p.id);
      if (!id) throw new Error('id を指定してください');
      await deps.workFiles.remove({ appScope: ctx.pluginId, id });
      return null;
    }

    case 'ui.setSelection':
      await deps.ui.setSelection(p.item ?? null);
      return null;

    case 'ui.toast': {
      const message = str(p.message);
      if (!message) throw new Error('message を指定してください');
      const level = str(p.level);
      const valid: ToastLevel[] = ['info', 'success', 'warning', 'error'];
      await deps.ui.toast(message, valid.includes(level as ToastLevel) ? level as ToastLevel : 'info');
      return null;
    }

    case 'ui.confirm': {
      const message = str(p.message);
      if (!message) throw new Error('message を指定してください');
      return deps.ui.confirm(message);
    }

    case 'ui.setTitle': {
      const title = str(p.title);
      if (title === null) throw new Error('title を指定してください');
      await deps.ui.setTitle(title);
      return null;
    }

    case 'http.request': {
      const url = str(p.url);
      if (!url) throw new Error('url を指定してください');
      const methodStr = str(p.method) ?? 'GET';
      if (!isHttpMethod(methodStr)) {
        throw new Error(`method が不正です: "${methodStr}"（許可値: ${HTTP_METHODS.join(', ')}）`);
      }
      return deps.http({
        url,
        method: methodStr,
        headers: stringHeaders(p.headers),
        body: str(p.body) ?? undefined,
      });
    }

    case 'chat.send': {
      const text = str(p.text);
      if (!text) throw new Error('text を指定してください');
      await deps.chat.send(text);
      return null;
    }

    case 'storage.get': {
      const key = str(p.key);
      if (!key) throw new Error('key を指定してください');
      return deps.storage.get(key);
    }

    case 'storage.set': {
      const key = str(p.key);
      if (!key) throw new Error('key を指定してください');
      await deps.storage.set(key, p.value ?? null);
      return null;
    }

    default: {
      // RPC_METHODS に追加したのに case を書き忘れると、ここで型エラーになる。
      // 無いと未処理のメソッドが ok:true / result:null で静かに通ってしまう。
      const unhandled: never = method;
      throw new Error(`未処理のメソッドです: ${String(unhandled)}`);
    }
  }
}

export async function handleRpc(
  req: RpcRequest,
  ctx: PermissionContext,
  deps: GatewayDeps,
): Promise<RpcResponse> {
  if (!isRpcMethod(req.method)) {
    return fail(req.id, `${req.method} は公開されていません。`);
  }
  const params = asObject(req.params);

  const permission = checkPermission(req.method, params, ctx);
  if (!permission.allowed) return fail(req.id, permission.error);

  try {
    const result = await dispatch(req.method, params, ctx, deps);
    return ok(req.id, result ?? null);
  } catch (e) {
    // プラグインの失敗が本体を巻き込まないよう、ここで必ず畳む
    return fail(req.id, e instanceof Error ? e.message : String(e));
  }
}
