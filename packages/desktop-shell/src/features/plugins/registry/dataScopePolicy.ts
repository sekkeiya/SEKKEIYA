// プラグインが触れるデータの範囲を「出所」から決める（要件66）。
//
// 「自分のデータだけ」をハードコードせず policy にしてあるのは、用途によって
// 必要な範囲が違うため。自作ツールが自分の S.Model / S.Layout を読めないと
// 「自分のロジックで効率化する」という中心的な用途が成立しない。
// 一方でマーケット公開のプラグインに同じことを許すわけにはいかない。
// 信頼は manifest の自己申告ではなく「どこから入れたか」で決める。
import type { PluginPermissions } from '../manifest/manifestTypes';

export type PluginSource =
  /** 自分で作って自分で入れたツール（開発モード / ローカルフォルダ）。 */
  | 'self'
  /** チーム管理者が承認して配ったもの。初版では経路を作らない。 */
  | 'team'
  /** マーケット公開。不特定多数。 */
  | 'marketplace';

export interface DataScopePolicy {
  /** 自分の appScope に対する権限。 */
  own: 'none' | 'read' | 'readwrite';
  /** 読み取りを許す他サブアプリの appScope。書き込みは決して許さない。 */
  readScopes: string[];
}

/** 他 scope の読み取りを許してよい出所。 */
const SOURCES_ALLOWING_READ_SCOPES: PluginSource[] = ['self'];

export function resolveDataScopePolicy(
  source: PluginSource,
  permissions: PluginPermissions | undefined,
): DataScopePolicy {
  const own = permissions?.workFiles ?? 'none';
  const declared = permissions?.readScopes ?? [];
  const readScopes = SOURCES_ALLOWING_READ_SCOPES.includes(source) ? [...declared] : [];
  return { own, readScopes };
}
