// src/utils/services/storage/storage.common.js
import { storage } from "@/shared/config/firebase";
import {
    ref,
    deleteObject,
    getMetadata,
    uploadBytesResumable,
    getDownloadURL,
} from "firebase/storage";

/* ------------------------------ */
/* helpers                        */
/* ------------------------------ */

const safeExtFromFile = (file, fallback = "jpg") => {
    const safeExt = String(file?.name || "").split(".").pop()?.toLowerCase();
    if (!safeExt || safeExt.length > 6) return fallback;
    return safeExt;
};

export const formatBytes = (bytes) => {
    const n = Number(bytes || 0);
    if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + " MB";
    if (n >= 1024) return (n / 1024).toFixed(2) + " KB";
    return n + " bytes";
};

// ✅ 旧形式（uid無し）の board cover path を検知してスキップする
// 例: boardCovers/myBoards/{boardId}/xxx.png  / boardCovers/teamBoards/{boardId}/xxx.png
const isLegacyBoardCoverPath = (path) =>
    typeof path === "string" && /^boardCovers\/(myBoards|teamBoards)\//.test(path);

// ✅ 正しい形式（uidあり）の board cover path をざっくり検知
// 例: boardCovers/{uid}/{myBoards|teamBoards}/{boardId}/xxx.png
const isUidBoardCoverPath = (path) =>
    typeof path === "string" && /^boardCovers\/[^/]+\/(myBoards|teamBoards)\/[^/]+\//.test(path);

/* ------------------------------ */
/* generic upload/delete          */
/* ------------------------------ */

/**
 * Firebase Storage にファイルをアップロードするユーティリティ
 * @returns {Promise<{path:string, url:string}>}
 */
export const uploadFile = async (file, fullPath, setProgress) => {
    if (!file) throw new Error("uploadFile: file is required");
    if (!fullPath) throw new Error("uploadFile: fullPath is required");

    const storageRef = ref(storage, fullPath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            "state_changed",
            (snapshot) => {
                if (setProgress) {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(progress);
                }
            },
            (error) => {
                console.error("[storage] Upload failed:", { fullPath, error });
                reject(error);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({ path: fullPath, url: downloadURL });
            }
        );
    });
};

export const deleteFile = async (fullPath) => {
    if (!fullPath) return;

    // ✅ 旧形式は削除を試みない（403ノイズ源）
    if (isLegacyBoardCoverPath(fullPath)) {
        console.warn("[storage] skip delete legacy boardCover path:", fullPath);
        return;
    }

    const storageRef = ref(storage, fullPath);

    try {
        await deleteObject(storageRef);
        console.log(`✅ Firebase Storage から削除完了: ${fullPath}`);
    } catch (e) {
        // ✅ 存在しないだけなら無視（古い参照が残っている等）
        if (e?.code === "storage/object-not-found") {
            console.warn("[storage] delete skipped (not found):", fullPath);
            return;
        }
        // ✅ 権限がない場合もここでログ（原因追跡しやすく）
        console.warn("[storage] delete failed:", { fullPath, code: e?.code, message: e?.message });
        throw e;
    }
};

/* ------------------------------ */
/* ✅ Board cover                 */
/* ------------------------------ */

/**
 * ✅ Board cover をアップロードするユーティリティ
 * ルールに合わせて uid を必ず含める:
 * boardCovers/{uid}/{boardType}/{boardId}/{fileName}
 */
export const uploadBoardCoverFile = async ({
    file,
    userId,
    boardType, // "myBoards" | "teamBoards"
    boardId,
    setProgress,
}) => {
    if (!file) throw new Error("uploadBoardCoverFile: file is required");
    if (!userId) throw new Error("uploadBoardCoverFile: userId is required");
    if (!boardType) throw new Error("uploadBoardCoverFile: boardType is required");
    if (!boardId) throw new Error("uploadBoardCoverFile: boardId is required");

    if (boardType !== "myBoards" && boardType !== "teamBoards") {
        throw new Error(`uploadBoardCoverFile: invalid boardType "${boardType}"`);
    }

    const ext = safeExtFromFile(file, "jpg");

    // 例: 20260109_073719_xxxxxx.jpg
    const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace("T", "_")
        .slice(0, 15); // YYYYMMDD_HHMMSS
    const rand = Math.random().toString(36).slice(2, 8);
    const fileName = `${stamp}_${rand}.${ext}`;

    // ✅ uid を含める（ここが最重要）
    const fullPath = `boardCovers/${userId}/${boardType}/${boardId}/${fileName}`;

    const res = await uploadFile(file, fullPath, setProgress);
    return { ...res, fileName };
};

/**
 * ✅ Board cover を削除するユーティリティ
 * 呼び方は2通り対応:
 * 1) deleteBoardCoverFile(fullPath)
 * 2) deleteBoardCoverFile({ userId, boardType, boardId, fileName })
 *
 * 重要:
 * - 旧形式（uid無し）のパスは削除しない（403回避）
 */
export const deleteBoardCoverFile = async (arg) => {
    if (!arg) return;

    // 1) fullPath 文字列
    if (typeof arg === "string") {
        // ✅ 旧形式ならスキップ（deleteFile側でも弾くが、ここでも明示しておく）
        if (isLegacyBoardCoverPath(arg)) {
            console.warn("[storage] skip delete legacy boardCover path:", arg);
            return;
        }
        await deleteFile(arg);
        return;
    }

    const { userId, boardType, boardId, fileName, path } = arg || {};

    // path が直接あるならそれ優先
    if (path) {
        if (isLegacyBoardCoverPath(path)) {
            console.warn("[storage] skip delete legacy boardCover path:", path);
            return;
        }
        await deleteFile(path);
        return;
    }

    if (!userId || !boardType || !boardId || !fileName) return;
    if (boardType !== "myBoards" && boardType !== "teamBoards") return;

    const fullPath = `boardCovers/${userId}/${boardType}/${boardId}/${fileName}`;
    await deleteFile(fullPath);
};

/* ------------------------------ */
/* Model file (existing)          */
/* ------------------------------ */

export const uploadModelFile = async ({ file, userId, modelId, extension }) => {
    if (!file) throw new Error("uploadModelFile: file is required");
    if (!userId) throw new Error("uploadModelFile: userId is required");
    if (!modelId) throw new Error("uploadModelFile: modelId is required");
    if (!extension) throw new Error("uploadModelFile: extension is required");

    const path = `models/${userId}/${modelId}/chair-1.${extension}`;
    const storageRef = ref(storage, path);

    const uploadTask = uploadBytesResumable(storageRef, file);
    await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", () => { }, reject, resolve);
    });

    const url = await getDownloadURL(storageRef);
    const metadata = await getMetadata(storageRef);

    return { path, url, size: formatBytes(metadata.size) };
};
