import { db } from '../../../../../../services/firebase/firebaseApp';
import { collection, doc, addDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const JOBS_COLLECTION = 'generationJobs';

export async function createGenerationJob(payload) {
  if (!db) throw new Error('Firestore not initialized');
  const jobsRef = collection(db, JOBS_COLLECTION);
  const docRef = await addDoc(jobsRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id };
}

export function subscribeGenerationJob(jobId, onUpdate) {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, JOBS_COLLECTION, jobId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() });
    }
  });
}

export async function updateGenerationJobStatus(jobId, status, progress) {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, JOBS_COLLECTION, jobId);
  await updateDoc(docRef, {
    status,
    progress,
    updatedAt: serverTimestamp(),
  });
}

export async function finalizeGenerationJob(jobId, results) {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, JOBS_COLLECTION, jobId);
  await updateDoc(docRef, {
    status: 'done',
    progress: 100,
    ...results,
    updatedAt: serverTimestamp(),
  });
}

export async function failGenerationJob(jobId, errorMessage) {
  if (!db) throw new Error('Firestore not initialized');
  const docRef = doc(db, JOBS_COLLECTION, jobId);
  await updateDoc(docRef, {
    status: 'error',
    errorMessage,
    updatedAt: serverTimestamp(),
  });
}
