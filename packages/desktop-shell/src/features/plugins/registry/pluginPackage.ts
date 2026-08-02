// プラグインパッケージ（.zip）の生成と展開・検証（要件71）。React / fs 非依存の純ロジック。
//
// パッケージの形: zip のルート直下に plugin.json（フォルダを zip した場合の
// 「単一トップフォルダ/plugin.json」も受け付け、プレフィックスを剥がして正規化する）。
// 展開結果はディスクに書かれるため、パスの安全性はここで全件検査する
// （validateManifest が entry に課すのと同じ規則を、全ファイルパスへ広げる）。
import { unzipSync, zipSync, strFromU8 } from 'fflate';
import { validateManifest } from '../manifest/validateManifest';
import type { PluginManifest } from '../manifest/manifestTypes';
import { API_VERSION, satisfiesEngine, engineErrorMessage } from './engineCompat';

/** 展開後の暴発を防ぐ上限。プラグインは HTML+JS+アセットの想定でこれで十分。 */
export const PACKAGE_MAX_FILES = 2000;
export const PACKAGE_MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB

export interface PluginPackage {
  manifest: PluginManifest;
  /** プラグインルートからの相対パス → 中身。plugin.json 自身も含む。 */
  files: Record<string, Uint8Array>;
}

export type ExtractResult =
  | { ok: true; pkg: PluginPackage }
  | { ok: false; error: string };

const err = (error: string): ExtractResult => ({ ok: false, error });

/** ディスクへ書いてはいけないパスなら理由を返す。 */
function unsafePathReason(path: string): string | null {
  if (path.includes('\\')) return '区切りに \\ が含まれています';
  if (path.split('/').includes('..')) return '.. が含まれています';
  if (path.startsWith('/')) return '絶対パスです';
  if (/^[A-Za-z]:/.test(path)) return 'ドライブレター始まりです';
  if (path.includes('%')) return 'percent-encode された文字（%）が含まれています';
  return null;
}

export function extractPluginPackage(bytes: Uint8Array): ExtractResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return err('zip として展開できませんでした。ファイルが壊れていないか確認してください。');
  }

  // ディレクトリエントリ（末尾 / ・中身なし）は除く。
  const fileEntries = Object.entries(entries).filter(([p]) => !p.endsWith('/'));
  if (fileEntries.length === 0) return err('zip の中にファイルがありません。');
  if (fileEntries.length > PACKAGE_MAX_FILES) {
    return err(`ファイル数が多すぎます（${fileEntries.length} 件 / 上限 ${PACKAGE_MAX_FILES} 件）。`);
  }

  // ルート判定: 直下に plugin.json があればそのまま。無ければ
  // 「全ファイルが単一のトップフォルダ配下」かつ「その直下に plugin.json」の形を受け付ける。
  let prefix = '';
  if (!entries['plugin.json']) {
    const tops = new Set(fileEntries.map(([p]) => p.split('/')[0]));
    const top = tops.size === 1 ? [...tops][0] : null;
    if (top && entries[`${top}/plugin.json`]) prefix = `${top}/`;
    else return err('plugin.json が見つかりません（zip のルート直下に置いてください）。');
  }

  const files: Record<string, Uint8Array> = {};
  let total = 0;
  for (const [path, data] of fileEntries) {
    if (!path.startsWith(prefix)) return err(`ルートフォルダの外にファイルがあります: ${path}`);
    const rel = path.slice(prefix.length);
    if (!rel) continue;
    const reason = unsafePathReason(rel);
    if (reason) return err(`不正なパスが含まれています（${reason}）: ${path}`);
    total += data.length;
    if (total > PACKAGE_MAX_TOTAL_BYTES) {
      return err(`展開後のサイズが大きすぎます（上限 ${Math.floor(PACKAGE_MAX_TOTAL_BYTES / 1024 / 1024)}MB）。`);
    }
    files[rel] = data;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(files['plugin.json']));
  } catch {
    return err('plugin.json が JSON として読めません。');
  }
  const result = validateManifest(raw);
  if (!result.ok) {
    return err('plugin.json: ' + result.errors.map(e => `${e.path}: ${e.message}`).join(' / '));
  }
  const { manifest } = result;
  if (!satisfiesEngine(manifest.engine, API_VERSION)) return err(engineErrorMessage(manifest.engine));
  if (!files[manifest.entry]) return err(`entry のファイルが zip 内にありません: ${manifest.entry}`);

  return { ok: true, pkg: { manifest, files } };
}

/** ファイル一式を zip にする（パッケージ化）。パスはプラグインルートからの相対。 */
export function packPluginFiles(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files, { level: 6 });
}

export function packageFileName(manifest: Pick<PluginManifest, 'id' | 'version'>): string {
  return `${manifest.id}-${manifest.version}.zip`;
}
