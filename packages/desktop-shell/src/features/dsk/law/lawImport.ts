// 法規ライブラリ — 法令取り込みのオーケストレーション。
// 法令名 → /laws で law_id 解決（完全一致優先）→ /law_data 全文取得 → 条文構造化
// → S.Library エントリ作成（kind 'law'）→ law.json 保存。
// 仕様: docs/22_law_library_spec.md

import { updateKnowledgeEntry, writeEntryTextFile, readLocalBinaryFile } from '../api/knowledgeApi';
import type { LibraryEntry } from '../types';
import { searchLawsByTitle, searchLawByNum, fetchLawData, egovLawPageUrl, type EgovLawSummary } from './egovApi';
import { parseLawFullText, type LawDoc } from './lawParse';

/**
 * プリセット法令（建築・インテリア設計の主要法体系）。
 * law_id はハードコードせず、取り込み時に法令名の完全一致で解決する（ID変更・誤記に強い）。
 */
export const LAW_PRESETS: { title: string; note?: string }[] = [
  { title: '建築基準法' },
  { title: '建築基準法施行令' },
  { title: '建築基準法施行規則' },
  { title: '消防法' },
  { title: '消防法施行令' },
  { title: '消防法施行規則' },
  { title: '都市計画法' },
  { title: '都市計画法施行令' },
  { title: '高齢者、障害者等の移動等の円滑化の促進に関する法律', note: 'バリアフリー法' },
  { title: '建築士法' },
];

export interface LawImportResult {
  entry: LibraryEntry;
  articleCount: number;
}

/** 法令エントリの localId（再取込みは同IDへの上書き＝フォルダ・紐付け維持）。 */
export function lawLocalId(lawId: string): string {
  return `egov-${lawId}`;
}

/** 機械生成の要約メモ（AI要約とは別物。鮮度と規模の即読用）。 */
function lawSummaryNote(doc: LawDoc): string {
  return `本則 全${doc.articles.length}条。改正施行日 ${doc.revisionDate ?? '不明'}／e-Gov法令APIから ${doc.fetchedAt.slice(0, 10)} に取得。`;
}

/**
 * 法令名から取り込む。/laws の結果からタイトル完全一致を優先し、無ければ先頭ヒット。
 * `existing` を渡すと紐付け・タグ等を維持して再取込み（更新）になる。
 */
export async function importLawByTitle(
  title: string,
  existing?: LibraryEntry | null,
  onProgress?: (msg: string) => void,
): Promise<LawImportResult> {
  onProgress?.('法令を検索中…');
  const results = await searchLawsByTitle(title);
  const hit = results.find((r) => r.lawTitle === title.trim()) ?? results[0];
  if (!hit) throw new Error(`法令が見つかりません: ${title}`);
  return importLaw(hit, existing, onProgress);
}

/** 検索結果（EgovLawSummary）から取り込む。 */
export async function importLaw(
  law: EgovLawSummary,
  existing?: LibraryEntry | null,
  onProgress?: (msg: string) => void,
): Promise<LawImportResult> {
  onProgress?.(`全文を取得中…（${law.lawTitle}）`);
  const { revisionInfo, fullText } = await fetchLawData(law.lawId);
  onProgress?.('条文を解析中…');
  const doc = parseLawFullText(fullText, {
    lawId: law.lawId,
    lawNum: law.lawNum,
    lawTitle: revisionInfo.law_title || law.lawTitle,
    revisionDate: revisionInfo.amendment_enforcement_date ?? law.revisionDate,
  });

  onProgress?.('S.Library に登録中…');
  const localId = lawLocalId(law.lawId);
  const now = new Date().toISOString();
  // update_knowledge_entry は未登録なら S.Library にフォルダを新設して作成する。
  // 再取込み時は既存の紐付け・タグ・AI要点を維持し、本文由来のメタだけ更新する。
  const patch: LibraryEntry = {
    localId,
    kind: 'law',
    title: doc.lawTitle,
    author: doc.lawNum,
    category: existing?.category || '法規',
    tags: Array.from(new Set([...(existing?.tags ?? []), '法令', 'e-Gov'])),
    sourceUrl: egovLawPageUrl(law.lawId),
    bodyMarkdown: null,
    summary: existing?.summary && !existing.summary.startsWith('本則 全') ? existing.summary : lawSummaryNote(doc),
    keyPoints: existing?.keyPoints ?? [],
    embeddingStatus: existing?.embeddingStatus ?? 'none',
    linkedProjectIds: existing?.linkedProjectIds ?? [],
    bookmarks: existing?.bookmarks ?? [],
    status: 'local',
    folderPath: existing?.folderPath ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lawId: law.lawId,
    lawRevisionDate: doc.revisionDate ?? null,
    lawJsonPath: existing?.lawJsonPath ?? null,
  };
  const saved = await updateKnowledgeEntry(patch);

  onProgress?.('条文を保存中…');
  const lawJsonPath = await writeEntryTextFile(localId, 'law.json', JSON.stringify(doc));
  const final = lawJsonPath === saved.lawJsonPath
    ? saved
    : await updateKnowledgeEntry({ ...saved, lawJsonPath });

  return { entry: final, articleCount: doc.articles.length };
}

/** 保存済み law.json（LawDoc）を読み込む。 */
export async function loadLawDoc(entry: LibraryEntry): Promise<LawDoc> {
  const path = entry.lawJsonPath || (entry.folderPath ? `${entry.folderPath}\\law.json` : '');
  if (!path) throw new Error('条文データ（law.json）のパスが不明です');
  const bytes = await readLocalBinaryFile(path);
  const text = new TextDecoder().decode(new Uint8Array(bytes));
  return JSON.parse(text) as LawDoc;
}

export interface LawUpdateCheck {
  hasUpdate: boolean;
  /** e-Gov 上の現行版の改正施行日 */
  latestDate?: string;
}

/** e-Gov に改正版が出ていないか確認する（/laws?law_num= の軽量照会）。 */
export async function checkLawUpdate(entry: LibraryEntry): Promise<LawUpdateCheck> {
  if (!entry.author) throw new Error('法令番号が未設定のため更新確認できません');
  const latest = await searchLawByNum(entry.author);
  const latestDate = latest?.revisionDate;
  const current = entry.lawRevisionDate ?? '';
  return {
    hasUpdate: !!latestDate && !!current && latestDate > current,
    latestDate,
  };
}

/**
 * RAG（外付け脳）送信用テキストを条単位ヘッダ付きで組み立てる。
 * チャンクがどこで切れても出典（法令名＋条番号＋版）が残るようにする。
 */
export function buildLawRagText(doc: LawDoc): string {
  const header = `# ${doc.lawTitle}（${doc.lawNum}）\n改正施行日: ${doc.revisionDate ?? '不明'} / e-Gov法令APIより ${doc.fetchedAt.slice(0, 10)} 取得\n※参考情報。法適合の最終判断は建築士・特定行政庁・指定確認検査機関に確認すること。`;
  const blocks = doc.articles.map(
    (a) => `【${doc.lawTitle} ${a.title}${a.caption ?? ''}】\n${a.text}`,
  );
  return [header, ...blocks].join('\n\n');
}
