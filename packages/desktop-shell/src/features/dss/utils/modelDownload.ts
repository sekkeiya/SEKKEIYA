import {
  getAvailableFormatsFromModel,
  getSizeLabelForModel,
  resolveDownloadUrl,
  getCanonicalModelId,
} from './modelUtils';

export type DownloadFormat = {
  ext: 'glb' | '3dm' | 'blend';
  label: string;
  sizeLabel: string | null;
};

/** このモデルからダウンロードできる形式を列挙する（実ファイルがあるものだけ）。 */
export function listDownloadFormats(model: any): DownloadFormat[] {
  const formats = getAvailableFormatsFromModel(model);
  const list: DownloadFormat[] = [];
  if (formats.hasGlb) list.push({ ext: 'glb', label: 'GLB', sizeLabel: getSizeLabelForModel(model, 'glb') });
  if (formats.has3dm) list.push({ ext: '3dm', label: 'Rhino（3DM）', sizeLabel: getSizeLabelForModel(model, '3dm') });
  if (formats.hasBlend) list.push({ ext: 'blend', label: 'Blender（BLEND）', sizeLabel: getSizeLabelForModel(model, 'blend') });
  return list;
}

/**
 * Windows ファイルシステムで使用禁止の文字や予約名を除去し、安全なファイル名を生成する。
 * 対応:
 * - 制御文字（\x00-\x1F）を削除
 * - 違法な記号（\\/:*?"<>|）を _ に置換
 * - Windows 予約デバイス名（CON、PRN、AUX、NUL、COM1-9、LPT1-9）を検出し、末尾に _ サフィックスを追加
 * - 空文字列または空白のみの場合は 'model' にフォールバック
 * - 最大 80 文字に制限（拡張子の前）
 */
function sanitizeWindowsFilename(rawTitle: string | null | undefined): string {
  // フォールバック: null/undefined/空文字列は 'model' を使用
  let title = String(rawTitle || 'model').trim();
  if (!title) title = 'model';

  // 制御文字（\x00-\x1F）を削除
  // eslint-disable-next-line no-control-regex
  title = title.replace(/[\x00-\x1F]/g, '');

  // 違法な記号を _ に置換
  title = title.replace(/[\\/:*?"<>|]/g, '_');

  // 長さを制限
  title = title.slice(0, 80);

  // 空白のみになってないか確認（制御文字削除後の再チェック）
  if (!title.trim()) title = 'model';

  // Windows 予約デバイス名を検出（大文字小文字を区別しない）
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(title)) {
    title = title + '_';
  }

  return title;
}

/**
 * モデルファイルをダウンロードする。
 * Storage の URL を直接 <a download> で開くとリダイレクトで拡張子が落ちることがあるため、
 * 一度 fetch して Blob 経由で保存し、ファイル名を明示する。
 */
export async function downloadModelFile(model: any, ext: string): Promise<void> {
  const canonicalId = getCanonicalModelId(model) || model?.id;
  if (!canonicalId) throw new Error('モデルIDが解決できませんでした');

  const url = await resolveDownloadUrl(model, ext, canonicalId);
  if (!url) throw new Error(`${ext.toUpperCase()} ファイルが見つかりませんでした`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロードに失敗しました (${res.status})`);
  const blob = await res.blob();

  const rawTitle = model?.title || model?.name || 'model';
  const safeTitle = sanitizeWindowsFilename(rawTitle);

  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${safeTitle}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // click() は同期的にダウンロードを開始するが、念のため次のタスクまで URL を保持する
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}
