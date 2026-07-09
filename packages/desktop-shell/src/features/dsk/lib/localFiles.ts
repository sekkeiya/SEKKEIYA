// S.Library (3DSK) — LocalAssets/Documents 配下の実ファイルを知識エントリとして取り込む。
//
// 3DSK の _index.json に登録された知識（saveKnowledgeEntry 由来）とは別に、
// ユーザーが Explorer で %USERPROFILE%\SEKKEIYA\LocalAssets\Documents に置いた
// ファイルをそのまま「読み取り専用エントリ」として一覧へ混ぜる。
// 実体はコピーせず、フルパスを filePath に持たせて PDF はビューア、その他は
// OS 既定アプリで開く。

import { listLocalAssets } from '../../sites/localAssetsSnapshot';
import type { LibraryEntry, KnowledgeKind } from '../types';

/** LocalAssets のトップレベルカテゴリ名（src-tauri 側の scaffold と一致）。 */
const DOCUMENTS_CATEGORY = 'Documents';

/** 文書系拡張子 → 書類（kind 'pdf'）。それ以外はメモ扱い（内蔵ビューアで開けるのは .pdf のみ）。 */
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);
function kindForExt(ext: string): KnowledgeKind {
  return DOC_EXTS.has(ext.toLowerCase()) ? 'pdf' : 'note';
}

/** 拡張子を落としたファイル名をタイトルに使う。 */
function titleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || name;
}

/**
 * LocalAssets/Documents 配下のファイルを読み取り専用の LibraryEntry へ変換して返す。
 * Tauri 不在環境（Web 版）や走査失敗時は空配列。
 */
export async function getLocalDocumentEntries(): Promise<LibraryEntry[]> {
  let assets;
  try {
    assets = await listLocalAssets();
  } catch {
    return [];
  }

  return assets
    .filter((a) => a.category === DOCUMENTS_CATEGORY)
    .map((a) => {
      const iso = new Date(a.modifiedMs || 0).toISOString();
      return {
        localId: `localfile:${a.relPath}`,
        kind: kindForExt(a.ext),
        title: titleFromName(a.name),
        author: null,
        filePath: a.path,
        sourceUrl: null,
        snapshotHtmlPath: null,
        snapshotPdfPath: null,
        bodyMarkdown: null,
        category: 'ローカルファイル',
        tags: [],
        summary: null,
        keyPoints: [],
        embeddingStatus: 'none',
        linkedProjectIds: [],
        lastReadPage: null,
        totalPages: null,
        bookmarks: [],
        status: 'local',
        thumbnailPath: null,
        folderPath: a.path,
        createdAt: iso,
        updatedAt: iso,
        isLocalFile: true,
        relPath: a.relPath,
      } satisfies LibraryEntry;
    });
}

/** ローカルファイルを OS の既定アプリで開く（PDF 以外の資料用）。 */
export async function openLocalFileExternally(path: string): Promise<void> {
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(path);
}
