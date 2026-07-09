/**
 * roomCategories.ts
 * ゾーン＝部屋（カテゴリ）の語彙定義。建物タイプごとに作成できる部屋カテゴリが決まる。
 * ゾーンのラベル表示（カテゴリ名＋面積）と Auto Layout の zonePurpose 連携に使用する。
 */

export interface RoomCategory {
  key: string;
  label: string;
  icon: string;
  /** ゾーンの表示色（カテゴリ選択時にゾーン色へ反映） */
  color: string;
  /** Auto Layout マッチングに使う ZonePurpose */
  purpose: string;
}

export const ROOM_CATEGORIES: Record<string, RoomCategory[]> = {
  residential: [
    { key: 'ldk',      label: 'LDK',         icon: '🛋', color: '#3b82f6', purpose: 'living' },
    { key: 'living',   label: 'リビング',     icon: '🛋', color: '#60a5fa', purpose: 'living' },
    { key: 'dining',   label: 'ダイニング',   icon: '🍽', color: '#f59e0b', purpose: 'dining' },
    { key: 'kitchen',  label: 'キッチン',     icon: '🍳', color: '#ef4444', purpose: 'general' },
    { key: 'bedroom',  label: '寝室',         icon: '🛏', color: '#8b5cf6', purpose: 'bedroom' },
    { key: 'kids',     label: '子供部屋',     icon: '🧸', color: '#ec4899', purpose: 'bedroom' },
    { key: 'study',    label: '書斎',         icon: '📚', color: '#06b6d4', purpose: 'study' },
    { key: 'storage',  label: '収納・WIC',    icon: '🗄', color: '#84cc16', purpose: 'general' },
    { key: 'toilet',   label: 'トイレ',       icon: '🚻', color: '#64748b', purpose: 'general' },
    { key: 'washroom', label: '洗面所',       icon: '🧼', color: '#0ea5e9', purpose: 'general' },
    { key: 'bath',     label: '風呂',         icon: '🛁', color: '#14b8a6', purpose: 'general' },
    { key: 'entrance', label: '玄関',         icon: '🚪', color: '#a16207', purpose: 'general' },
    { key: 'corridor', label: '廊下',         icon: '🚶', color: '#6b7280', purpose: 'general' },
    { key: 'balcony',  label: 'バルコニー',   icon: '🌿', color: '#22c55e', purpose: 'general' },
    { key: 'general',  label: '汎用',         icon: '✦',  color: '#94a3b8', purpose: 'general' },
  ],
  office: [
    { key: 'workspace', label: '執務エリア',  icon: '💻', color: '#3b82f6', purpose: 'desk' },
    { key: 'meeting',   label: '会議室',      icon: '🤝', color: '#8b5cf6', purpose: 'meeting' },
    { key: 'reception', label: '受付',        icon: '🛎', color: '#f59e0b', purpose: 'general' },
    { key: 'lounge',    label: '休憩・ラウンジ', icon: '☕', color: '#10b981', purpose: 'seating' },
    { key: 'focus',     label: '集中ブース',  icon: '🎧', color: '#06b6d4', purpose: 'desk' },
    { key: 'executive', label: '役員室',      icon: '👔', color: '#a16207', purpose: 'desk' },
    { key: 'storage',   label: '倉庫・収納',  icon: '🗄', color: '#84cc16', purpose: 'general' },
    { key: 'corridor',  label: '通路',        icon: '🚶', color: '#6b7280', purpose: 'general' },
    { key: 'general',   label: '汎用',        icon: '✦',  color: '#94a3b8', purpose: 'general' },
  ],
  cafe: [
    { key: 'seating',  label: '客席',         icon: '🪑', color: '#3b82f6', purpose: 'seating' },
    { key: 'counter',  label: 'カウンター',   icon: '🍸', color: '#f59e0b', purpose: 'seating' },
    { key: 'kitchen',  label: '厨房',         icon: '🍳', color: '#ef4444', purpose: 'general' },
    { key: 'register', label: 'レジ',         icon: '💴', color: '#8b5cf6', purpose: 'general' },
    { key: 'terrace',  label: 'テラス',       icon: '🌿', color: '#22c55e', purpose: 'seating' },
    { key: 'general',  label: '汎用',         icon: '✦',  color: '#94a3b8', purpose: 'general' },
  ],
  hotel: [
    { key: 'guestroom', label: '客室',        icon: '🛏', color: '#8b5cf6', purpose: 'bedroom' },
    { key: 'lobby',     label: 'ロビー',      icon: '🛎', color: '#f59e0b', purpose: 'seating' },
    { key: 'bath',      label: 'バスルーム',  icon: '🛁', color: '#14b8a6', purpose: 'general' },
    { key: 'corridor',  label: '廊下',        icon: '🚶', color: '#6b7280', purpose: 'general' },
    { key: 'general',   label: '汎用',        icon: '✦',  color: '#94a3b8', purpose: 'general' },
  ],
};

export function getRoomCategories(buildingType?: string | null): RoomCategory[] {
  return ROOM_CATEGORIES[buildingType ?? ''] ?? ROOM_CATEGORIES.residential;
}

/** カテゴリキーからメタ情報を取得。建物タイプ内→全タイプの順で探索 */
export function getRoomCategoryMeta(categoryKey?: string | null, buildingType?: string | null): RoomCategory | null {
  if (!categoryKey) return null;
  const inType = getRoomCategories(buildingType).find(c => c.key === categoryKey);
  if (inType) return inType;
  for (const list of Object.values(ROOM_CATEGORIES)) {
    const hit = list.find(c => c.key === categoryKey);
    if (hit) return hit;
  }
  return null;
}

/** ゾーンの表示ラベル: カテゴリ名（無ければゾーン名）。面積は呼び出し側で付加 */
export function zoneCategoryLabel(zone: { category?: string | null; name?: string | null }, buildingType?: string | null): string {
  const meta = getRoomCategoryMeta(zone.category, buildingType);
  if (meta) return meta.label;
  return zone.name || 'ゾーン';
}

/** rect (mm) から面積表示文字列 (㎡) を生成 */
export function zoneAreaLabel(rect?: { width: number; depth: number } | null): string {
  if (!rect?.width || !rect?.depth) return '';
  const sqm = (rect.width * rect.depth) / 1_000_000;
  return `${sqm.toFixed(1)}㎡`;
}
