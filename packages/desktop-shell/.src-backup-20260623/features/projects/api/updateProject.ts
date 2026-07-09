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

