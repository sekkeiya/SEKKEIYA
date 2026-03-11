import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";


// プレビュー画面のカスタムリンク作成
export const addCustomLinkToModel = async ({ modelId, title, url }) => {
    const modelRef = doc(db, "models", modelId); // 🔸 グローバル構造想定
    await updateDoc(modelRef, {
        customLinks: arrayUnion({ title, url }),
    });
};


// プレビュー画面のカスタムリンク削除
export const deleteCustomLinkFromModel = async ({ modelId, index }) => {
    const modelRef = doc(db, "models", modelId);
    const snapshot = await getDoc(modelRef);

    if (!snapshot.exists()) {
        throw new Error("モデルが存在しません");
    }

    const currentLinks = snapshot.data().customLinks || [];

    // 指定 index を除外した新配列を作成
    const updatedLinks = currentLinks.filter((_, i) => i !== index);

    await updateDoc(modelRef, {
        customLinks: updatedLinks,
    });
};