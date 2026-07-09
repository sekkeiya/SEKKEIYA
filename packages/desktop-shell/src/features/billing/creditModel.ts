// SEKKEIYA 料金プラン & AIクレジット の単一の真実（source of truth）。
// 仕様: docs/17_pricing_credit_spec.md
//
// 設計の核:
//   - 課金軸 = クラウドAIの使用量（クレジット）。ストレージ/プロジェクト数は気前よく開放。
//   - 原価のほぼ全ては「画像→3D化」= Tripo $0.30/個（≈¥46.5）。これが価格設計の基準点。
//   - Cyclesレンダはユーザーのローカル GPU で回る = 原価0 = クレジット消費なし（無制限）。
//   - ルールベースの自動処理（ローカル実行）も 0 クレジット。
//
// ※ クレジットの実消費・残高検証はサーバ（Cloud Functions リポ）が正本。
//   本モジュールはクライアント表示とゲーティングの単一定義で、サーバ側と同じ値を共有する。

export type PlanId = 'free' | 'standard' | 'premium' | 'pro' | 'enterprise';

/** 表示順（安い→高い）。 */
export const PLAN_ORDER: PlanId[] = ['free', 'standard', 'premium', 'pro', 'enterprise'];

/** 画像→3D化 1個あたりの実原価（USD）。Tripo 実測。 */
export const MODEL3D_UNIT_COST_USD = 0.30;
/** 円換算の概算レート（確定時に当月レートで再計算）。 */
export const USD_JPY = 155;

/**
 * 各操作のクレジット消費量。
 * ローカル実行（ルールベース自動処理 / Cyclesレンダ）は 0。
 * 1クレジット ≈ ¥4.6 相当の原価カバー（= 3D化¥46.5 / 10）。
 */
export const CREDIT_COST = {
  /** 画像→3D化 1個（クラウド Tripo） */
  model3d: 10,
  /** AI画像生成 1枚 */
  image: 1,
  /** Chat オーケストレーター 1ターン */
  chatTurn: 1,
  /** 自動ラベリング等の AI 後段 */
  autoLabelAi: 2,
  /** ルールベース自動処理（ローカル） */
  localOp: 0,
  /** Cycles レンダ（ローカル GPU） */
  render: 0,
} as const;

export type CreditOp = keyof typeof CREDIT_COST;

export interface PlanDef {
  id: PlanId;
  label: string;
  /** 月額（税込・円）。null = 応相談。 */
  priceJpy: number | null;
  /** 段階値上げ後の目標月額（Pro のみ。先行価格→将来価格）。 */
  targetPriceJpy?: number;
  /** 月次付与クレジット。null = カスタム（Enterprise）。 */
  monthlyCredits: number | null;
  storageLabel: string;
  /** 商用利用可否（Free のみ不可）。 */
  commercial: boolean;
  /** API アクセス。 */
  api: boolean;
  /** 生成物の透かし。 */
  watermark: boolean;
  /** チーム権限管理（Owner/Editor/Viewer）。 */
  teamRoles: boolean;
  tagline: string;
  recommended?: boolean;
  /** UI アクセント色。 */
  color: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free', label: 'Free', priceJpy: 0, monthlyCredits: 30,
    storageLabel: '5 GB', commercial: false, api: false, watermark: true,
    teamRoles: false, tagline: 'お試し・学習', color: '#90a4ae',
  },
  standard: {
    id: 'standard', label: 'Standard', priceJpy: 1980, monthlyCredits: 120,
    storageLabel: '100 GB', commercial: true, api: false, watermark: false,
    teamRoles: false, tagline: '個人・社会人', color: '#26a69a',
  },
  premium: {
    id: 'premium', label: 'Premium', priceJpy: 2980, monthlyCredits: 200,
    storageLabel: '300 GB', commercial: true, api: false, watermark: false,
    teamRoles: false, tagline: '個人ヘビー', color: '#5c6bc0',
  },
  pro: {
    id: 'pro', label: 'Pro', priceJpy: 4900, targetPriceJpy: 10000, monthlyCredits: 400,
    storageLabel: '1 TB', commercial: true, api: true, watermark: false,
    teamRoles: true, tagline: 'プロ・受託', recommended: true, color: '#42a5f5',
  },
  enterprise: {
    id: 'enterprise', label: 'Enterprise', priceJpy: null, monthlyCredits: null,
    storageLabel: 'カスタム', commercial: true, api: true, watermark: false,
    teamRoles: true, tagline: '法人・大規模', color: '#ffa726',
  },
};

/** Top-up（追加クレジット）パック。原価の 2〜3 倍マージン = 利益の源泉。 */
export interface TopupPack {
  credits: number;
  priceJpy: number;
}
export const TOPUP_PACKS: TopupPack[] = [
  { credits: 100, priceJpy: 1200 },
  { credits: 300, priceJpy: 3000 },
  { credits: 1000, priceJpy: 8800 },
];

/** プラン定義を取得（不正値は free にフォールバック）。 */
export function getPlan(planId: string | null | undefined): PlanDef {
  return PLANS[(planId as PlanId)] ?? PLANS.free;
}

/** 月次クレジットで何個の 3D 化ができるか（Enterprise/カスタムは Infinity）。 */
export function monthlyModel3dQuota(planId: PlanId): number {
  const c = PLANS[planId].monthlyCredits;
  if (c == null) return Infinity;
  return Math.floor(c / CREDIT_COST.model3d);
}

/** 円表示。null は「応相談」。 */
export function formatJpy(v: number | null): string {
  if (v == null) return '応相談';
  return `¥${v.toLocaleString('ja-JP')}`;
}
