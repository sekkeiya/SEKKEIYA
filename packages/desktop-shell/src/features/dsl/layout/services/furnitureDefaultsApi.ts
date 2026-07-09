/**
 * furnitureDefaultsApi.ts
 * カテゴリ別デフォルト家具の Firestore CRUD。
 *
 * 保存先:
 *   users/{userId}/furniture_defaults/{categoryKey}
 * プロジェクト上書き:
 *   projects/{projectId}/furniture_defaults/{categoryKey}
 */

import {
  doc, getDoc, getDocs, setDoc, deleteDoc,
  collection, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';

export interface FurnitureDefaultEntry {
  categoryKey: string;
  entityId: string;
  title: string;
  thumbnailUrl?: string;
  widthMm?: number;
  depthMm?: number;
  updatedAt?: any;
}

const userCol = (userId: string) =>
  collection(db, 'users', userId, 'furniture_defaults');
const userDoc = (userId: string, key: string) =>
  doc(db, 'users', userId, 'furniture_defaults', key);

const projectDoc = (projectId: string, key: string) =>
  doc(db, 'projects', projectId, 'furniture_defaults', key);
const projectCol = (projectId: string) =>
  collection(db, 'projects', projectId, 'furniture_defaults');

// ─── ユーザーレベル ────────────────────────────────────────────────────────

export async function getUserDefaults(
  userId: string
): Promise<Map<string, FurnitureDefaultEntry>> {
  const snap = await getDocs(userCol(userId));
  const map = new Map<string, FurnitureDefaultEntry>();
  snap.docs.forEach(d => map.set(d.id, d.data() as FurnitureDefaultEntry));
  return map;
}

export async function getUserDefault(
  userId: string,
  categoryKey: string
): Promise<FurnitureDefaultEntry | null> {
  const snap = await getDoc(userDoc(userId, categoryKey));
  return snap.exists() ? (snap.data() as FurnitureDefaultEntry) : null;
}

export async function setUserDefault(
  userId: string,
  entry: FurnitureDefaultEntry
): Promise<void> {
  await setDoc(userDoc(userId, entry.categoryKey), {
    ...entry,
    updatedAt: serverTimestamp(),
  });
}

export async function clearUserDefault(
  userId: string,
  categoryKey: string
): Promise<void> {
  await deleteDoc(userDoc(userId, categoryKey));
}

// ─── プロジェクトレベル（ユーザーデフォルトを上書き）──────────────────────

export async function getProjectDefaults(
  projectId: string
): Promise<Map<string, FurnitureDefaultEntry>> {
  const snap = await getDocs(projectCol(projectId));
  const map = new Map<string, FurnitureDefaultEntry>();
  snap.docs.forEach(d => map.set(d.id, d.data() as FurnitureDefaultEntry));
  return map;
}

export async function setProjectDefault(
  projectId: string,
  entry: FurnitureDefaultEntry
): Promise<void> {
  await setDoc(projectDoc(projectId, entry.categoryKey), {
    ...entry,
    updatedAt: serverTimestamp(),
  });
}

export async function clearProjectDefault(
  projectId: string,
  categoryKey: string
): Promise<void> {
  await deleteDoc(projectDoc(projectId, categoryKey));
}

// ─── マージ取得（プロジェクト優先 → ユーザー）─────────────────────────────

export async function getMergedDefaults(
  userId: string,
  projectId?: string | null
): Promise<Map<string, FurnitureDefaultEntry>> {
  const [userMap, projectMap] = await Promise.all([
    getUserDefaults(userId),
    projectId ? getProjectDefaults(projectId) : Promise.resolve(new Map<string, FurnitureDefaultEntry>()),
  ]);
  // ユーザーデフォルトをベースにプロジェクトで上書き
  const merged = new Map(userMap);
  projectMap.forEach((v, k) => merged.set(k, v));
  return merged;
}
