// utils/modelReupload.js
// モデルの再アップロード（既存3Dファイルを削除 → Storage アップロード → Firestore 更新）
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/** 人間可読サイズ */
function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/** 3D拡張子判定（必要に応じて追加） */
function is3dExt(extOrMime = "") {
    const ext = extOrMime.toString().toLowerCase();
    return ["glb", "gltf", "3dm", "obj", "fbx", "stl"].includes(ext)
        || ext.startsWith("model/"); // 保険（mime）
}

/** ファイル1つをアップロードしてメタ情報を返す */
async function uploadOne({ userId, modelId, ext, file, onProgress }) {
    const storage = getStorage();
    const safeExt = ext.toLowerCase();
    const fileName = `${Date.now()}_${file.name}`;
    const path = `models/${userId}/${modelId}/${safeExt}/${fileName}`;
    const storageRef = ref(storage, path);

    const task = uploadBytesResumable(storageRef, file);
    await new Promise((resolve, reject) => {
        task.on(
            "state_changed",
            (snap) => {
                if (onProgress) {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    onProgress({ ext: safeExt, progress: pct });
                }
            },
            reject,
            resolve
        );
    });

    const url = await getDownloadURL(task.snapshot.ref);
    return {
        url,
        path,
        size: formatBytes(file.size),
        uploadedAt: Date.now(),
    };
}

/** 既存3Dファイルを Storage から削除（files マップのうち3D拡張子を対象） */
async function deleteExisting3DFiles({ docRef }) {
    const storage = getStorage();
    const snap = await getDoc(docRef);
    if (!snap.exists()) return { deleted: [] };

    const data = snap.data() || {};
    const filesMap = data.files || {};
    const targets = [];

    for (const [ext, meta] of Object.entries(filesMap)) {
        // files[source] などは除外、3Dだけ削除
        if (is3dExt(ext) && meta?.path) {
            targets.push(meta.path);
        }
    }

    const deleted = [];
    for (const path of targets) {
        try {
            await deleteObject(ref(storage, path));
            deleted.push(path);
        } catch (e) {
            // 404などは握りつぶして続行
            console.warn("deleteObject failed:", path, e?.message || e);
        }
    }

    // Firestore 上の files も3Dキーを消し、残りは維持（例：sourceやその他は残す）
    if (targets.length > 0) {
        const rest = {};
        for (const [ext, meta] of Object.entries(filesMap)) {
            if (!is3dExt(ext)) rest[ext] = meta;
        }
        // files が空になったらフィールドごと消す
        if (Object.keys(rest).length === 0) {
            await updateDoc(docRef, { files: deleteField() });
        } else {
            await updateDoc(docRef, { files: rest });
        }
    }

    return { deleted };
}

/**
 * 再アップロード本体
 * - 既存3Dファイルを削除
 * - 新規ファイルをアップロード
 * - Firestore の files/thumnailFilePath を更新
 *
 * @param {Object} params
 * @param {string} params.userId - 所有者 UID（必須）
 * @param {string} params.modelId - モデルID（必須）
 * @param {Object} params.files - { glb?: File, "3dm"?: File, thumbnail?: File, ... }
 * @param {"public"|"private"} [params.visibility="private"]
 * @param {string} [params.docPathOverride] - 例: "users/xxx/models/yyy"
 * @param {(p:{ext:string,progress:number})=>void} [params.onProgress]
 * @returns {Promise<{success:boolean,message?:string,updatedDocPath?:string,deleted?:string[],uploaded?:any}>}
 */
export async function reuploadModel({
    userId,
    modelId,
    files,
    visibility = "private",
    docPathOverride,
    onProgress,
}) {
    if (!userId || !modelId) {
        return { success: false, message: "userId と modelId は必須です" };
    }
    if (!files || typeof files !== "object") {
        return { success: false, message: "files が不正です" };
    }

    try {
        // Firestore の更新先を決定
        let targetDocPath = docPathOverride;
        if (!targetDocPath) {
            targetDocPath =
                visibility === "public"
                    ? `models/${modelId}`
                    : `users/${userId}/models/${modelId}`;
        }
        const docRef = doc(db, targetDocPath);

        // 1) 既存の 3D ファイル（files のうち 3D拡張子）を Storage & Firestore から削除
        const { deleted } = await deleteExisting3DFiles({ docRef });

        // 2) 新規ファイルをアップロード
        const uploaded = {};
        const fileEntries = Object.entries(files).filter(([, f]) => f instanceof File);

        for (const [key, file] of fileEntries) {
            const keyLower = key.toLowerCase();
            const ext =
                keyLower === "thumbnail" ? "thumbnail" :
                    keyLower === "thumb" ? "thumbnail" :
                        // .glb/.3dm などは key をそのまま拡張子として扱う
                        keyLower;

            const meta = await uploadOne({ userId, modelId, ext, file, onProgress });

            if (ext === "thumbnail" || /png|jpg|jpeg|webp/.test(file.type)) {
                uploaded.thumbnailFilePath = {
                    path: meta.path,
                    url: meta.url,
                    thumbnailUrl: meta.url,
                    size: meta.size,
                    uploadedAt: meta.uploadedAt,
                };
            } else {
                uploaded.files = uploaded.files || {};
                uploaded.files[ext] = {
                    path: meta.path,
                    url: meta.url,
                    size: meta.size,
                    uploadedAt: meta.uploadedAt,
                };
            }
        }

        // 3) Firestore を更新（files は上書き：既存3Dは消したので新規3Dのみ）
        const basePatch = {
            updatedAt: serverTimestamp(),
            "processing.glb": "done",
            versionize: "off",
            visibility,
        };
        await setDoc(docRef, basePatch, { merge: true });

        // 新しい files をセット（3D以外の旧データは deleteExisting3DFiles で温存済み）
        if (uploaded.files) {
            // merge:true でも files のキー集合は上書きされる（マップごと入れ替え）
            await setDoc(docRef, { files: uploaded.files }, { merge: true });
        }
        if (uploaded.thumbnailFilePath) {
            await setDoc(docRef, { thumbnailFilePath: uploaded.thumbnailFilePath }, { merge: true });
        }

        return { success: true, updatedDocPath: targetDocPath, deleted, uploaded };
    } catch (e) {
        console.error("reuploadModel failed:", e);
        return { success: false, message: e?.message || String(e) };
    }
}

/**
 * ファイルピッカーを出して実行
 */
export function openFilePickerAndReupload({
    userId,
    modelId,
    visibility = "private",
    docPathOverride,
    onProgress,
    onDone,
}) {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".glb,.gltf,.3dm,.obj,.fbx,.stl,.png,.jpg,.jpeg,.webp,image/*,model/*";

    input.onchange = async () => {
        const picked = Array.from(input.files || []);
        const files = {};

        for (const f of picked) {
            const name = f.name.toLowerCase();
            if (name.endsWith(".glb")) files["glb"] = f;
            else if (name.endsWith(".gltf")) files["gltf"] = f;
            else if (name.endsWith(".3dm")) files["3dm"] = f;
            else if (name.endsWith(".obj")) files["obj"] = f;
            else if (name.endsWith(".fbx")) files["fbx"] = f;
            else if (name.endsWith(".stl")) files["stl"] = f;
            else if (/\.(png|jpg|jpeg|webp)$/i.test(name) || f.type.startsWith("image/")) files["thumbnail"] = f;
        }

        const res = await reuploadModel({
            userId,
            modelId,
            visibility,
            docPathOverride,
            files,
            onProgress,
        });

        onDone?.(res);
    };

    input.click();
}
