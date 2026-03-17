// utils/services/models/crud/save.js
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/** 既存/指定IDで保存（再アップロードなどで使用） */
export const saveModelDataWithId = async (modelData, modelId, userId) => {
    await setDoc(doc(db, "users", userId, "models", modelId), modelData);
};
