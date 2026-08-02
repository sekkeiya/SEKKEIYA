import { describe, it, expect, vi } from 'vitest';
import { handleRpc, type GatewayDeps } from './gateway';
import type { PermissionContext } from './permissions';
import { RPC_REQ, RPC_RES } from '../sdk/rpcProtocol';
import type { RpcRequest } from '../sdk/rpcProtocol';
import type { WorkFileRecord } from '../sdk/publicApi';

const file = (over: Partial<WorkFileRecord> = {}): WorkFileRecord => ({
  id: 'f1', appScope: 'com.example.tool', name: 'a', data: {},
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

const makeDeps = (): GatewayDeps => ({
  context: vi.fn(async () => ({ projectId: 'p1', projectName: 'P', userId: 'u1', locale: 'ja', theme: 'dark' as const })),
  workFiles: {
    list: vi.fn(async () => [file()]),
    get: vi.fn(async () => file()),
    create: vi.fn(async () => file({ id: 'new' })),
    update: vi.fn(async () => file({ name: 'b' })),
    remove: vi.fn(async () => {}),
  },
  ui: {
    setSelection: vi.fn(async () => {}),
    toast: vi.fn(async () => {}),
    confirm: vi.fn(async () => true),
    setTitle: vi.fn(async () => {}),
  },
  http: vi.fn(async () => ({ status: 200, headers: {}, body: 'ok' })),
  chat: { send: vi.fn(async () => {}) },
  storage: { get: vi.fn(async () => 42), set: vi.fn(async () => {}) },
});

const ctx: PermissionContext = {
  pluginId: 'com.example.tool',
  policy: { own: 'readwrite', readScopes: ['3dss'], network: ['https://api.example.com'], chat: true },
  network: ['https://api.example.com'],
  chat: true,
};

const req = (method: string, params?: unknown): RpcRequest => ({ type: RPC_REQ, id: 'r1', method, params });

describe('handleRpc — 正常系', () => {
  it('context.get を本体へ委譲する', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('context.get'), ctx, deps);
    expect(res).toEqual({ type: RPC_RES, id: 'r1', ok: true, result: { projectId: 'p1', projectName: 'P', userId: 'u1', locale: 'ja', theme: 'dark' } });
  });
  it('id を応答にそのまま返す', async () => {
    const res = await handleRpc({ ...req('ui.toast', { message: 'x' }), id: 'zzz' }, ctx, makeDeps());
    expect(res.id).toBe('zzz');
  });
});

describe('handleRpc — appScope の強制付与', () => {
  it('list の appScope 未指定なら自分の id を入れる', async () => {
    const deps = makeDeps();
    await handleRpc(req('workFiles.list', {}), ctx, deps);
    expect(deps.workFiles.list).toHaveBeenCalledWith({ appScope: 'com.example.tool', limit: undefined });
  });
  it('プラグインが他人の appScope を偽装しても、許可外なら拒否する', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('workFiles.list', { appScope: '3dsl' }), ctx, deps);
    expect(res.ok).toBe(false);
    expect(deps.workFiles.list).not.toHaveBeenCalled();
  });
  it('許可された他 scope はそのまま渡す', async () => {
    const deps = makeDeps();
    await handleRpc(req('workFiles.list', { appScope: '3dss' }), ctx, deps);
    expect(deps.workFiles.list).toHaveBeenCalledWith({ appScope: '3dss', limit: undefined });
  });
  it('create は appScope の指定を無視して必ず自分の id にする（他 scope 指定は権限チェックで落ちる）', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('workFiles.create', { name: 'n', data: {}, appScope: '3dss' }), ctx, deps);
    // 他 scope への書き込みは権限チェックで落ちる
    expect(res.ok).toBe(false);
    expect(deps.workFiles.create).not.toHaveBeenCalled();
  });
  it('create に自分の id を appScope として明示指定しても、dispatch は params を使わず ctx.pluginId を渡す', async () => {
    // 権限チェックを通る appScope（＝自分の id）を明示しても、dispatch が params.appScope を
    // そのまま使ってしまう回帰（本来は ctx.pluginId 固定のはず）を検知するためのテスト。
    const deps = makeDeps();
    await handleRpc(req('workFiles.create', { name: 'n', data: {}, appScope: 'com.example.tool' }), ctx, deps);
    expect(deps.workFiles.create).toHaveBeenCalledWith({ appScope: 'com.example.tool', name: 'n', data: {} });
  });
  it('create の appScope 未指定でも自分の id になる', async () => {
    const deps = makeDeps();
    await handleRpc(req('workFiles.create', { name: 'n', data: {} }), ctx, deps);
    expect(deps.workFiles.create).toHaveBeenCalledWith({ appScope: 'com.example.tool', name: 'n', data: {} });
  });
});

describe('handleRpc — 権限違反', () => {
  it('拒否理由をそのまま返す', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('http.request', { url: 'https://evil.example.net/' }), ctx, deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('permissions.network');
    expect(deps.http).not.toHaveBeenCalled();
  });
});

describe('handleRpc — 未知のメソッド', () => {
  it('公開していないメソッドを拒否する', async () => {
    const res = await handleRpc(req('store.getState'), ctx, makeDeps());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('store.getState');
  });
});

describe('handleRpc — 引数不正', () => {
  it('workFiles.get に id が無ければ拒否する', async () => {
    const res = await handleRpc(req('workFiles.get', {}), ctx, makeDeps());
    expect(res.ok).toBe(false);
  });
  it('ui.toast に message が無ければ拒否する', async () => {
    const res = await handleRpc(req('ui.toast', {}), ctx, makeDeps());
    expect(res.ok).toBe(false);
  });
});

describe('handleRpc — http.request の method 検証', () => {
  it('許可されていない method（TRACE）は拒否し、エラー文に許可値を含める', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('http.request', { url: 'https://api.example.com/x', method: 'TRACE' }), ctx, deps);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain('TRACE');
      expect(res.error).toContain('GET');
      expect(res.error).toContain('POST');
      expect(res.error).toContain('PUT');
      expect(res.error).toContain('PATCH');
      expect(res.error).toContain('DELETE');
    }
    expect(deps.http).not.toHaveBeenCalled();
  });
  it('許可される method（POST）はそのまま本体へ渡す', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('http.request', { url: 'https://api.example.com/x', method: 'POST' }), ctx, deps);
    expect(res.ok).toBe(true);
    expect(deps.http).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
  });
});

describe('handleRpc — http.request の headers 検証', () => {
  it('文字列でない値は落とし、文字列の値だけを本体へ渡す', async () => {
    const deps = makeDeps();
    const res = await handleRpc(req('http.request', {
      url: 'https://api.example.com/x',
      headers: { 'X-Ok': 'value', 'X-Num': 123, 'X-Obj': { nested: true }, 'X-Arr': [1, 2] },
    }), ctx, deps);
    expect(res.ok).toBe(true);
    expect(deps.http).toHaveBeenCalledWith(expect.objectContaining({ headers: { 'X-Ok': 'value' } }));
  });
});

describe('handleRpc — 本体側の例外', () => {
  it('例外を握って ok:false に変換する（本体を巻き込まない）', async () => {
    const deps = makeDeps();
    deps.workFiles.list = vi.fn(async () => { throw new Error('firestore down'); });
    const res = await handleRpc(req('workFiles.list', {}), ctx, deps);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('firestore down');
  });
});
