import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import type { FurnitureSet } from '../types/furnitureSet';

const col = (uid: string) => collection(db, 'users', uid, 'furniture_sets');
const ref = (uid: string, id: string) => doc(db, 'users', uid, 'furniture_sets', id);

export const furnitureSetsApi = {
  async list(uid: string): Promise<FurnitureSet[]> {
    const q = query(col(uid), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureSet));
  },

  async get(uid: string, id: string): Promise<FurnitureSet | null> {
    const snap = await getDoc(ref(uid, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as FurnitureSet) : null;
  },

  async save(uid: string, set: FurnitureSet): Promise<void> {
    await setDoc(ref(uid, set.id), { ...set, updatedAt: serverTimestamp() }, { merge: true });
  },

  async delete(uid: string, id: string): Promise<void> {
    await deleteDoc(ref(uid, id));
  },

  newId(uid: string): string {
    return doc(col(uid)).id;
  },
};
