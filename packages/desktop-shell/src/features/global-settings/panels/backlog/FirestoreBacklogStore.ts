// BacklogStore の Firestore/Storage 実装。DevStatusPanel から抽出（挙動不変）。
// コレクション: /devBacklog（項目）+ /devSprints（スプリント）。管理者のみ読み書き。
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../../../lib/firebase/client';
import type { BacklogStore, Unsubscribe } from './BacklogStore';
import type { BacklogItem, Sprint, Attachment } from '../DevStatusPanel';

const ITEMS = 'devBacklog';
const SPRINTS = 'devSprints';

export const firestoreBacklogStore: BacklogStore = {
  subscribeItems(cb, onError): Unsubscribe {
    return onSnapshot(
      collection(db, ITEMS),
      (snap) => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<BacklogItem, 'id'>) }))),
      (e) => onError?.(e),
    );
  },
  subscribeSprints(cb, onError): Unsubscribe {
    return onSnapshot(
      collection(db, SPRINTS),
      (snap) => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Sprint, 'id'>) }))),
      (e) => onError?.(e),
    );
  },
  async addItem(data) {
    const r = await addDoc(collection(db, ITEMS), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return r.id;
  },
  async updateItem(id, patch) {
    await updateDoc(doc(db, ITEMS, id), { ...patch, updatedAt: serverTimestamp() });
  },
  async removeItem(id) {
    await deleteDoc(doc(db, ITEMS, id));
  },
  async addSprint(data) {
    const r = await addDoc(collection(db, SPRINTS), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return r.id;
  },
  async updateSprint(id, patch) {
    await updateDoc(doc(db, SPRINTS, id), { ...patch, updatedAt: serverTimestamp() });
  },
  async removeSprint(id) {
    await deleteDoc(doc(db, SPRINTS, id));
  },
  async uploadAttachment(itemId, file, name) {
    const path = `devBacklog/${itemId}/${crypto.randomUUID()}`;
    const r = storageRef(storage, path);
    await uploadBytes(r, file, { contentType: (file as File).type || 'image/png' });
    const url = await getDownloadURL(r);
    await updateDoc(doc(db, ITEMS, itemId), { attachments: arrayUnion({ url, path, name }), updatedAt: serverTimestamp() });
  },
  async removeAttachment(itemId, att: Attachment) {
    try { await deleteObject(storageRef(storage, att.path)); } catch { /* 既に無い場合は無視 */ }
    await updateDoc(doc(db, ITEMS, itemId), { attachments: arrayRemove(att), updatedAt: serverTimestamp() });
  },
  now() { return serverTimestamp(); },
  async getAttachmentUrl(att) {
    // クラウド添付は Storage のダウンロード URL をそのまま使う。url 未設定は異常データ。
    if (!att.url) throw new Error('添付 URL がありません');
    return att.url;
  },
};
