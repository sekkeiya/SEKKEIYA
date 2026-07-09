// 記事分析のクライアント窓口。CF `analyzeArticle`（別リポ）を呼び、未デプロイ/失敗時は
// ヒューリスティック（analyzeArticleMock）へフォールバックする。返す ArticleInsight の形は
// engine 以外どちらも同じなので、パネル側は分析経路を問わず同じ描画で済む。
//
// CF 契約（docs/23_analyze_article_function_draft.md）:
//   入力: { title, bodyMarkdown, excerpt?, sourceUrl?, lang? }
//   出力: { success, summary, claims:[{ref,text,role,evidenceStrength?,sourceIndex?}],
//          edges:[{source,target,relation,label?}], scores:{6軸}, keywords:[{term,weight}] }
//   claims[].ref はエッジが参照する安定キー（クライアントで実ノードIDへ写像する）。

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import type {
  ResearchCanvasItem, ResearchCanvasEdge, ResearchNodeRole, ResearchEdgeRelation,
} from '../projects/repositories/ResearchCanvasRepository';
import {
  emptyScores, SCORE_KEYS,
  type ArticleInsight, type InsightClaim, type InsightKeyword, type InsightScores,
} from './articleInsightTypes';
import { analyzeArticleMock } from './analyzeArticleMock';

const ROLES: ResearchNodeRole[] = ['evidence', 'interpretation', 'conclusion'];
const RELATIONS: ResearchEdgeRelation[] = ['supports', 'contradicts', 'applies', 'derives'];
const ROLE_X: Record<ResearchNodeRole, number> = { evidence: 40, interpretation: 340, conclusion: 640 };
const clamp01 = (n: unknown) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, Math.round(v * 100) / 100)) : 0;
};

interface CfClaim { ref?: string; text?: string; role?: string; evidenceStrength?: number; sourceIndex?: number }
interface CfEdge { source?: string; target?: string; relation?: string; label?: string }

