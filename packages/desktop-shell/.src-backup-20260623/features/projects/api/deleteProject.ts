import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export const deleteProject = async (projectId: string) => {
  if (!projectId) throw new Error("projectId is required");

  const projectRef = doc(db, 'projects', projectId);
  await deleteDoc(projectRef);
};
