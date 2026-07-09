// pdfjs-dist のワーカー設定とレンダリングヘルパー。
// S.Portfolio の「本のような閲覧 UI」は PDF を 1 ページずつ canvas → 画像 URL に変換し、
// react-pageflip のページに流し込む。アップロード時の表紙サムネイル生成にも使う。
import * as pdfjsLib from 'pdfjs-dist';
// Vite: ワーカーは ?url で同梱物として解決する（v6 は ESM ワーカー）
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * ArrayBuffer から PDF を開く。クリーンアップは getDocument() が返す
 * loadingTask 側の destroy() を呼ぶ必要があるため（PDFDocumentProxy には destroy が無い）、
 * loadingTask ごと返す。呼び出し側は `task.promise` で文書を取得し、最後に `task.destroy()` する。
 */
export function loadPdf(data: ArrayBuffer) {
  return pdfjsLib.getDocument({ data });
}

/** URL を fetch して ArrayBuffer を返す（Firebase Storage の downloadUrl を想定） */
export async function fetchPdfBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF の取得に失敗しました (${res.status})`);
  return res.arrayBuffer();
}

/** 1 ページを指定スケールで描画し、PNG data URL を返す */
async function renderPageToDataUrl(page: any, scale: number): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas コンテキストの取得に失敗しました');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

/** 開いた PDF のハンドル。遅延描画ビューア用に文書とメタ情報をまとめて返す。 */
export interface OpenedPdf {
  /** PDFDocumentProxy。getPage() で個別ページを取得して描画する */
  pdf: any;
  /** クリーンアップ用。閉じるときに destroy() を呼ぶ */
  task: any;
  pageCount: number;
  /** 1 ページ目のアスペクト比（width / height） */
  aspect: number;
}

/**
 * PDF を開いてページ数とアスペクト比だけ取得する（全ページ描画はしない）。
 * 100 ページ超のポートフォリオでも即座に開けるよう、描画は呼び出し側で
 * {@link renderPdfPage} を使って必要なページだけ遅延実行する。
 * 使い終わったら戻り値の task.destroy() を呼ぶこと。
 */
export async function openPdf(data: ArrayBuffer): Promise<OpenedPdf> {
  const task = loadPdf(data);
  const pdf = await task.promise;
  let aspect = 0.707; // A4 縦のフォールバック
  try {
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    aspect = vp.width / vp.height;
    page.cleanup();
  } catch {
    /* メタ取得に失敗してもフォールバック値で続行 */
  }
  return { pdf, task, pageCount: pdf.numPages, aspect };
}

/** 指定ページ（1 始まり）を指定スケールで描画し、PNG data URL を返す */
export async function renderPdfPage(pdf: any, pageNumber: number, scale = 1.5): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  try {
    return await renderPageToDataUrl(page, scale);
  } finally {
    page.cleanup();
  }
}

/**
 * URL（Firebase Storage の downloadUrl 等）から PDF の 1 ページ目を表紙化する。
 * 保存済みサムネが無い既存ポートフォリオを一覧で表示する／バックフィルするために使う。
 * 表示用の data URL と、保存用の JPEG Blob を返す。
 */
export async function renderFirstPageCoverFromUrl(
  url: string,
  maxWidth = 480,
): Promise<{ dataUrl: string; blob: Blob | null }> {
  const buf = await fetchPdfBuffer(url);
  const task = loadPdf(buf);
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: '', blob: null };
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    page.cleanup();
    return { dataUrl, blob };
  } finally {
    task.destroy();
  }
}

export interface RenderedPdf {
  /** ページ画像（data URL）の配列 */
  pages: string[];
  /** 各ページのアスペクト比（width / height）。見開き表示の寸法計算に使う */
  aspect: number;
  pageCount: number;
}

/**
 * PDF の全ページを画像化する。ポートフォリオは通常数十ページなので一括描画で十分。
 * scale は表示解像度（高すぎるとメモリを食うので 1.5 前後が無難）。
 */
export async function renderPdfToImages(data: ArrayBuffer, scale = 1.5): Promise<RenderedPdf> {
  const task = loadPdf(data);
  const pdf = await task.promise;
  try {
    const pages: string[] = [];
    let aspect = 0.707; // A4 縦のフォールバック
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      if (i === 1) {
        const vp = page.getViewport({ scale: 1 });
        aspect = vp.width / vp.height;
      }
      pages.push(await renderPageToDataUrl(page, scale));
      page.cleanup();
    }
    return { pages, aspect, pageCount: pdf.numPages };
  } finally {
    task.destroy();
  }
}

/**
 * PDF の 1 ページ目を表紙サムネイル（PNG Blob）に変換する。
 * maxWidth に収まるよう縮小スケールを決める。
 */
export async function renderFirstPageThumbnail(file: File, maxWidth = 480): Promise<Blob | null> {
  const buf = await file.arrayBuffer();
  const task = loadPdf(buf);
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  } finally {
    task.destroy();
  }
}
