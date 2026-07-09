import { PLAN_ORDER, monthlyModel3dQuota, type PlanId } from '../../billing/creditModel';

// プラン分類は creditModel.ts（docs/17）が正本。本ファイルはモデル別ゲーティングの語彙を提供する。
export type UserPlan = PlanId;

export const PLAN_ALLOWED_MODELS: Record<UserPlan, string[]> = {
  free: ['gemini-2.5-flash'],
  standard: ['gemini-2.5-flash', 'gemini-pro-latest'],
  premium: ['gemini-2.5-flash', 'gemini-pro-latest'],
  pro: ['gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.5-pro'],
  enterprise: ['gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.5-pro'],
};

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-pro-latest': 'Gemini Pro Latest',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

export const MODEL_PLAN_REQUIRED: Record<string, UserPlan> = {
  'gemini-2.5-flash': 'free',
  'gemini-pro-latest': 'standard',
  'gemini-2.5-pro': 'pro',
};

// --- AI 3D Create Constants ---

export const MODEL_3D_DISPLAY_NAMES: Record<string, string> = {
  'tripo3d': 'Tripo API (Pro/高品質)',
};

export const MODEL_3D_PLAN_REQUIRED: Record<string, UserPlan> = {
  'tripo3d': 'free',
};

// 月次 3D 化上限はクレジット（creditModel）から導出する。回数 = floor(月次クレジット / 10)。
// 例: free 30cr→3個 / standard 120cr→12個 / premium 200cr→20個 / pro 400cr→40個 / enterprise→無制限。
function limitsFor(planId: PlanId) {
  return { tripo3d: { daily: Infinity, monthly: monthlyModel3dQuota(planId) } };
}

export const AI_3D_LIMITS = {
  ...Object.fromEntries(PLAN_ORDER.map((p) => [p, limitsFor(p)])),
  // 公式アカウント — すべての制限をバイパスする内部プラン。
  official: { tripo3d: { daily: Infinity, monthly: Infinity } },
} as Record<string, { tripo3d: { daily: number; monthly: number } }>;

/** 公式アカウント — すべての制限をクライアント側でバイパスする。 */
export const OFFICIAL_EMAILS: ReadonlySet<string> = new Set([
  's.sekkeiya@gmail.com',
  'hello@sekkeiya.com',
]);
