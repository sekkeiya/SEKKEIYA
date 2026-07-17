// underlayImportService — S.Layout「下絵」の取り込み。
//   PDF / 画像を選ばせ、PDF は 1 ページ目をラスタライズし、Storage に上げて URL を返す。
//   保存先は Base 単位（躯体扱い）。Firestore には URL と数値だけを入れる（dataURL は入れない）。
//
// デスクトップ(Tauri)は OS ネイティブダイアログ、Web は <input type="file"> を使う。
// Web ビルドでは @tauri-apps/* が tauri-shims に alias され、plugin-dialog.open() は
// 黙って null を返す（＝何も起きない）ため、isTauri() で明示的に分岐している。
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../../../lib/firebase/client";
import { openPdf, renderPdfPage } from "../../../dsf/lib/pdf";

/** 取り込み可能な拡張子。 */
const PDF_EXT = ["pdf"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"];
const ALL_EXT = [...PDF_EXT, ...IMAGE_EXT];

export interface ImportedUnderlay {
  imageUrl: string;
  storagePath: string;
  sourceName: string;
  /** 画像の縦横比（width / height）。実寸合わせの初期値に使う。 */
  aspect: number;
}

interface PickedFile {
  name: string;
  ext: string;
  bytes: ArrayBuffer;
}

const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

/** Web: <input type="file"> を一時生成して 1 ファイル選ばせる。 */
function pickFileViaInput(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ALL_EXT.map((e) => `.${e}`).join(",");
    input.style.display = "none";
    document.body.appendChild(input);

    let settled = false;
    const finish = (v: PickedFile | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(v);
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      try {
        finish({ name: file.name, ext: extOf(file.name), bytes: await file.arrayBuffer() });
      } catch (err) {
        console.error("[underlayImportService] failed to read file", err);
        finish(null);
      }
    });
    // キャンセルは change が飛ばないので cancel を拾う（未対応ブラウザでは
    // input が残るだけで害はない）。
    input.addEventListener("cancel", () => finish(null));

    input.click();
  });
}

/** Desktop: Tauri のネイティブダイアログで 1 ファイル選ばせ、バイト列を読む。 */
async function pickFileViaTauri(): Promise<PickedFile | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "下絵（PDF / 画像）", extensions: ALL_EXT }],
    title: "下絵にする PDF / 画像を選択",
  });
  if (!selected) return null;

  const path = Array.isArray(selected) ? selected[0] : selected;
  if (!path) return null;

  const name = path.split(/[/\\]/).pop() || "underlay";
  const bytes = await readFile(path); // Uint8Array
  // Uint8Array の裏の ArrayBuffer をそのまま渡すと余分な領域を含みうるので slice する。
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { name, ext: extOf(name), bytes: buf as ArrayBuffer };
}

/** dataURL → Blob（PDF ラスタライズ結果のアップロード用）。 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/** 画像バイト列の縦横比を測る。 */
function measureImageAspect(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
      URL.revokeObjectURL(url);
      resolve(aspect);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(1);
    };
    img.src = url;
  });
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * 下絵にする PDF / 画像を選ばせ、Storage に上げて URL を返す。
 * ユーザーがキャンセルしたら null。
 *
 * PDF は 1 ページ目だけを PNG にラスタライズして扱う（下絵は 1 枚で足りるため）。
 *
 * nodeId は下絵を載せるノード（Base か Plan）の id。Storage もノード単位で分けるので、
 * Plan 専用の下絵と Base の下絵が同じフォルダに混ざらない。
 */
export async function importUnderlay(params: {
  projectId: string;
  nodeId: string;
}): Promise<ImportedUnderlay | null> {
  const { projectId, nodeId } = params;
  if (!projectId || !nodeId) {
    throw new Error("下絵の取り込みには projectId と nodeId が必要です");
  }

  const picked = isTauri() ? await pickFileViaTauri() : await pickFileViaInput();
  if (!picked) return null;

  if (!ALL_EXT.includes(picked.ext)) {
    throw new Error(`対応していない形式です（${picked.ext || "不明"}）。PDF / PNG / JPEG / WebP を選んでください。`);
  }

  let blob: Blob;
  let aspect: number;
  let uploadExt: string;

  if (PDF_EXT.includes(picked.ext)) {
    const opened = await openPdf(picked.bytes);
    try {
      // 下絵はトレース用なので線がはっきり出る程度に大きめ（2.0倍）で描く。
      const dataUrl = await renderPdfPage(opened.pdf, 1, 2.0);
      blob = await dataUrlToBlob(dataUrl);
      aspect = opened.aspect;
      uploadExt = "png";
    } finally {
      try {
        await opened.task.destroy();
      } catch {
        /* noop */
      }
    }
  } else {
    blob = new Blob([picked.bytes], { type: MIME[picked.ext] || "application/octet-stream" });
    aspect = await measureImageAspect(blob);
    uploadExt = picked.ext;
  }

  const storagePath = `projects/${projectId}/underlays/${nodeId}/${Date.now()}.${uploadExt}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  const imageUrl = await getDownloadURL(storageRef);

  return { imageUrl, storagePath, sourceName: picked.name, aspect: aspect > 0 ? aspect : 1 };
}

/** 差し替え/削除で不要になった下絵を Storage から消す（失敗しても致命ではない）。 */
export async function deleteUnderlayFile(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    console.warn("[underlayImportService] failed to delete underlay file", storagePath, err);
  }
}
