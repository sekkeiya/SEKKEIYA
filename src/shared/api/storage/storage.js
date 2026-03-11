export * from "./storage.common";


// import { storage } from "@/shared/config/firebase";
// import {
//     ref,
//     deleteObject,
//     getMetadata,
//     uploadBytesResumable,
//     getDownloadURL,
// } from 'firebase/storage';

// /**
//  * Firebase Storage にファイルをアップロードするユーティリティ
//  */
// export const uploadFile = async (file, fullPath, setProgress) => {
//     const storageRef = ref(storage, fullPath);
//     const uploadTask = uploadBytesResumable(storageRef, file);

//     return new Promise((resolve, reject) => {
//         uploadTask.on(
//             'state_changed',
//             (snapshot) => {
//                 if (setProgress) {
//                     const progress =
//                         (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
//                     setProgress(progress);
//                 }
//             },
//             (error) => {
//                 console.error('Upload failed:', error);
//                 reject(error);
//             },
//             async () => {
//                 const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
//                 resolve({
//                     path: fullPath,
//                     url: downloadURL,
//                 });
//             }
//         );
//     });
// };

// /**
//  * Firebase Storage からファイルを削除するユーティリティ
//  */
// export const deleteFile = async (fullPath) => {
//     const storageRef = ref(storage, fullPath);
//     await deleteObject(storageRef);
//     console.log(`✅ Firebase Storage から削除完了: ${fullPath}`);
// };

// /**
//  * Firebase Storage にモデルファイルをアップロードし
//  * ファイルサイズも取得するユーティリティ
//  */
// export const uploadModelFile = async ({
//     file,
//     userId,
//     modelId,
//     extension,
// }) => {
//     console.log("uploadModelFile が呼ばれました");

//     const path = `models/${userId}/${modelId}/chair-1.${extension}`;
//     const storageRef = ref(storage, path);

//     // アップロード開始
//     const uploadTask = uploadBytesResumable(storageRef, file);

//     await new Promise((resolve, reject) => {
//         uploadTask.on(
//             'state_changed',
//             () => { },
//             reject,
//             resolve
//         );
//     });

//     // URL取得
//     const url = await getDownloadURL(storageRef);

//     // メタデータ取得
//     const metadata = await getMetadata(storageRef);
//     console.log("uploaded size (bytes):", metadata.size);

//     let sizeFormatted;

//     if (metadata.size >= 1024 * 1024 * 1024) {
//         sizeFormatted = (metadata.size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
//     } else if (metadata.size >= 1024 * 1024) {
//         sizeFormatted = (metadata.size / (1024 * 1024)).toFixed(2) + ' MB';
//     } else if (metadata.size >= 1024) {
//         sizeFormatted = (metadata.size / 1024).toFixed(2) + ' KB';
//     } else {
//         sizeFormatted = metadata.size + ' bytes';
//     }

//     return { path, url, size: sizeFormatted };
// };

