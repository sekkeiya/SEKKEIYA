/**
 * LoRA モデル製造ライン（LoRA Studio）の台帳 — Firestore loraModels（管理者専用）。
 * 用途別LoRAを「教材 → 学習 → 配信 → 運用」の4工程で管理する。
 * 実際の学習は tools/lora の CLI（fal）で行い、出力された重み URL をここへ登録する。
 */
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';

export type LoraStage = 'concept' | 'collecting' | 'trained' | 'live';

export interface LoraModel {
  id: string;
  name: string;            // 表示名（例: 内観パース）
  usage: string;           // 用途（内観 / 家具 / 素材 / 図面…）
  base: string;            // FLUX / SDXL
  triggerWord: string;     // 生成時にプロンプト先頭へ付与する語（例: skvintr）
  dataset: string;         // 教材フォルダ名（tools/lora/datasets/<dataset>/images）
  scale: number;           // LoRA の効き（既定 1.0）
  imageCount: number;      // 教材枚数（手入力）
  weightsUrl: string;      // 学習済み LoRA 重み URL（tools/lora の manifest から）
  deployCloud: boolean;    // クラウド配信（airender flux-lora）
  deployLocal: boolean;    // ローカル配信（ComfyUI models/loras）
  note: string;
  createdAtMs?: number;
  updatedAtMs?: number;
}

/** 4工程のうち今どこか。フィールドから導出。 */
export function deriveStage(m: Pick<LoraModel, 'imageCount' | 'weightsUrl' | 'deployCloud' | 'deployLocal'>): LoraStage {
  if (m.deployCloud || m.deployLocal) return 'live';
  if (m.weightsUrl) return 'trained';
  if (m.imageCount > 0) return 'collecting';
  return 'concept';
}

export const STAGE_INDEX: Record<LoraStage, number> = { concept: 0, collecting: 1, trained: 2, live: 3 };
export const STAGE_LABELS = ['教材', '学習', '配信', '運用'] as const;

export function subscribeLoraModels(cb: (rows: LoraModel[]) => void): () => void {
  const q = query(collection(db, 'loraModels'), orderBy('updatedAtMs', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    (e) => { console.warn('[loraModels] subscribe error', e); cb([]); },
  );
}

/** 表示名からファイルシステム安全なデータセット名（ASCII slug）を作る。空なら日時ベース。 */
function slugFor(name: string): string {
  const s = (name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return s || `ds-${Date.now().toString(36)}`;
}

export async function createLoraModel(input: Partial<LoraModel>): Promise<string> {
  const ref = doc(collection(db, 'loraModels'));
  await setDoc(ref, {
    name: input.name || '新しいモデル',
    usage: input.usage || '内観',
    base: input.base || 'FLUX',
    triggerWord: input.triggerWord || '',
    dataset: input.dataset || slugFor(input.name || ''),
    scale: input.scale ?? 1.0,
    imageCount: input.imageCount ?? 0,
    weightsUrl: input.weightsUrl || '',
    deployCloud: !!input.deployCloud,
    deployLocal: !!input.deployLocal,
    note: input.note || '',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLoraModel(id: string, patch: Partial<LoraModel>): Promise<void> {
  await updateDoc(doc(db, 'loraModels', id), { ...patch, updatedAtMs: Date.now() });
}

export async function deleteLoraModel(id: string): Promise<void> {
  await deleteDoc(doc(db, 'loraModels', id));
}

/** 稼働中の公式LoRA第一号（内観パース）を台帳へ取り込む（未登録なら）。 */
export async function seedInteriorModel(existing: LoraModel[]): Promise<void> {
  if (existing.some((m) => m.triggerWord === 'skvintr' || m.name.includes('内観'))) return;
  await createLoraModel({
    name: '内観パース',
    usage: '内観',
    base: 'FLUX',
    triggerWord: 'skvintr',
    dataset: 'interior-perspective',
    scale: 1.0,
    imageCount: 12,
    weightsUrl: 'https://v3b.fal.media/files/b/0aa1c5f9/ZrX-bq1NyhyHuPiUQWfvQ_pytorch_lora_weights.safetensors',
    deployCloud: true,
    deployLocal: true,
    note: '公式LoRA第一号。fal で学習、クラウド(airender)＋ローカル(ComfyUI)で稼働中。',
  });
}
