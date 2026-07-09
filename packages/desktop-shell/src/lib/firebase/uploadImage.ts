import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "./client";

export const uploadImageAndGetUrl = async (file: File) => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Login required");

    const path = `drive/${uid}/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
};
