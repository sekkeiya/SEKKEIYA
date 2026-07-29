// プラグイン（iframe）側で使う薄いラッパ（要件67）。
// postMessage を await できる関数に包むだけで、判断は一切しない。
// 本体側の判断（権限・appScope）は rpc/gateway.ts が持つ。
import {
  RPC_REQ, RPC_RES, RPC_EVENT, RPC_TIMEOUT_MS,
  type RpcRequest, type RpcResponse,
} from './rpcProtocol';
import type {
  SekkeiyaPluginApi, PluginContext, WorkFileRecord, WorkFileQuery,
  HttpRequest, HttpResponse, ToastLevel,
} from './publicApi';

interface PostTarget { postMessage: (message: unknown, targetOrigin: string) => void; }
type Listen = (cb: (data: unknown) => void) => () => void;

const isResponse = (v: unknown): v is RpcResponse =>
  !!v && typeof v === 'object' && (v as { type?: unknown }).type === RPC_RES;

export function createPluginApi(target: PostTarget, listen: Listen): SekkeiyaPluginApi {
  let seq = 0;
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const verbHandlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>();
  const contextListeners = new Set<(ctx: PluginContext) => void>();
  const workFileListeners = new Set<(files: WorkFileRecord[]) => void>();

  listen((data) => {
    if (isResponse(data)) {
      const entry = pending.get(data.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(data.id);
      if (data.ok) entry.resolve(data.result);
      else entry.reject(new Error(data.error));
      return;
    }
    if (!data || typeof data !== 'object') return;
    const ev = data as { type?: unknown; name?: unknown; payload?: unknown };
    if (ev.type !== RPC_EVENT || typeof ev.name !== 'string') return;

    if (ev.name === 'context.changed') {
      contextListeners.forEach(cb => cb(ev.payload as PluginContext));
    } else if (ev.name === 'workFiles.changed') {
      workFileListeners.forEach(cb => cb(ev.payload as WorkFileRecord[]));
    } else if (ev.name.startsWith('verb:')) {
      const handler = verbHandlers.get(ev.name.slice('verb:'.length));
      if (handler) void handler((ev.payload ?? {}) as Record<string, unknown>);
    }
  });

  function call(method: string, params?: unknown): Promise<unknown> {
    const id = `p${++seq}`;
    const req: RpcRequest = { type: RPC_REQ, id, method, params };
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} が応答しませんでした（${RPC_TIMEOUT_MS}ms）`));
      }, RPC_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      target.postMessage(req, '*');
    });
  }

  return {
    context: {
      get: () => call('context.get') as Promise<PluginContext>,
      onChange: (cb) => { contextListeners.add(cb); return () => contextListeners.delete(cb); },
    },
    workFiles: {
      list: (query?: WorkFileQuery) => call('workFiles.list', query ?? {}) as Promise<WorkFileRecord[]>,
      get: (id) => call('workFiles.get', { id }) as Promise<WorkFileRecord | null>,
      create: (input) => call('workFiles.create', input) as Promise<WorkFileRecord>,
      update: (id, patch) => call('workFiles.update', { id, ...patch }) as Promise<WorkFileRecord>,
      remove: async (id) => { await call('workFiles.remove', { id }); },
      onChange: (cb) => { workFileListeners.add(cb); return () => workFileListeners.delete(cb); },
    },
    ui: {
      setSelection: async (item) => { await call('ui.setSelection', { item }); },
      toast: async (message, level: ToastLevel = 'info') => { await call('ui.toast', { message, level }); },
      confirm: (message) => call('ui.confirm', { message }) as Promise<boolean>,
      setTitle: async (title) => { await call('ui.setTitle', { title }); },
    },
    http: {
      request: (req: HttpRequest) => call('http.request', req) as Promise<HttpResponse>,
    },
    chat: {
      send: async (text) => { await call('chat.send', { text }); },
    },
    verbs: {
      on: (name, handler) => { verbHandlers.set(name, handler); },
    },
    storage: {
      get: (key) => call('storage.get', { key }),
      set: async (key, value) => { await call('storage.set', { key, value }); },
    },
  };
}
