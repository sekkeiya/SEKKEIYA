// 記事インサイト（横断の分析ライブラリ）— 記事1本を多視点で分析した結果パックのデータモデル。
//
// 思想: 記事は「完成した結論のかたまり」。これを逆算で「どの根拠が・どのロジックで・どの
// 結論を支えるか」に分解し、論証グラフ断片として貯める。graph は Research & Memo と同じ
// ResearchCanvasItem/Edge をそのまま持つので、変換ゼロでプロジェクトのリサーチボードへ
// 流し込める（＝ここで採掘した根拠を、別プロジェクトのロジック構築で再利用する）。
// 全プロジェクト横断で検索・引用でき、RAG索引（外付け脳）にも投入する。
//
// 正本: users/{uid}/articleInsights/{id}

import type {
  ResearchCanvasItem,
  ResearchCanvasEdge,
  ResearchNodeRole,
} from '../projects/repositories/ResearchCanvasRepository';

/** 記事から抽出した主張1件（論証グラフ上のカード候補）。 */
export interface InsightClaim {
  id: string;
  text: string;
  /** 論証グラフ上の役割（根拠 / 解釈 / 結論）。ResearchCanvas と同じ語彙。 */
  role: ResearchNodeRole;
  /** この主張が根拠でどれだけ支えられているか（0..1）。多視点スコアの素。 */
  evidenceStrength?: number;
  /** 記事内の該当箇所（リーダー抽出ブロックの index）。トレーサビリティ用。 */
  refs?: number[];
}

/**
 * 多視点スコア（各 0..1）。分析ビューのレーダーチャートに使う。
 * 「記事の主張がどれだけ強い/実務に使えるか」を6軸で測る。
 */
export interface InsightScores {
  logic: number;          // 論理の強度（主張が根拠で支えられているか）
  evidence: number;       // 実証度（データ・出典・具体例の量）
  novelty: number;        // 新規性（既知の一般論か、固有の視点か）
  falsifiability: number; // 反証可能性（検証・反論の余地があるか）
  clarity: number;        // 明快さ（論旨の追いやすさ）
  applicability: number;  // 実務転用性（自分のプロジェクトに使えるか）
}

export const SCORE_KEYS: (keyof InsightScores)[] = [
  'logic', 'evidence', 'novelty', 'falsifiability', 'clarity', 'applicability',
];

export const SCORE_LABELS: Record<keyof InsightScores, string> = {
  logic: '論理',
  evidence: '実証',
  novelty: '新規性',
  falsifiability: '反証可能性',
  clarity: '明快さ',
  applicability: '実務転用性',
};

/** キーワード頻度（分析ビューのバーチャート用）。 */
export interface InsightKeyword {
  term: string;
  weight: number; // 相対頻度・重要度（0..1）
}

/**
 * 記事1本の分析パック。多視点スコア＋論証グラフ断片＋キーワードを1ドキュメントに束ねる。
 * graph は Research & Memo と同一の型なので、そのままリサーチボードへ取り込める。
 */
export interface ArticleInsight {
  id: string;
  /** 分析元。S.Blog 記事なら記事ID、外部Web記事なら null（sourceUrl で識別）。 */
  articleId?: string | null;
  sourceTitle: string;
  sourceUrl?: string | null;
  /** 分析対象の本文スナップショット（再分析・トレース用。長文は丸める）。 */
  sourceExcerpt?: string;
  summary: string;                 // 記事全体の要約（1〜3文）
  claims: InsightClaim[];          // 抽出した主張リスト
  /** 論証グラフ断片（再利用可能）。Research & Memo と同じ items/edges 構造。 */
  graph: { items: ResearchCanvasItem[]; edges: ResearchCanvasEdge[] };
  scores: InsightScores;           // 多視点スコア（レーダー）
  keywords: InsightKeyword[];      // キーワード頻度（バー）
  /** 分析エンジン。'mock' = ヒューリスティック（CF未接続時のフォールバック）/ 'cf' = サーバー分析。 */
  engine: 'mock' | 'cf';
  /** RAG索引へ投入した時刻（外付け脳連携）。未投入は null。 */
  ragIngestedAt?: string | null;
  authorUid: string;
  generatedAt: string;             // ISO（分析実行時刻）
  createdAt: string;               // ISO
  updatedAt: string;               // ISO
}

/** Firestore は undefined を保存できないため、書き込み前に undefined キーを落とす（ネスト1段まで手当て）。 */
export function compactInsight(insight: ArticleInsight): ArticleInsight {
  const strip = <T extends Record<string, unknown>>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return {
    ...strip(insight as unknown as Record<string, unknown>),
    claims: insight.claims.map((c) => strip(c as unknown as Record<string, unknown>)),
    graph: {
      items: insight.graph.items.map((i) => strip(i as unknown as Record<string, unknown>) as unknown as ResearchCanvasItem),
      edges: insight.graph.edges.map((e) => strip(e as unknown as Record<string, unknown>) as unknown as ResearchCanvasEdge),
    },
  } as ArticleInsight;
}

/** 空スコア（全軸0）。 */
export function emptyScores(): InsightScores {
  return { logic: 0, evidence: 0, novelty: 0, falsifiability: 0, clarity: 0, applicability: 0 };
}
