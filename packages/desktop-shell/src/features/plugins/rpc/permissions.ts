// RPC 1 件ごとの権限チェック（要件70 の土台）。React / fs 非依存の純ロジック。
//
// 違反しても プラグインは停止させない（呼び出しだけ拒否する）。開発中は宣言漏れが
// 日常的に起きるため、そのたびに再起動が要ると開発モードが機能しない。
// 代わりにエラー文へ「manifest のどこを直すか」を書く。Claude Code がそれを読んで直せる。
import type { RpcMethod } from '../sdk/publicApi';
import type { DataScopePolicy } from '../registry/dataScopePolicy';

export interface PermissionContext {
  pluginId: string;
  policy: DataScopePolicy;
  /** permissions.network の宣言（https のオリジン）。 */
  network: string[];
  chat: boolean;
}

export type PermissionResult = { allowed: true } | { allowed: false; error: string };

const allow: PermissionResult = { allowed: true };
const deny = (error: string): PermissionResult => ({ allowed: false, error });

const READ_METHODS: RpcMethod[] = ['workFiles.list', 'workFiles.get'];
const WRITE_METHODS: RpcMethod[] = ['workFiles.create', 'workFiles.update', 'workFiles.remove'];

/** params.appScope を読む（未指定＝自分の領域）。gateway.ts の dispatch とロジックを共有する。 */
export function requestedScope(params: unknown, pluginId: string): string {
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    const v = (params as { appScope?: unknown }).appScope;
    if (typeof v === 'string' && v) return v;
  }
  return pluginId;
}

function originOf(params: unknown): string | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  const url = (params as { url?: unknown }).url;
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function checkPermission(
  method: RpcMethod,
  params: unknown,
  ctx: PermissionContext,
): PermissionResult {
  if (READ_METHODS.includes(method)) {
    const scope = requestedScope(params, ctx.pluginId);
    if (scope === ctx.pluginId) {
      return ctx.policy.own === 'none'
        ? deny('workFiles を読むには manifest の permissions.workFiles に "read" か "readwrite" が要ります。')
        : allow;
    }
    return ctx.policy.readScopes.includes(scope)
      ? allow
      : deny(`${scope} を読むには manifest の permissions.readScopes に "${scope}" を足してください（自分で入れたプラグインのみ有効です）。`);
  }

  if (WRITE_METHODS.includes(method)) {
    const scope = requestedScope(params, ctx.pluginId);
    if (scope !== ctx.pluginId) {
      return deny(`他のサブアプリ（${scope}）には書き込めません。読み取りのみ可能です。`);
    }
    return ctx.policy.own === 'readwrite'
      ? allow
      : deny('workFiles に書き込むには manifest の permissions.workFiles に "readwrite" が要ります。');
  }

  if (method === 'http.request') {
    const origin = originOf(params);
    if (!origin) return deny('url が正しくありません（https の絶対 URL を指定してください）。');
    if (!origin.startsWith('https://')) return deny('https の URL のみ使用できます。');
    // validateManifest（isHttpsOrigin）は末尾スラッシュ付きの宣言も有効として受け入れるため、
    // URL.origin（末尾スラッシュ無し）と比較する前に正規化する。さもないと妥当な manifest が
    // 原因不明の拒否を受ける。
    const declared = ctx.network.map(n => n.replace(/\/$/, ''));
    return declared.includes(origin)
      ? allow
      : deny(`${origin} への通信は許可されていません。manifest の permissions.network に "${origin}" を足してください。`);
  }

  if (method === 'chat.send') {
    return ctx.chat
      ? allow
      : deny('チャットへ送るには manifest の permissions.chat を true にしてください。');
  }

  // context / ui / storage は宣言不要（自分の領域か、本体が描画するものだけ）
  return allow;
}
