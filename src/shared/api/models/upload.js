// utils/services/models/upload.js
import { doc, updateDoc } from "firebase/firestore";
import { getDocFromServer } from "firebase/firestore";
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
    getMetadata,
} from "firebase/storage";
import { db } from "@/shared/config/firebase";
import { fetchPlanInfo } from "@/shared/utils/planUtils";

/** バイト数を人間向けに */
const prettySize = (bytes = 0) => {
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + " GB";
    if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
    return `${bytes} bytes`;
};

/**
 * モデル本体のアップロード（Storage のみ）
 * - 保存先: models/{userId}/{modelId}/{元ファイル名}
 * - Firestore には書き込まない（files.* の反映は呼び出し側でまとめて行う）
 * - 返り値: { path, url, size }  ※sizeは人間向け表記
 */
export const uploadModelFile = async ({
    file,
    userId,
    modelId,
    extension,     // "3dm" | "glb" | "blend" | "gh" ...
    visibility,    // "private" | "public"
    onProgress,    // (0-100) を受け取る任意コールバック
}) => {
    console.log("[uploadModelFile] start", { userId, modelId, extension, visibility });
    if (!file) throw new Error("file is required");
    if (!userId || !modelId) throw new Error("userId/modelId is required");

    // ---- private 容量チェック（読み取りのみ）----
    let limit = 100 * 1024 * 1024; // 100MB デフォルト
    let used = 0;

    if (visibility === "private") {
        const userRef = doc(db, "users", userId);
        const snap = await getDocFromServer(userRef);
        const data = snap.exists() ? snap.data() : {};
        used = Number(data.privateStorageUsedBytes || 0);
        if (data.plan) {
            const planInfo = await fetchPlanInfo(data.plan);
            if (planInfo?.privateStorageLimitBytes) {
                limit = planInfo.privateStorageLimitBytes;
            }
        }
        const incoming = Number(file.size || 0);
        if (used + incoming > limit) {
            throw new Error("アップロード容量制限を超えています");
        }
    }

    // ---- 保存パス ----
    const original = file.name || `model.${extension || "bin"}`;
    const safeName = original.replace(/[\\/:*?"<>|]+/g, "_");
    const path = `models/${userId}/${modelId}/${safeName}`;

    // ---- Storage へアップロード ----
    const storage = getStorage();
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    await new Promise((resolve, reject) => {
        task.on(
            "state_changed",
            (snap) => {
                const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                onProgress?.(pct);
            },
            reject,
            resolve
        );
    });

    const url = await getDownloadURL(storageRef);
    const meta = await getMetadata(storageRef);
    const sizeBytes = meta.size ?? file.size ?? 0;

    console.log("[uploadModelFile] done", { path, size: prettySize(sizeBytes) });

    // ※ ここで Firestore の users や models には一切書き込まない
    return { path, url, size: prettySize(sizeBytes) };
};

/* ============================
 * ギャラリー画像（任意）
 * ============================ */
import { uploadFile } from "@/shared/api/storage/storage";
import { arrayUnion, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

/**
 * ギャラリー画像のアップロード（容量制限なし）
 * - 保存先: models/{userId}/{modelId}/images/{uuid}.png
 * - Firestore の models/{modelId}.images に追加
 */
export const uploadModelImage = async ({ file, userId, modelId }) => {
    if (!file) throw new Error("image file is required");

    const uuid = uuidv4();
    const path = `models/${userId}/${modelId}/images/${uuid}.png`;
    const { url } = await uploadFile(file, path);

    const docRef = doc(db, "users", userId, "models", modelId);
    await updateDoc(
        docRef,
        {
            images: arrayUnion({
                path,
                img: url,
                title: file.name,
                createdAt: new Date(),
            }),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );

    console.log("✅ Image uploaded and Firestore updated:", url);
    return { path, url };
};
