import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';

// 本文に挿入できるメディア（画像 + 動画）
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];
const ALLOWED_EXT = [...IMAGE_EXT, ...VIDEO_EXT];

const getExt = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const blogMediaKind = (file: File): 'image' | 'video' => {
  const ext = getExt(file.name);
  if (VIDEO_EXT.includes(ext) || file.type.startsWith('video/')) return 'video';
  return 'image';
};

export const blogMediaAccept = {
  image: 'image/*',
  video: 'video/*',
  any: 'image/*,video/*',
};

/**
 * 本文へ挿入する画像 / 動画を Firebase Storage にアップロードして download URL を返す。
 * 記事正本（users/{uid}/blogArticles）に合わせ、メディアもユーザースコープに置く。
 */
export async function uploadBlogMedia(
  uid: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; kind: 'image' | 'video' }> {
  const ext = getExt(file.name);
  if (ext && !ALLOWED_EXT.includes(ext)) {
    throw new Error(`未対応のファイル形式です（${ext}）。画像（PNG/JPG/WebP/GIF）または動画（MP4/MOV/WebM）を選んでください。`);
  }

  const mediaId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `users/${uid}/blog/media/${mediaId}/${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
      (err) => reject(err),
      () => resolve(),
    );
  });

  const url = await getDownloadURL(storageRef);
  return { url, kind: blogMediaKind(file) };
}
