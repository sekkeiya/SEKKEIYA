// 家具選定フロー 行動ログ（Layer 1）＋ ユーザー傾向推論（Layer 2）
//
// Firestore 設計:
//   users/{uid}/furnitureLogs/{logId}  ← 選定イベント1件
//   insights/furniturePatterns          ← 全ユーザー集計（Layer 3 バッチが書き込む）

import {
  collection, addDoc, getDocs, getDoc, doc,
  query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';

// ─── 型定義 ───────────────────────────────────────────────────────────────────

export interface FurnitureLogEntry {
  projectId: string;
  scope: string;              // 'explore' | 'following' | 'my_public' | 'my_private'
  roomType?: string;
  style?: string;
  selectedIds: string[];
  selectedCategories: string[];
  selectionMode: 'auto' | 'manual';
  addedCount: number;
  timestamp?: any;
}

export interface FurniturePreferences {
  topScope: string | null;
  topStyle: string | null;
  topRoomType: string | null;
  topCategories: string[];
  avgAddedCount: number;
  totalSessions: number;
}

export interface GlobalFurnitureInsights {
  topScope: string | null;
  topStyle: string | null;
  topRoomType: string | null;
  topCategories: string[];
  totalSessions: number;
  updatedAt?: any;
}

// ─── Layer 1: ログ書き込み ────────────────────────────────────────────────────

export async function logFurnitureSelection(
  uid: string,
  entry: Omit<FurnitureLogEntry, 'timestamp'>,
): Promise<void> {
  try {
    await addDoc(collection(db, 'users', uid, 'furnitureLogs'), {
      ...entry,
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[furnitureLog] write failed:', e);
  }
}

// ─── Layer 2: ユーザー傾向読み込み ───────────────────────────────────────────

/** 過去20セッション分のログから傾向を集計する。 */
export async function getUserFurniturePreferences(
  uid: string,
): Promise<FurniturePreferences | null> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'users', uid, 'furnitureLogs'),
        orderBy('timestamp', 'desc'),
        limit(20),
      ),
    );
    if (snap.empty) return null;

    const logs = snap.docs.map(d => d.data() as FurnitureLogEntry);

    const scopeCount: Record<string, number> = {};
    const styleCount: Record<string, number> = {};
    const roomCount: Record<string, number> = {};
    const catCount: Record<string, number> = {};
    let totalAdded = 0;

    for (const log of logs) {
      if (log.scope) scopeCount[log.scope] = (scopeCount[log.scope] || 0) + 1;
      if (log.style) styleCount[log.style] = (styleCount[log.style] || 0) + 1;
      if (log.roomType) roomCount[log.roomType] = (roomCount[log.roomType] || 0) + 1;
      for (const cat of log.selectedCategories || []) {
        catCount[cat] = (catCount[cat] || 0) + 1;
      }
      totalAdded += log.addedCount || 0;
    }

    const topOf = (c: Record<string, number>) =>
      Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const topCategories = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k);

    return {
      topScope: topOf(scopeCount),
      topStyle: topOf(styleCount),
      topRoomType: topOf(roomCount),
      topCategories,
      avgAddedCount: Math.round((totalAdded / logs.length) * 10) / 10,
      totalSessions: logs.length,
    };
  } catch (e) {
    console.warn('[furnitureLog] read preferences failed:', e);
    return null;
  }
}

// ─── Layer 3: 全ユーザー集計（バッチが書いた Firestore を読む） ──────────────

export async function getGlobalFurnitureInsights(): Promise<GlobalFurnitureInsights | null> {
  try {
    const snap = await getDoc(doc(db, 'insights', 'furniturePatterns'));
    if (!snap.exists()) return null;
    return snap.data() as GlobalFurnitureInsights;
  } catch (e) {
    console.warn('[furnitureLog] read global insights failed:', e);
    return null;
  }
}

// ─── プロンプト文字列化 ───────────────────────────────────────────────────────

const SCOPE_LABEL: Record<string, string> = {
  explore: 'Explore（全公開）',
  following: 'Following（フォロー中）',
  my_public: '自分の公開モデル',
  my_private: '自分の非公開モデル',
};

/**
 * ユーザー傾向 + 全体トレンドをシステムプロンプト末尾に注入するテキストを生成する。
 * 情報が少ない（1回以下）場合は空文字を返し、プロンプトを汚染しない。
 */
export function buildFurnitureContextSection(
  prefs: FurniturePreferences | null,
  insights: GlobalFurnitureInsights | null,
): string {
  const lines: string[] = [];

  // ── ユーザー傾向（2回以上のログがある場合のみ）──
  if (prefs && prefs.totalSessions >= 2) {
    lines.push('[このユーザーの家具選定傾向（過去履歴より自動推論）]');
    if (prefs.topScope) lines.push(`- よく使うスコープ: ${SCOPE_LABEL[prefs.topScope] ?? prefs.topScope}`);
    if (prefs.topRoomType) lines.push(`- よく使う部屋タイプ: ${prefs.topRoomType}`);
    if (prefs.topStyle) lines.push(`- 好みのスタイル: ${prefs.topStyle}`);
    if (prefs.topCategories.length > 0) lines.push(`- よく選ぶカテゴリ: ${prefs.topCategories.join('、')}`);
    if (prefs.avgAddedCount > 0) lines.push(`- 平均選定数: ${prefs.avgAddedCount}件/回`);
    lines.push(
      '→ 家具選定フローの propose_choices では上記傾向を初期値として優先提案する。' +
      'scope・roomType・style が明確なら確認ステップを省略してよい。',
    );
  }

  // ── 全ユーザートレンド（集計済みの場合のみ）──
  if (insights && insights.totalSessions >= 10) {
    if (lines.length) lines.push('');
    lines.push('[SEKKEIYAユーザー全体のトレンド（参考）]');
    if (insights.topScope) lines.push(`- 人気スコープ: ${SCOPE_LABEL[insights.topScope] ?? insights.topScope}`);
    if (insights.topRoomType) lines.push(`- 人気部屋タイプ: ${insights.topRoomType}`);
    if (insights.topStyle) lines.push(`- 人気スタイル: ${insights.topStyle}`);
    if (insights.topCategories?.length) lines.push(`- 人気カテゴリ: ${insights.topCategories.join('、')}`);
    lines.push('→ ユーザーの指定がない場合は上記トレンドを参考に提案する。');
  }

  return lines.length ? '\n\n' + lines.join('\n') : '';
}
