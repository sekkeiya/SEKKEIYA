import {
  collection, addDoc, getDocs, query, orderBy,
  updateDoc, doc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../lib/firebase/client';

export interface FieldPhotoComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface FieldPhoto {
  id: string;
  projectId: string;
  storageUrl: string;
  thumbnailUrl: string;
  caption: string;
  createdAt: number;
  createdBy: string;
  likes: string[];
  comments: FieldPhotoComment[];
}

/** Upload a field photo: saves to Storage, AI Drive assets, and fieldPhotos sub-collection. */
export async function uploadFieldPhoto(
  projectId: string,
  file: File,
  caption: string,
): Promise<FieldPhoto> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Login required');

  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `projects/${projectId}/fieldPhotos/${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const storageUrl = await getDownloadURL(storageRef);

  const now = Date.now();

  // Mirror into AI Drive so the photo appears in the Drive panel too.
  const assetsRef = collection(db, 'projects', projectId, 'assets');
  await addDoc(assetsRef, {
    name: file.name,
    type: 'image',
    storageUrl,
    thumbnailUrl: storageUrl,
    size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    ownerId: uid,
    projectId,
    tags: ['fieldPhoto'],
    sourceCollection: 'assets',
    createdAt: now,
  });

  // Social layer — likes / comments live here.
  const photosRef = collection(db, 'projects', projectId, 'fieldPhotos');
  const docRef = await addDoc(photosRef, {
    projectId,
    storageUrl,
    thumbnailUrl: storageUrl,
    caption,
    createdAt: now,
    createdBy: uid,
    likes: [],
    comments: [],
  });

  return {
    id: docRef.id,
    projectId,
    storageUrl,
    thumbnailUrl: storageUrl,
    caption,
    createdAt: now,
    createdBy: uid,
    likes: [],
    comments: [],
  };
}

export async function getFieldPhotos(projectId: string): Promise<FieldPhoto[]> {
  const q = query(
    collection(db, 'projects', projectId, 'fieldPhotos'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FieldPhoto));
}

export async function toggleLike(
  projectId: string,
  photoId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<void> {
  const photoRef = doc(db, 'projects', projectId, 'fieldPhotos', photoId);
  await updateDoc(photoRef, {
    likes: currentlyLiked ? arrayRemove(userId) : arrayUnion(userId),
  });
}

export async function addComment(
  projectId: string,
  photoId: string,
  userId: string,
  userName: string,
  text: string,
): Promise<FieldPhotoComment> {
  const comment: FieldPhotoComment = {
    id: `${Date.now()}_${userId}`,
    userId,
    userName,
    text,
    createdAt: Date.now(),
  };
  const photoRef = doc(db, 'projects', projectId, 'fieldPhotos', photoId);
  await updateDoc(photoRef, { comments: arrayUnion(comment) });
  return comment;
}
