/**
 * postingPlanner — カテゴリ構成から「4週間の投稿計画」を自動生成する。
 * カテゴリ戦略（BlogCategoryStrategist）の更新目安に基づき、同カテゴリが
 * 連続しないようラウンドロビンで日付に割り付ける。スケジュール画面と
 * 戦略ウィザードの両方から使う。
 */

/** カテゴリ別の月あたり目安本数（戦略テンプレートと対応。未知カテゴリは月1）。 */
const FREQ_PER_MONTH: Record<string, number> = {
  '施工事例': 2, 'コーディネート事例': 2, '設計の考え方': 1, 'インテリアのコツ': 2,
  'リノベの基礎知識': 2, '家づくりの基礎知識': 2, '素材とディテール': 1,
  '建築×AI・デジタル': 2, '事例研究': 4, 'コラム': 2,
};

export interface PlanEntry { date: string; time: string; title: string; category: string; note?: string }

export interface PlanOptions {
  weeks?: number;      // 何週分（既定4）
  weekdays?: number[]; // 投稿する曜日（0=日〜6=土。既定 火・金）
  time?: string;       // 投稿時刻 HH:mm（既定 20:00）
}

const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

/** カテゴリ一覧から今後 weeks 週分の投稿計画を作る（指定曜日・時刻のスロットに割り付け）。 */
export function buildPostingPlan(categories: string[], opts?: PlanOptions): PlanEntry[] {
  const weeks = opts?.weeks ?? 4;
  const weekdays = opts?.weekdays?.length ? opts.weekdays : [2, 5]; // 火・金
  const time = opts?.time || '20:00';
  const clean = categories.map((c) => c.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  // カテゴリごとの本数（weeks 週分）→ 同カテゴリが連続しないようラウンドロビン
  const remaining = new Map<string, number>(
    clean.map((c) => [c, Math.max(1, Math.round((FREQ_PER_MONTH[c] ?? 1) * (weeks / 4)))]),
  );
  const ordered: string[] = [];
  while (true) {
    let took = false;
    for (const c of clean) {
      const n = remaining.get(c) || 0;
      if (n > 0) { ordered.push(c); remaining.set(c, n - 1); took = true; }
    }
    if (!took) break;
  }
  // 指定曜日のスロットを明日以降から列挙し、順に割り付け（本数がスロットより多ければ同日複数もあり得る）
  const slots: string[] = [];
  const d = new Date();
  for (let i = 1; slots.length < ordered.length && i <= weeks * 7 * 2; i++) {
    const cur = new Date(d); cur.setDate(d.getDate() + i);
    if (weekdays.includes(cur.getDay())) slots.push(toISO(cur));
  }
  return ordered.map((category, i) => ({
    date: slots[i % slots.length] ?? toISO(new Date()),
    time,
    title: category === '事例研究'
      ? 'ホームの気になる記事をAIと議論して書く'
      : `「${category}」の記事を書く`,
    category,
    note: '投稿計画（自動作成）',
  }));
}
