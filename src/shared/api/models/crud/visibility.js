// utils/services/models/crud/visibility.js
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { parseSizeToBytes } from "@/shared/utils/core/format/size";
import { fetchPlanInfo } from "@/shared/utils/planUtils";

/**
 * モデルの visibility を更新
 */
export const updateModelVisibility = async (modelId, userId, newVisibility) => {
    const userModelRef = doc(db, "users", userId, "models", modelId);

    const modelSnap = await getDoc(userModelRef);
    const modelData = modelSnap.data();

    if (!modelData) {
        console.error("ユーザーモデルデータが取得できませんでした");
        return { success: false, message: "モデルデータが見つかりません" };
    }

    const oldVisibility = modelData?.visibility;
    if (oldVisibility === newVisibility) {
        return { success: true };
    }

    if (!modelData.files || Object.keys(modelData.files).length === 0) {
        return { success: false, message: "モデルにファイル情報がありません。" };
    }

    const extension = Object.keys(modelData.files)[0];
    const sizeStr = modelData.files[extension]?.size;
    const sizeBytes = Math.round(parseSizeToBytes(sizeStr));

    if (oldVisibility === "public" && newVisibility === "private") {
        const canAdd = await canUserAddBytes(userId, sizeBytes);
        if (!canAdd) {
            return { success: false, message: "容量制限を超えるため、非公開にできません。" };
        }
    } else if (oldVisibility === "private" && newVisibility === "public") {
        await updatePrivateStorageUsedBytes(userId, -sizeBytes); // no-op
    }

    await updateDoc(userModelRef, {
        visibility: newVisibility,
        updatedAt: serverTimestamp(),
    });

    return { success: true };
};

/**
 * ユーザが sizeBytes を追加できるか
 */
export const canUserAddBytes = async (userId, sizeBytes) => {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    const planInfo = await fetchPlanInfo(userData?.plan || "free");
    const limit = planInfo?.privateStorageLimitBytes ?? 0;
    const used = userData?.privateStorageUsedBytes || 0;

    if (limit === -1) return true; // 無制限
    return used + sizeBytes <= limit;
};

/**
 * （DEPRECATED）
 * privateStorageUsedBytes の差分管理は Cloud Functions に移譲
 */
export const updatePrivateStorageUsedBytes = async (_userId, _bytes) => {
    if (import.meta?.env?.MODE === "development") {
        console.debug("[updatePrivateStorageUsedBytes] no-op (moved to Cloud Functions)");
    }
};
