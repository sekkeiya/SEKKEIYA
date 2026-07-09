// S.Library — Tauri バックエンド（knowledge.rs）への薄いラッパー。
import { invoke } from '@tauri-apps/api/core';
import type { LibraryEntry, KnowledgeKind } from '../types';

/** S.Library のアプリ管理メタのローカルルートパス */
export function getKnowledgePath(): Promise<string> {
  return invoke<string>('get_knowledge_path');
}

/** 社外秘ローカル接続フォルダ（S.Library\Local）のパス */
export function getSLibraryPath(): Promise<string> {
  return invoke<string>('get_s_library_path');
}

/** URL から PDF をダウンロードし LocalAssets\Documents\PDF\ に保存（保存先パスを返す）。 */
export function downloadPdfToDocuments(url: string, fileName?: string): Promise<string> {
  return invoke<string>('download_pdf_to_documents', { url, fileName: fileName ?? null });
}

/** 社外秘フォルダ内の 1 ファイル（Rust knowledge.rs の SLibraryFile と一致）。 */
export interface SLibraryFile {
  id: string;
  name: string;
  path: string;
  ext: string;
  sizeBytes: number;
  modifiedMs: number;
  subfolder: string;
}

/** S_Library 配下の社外秘資料を読み取り専用でスキャン */
export function listSLibraryFiles(): Promise<SLibraryFile[]> {
  return invoke<SLibraryFile[]>('list_s_library_files');
}

/** ローカル保存された知識エントリ一覧 */
export function getLocalKnowledge(): Promise<LibraryEntry[]> {
  return invoke<LibraryEntry[]>('get_local_knowledge');
}

export interface SaveKnowledgeArgs {
  localId: string;
  kind: KnowledgeKind;
  title: string;
  category: string;
  author?: string | null;
  tags?: string[];
  /** book/pdf: コピー元の PDF パス */
  sourcePath?: string | null;
  /** url: 元 URL */
  sourceUrl?: string | null;
  /** note: 本文 */
  bodyMarkdown?: string | null;
  thumbnailPath?: string | null;
  totalPages?: number | null;
}

/** 知識エントリを追加（book/pdf は PDF をローカルにコピー） */
export function saveKnowledgeEntry(args: SaveKnowledgeArgs): Promise<LibraryEntry> {
  return invoke<LibraryEntry>('save_knowledge_entry', {
    localId: args.localId,
    kind: args.kind,
    title: args.title,
    category: args.category,
    author: args.author ?? null,
    tags: args.tags ?? [],
    sourcePath: args.sourcePath ?? null,
    sourceUrl: args.sourceUrl ?? null,
    bodyMarkdown: args.bodyMarkdown ?? null,
    thumbnailPath: args.thumbnailPath ?? null,
    totalPages: args.totalPages ?? null,
  });
}

/** 知識エントリを更新（要約・タグ・紐付け・読書進捗など。実体パスは Rust 側で保持） */
export function updateKnowledgeEntry(patch: LibraryEntry): Promise<LibraryEntry> {
  return invoke<LibraryEntry>('update_knowledge_entry', { patch });
}

/** 知識エントリを削除（フォルダごと削除） */
export function deleteKnowledgeEntry(localId: string): Promise<void> {
  return invoke<void>('delete_knowledge_entry', { localId });
}

export interface UrlContent {
  title: string;
  text: string;
  ogImageUrl?: string | null;
}

/** URL 本文を取得（CORS 回避・要約用） */
export function fetchUrlContent(url: string): Promise<UrlContent> {
  return invoke<UrlContent>('fetch_url_content', { url });
}

export interface SnapshotResult {
  htmlPath: string;
  pdfPath?: string | null;
}

/** URL の HTML スナップショットを保存し、エントリの snapshotHtmlPath を更新 */
export function saveUrlSnapshot(localId: string, url: string): Promise<SnapshotResult> {
  return invoke<SnapshotResult>('save_url_snapshot', { localId, url });
}

/** ローカルファイルをバイナリで読む（PDF ビューア用） */
export function readLocalBinaryFile(path: string): Promise<number[]> {
  return invoke<number[]>('read_local_binary_file', { path });
}

/**
 * e-Gov 法令API v2 を GET して本文（JSON文字列）を返す（CORS回避・Rust側で取得）。
 * path は "laws?law_title=..." のような /api/2/ からの相対パス。
 */
export function fetchEgovApi(path: string): Promise<string> {
  return invoke<string>('fetch_egov_api', { path });
}

/** エントリフォルダ直下にテキストファイルを書く（law.json 等）。保存パスを返す。 */
export function writeEntryTextFile(localId: string, fileName: string, content: string): Promise<string> {
  return invoke<string>('write_entry_text_file', { localId, fileName, content });
}
