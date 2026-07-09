import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export const renameProject = async (projectId: string, newName: string) => {
  if (!projectId) throw new Error("projectId is required");
  if (!newName.trim()) throw new Error("newName is required");

  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, {
    name: newName.trim(),
    updatedAt: serverTimestamp()
  });
};

/**
 * プロジェクトのカスタムアイコン（絵文字 or 画像URL）を更新。
 * 片方を設定したらもう片方はクリア。両方 null でデフォルト（頭文字＋ハッシュ色）に戻す。
 */
export const updateProjectIcon = async (
  projectId: string,
  icon: { iconEmoji?: string | null; iconUrl?: string | null }
) => {
  if (!projectId) throw new Error("projectId is required");
  const projectRef = doc(db, 'projects', projectId);
  await updateDoc(projectRef, {
    iconEmoji: icon.iconEmoji ?? null,
    iconUrl: icon.iconUrl ?? null,
    updatedAt: serverTimestamp(),
  });
};

export const touchProject = async (projectId: string) => {
  if (!projectId) return;
  const projectRef = doc(db, 'projects', projectId);
  try {
    await updateDoc(projectRef, {
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to touch project:", err);
  }
};

