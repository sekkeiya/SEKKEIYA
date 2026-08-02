// manifest.permissions をユーザーに見せる日本語へ変換する（要件70 の同意ダイアログ用）。
// React 非依存の純ロジック。
import type { PluginPermissions } from '../manifest/manifestTypes';

/** 宣言された権限の説明行。宣言が無ければ空配列（UI 側で「権限の要求なし」を出す）。 */
export function describePermissions(permissions: PluginPermissions | undefined): string[] {
  const out: string[] = [];
  if (!permissions) return out;
  if (permissions.workFiles === 'read') out.push('このプラグイン領域の作業ファイルを読み取る');
  if (permissions.workFiles === 'readwrite') out.push('このプラグイン領域の作業ファイルを読み書きする');
  if (permissions.readScopes?.length) {
    out.push(`他サブアプリのデータを読み取る: ${permissions.readScopes.join(', ')}（自分で置いたプラグインのみ有効）`);
  }
  if (permissions.network?.length) {
    out.push(`外部サーバーと通信する: ${permissions.network.join(', ')}`);
  }
  if (permissions.chat) out.push('SEKKEIYA Chat へメッセージを送る');
  return out;
}

/** 同意を求める必要がある（外へ出る系の）権限を含むか。 */
export function hasSensitivePermissions(permissions: PluginPermissions | undefined): boolean {
  return !!(permissions && ((permissions.network?.length ?? 0) > 0 || permissions.chat));
}
