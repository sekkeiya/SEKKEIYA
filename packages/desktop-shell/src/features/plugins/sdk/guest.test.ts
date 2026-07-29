import { describe, it, expect, vi } from 'vitest';
import { createPluginApi } from './guest';
import { RPC_REQ, RPC_RES, RPC_EVENT } from './rpcProtocol';
import type { RpcRequest } from './rpcProtocol';

/** 本体の代わりに、送られてきた要求へ即座に応答する足場。 */
function harness(respond: (req: RpcRequest) => unknown) {
  let handler: ((data: unknown) => void) | null = null;
  const sent: RpcRequest[] = [];
  const target = {
    postMessage: (m: unknown) => {
      const req = m as RpcRequest;
      sent.push(req);
      queueMicrotask(() => handler?.({ type: RPC_RES, id: req.id, ok: true, result: respond(req) }));
    },
  };
  const listen = (cb: (data: unknown) => void) => { handler = cb; return () => { handler = null; }; };
  const api = createPluginApi(target, listen);
  return {
    api,
    sent,
    fail: (id: string, error: string) => handler?.({ type: RPC_RES, id, ok: false, error }),
    /** 本体 → プラグインの一方向通知を流す。 */
    emit: (name: string, payload: unknown) => handler?.({ type: RPC_EVENT, name, payload }),
  };
}

/**
 * 自動応答を行わない足場。要求を `sent` に記録するだけで、応答は
 * `fail`（や将来の手動 resolve ヘルパ）を呼んだときにのみ返す。
 * 失敗応答が自動成功応答と競り合う（テストが先に負ける）ケース用。
 */
function harnessManual() {
  let handler: ((data: unknown) => void) | null = null;
  const sent: RpcRequest[] = [];
  const target = {
    postMessage: (m: unknown) => { sent.push(m as RpcRequest); },
  };
  const listen = (cb: (data: unknown) => void) => { handler = cb; return () => { handler = null; }; };
  const api = createPluginApi(target, listen);
  return {
    api,
    sent,
    fail: (id: string, error: string) => handler?.({ type: RPC_RES, id, ok: false, error }),
    emit: (name: string, payload: unknown) => handler?.({ type: RPC_EVENT, name, payload }),
  };
}

describe('createPluginApi — 要求の組み立て', () => {
  it('メソッド名と引数を載せて送る', async () => {
    const h = harness(() => null);
    await h.api.ui.toast('こんにちは', 'success');
    expect(h.sent[0].type).toBe(RPC_REQ);
    expect(h.sent[0].method).toBe('ui.toast');
    expect(h.sent[0].params).toEqual({ message: 'こんにちは', level: 'success' });
  });
  it('要求ごとに異なる id を振る', async () => {
    const h = harness(() => null);
    await Promise.all([h.api.ui.toast('a'), h.api.ui.toast('b')]);
    expect(h.sent[0].id).not.toBe(h.sent[1].id);
  });
});

describe('createPluginApi — 応答', () => {
  it('result を解決する', async () => {
    const h = harness(() => ({ projectId: 'p1' }));
    await expect(h.api.context.get()).resolves.toEqual({ projectId: 'p1' });
  });
  it('workFiles.list は配列を返す', async () => {
    const h = harness(() => []);
    await expect(h.api.workFiles.list()).resolves.toEqual([]);
  });
});

describe('createPluginApi — エラー', () => {
  it('ok:false を例外にする', async () => {
    let captured = '';
    const h = harnessManual();
    const p = h.api.http.request({ url: 'https://x.com/' }).catch((e: Error) => { captured = e.message; });
    h.fail(h.sent[0].id, 'permissions.network に足してください');
    await p;
    expect(captured).toContain('permissions.network');
  });
});

describe('createPluginApi — verbs', () => {
  it('登録した handler は本体からの verb イベントで呼ばれる', async () => {
    const h = harness(() => null);
    const spy = vi.fn(async () => ({ ok: true }));
    h.api.verbs.on('create_estimate', spy);
    h.emit('verb:create_estimate', { amount: 3 });
    await Promise.resolve();
    expect(spy).toHaveBeenCalledWith({ amount: 3 });
  });
  it('登録していない verb のイベントは無視する', async () => {
    const h = harness(() => null);
    const spy = vi.fn(async () => null);
    h.api.verbs.on('a', spy);
    h.emit('verb:b', {});
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('createPluginApi — context.onChange', () => {
  it('本体からの通知を購読でき、解除できる', async () => {
    const h = harness(() => null);
    const seen: unknown[] = [];
    const off = h.api.context.onChange(c => seen.push(c));
    h.emit('context.changed', { projectId: 'p2' });
    expect(seen).toEqual([{ projectId: 'p2' }]);
    off();
    h.emit('context.changed', { projectId: 'p3' });
    expect(seen).toHaveLength(1);
  });
});
