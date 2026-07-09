// 対話オンボーディングの「選択式 3〜4 問」スクリプト（決定的）。
// 質問は決定的なので確実に動く。回答 → OnboardingAnswers へ正規化し、アセンブラへ渡す。
// 仕様: docs/09_project_site_spec.md §7

import type { SiteSectionType, SiteTemplateFamily, SiteThemePersonality } from '../projects/types';

export interface OnboardingAnswers {
  family: SiteTemplateFamily;
  personality: SiteThemePersonality;
  emphasis: SiteSectionType[];
  tagline?: string;
}

export type OnboardingStep =
  | { id: 'name'; kind: 'text'; prompt: string; placeholder: string; optional: false }
  | { id: 'purpose'; kind: 'single'; prompt: string; options: { value: string; label: string }[] }
  | { id: 'personality'; kind: 'single'; prompt: string; options: { value: string; label: string }[] }
  | { id: 'emphasis'; kind: 'multi'; prompt: string; options: { value: SiteSectionType; label: string }[] }
  | { id: 'tagline'; kind: 'text'; prompt: string; placeholder: string; optional: true };

/** 名前未設定のプロジェクトに付与する仮称。オンボーディングはこの名前のときだけ「名前」ステップを出す。 */
export const UNNAMED_PROJECT = '新規プロジェクト';

/** 先頭に差し込む「プロジェクト名」ステップ（仮称のプロジェクトのときのみ使用）。 */
export const NAME_STEP: OnboardingStep = {
  id: 'name', kind: 'text',
  prompt: 'まず、このプロジェクトの名前を教えてください。',
  placeholder: '例: SEKKEIYA コンペ',
  optional: false,
};

export const ONBOARDING_INTRO =
  'このプロジェクトを 1 枚の Web サイトに仕上げます。選択肢からお選びいただくか、「おまかせ」と入力すれば最適な内容をこちらで判断します。迷ったら「全部おまかせ」でも大丈夫です。';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'purpose', kind: 'single',
    prompt: 'まず、このサイトの主な目的は？',
    options: [
      { value: 'proposal', label: '設計提案（受注前のプレゼン）' },
      { value: 'record', label: '竣工・実例の記録' },
      { value: 'portfolio', label: '作品ポートフォリオ' },
      { value: 'residence', label: '集合住宅・分譲プロジェクト（部屋一覧・価格）' },
      { value: 'parcel', label: '区画・戸建て分譲（棟セレクター）' },
      { value: 'studio', label: '事務所・スタジオ紹介（サービス・実績）' },
    ],
  },
  {
    id: 'personality', kind: 'single',
    prompt: '誌面のスタイルは？（雑誌・Webマガジンのような佇まいを選べます）',
    options: [
      { value: 'journal', label: 'Journal — 報道的でクリーン（a+u 風）' },
      { value: 'atelier', label: 'Atelier — 静かで余白の効いた（V. Van Duysen 風）' },
      { value: 'gallery', label: 'Gallery — 大胆でシネマティック（NOT A HOTEL 風）' },
      { value: 'salon', label: 'Salon — クラシックで高級（Architectural Digest 風）' },
      { value: 'mono', label: 'Mono — 白黒ブルータリスト（Swiss editorial 風）' },
      { value: 'studio', label: 'Studio — 現代的で大胆（BIG 等の事務所風）' },
    ],
  },
  {
    id: 'emphasis', kind: 'multi',
    prompt: '特に見せたい成果物は？（複数選択可・スキップ可）',
    options: [
      { value: 'layout', label: 'レイアウト / パース' },
      { value: 'gallery', label: '画像ギャラリー' },
      { value: 'drawing', label: '図面' },
      { value: 'walkthrough', label: '動画ウォークスルー' },
      { value: 'portfolio', label: 'ポートフォリオ PDF' },
    ],
  },
  {
    id: 'tagline', kind: 'text',
    prompt: '最後に、トップに表示する一言キャッチコピーがあれば入力してください（スキップ可）。',
    placeholder: '例: 光と緑に包まれた、家族のための住まい',
    optional: true,
  },
];

