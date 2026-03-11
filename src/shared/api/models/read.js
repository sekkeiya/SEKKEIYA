// src/utils/services/models/read.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/** 公開モデル（/models/{id}）を1件取得。見つからなければ false */
export const getPublicModelById = async (id) => {
    try {
        const ref = doc(db, "models", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            console.warn("[getPublicModelById] not found:", id);
            return false;
        }
        const data = snap.data();
        return {
            id: snap.id,
            title: data.title ?? data.name ?? "Untitled",
            description: data.description ?? "",
            thumbnailUrl: data.thumbnailUrl ?? data.thumbnailFilePath?.url ?? "",
            files: data.files ?? {},
            width: data.size?.width ?? data.width ?? null,
            depth: data.size?.depth ?? data.depth ?? null,
            height: data.size?.height ?? data.height ?? null,
            brand: data.brand ?? "",
            price: data.price ?? 0,
            author: data.author ?? data.createdByName ?? "",
            _raw: data,
        };
    } catch (e) {
        console.error("[getPublicModelById] error:", e);
        return false;
    }
};

/**
 * ページ種別に応じてモデルを1件取得（modelRef 展開対応）。見つからなければ null
 */
export async function getModelDataFromFirestore({
    userId,
    modelId,
    selectedPage,
    boardId,
    boardType,
}) {
    if (!modelId) {
        console.error("❌ modelId is required");
        return null;
    }

    // ユーザー前提のページでは userId 必須
    if (
        ["openmodelspage", "privatemodelspage", "boardspage"].includes(selectedPage) &&
        !userId
    ) {
        console.error(`❌ userId is missing for selectedPage: ${selectedPage}`);
        return null;
    }

    let pathSegments;

    switch (selectedPage) {
        case "openmodelspage":
        case "privatemodelspage":
            pathSegments = ["users", userId, "models", modelId];
            break;
        case "boardspage":
            if (!boardId) {
                console.error("❌ boardId is required for boardspage");
                return null;
            }
            if (boardType === "myBoards") {
                pathSegments = ["users", userId, "myBoards", boardId, "models", modelId];
            } else if (boardType === "teamBoards") {
                pathSegments = ["teamBoards", boardId, "models", modelId];
            } else {
                console.error("❌ 未対応の boardType:", boardType);
                return null;
            }
            break;
        case "dashboard":
            pathSegments = ["models", modelId];
            break;
        default:
            console.error("❌ 不正な selectedPage:", selectedPage);
            return null;
    }

    try {
        const ref = doc(db, ...pathSegments);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;

        const data = snap.data();

        // modelRef 構造なら元モデルを展開
        if (data?.modelRef?.path) {
            const refSnap = await getDoc(doc(db, data.modelRef.path));
            if (refSnap.exists()) {
                const originalData = refSnap.data();
                return {
                    id: refSnap.id,
                    ...originalData,
                    boardOptions: data.boardOptions ?? [],
                    modelRef: data.modelRef,
                };
            }
        }

        return { id: snap.id, ...data };
    } catch (e) {
        console.error("🔥 getModelDataFromFirestore error:", e);
        return null;
    }
}
