import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, storage, auth } from '../../../lib/firebase/client';
import type { DsdExportItem } from './DsdLibraryGrid';

export type DsdTemplate = 'sun' | 'site' | 'layout' | 'env';
export type DsdExportType = 'image' | 'video' | 'pdf';

interface SaveExportOptions {
  projectId: string;
  title: string;
  template: DsdTemplate;
  exportType: DsdExportType;
  file: Blob | File;
  thumbnailBlob?: Blob;
  mimeType?: string;
}

/** Upload a diagram export to Firebase Storage and register it in Firestore. */
export async function saveDsdExport(options: SaveExportOptions): Promise<string> {
  const { projectId, title, template, exportType, file, thumbnailBlob, mimeType } = options;

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('ログインが必要です');

  const ext = exportType === 'pdf' ? 'pdf' : exportType === 'video' ? 'mp4' : 'png';
  const timestamp = Date.now();
  const basePath = `projects/${projectId}/dsd-exports/${uid}/${timestamp}`;

  // Upload main file
  const fileRef = ref(storage, `${basePath}/export.${ext}`);
  const fileBlob = file instanceof File ? file : new File([file], `export.${ext}`, { type: mimeType });
  await uploadBytes(fileRef, fileBlob);
  const fileUrl = await getDownloadURL(fileRef);

  // Upload thumbnail if provided
  let thumbnailUrl: string | undefined;
  if (thumbnailBlob) {
    const thumbRef = ref(storage, `${basePath}/thumbnail.jpg`);
    await uploadBytes(thumbRef, thumbnailBlob);
    thumbnailUrl = await getDownloadURL(thumbRef);
  }

  // Write Firestore document
  const docData: Omit<DsdExportItem, 'id'> & Record<string, any> = {
    appScope: '3dsd',
    title,
    template,
    exportType,
    fileUrl,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(mimeType ? { mimeType } : {}),
    fileSize: fileBlob.size,
    createdBy: uid,
    createdAt: serverTimestamp(),
    visibility: 'private',
    status: 'active',
  };

  const colRef = collection(db, `projects/${projectId}/workFiles`);
  const docRef = await addDoc(colRef, docData);
  return docRef.id;
}

/** Soft-delete a diagram export (sets status to archived). */
export async function deleteDsdExport(projectId: string, itemId: string): Promise<void> {
  const ref = doc(db, `projects/${projectId}/workFiles`, itemId);
  await deleteDoc(ref);
}
