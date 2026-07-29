// プラグインの plugin.json の型（要件64）。
// 値の検証は validateManifest.ts。ここは形だけを定義する。

/** verb のリスク階級（既存の store/verb/verbTypes.ts の VerbRisk に合わせる）。 */
export type PluginVerbRisk = 'low' | 'medium' | 'high';

/**
 * AI verb の宣言。既存 VerbDef から handler を除いた部分。
 * handler は JSON に書けないので、プラグイン側が sekkeiya.verbs.on() で登録する。
 */
export interface PluginVerbDecl {
  /** ツール名。snake_case。 */
  name: string;
  /** モデル向けの説明。 */
  description: string;
  /** Anthropic input_schema 互換の JSON Schema。 */
  input: Record<string, unknown>;
  risk: PluginVerbRisk;
  /** 進捗表示ラベル。 */
  label?: string;
}

export interface PluginPermissions {
  /** 自分の領域の workFiles へのアクセス。未指定＝不可。 */
  workFiles?: 'read' | 'readwrite';
  /** 読み取りを許す他サブアプリの appScope。自分で入れたツールのみ有効。 */
  readScopes?: string[];
  /** 通信を許すオリジン（https のみ・パス無し）。 */
  network?: string[];
  /** SEKKEIYA Chat への送信を許すか。 */
  chat?: boolean;
}

export interface PluginContributes {
  /** 子アプリタブを足す。 */
  tab?: { label: string };
  /** AI verb を足す。 */
  verbs?: PluginVerbDecl[];
}

export interface PluginManifest {
  /** 逆ドメイン形式。appScope とデータ分離キーを兼ねる。 */
  id: string;
  name: string;
  /** プラグイン自身の semver。 */
  version: string;
  /** 対応する公開 API バージョンの range（`^1.0.0` か `1.0.0`）。 */
  engine: string;
  /** iframe に読ませる HTML。プラグインルートからの相対パス。 */
  entry: string;
  icon?: string;
  color?: string;
  contributes?: PluginContributes;
  permissions?: PluginPermissions;
}
