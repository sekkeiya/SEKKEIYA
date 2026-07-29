// ★ 公開 API の単一定義（要件66 / 要件67）。
//
// このファイルが「プラグインから見える SEKKEIYA の全て」。
// ここを壊す変更をしたら registry/engineCompat.ts の API_VERSION を上げること。
// 逆に言えば、ここに無いものはプラグインから触れない。
//
// 設計上の約束:
//   - すべて非同期・シリアライズ可能（将来 iframe を別オリジンや Worker へ移せるように）
//   - 内部ストア（useAppStore）・Firestore ハンドル・Tauri invoke・認証トークンは出さない
//   - 画面遷移は出さない（プラグインが勝手にプロジェクトを切り替えると挙動が読めなくなる）

import type { PluginVerbDecl } from '../manifest/manifestTypes';

/** プラグインが呼べる RPC メソッドの全て。gateway と permissions がこの一覧を共有する。 */
export const RPC_METHODS = [
  'context.get',
  'workFiles.list',
  'workFiles.get',
  'workFiles.create',
  'workFiles.update',
  'workFiles.remove',
  'ui.setSelection',
  'ui.toast',
  'ui.confirm',
  'ui.setTitle',
  'http.request',
  'chat.send',
  'storage.get',
  'storage.set',
] as const;

export type RpcMethod = typeof RPC_METHODS[number];

export interface PluginContext {
  projectId: string | null;
  projectName: string | null;
  userId: string | null;
  locale: string;
  theme: 'light' | 'dark';
}

/** workFiles の 1 件。data の中身はプラグインが自由に決める。 */
export interface WorkFileRecord {
  id: string;
  appScope: string;
  name: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkFileQuery {
  /** 省略時は自分の appScope。permissions.readScopes にあるものだけ他 scope を指定できる。 */
  appScope?: string;
  limit?: number;
}

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

/** プラグイン側が `sekkeiya` として受け取る面。 */
export interface SekkeiyaPluginApi {
  context: {
    get(): Promise<PluginContext>;
    /** 本体からの発火は未実装（次のプランで配線）。今は登録できるだけで呼ばれない。 */
    onChange(cb: (ctx: PluginContext) => void): () => void;
  };
  workFiles: {
    list(query?: WorkFileQuery): Promise<WorkFileRecord[]>;
    get(id: string): Promise<WorkFileRecord | null>;
    create(input: { name: string; data: Record<string, unknown> }): Promise<WorkFileRecord>;
    update(id: string, patch: { name?: string; data?: Record<string, unknown> }): Promise<WorkFileRecord>;
    remove(id: string): Promise<void>;
    /** 本体からの発火は未実装（次のプランで配線）。今は登録できるだけで呼ばれない。 */
    onChange(cb: (files: WorkFileRecord[]) => void): () => void;
  };
  ui: {
    setSelection(item: unknown): Promise<void>;
    toast(message: string, level?: ToastLevel): Promise<void>;
    confirm(message: string): Promise<boolean>;
    setTitle(title: string): Promise<void>;
  };
  http: {
    request(req: HttpRequest): Promise<HttpResponse>;
  };
  chat: {
    send(text: string): Promise<void>;
  };
  verbs: {
    /**
     * manifest の contributes.verbs で宣言した verb の実装を登録する。
     * 本体からの発火は未実装（次のプランで配線）。今は登録できるだけで呼ばれない。
     */
    on(name: string, handler: (input: Record<string, unknown>) => Promise<unknown>): void;
  };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
}

/** 再エクスポート（プラグイン作者はこのファイルだけ見れば済むように）。 */
export type { PluginVerbDecl };
