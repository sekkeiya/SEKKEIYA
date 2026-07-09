// S.Library — 保存先ローカルフォルダ（S.Library\Local）の実ファイルを知識エントリ化する。
//
// Accounts\<アカウント>\S.Library\Local にユーザーが Explorer で置いたローカル資料を、
// 読み取り専用の LibraryEntry として一覧へ混ぜる。実体はコピーせずフルパス参照。
// データ3層（クラウド公開 / クラウド非公開 / ローカル）の「ローカル」層に当たる。

import { listSLibraryFiles, type SLibraryFile } from '../api/knowledgeApi';
import type { LibraryEntry, KnowledgeKind } from '../types';

/** 拡張子から表示用 kind を決める（実体ビューアは pdf のみ対応）。 */
function kindForExt(ext: string): KnowledgeKind {
  return ext === 'pdf' ? 'pdf' : 'note';
}

function titleFromName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || name;
}

/** S_Library 配下のファイルを読み取り専用の LibraryEntry へ変換。Tauri 不在/失敗時は空配列。 */
export async function getSLibraryEntries(): Promise<LibraryEntry[]> {
  let files: SLibraryFile[];
  try {
    files = await listSLibraryFiles();
  } catch {
    return [];
  }

  return files.map((f) => {
    const iso = new Date(f.modifiedMs || 0).toISOString();
    return {
      localId: `slib:${f.subfolder ? f.subfolder + '/' : ''}${f.name}`,
      kind: kindForExt(f.ext),
      title: titleFromName(f.name),
      author: null,
      filePath: f.path,
      sourceUrl: null,
      snapshotHtmlPath: null,
      snapshotPdfPath: null,
      bodyMarkdown: null,
      // フォルダ階層をそのままサブカテゴリ的に見せる（直下なら「ローカル」）。
      category: f.subfolder ? f.subfolder.split('/')[0] : 'ローカル',
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
      folderPath: f.path,
      createdAt: iso,
      updatedAt: iso,
      isLocalFile: true,
      isConfidential: true,
      relPath: f.subfolder ? `${f.subfolder}/${f.name}` : f.name,
    } satisfies LibraryEntry;
  });
}