const FAMILY_BY_PURPOSE: Record<string, SiteTemplateFamily> = {
  proposal: 'proposal', record: 'record', portfolio: 'portfolio',
  residence: 'residence', parcel: 'parcel', studio: 'studio',
};

/** ステップごとの生回答（Record<stepId, value>）を正規化する。 */
export function buildAnswers(raw: Record<string, any>): OnboardingAnswers {
  const family = FAMILY_BY_PURPOSE[raw.purpose] ?? 'proposal';
  const VALID_PERSONALITIES: SiteThemePersonality[] = ['journal', 'atelier', 'gallery', 'salon', 'mono', 'studio'];
  const personality: SiteThemePersonality =
    VALID_PERSONALITIES.includes(raw.personality) ? raw.personality : 'journal';
  const emphasis: SiteSectionType[] = Array.isArray(raw.emphasis) ? raw.emphasis : [];
  const tagline = (raw.tagline || '').trim() || undefined;
  return { family, personality, emphasis, tagline };
}

/** 単一選択ステップの value からラベルを引く（チャット表示用）。 */
export function labelForValue(step: OnboardingStep, value: string): string {
  if (step.kind === 'single' || step.kind === 'multi') {
    return (step.options as { value: string; label: string }[]).find(o => o.value === value)?.label ?? value;
  }
  return value;
}

/* ==========================================================
 * 推奨値 ＋「おまかせ」解釈（AI が最適を判断する余地）
 * 現状は決定的なヒューリスティック。後で LLM 推論に差し替え可能な継ぎ目。
 * =========================================================*/

/** 各ステップの推奨回答。 */
export const RECOMMENDED: Record<string, any> = {
  purpose: 'proposal',
  personality: 'journal',
  emphasis: ['layout', 'gallery'],
  tagline: '',
};

export function isRecommended(stepId: string, value: string): boolean {
  const rec = RECOMMENDED[stepId];
  return Array.isArray(rec) ? rec.includes(value) : rec === value;
}

/** 既回答に推奨値を補完した完全な raw を返す（全部おまかせ用）。 */
export function recommendedRaw(existing: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = { ...existing };
  for (const s of ONBOARDING_STEPS) if (out[s.id] === undefined) out[s.id] = RECOMMENDED[s.id];
  return out;
}

export type OmakaseScope = 'all' | 'one' | null;

/** 自由入力が「おまかせ」意図か判定する。 */
export function detectOmakase(text: string): OmakaseScope {
  const t = text.replace(/\s/g, '');
  const makase = /(おまかせ|お任せ|まかせ|任せ|おすすめ|オススメ|recommend|どちらでも|どれでも|なんでも|何でも|わからない|分からない|任意)/i.test(t);
  if (!makase) return null;
  const all = /(全部|全て|すべて|ぜんぶ|まとめて|一括|最後まで|まるごと)/.test(t);
  return all ? 'all' : 'one';
}

/** 自由入力を選択肢へマッチング（単一→value / 複数→value[] / 不一致→null）。 */
export function matchOption(step: OnboardingStep, text: string): any {
  if (step.kind === 'text') return null;
  const t = text.toLowerCase();
  const opts = step.options as { value: string; label: string }[];
  const hit = (o: { value: string; label: string }) => {
    if (t.includes(String(o.value).toLowerCase())) return true;
    const core = o.label.split(/[（(—\-/]/)[0].trim().toLowerCase();
    return core.length >= 2 && t.includes(core);
  };
  if (step.kind === 'multi') {
    const vals = opts.filter(hit).map(o => o.value);
    return vals.length ? vals : null;
  }
  const found = opts.find(hit);
  return found ? found.value : null;
}