/** CF レスポンスを ArticleInsight（engine:'cf'）へ正規化。ref→実ノードIDへ写像し座標を役割列で割る。 */
function buildInsightFromCf(
  data: any,
  params: { articleId?: string | null; title: string; sourceUrl?: string | null; authorUid: string; bodyExcerpt: string },
): ArticleInsight {
  const nowIso = new Date().toISOString();
  const rawClaims: CfClaim[] = Array.isArray(data.claims) ? data.claims : [];
  const refToId = new Map<string, string>();
  const roleRow: Record<string, number> = { evidence: 0, interpretation: 0, conclusion: 0 };

  const claims: InsightClaim[] = [];
  const items: ResearchCanvasItem[] = [];
  rawClaims.forEach((c, i) => {
    const text = String(c.text || '').trim();
    if (!text) return;
    const role = (ROLES.includes(c.role as ResearchNodeRole) ? c.role : 'evidence') as ResearchNodeRole;
    const id = `insn_${Date.now().toString(36)}_${i.toString(36)}`;
    if (c.ref) refToId.set(String(c.ref), id);
    refToId.set(`__idx_${i}`, id); // ref 欠落時のフォールバック参照
    const row = roleRow[role]++;
    items.push({
      id,
      kind: role === 'evidence' ? 'quote' : 'note',
      role,
      color: role === 'evidence' ? 'yellow' : role === 'interpretation' ? 'blue' : 'pink',
      text,
      x: ROLE_X[role], y: 40 + row * 140,
      refType: role === 'evidence' && params.articleId ? 'article' : undefined,
      refId: role === 'evidence' && params.articleId ? params.articleId : undefined,
      refTitle: role === 'evidence' && params.articleId ? params.title : undefined,
      createdAt: nowIso, updatedAt: nowIso,
    });
    claims.push({
      id, text, role,
      evidenceStrength: c.evidenceStrength !== undefined ? clamp01(c.evidenceStrength) : undefined,
      refs: typeof c.sourceIndex === 'number' ? [c.sourceIndex] : undefined,
    });
  });

  const rawEdges: CfEdge[] = Array.isArray(data.edges) ? data.edges : [];
  const edges: ResearchCanvasEdge[] = [];
  const seenPair = new Set<string>();
  rawEdges.forEach((e, i) => {
    const s = refToId.get(String(e.source));
    const t = refToId.get(String(e.target));
    if (!s || !t || s === t) return;
    const key = `${s}->${t}`;
    if (seenPair.has(key)) return;
    seenPair.add(key);
    const relation = (RELATIONS.includes(e.relation as ResearchEdgeRelation) ? e.relation : 'supports') as ResearchEdgeRelation;
    edges.push({
      id: `inse_${Date.now().toString(36)}_${i.toString(36)}`,
      source: s, target: t, relation, label: e.label ? String(e.label) : undefined,
      createdAt: nowIso, updatedAt: nowIso,
    });
  });

  const scores: InsightScores = emptyScores();
  if (data.scores && typeof data.scores === 'object') {
    for (const k of SCORE_KEYS) scores[k] = clamp01(data.scores[k]);
  }

  const keywords: InsightKeyword[] = Array.isArray(data.keywords)
    ? data.keywords
        .map((k: any) => ({ term: String(k?.term || '').trim(), weight: clamp01(k?.weight ?? 0.5) }))
        .filter((k: InsightKeyword) => k.term.length > 0)
        .slice(0, 12)
    : [];

  return {
    id: `insight_${Date.now().toString(36)}_${Math.floor(Date.now() % 46656).toString(36)}`,
    articleId: params.articleId || null,
    sourceTitle: params.title || '（無題の記事）',
    sourceUrl: params.sourceUrl || null,
    sourceExcerpt: params.bodyExcerpt.slice(0, 800),
    summary: String(data.summary || '').slice(0, 300),
    claims,
    graph: { items, edges },
    scores,
    keywords,
    engine: 'cf',
    ragIngestedAt: null,
    authorUid: params.authorUid,
    generatedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** 分析に足るだけの本文があるか（CF が空応答を返す前に mock で受ける最低ライン）。 */
function hasEnoughContent(title: string, body: string): boolean {
  return (body?.trim().length || 0) >= 40 || (title?.trim().length || 0) >= 4;
}

export interface AnalyzeResult { insight: ArticleInsight; usedFallback: boolean; fallbackReason?: string }

/**
 * 記事を分析して ArticleInsight を返す。CF 成功で engine:'cf'、失敗時は mock（engine:'mock'）。
 * 永続化はしない（呼び出し側の責務）。
 */
export async function analyzeArticle(params: {
  articleId?: string | null;
  title: string;
  bodyMarkdown: string;
  excerpt?: string;
  sourceUrl?: string | null;
  authorUid: string;
}): Promise<AnalyzeResult> {
  const mock = () => analyzeArticleMock(params);

  if (!hasEnoughContent(params.title, params.bodyMarkdown)) {
    return { insight: mock(), usedFallback: true, fallbackReason: '本文が短いため簡易分析を使用' };
  }

  try {
    const fn = httpsCallable(functions, 'analyzeArticle', { timeout: 60000 });
    const r: any = await fn({
      title: params.title,
      bodyMarkdown: params.bodyMarkdown,
      excerpt: params.excerpt || '',
      sourceUrl: params.sourceUrl || '',
      lang: 'ja',
    });
    if (!r?.data?.success) throw new Error(r?.data?.reason || 'analyzeArticle が失敗を返しました');
    const insight = buildInsightFromCf(r.data, {
      articleId: params.articleId,
      title: params.title,
      sourceUrl: params.sourceUrl,
      authorUid: params.authorUid,
      bodyExcerpt: params.bodyMarkdown,
    });
    // CF が主張を1つも返せなかった場合は mock の方が実用的
    if (insight.claims.length === 0) throw new Error('analyzeArticle が主張を抽出できませんでした');
    return { insight, usedFallback: false };
  } catch (e: any) {
    console.warn('[analyzeArticle] CF 未接続/失敗のため簡易分析にフォールバック:', e?.message || e);
    return { insight: mock(), usedFallback: true, fallbackReason: e?.message || 'CF 未接続' };
  }
}
