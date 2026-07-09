export type UserPlan = 'free' | 'pro' | 'enterprise';

export const PLAN_ALLOWED_MODELS: Record<UserPlan, string[]> = {
  free: ['gemini-2.5-flash'],
  pro: ['gemini-2.5-flash', 'gemini-pro-latest'],
  enterprise: ['gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.5-pro'],
};

export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-pro-latest': 'Gemini Pro Latest',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

export const MODEL_PLAN_REQUIRED: Record<string, UserPlan> = {
  'gemini-2.5-flash': 'free',
  'gemini-pro-latest': 'pro',
  'gemini-2.5-pro': 'enterprise',
};

// --- AI 3D Create Constants ---

export const MODEL_3D_DISPLAY_NAMES: Record<string, string> = {
  'tripo3d': 'Tripo API (Pro/高品質)',
};

export const MODEL_3D_PLAN_REQUIRED: Record<string, UserPlan> = {
  'tripo3d': 'free',
};

export const AI_3D_LIMITS = {
  free: {
    tripo3d: { daily: Infinity, monthly: 3 },
  },
  pro: {
    tripo3d: { daily: Infinity, monthly: 30 },
  },
  enterprise: {
    tripo3d: { daily: Infinity, monthly: 100 },
  }
};
