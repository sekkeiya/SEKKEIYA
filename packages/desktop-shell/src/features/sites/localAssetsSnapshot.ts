// %USERPROFILE%\SEKKEIYA\LocalAssets を「SEKKEIYA Chat が読める軽量サマリ」に変換する。
// ユーザーが LocalAssets/ に置いたローカル素材（画像/動画/資料/モデル）を Chat が把握し、
// テキスト資料を read_local_asset_text で読めるようにするための参照レイヤ。
//
// - list_local_assets (Tauri) を呼び、カテゴリ別の件数 + 代表ファイルをテキスト整形する。
// - Web 版や Tauri 不在環境では invoke が失敗するため、安全に空サマリを返す。

import { invoke } from '@tauri-apps/api/core';

export interface LocalAssetEntry {
  /** LocalAssets/ からの相対パス（/ 区切り）。read_local_asset_text の参照キー。 */
  relPath: string;
  name: string;
  path: string;
  /** トップレベルのカテゴリフォルダ名（Images / Movies / Documents / Models / 他）。 */
  category: string;
  ext: string;
  /** image | video | document | model | other */
  kind: string;
  sizeBytes: number;
  modifiedMs: number;
}

/** LocalAssets の全ファイル一覧を取得（新しい順、最大 500 件）。失敗時は空配列。 */
export async function listLocalAssets(): Promise<LocalAssetEntry[]> {
  try {
    return await invoke<LocalAssetEntry[]>('list_local_assets');
  } catch {
    return [];
  }
}

/** LocalAssets 内のテキストファイル（txt/md/csv/json/log/rtf）を読む。失敗時はエラー文字列。 */
export async function readLocalAssetText(relPath: string): Promise<string> {
  return invoke<string>('read_local_asset_text', { relPath });
}

const MAX_LISTED_PER_CATEGORY = 12;

/** バイト数を人間可読な短い表記に。 */
function humanSize(bytes: number): string {
  if (!bytes) return '0B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)}${units[i]}`;
}

/**
 * LocalAssets の一覧を system prompt へ差し込むコンパクトなテキストへ整形する。
 * Chat が「どんなローカル素材があるか」を把握し、relPath を指定して読めるようにする。
 */
export function formatLocalAssetsForPrompt(entries: LocalAssetEntry[]): string {
  if (!entries.length) {
    return '[ローカル素材] LocalAssets/ にファイルはありません（ユーザーが画像・動画・資料・モデルを置くと参照できます）。';
  }

  // カテゴリごとにグルーピング（Images/Movies/Documents/Models/その他）。
  const byCategory = new Map<string, LocalAssetEntry[]>();
  for (const e of entries) {
    const cat = e.category || '(直下)';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(e);
  }

  const lines: string[] = [];
  lines.push(
    `[ローカル素材] SEKKEIYA/LocalAssets に ${entries.length} 件。relPath を read_local_asset_text に渡すとテキスト資料を読めます。`
  );
  for (const [cat, items] of byCategory) {
    lines.push(`- ${cat}/ (${items.length}件)`);
    for (const e of items.slice(0, MAX_LISTED_PER_CATEGORY)) {
      lines.push(`    - ${e.relPath} [${e.kind}, ${humanSize(e.sizeBytes)}]`);
    }
    if (items.length > MAX_LISTED_PER_CATEGORY) {
      lines.push(`    … ほか ${items.length - MAX_LISTED_PER_CATEGORY} 件`);
    }
  }
  return lines.join('\n');
}
