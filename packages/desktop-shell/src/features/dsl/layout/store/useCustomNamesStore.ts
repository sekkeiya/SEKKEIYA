// useCustomNamesStore — ユーザーが手入力した「部屋名／ゾーン名」を貯めて、
//   以後の候補チップに出すためのパーソナライズ用ストア。
//   標準カテゴリ（roomCategories）に無い名前だけを覚える（重複は登録しない）。
//   永続化は localStorage（この端末のユーザー単位）。将来ユーザー設定(Firestore)へ
//   移す余地はあるが、まずは軽量に端末ローカルで持つ。
import { create } from "zustand";

export type CustomNameKind = "room" | "zone";

const LS_KEY = "sekkeiya:customNames:v1";
const MAX = 40; // 新しい順に上限まで保持

interface Stored {
  room: string[];
  zone: string[];
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { room: [], zone: [] };
    const v = JSON.parse(raw);
    return {
      room: Array.isArray(v?.room) ? v.room.filter((s: any) => typeof s === "string") : [],
      zone: Array.isArray(v?.zone) ? v.zone.filter((s: any) => typeof s === "string") : [],
    };
  } catch {
    return { room: [], zone: [] };
  }
}

function save(room: string[], zone: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ room, zone }));
  } catch {
    /* localStorage 不可（プライベート等）でも致命ではない */
  }
}

interface CustomNamesState {
  room: string[];
  zone: string[];
  /** 手入力名を覚える。標準カテゴリ名（既知ラベル）は knownLabels で除外して渡すこと。 */
  addName: (kind: CustomNameKind, name: string, knownLabels?: string[]) => void;
  removeName: (kind: CustomNameKind, name: string) => void;
}

const initial = load();

export const useCustomNamesStore = create<CustomNamesState>((set, get) => ({
  room: initial.room,
  zone: initial.zone,
  addName: (kind, name, knownLabels = []) => {
    const n = (name || "").trim();
    if (!n) return;
    if (knownLabels.includes(n)) return; // 標準カテゴリ名は覚えない
    const cur = get()[kind] || [];
    if (cur.includes(n)) {
      // 既にある→先頭へ（最近使った順）
      const next = [n, ...cur.filter((x) => x !== n)].slice(0, MAX);
      const patch = kind === "room" ? { room: next } : { zone: next };
      set(patch as any);
    } else {
      const next = [n, ...cur].slice(0, MAX);
      const patch = kind === "room" ? { room: next } : { zone: next };
      set(patch as any);
    }
    const s = get();
    save(s.room, s.zone);
  },
  removeName: (kind, name) => {
    const cur = get()[kind] || [];
    const next = cur.filter((x) => x !== name);
    const patch = kind === "room" ? { room: next } : { zone: next };
    set(patch as any);
    const s = get();
    save(s.room, s.zone);
  },
}));

/** 手入力名を候補チップ用の疑似カテゴリオブジェクトへ。標準カテゴリと同じ形。 */
export function customNameCandidate(label: string): {
  key: string;
  label: string;
  icon: string;
  color: string;
  purpose: string;
  custom: true;
} {
  return {
    key: `custom:${label}`,
    label,
    icon: "✎",
    color: "rgb(var(--brand-fg-rgb) / 0.55)",
    purpose: "general",
    custom: true,
  };
}
