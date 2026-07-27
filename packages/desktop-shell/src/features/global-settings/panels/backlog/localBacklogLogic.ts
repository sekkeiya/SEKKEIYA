// ローカルモードの純ロジック（React / Tauri fs 非依存）。fs 層は LocalFileBacklogStore.ts。
import type { BacklogItem, Sprint } from '../DevStatusPanel';

export interface LocalBacklogFile {
  version: 1;
  projectKey: string;
  items: BacklogItem[];
  sprints: Sprint[];
}

export function emptyBacklogFile(projectKey: string): LocalBacklogFile {
  return { version: 1, projectKey, items: [], sprints: [] };
}

export function parseBacklogFile(text: string): LocalBacklogFile {
  const raw: unknown = JSON.parse(text); // 不正 JSON はここで throw
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('backlog.json の形式が不正です（オブジェクトではありません）');
  }
  const o = raw as Partial<LocalBacklogFile>;
  return {
    version: 1,
    projectKey: typeof o.projectKey === 'string' ? o.projectKey : '',
    items: Array.isArray(o.items) ? o.items : [],
    sprints: Array.isArray(o.sprints) ? o.sprints : [],
  };
}

// git diff / Claude Code の可読性のため、キー順を安定化して直列化する。
// 優先キーを先頭に、残りはアルファベット順。ネストにも再帰適用。
// 'text' は fixes[].text 用（BacklogItem の本文は 'title'）。
const KEY_PRIORITY = ['version', 'projectKey', 'id', 'type', 'seq', 'title', 'text', 'status', 'items', 'sprints'];
function orderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderKeys);
  if (value === null || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => {
    const pa = KEY_PRIORITY.indexOf(a); const pb = KEY_PRIORITY.indexOf(b);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? KEY_PRIORITY.length : pa) - (pb === -1 ? KEY_PRIORITY.length : pb);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = orderKeys(obj[k]);
  return out;
}

export function serializeBacklogFile(file: LocalBacklogFile): string {
  return JSON.stringify(orderKeys(file), null, 2) + '\n';
}

export function addEntry<T extends { id?: string }>(list: T[], data: Partial<T>, id: string, nowIso: string): T[] {
  return [...list, { ...data, id, createdAt: nowIso, updatedAt: nowIso } as unknown as T];
}

export function patchEntry<T extends { id?: string }>(list: T[], id: string, patch: Record<string, unknown>, nowIso: string): T[] {
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) throw new Error(`項目が見つかりません: ${id}`);
  const next = [...list];
  next[idx] = { ...next[idx], ...patch, updatedAt: nowIso } as T;
  return next;
}

export function removeEntry<T extends { id?: string }>(list: T[], id: string): T[] {
  return list.filter(e => e.id !== id);
}

/** watch の自己書き込み判定: 直前に自分が書いた内容そのものなら無視して良い。 */
export function isSelfWrite(lastWritten: string | null, current: string): boolean {
  return lastWritten !== null && lastWritten === current;
}
