// plugin.json の検証（要件64）。React / fs 非依存の純ロジック。
// 方針: エラーは 1 件目で止めず全部返す。プラグイン作者が 1 往復で直せるようにするため。
import type {
  PluginManifest, PluginPermissions, PluginContributes, PluginVerbDecl, PluginVerbRisk,
} from './manifestTypes';

export interface ManifestError { path: string; message: string; }
export type ValidateResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: ManifestError[] };

/** 逆ドメイン形式。小文字英数とハイフン、ドット区切りが 1 つ以上。 */
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
/**
 * 対応する range は完全一致とキャレットだけ。増やすと互換判定が複雑になる。
 * プレリリースは書けない: プレリリースの順序比較は semver の中でも間違えやすい部分で、
 * 静かに誤判定するくらいなら受け付けないほうが安全。必要になったら緩める（satisfiesEngine 参照）。
 */
const ENGINE_RE = /^\^?\d+\.\d+\.\d+$/;
const VERB_NAME_RE = /^[a-z][a-z0-9_]*$/;

const TOP_KEYS = ['id', 'name', 'version', 'engine', 'entry', 'icon', 'color', 'contributes', 'permissions'];
const PERM_KEYS = ['workFiles', 'readScopes', 'network', 'chat'];
const WORKFILES_VALUES = ['read', 'readwrite'];
const RISKS: PluginVerbRisk[] = ['low', 'medium', 'high'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** entry がプラグインフォルダの外を指していないか。 */
function entryErrors(entry: string): string[] {
  const out: string[] = [];
  if (entry.includes('\\')) out.push('区切りは / を使ってください');
  if (entry.split('/').includes('..')) out.push('.. は使えません');
  if (entry.startsWith('/')) out.push('絶対パスは使えません');
  if (/^[A-Za-z]:/.test(entry)) out.push('ドライブレターは使えません');
  // percent-encode されたパス（例: %2e%2e）は、デコードの段数を推測せずに一律で弾く。
  // '..' 等の文字列チェックだけではすり抜けるうえ、convertFileSrc 側やアセットプロトコルの
  // 許可リストは無制限設定のため、ここが唯一の防御になる。
  if (entry.includes('%')) out.push('percent-encode されたパス（%を含む）は使えません');
  if (!entry.toLowerCase().endsWith('.html')) out.push('.html を指してください');
  return out;
}

/** https のオリジン（スキーム + ホスト [+ ポート]）ちょうどであること。 */
function isHttpsOrigin(value: string): boolean {
  if (!value.startsWith('https://')) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  return url.origin === value.replace(/\/$/, '') && url.pathname === '/' && !url.search && !url.hash;
}

function validatePermissions(perms: unknown, errors: ManifestError[]): void {
  if (perms === undefined) return;
  if (!isObject(perms)) {
    errors.push({ path: 'permissions', message: 'オブジェクトで指定してください' });
    return;
  }
  for (const key of Object.keys(perms)) {
    if (!PERM_KEYS.includes(key)) {
      errors.push({ path: `permissions.${key}`, message: '未知のキーです' });
    }
  }
  const { workFiles, readScopes, network, chat } = perms as PluginPermissions;
  if (workFiles !== undefined && !WORKFILES_VALUES.includes(workFiles)) {
    errors.push({ path: 'permissions.workFiles', message: `"read" か "readwrite" を指定してください` });
  }
  if (readScopes !== undefined) {
    if (!Array.isArray(readScopes) || readScopes.some(s => typeof s !== 'string' || !s)) {
      errors.push({ path: 'permissions.readScopes', message: '文字列の配列で指定してください' });
    }
  }
  if (network !== undefined) {
    if (!Array.isArray(network)) {
      errors.push({ path: 'permissions.network', message: '配列で指定してください' });
    } else {
      network.forEach((v, i) => {
        if (typeof v !== 'string' || !isHttpsOrigin(v)) {
          errors.push({ path: `permissions.network[${i}]`, message: 'https のオリジンのみ指定できます（例: https://api.example.com）' });
        }
      });
    }
  }
  if (chat !== undefined && typeof chat !== 'boolean') {
    errors.push({ path: 'permissions.chat', message: '真偽値で指定してください' });
  }
}

function validateVerb(verb: unknown, i: number, errors: ManifestError[]): void {
  const at = `contributes.verbs[${i}]`;
  if (!isObject(verb)) {
    errors.push({ path: at, message: 'オブジェクトで指定してください' });
    return;
  }
  const v = verb as Partial<PluginVerbDecl>;
  if (typeof v.name !== 'string' || !VERB_NAME_RE.test(v.name)) {
    errors.push({ path: `${at}.name`, message: 'snake_case で指定してください（例: create_estimate）' });
  }
  if (typeof v.description !== 'string' || !v.description) {
    errors.push({ path: `${at}.description`, message: '説明を書いてください（AI が読みます）' });
  }
  if (!isObject(v.input)) {
    errors.push({ path: `${at}.input`, message: 'JSON Schema をオブジェクトで指定してください' });
  }
  if (typeof v.risk !== 'string' || !RISKS.includes(v.risk as PluginVerbRisk)) {
    errors.push({ path: `${at}.risk`, message: `"low" / "medium" / "high" のいずれかを指定してください` });
  }
}

function validateContributes(contributes: unknown, errors: ManifestError[]): void {
  if (contributes === undefined) return;
  if (!isObject(contributes)) {
    errors.push({ path: 'contributes', message: 'オブジェクトで指定してください' });
    return;
  }
  const c = contributes as PluginContributes;
  if (c.tab !== undefined) {
    if (!isObject(c.tab) || typeof c.tab.label !== 'string' || !c.tab.label) {
      errors.push({ path: 'contributes.tab.label', message: 'タブの表示名を指定してください' });
    }
  }
  if (c.verbs !== undefined) {
    if (!Array.isArray(c.verbs)) {
      errors.push({ path: 'contributes.verbs', message: '配列で指定してください' });
    } else {
      c.verbs.forEach((v, i) => validateVerb(v, i, errors));
    }
  }
}

export function validateManifest(raw: unknown): ValidateResult {
  if (!isObject(raw)) {
    return { ok: false, errors: [{ path: '', message: 'manifest はオブジェクトである必要があります' }] };
  }
  const errors: ManifestError[] = [];

  for (const key of Object.keys(raw)) {
    if (!TOP_KEYS.includes(key)) {
      errors.push({ path: key, message: '未知のキーです（綴りを確認してください）' });
    }
  }

  const { id, name, version, engine, entry, icon, color } = raw as Partial<PluginManifest>;

  if (typeof id !== 'string' || !ID_RE.test(id)) {
    errors.push({ path: 'id', message: '逆ドメイン形式で指定してください（例: com.example.my-tool）' });
  } else if (id.length > 100) {
    errors.push({ path: 'id', message: '長すぎます（100文字まで）' });
  }
  if (typeof name !== 'string' || !name.trim()) {
    errors.push({ path: 'name', message: '表示名を指定してください' });
  } else if (name.length > 60) {
    errors.push({ path: 'name', message: '長すぎます（60文字まで）' });
  }
  if (typeof version !== 'string' || !SEMVER_RE.test(version)) {
    errors.push({ path: 'version', message: 'semver で指定してください（例: 0.1.0）' });
  }
  if (typeof engine !== 'string' || !ENGINE_RE.test(engine)) {
    errors.push({ path: 'engine', message: '"1.0.0" か "^1.0.0" の形式で指定してください' });
  }
  if (typeof entry !== 'string' || !entry) {
    errors.push({ path: 'entry', message: 'iframe に読ませる html を指定してください' });
  } else {
    for (const m of entryErrors(entry)) errors.push({ path: 'entry', message: m });
  }
  if (icon !== undefined && typeof icon !== 'string') {
    errors.push({ path: 'icon', message: '文字列で指定してください' });
  }
  if (color !== undefined && typeof color !== 'string') {
    errors.push({ path: 'color', message: '文字列で指定してください' });
  }

  validateContributes((raw as Record<string, unknown>).contributes, errors);
  validatePermissions((raw as Record<string, unknown>).permissions, errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, manifest: raw as unknown as PluginManifest };
}
