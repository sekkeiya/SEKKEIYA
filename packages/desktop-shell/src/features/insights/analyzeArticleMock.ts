// 記事分析のヒューリスティック実装（CF未接続時のフォールバック / Phase B ビジュアル検証の土台）。
//
// 記事本文（Markdown）を「見出し＝結論・解釈の候補」「本文の断定文＝根拠」に素朴に分解し、
// 根拠→結論の supports エッジを張った論証グラフ断片を組み立てる。多視点スコアとキーワード頻度も
// テキスト統計から概算する。本物の多視点分析は Phase C の CF `analyzeArticle` が置き換える
// （返す ArticleInsight の形は同じなので、パネル側は engine を問わず同じ描画で済む）。

import type {
  ResearchCanvasItem,
  ResearchCanvasEdge,
} from '../projects/repositories/ResearchCanvasRepository';
import type { ArticleInsight, InsightClaim, InsightKeyword, InsightScores } from './articleInsightTypes';

interface Block {
  kind: 'h' | 'p';
  text: string;
  index: number; // 元本文中の出現順（refs 用）
}

/** Markdown をごく浅く見出し/段落ブロックに分解（画像・コードフェンス等は落とす）。 */
function splitBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/```[\s\S]*?```/g, '').split(/\n{2,}/);
  let index = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^!\[/.test(line) || /^<(img|video|iframe)/i.test(line)) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) {
      blocks.push({ kind: 'h', text: stripInline(h[1]), index: index++ });
    } else {
      // 箇条書きは行ごとに、本文は文単位で扱う
      const text = stripInline(line.replace(/^[-*]\s+/, ''));
      if (text.length >= 2) blocks.push({ kind: 'p', text, index: index++ });
    }
  }
  return blocks;
}

function stripInline(s: string): string {
  return s
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // リンク/画像 → テキスト
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 文単位に割る（日本語の句点＋英語ピリオド）。 */
function toSentences(text: string): string[] {
  return text
    .split(/(?<=[。．！？!?])\s*|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);
}

/** 断定・根拠らしさのスコア（数値・割合・出典語・断定語で加点）。 */
function evidenceScore(s: string): number {
  let score = 0;
  if (/\d/.test(s)) score += 0.3;
  if (/[%％]|割|倍|件|年|万|億|㎡|平米|円/.test(s)) score += 0.25;
  if (/によると|調査|研究|データ|統計|報告|事例|実測|測定/.test(s)) score += 0.3;
  if (/である|だ。|と言える|と考えられる|が分かる|が判明/.test(s)) score += 0.15;
  return Math.min(1, score);
}

const STOPWORDS = new Set([
  'こと', 'もの', 'ため', 'よう', 'これ', 'それ', 'あれ', 'とき', 'ところ',
  'について', 'という', 'そして', 'しかし', 'また', 'さらに', 'つまり', 'なお',
]);

/** 素朴なキーワード抽出（漢字2+ / カタカナ3+ / 英単語3+ の頻度）。 */
function extractKeywords(text: string, top = 12): InsightKeyword[] {
  const counts = new Map<string, number>();
  const patterns = [/[一-鿿々]{2,}/g, /[ァ-ヶー]{3,}/g, /[A-Za-z][A-Za-z0-9]{2,}/g];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const term = m[0];
      if (STOPWORDS.has(term)) continue;
      counts.set(term, (counts.get(term) || 0) + 1);
    }
  }
  const sorted = [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, top);
  const max = sorted[0]?.[1] || 1;
  return sorted.map(([term, c]) => ({ term, weight: Math.round((c / max) * 100) / 100 }));
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Math.round(n * 100) / 100));

function newId(seed: number): string {
  return `ins_${Date.now().toString(36)}_${seed.toString(36)}`;
}

/**
 * 記事を分析して ArticleInsight（engine:'mock'）を組み立てる。永続化はしない（呼び出し側の責務）。
 * 論証グラフは role で3列に配置（根拠=左 / 解釈=中 / 結論=右）＝ Research & Memo の左→右規約に合わせる。
 */
export function analyzeArticleMock(params: {
  articleId?: string | null;
  title: string;
  bodyMarkdown: string;
  excerpt?: string;
  sourceUrl?: string | null;
  authorUid: string;
}): ArticleInsight {
  const { articleId, title, bodyMarkdown, excerpt, sourceUrl, authorUid } = params;
  const nowIso = new Date().toISOString();
  const blocks = splitBlocks(bodyMarkdown || '');
  const plainText = blocks.map((b) => b.text).join(' ') || title;

  const headings = blocks.filter((b) => b.kind === 'h');
  const sentences = blocks
    .filter((b) => b.kind === 'p')
    .flatMap((b) => toSentences(b.text).map((s) => ({ s, index: b.index })));

  // ── 結論・解釈（見出し）と根拠（断定文）を抽出 ──
  const conclusionText = title.trim() || headings[0]?.text || '（無題の記事）';
  const interpretations = headings.slice(0, 4);
  const rankedEvidence = sentences
    .map((x) => ({ ...x, score: evidenceScore(x.s) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .filter((x) => x.score > 0.1);

  const claims: InsightClaim[] = [];
  const items: ResearchCanvasItem[] = [];
  const edges: ResearchCanvasEdge[] = [];
  let seed = 0;

  // 結論カード（右列）
  const conclusionId = newId(seed++);
  items.push({
    id: conclusionId, kind: 'note', role: 'conclusion', color: 'pink',
    text: conclusionText, x: 640, y: 40, createdAt: nowIso, updatedAt: nowIso,
  });
  claims.push({ id: conclusionId, text: conclusionText, role: 'conclusion', evidenceStrength: 0 });

  // 解釈カード（中列）— 見出しを結論へ derives でつなぐ
  interpretations.forEach((h, i) => {
    const id = newId(seed++);
    items.push({
      id, kind: 'note', role: 'interpretation', color: 'blue',
      text: h.text, x: 340, y: 40 + i * 150, createdAt: nowIso, updatedAt: nowIso,
    });
    claims.push({ id, text: h.text, role: 'interpretation', refs: [h.index] });
    edges.push({
      id: newId(seed++), source: id, target: conclusionId, relation: 'derives',
      label: '記事の論旨', createdAt: nowIso, updatedAt: nowIso,
    });
  });

  // 根拠カード（左列）— 直近の解釈（なければ結論）へ supports でつなぐ
  const anchorForEvidence = items.find((it) => it.role === 'interpretation')?.id || conclusionId;
  rankedEvidence.forEach((e, i) => {
    const id = newId(seed++);
    items.push({
      id, kind: 'quote', role: 'evidence', color: 'yellow',
      text: e.s, x: 40, y: 40 + i * 130,
      refType: articleId ? 'article' : undefined,
      refId: articleId || undefined,
      refTitle: title || undefined,
      createdAt: nowIso, updatedAt: nowIso,
    });
    claims.push({ id, text: e.s, role: 'evidence', evidenceStrength: clamp01(e.score), refs: [e.index] });
    edges.push({
      id: newId(seed++), source: id, target: anchorForEvidence, relation: 'supports',
      label: e.score > 0.5 ? 'データで裏づけ' : '記述で支持', createdAt: nowIso, updatedAt: nowIso,
    });
  });

  // ── 多視点スコア（テキスト統計から概算） ──
  const numericHits = (plainText.match(/\d/g) || []).length;
  const listHits = (bodyMarkdown.match(/^[-*]\s+/gm) || []).length;
  const avgEvidence = rankedEvidence.length
    ? rankedEvidence.reduce((a, b) => a + b.score, 0) / rankedEvidence.length : 0;
  const scores: InsightScores = {
    logic: clamp01(0.35 + Math.min(0.5, edges.length * 0.06)),
    evidence: clamp01(0.2 + avgEvidence * 0.6 + Math.min(0.2, numericHits * 0.01)),
    novelty: clamp01(0.3 + Math.min(0.4, headings.length * 0.08)),
    falsifiability: clamp01(0.2 + Math.min(0.5, numericHits * 0.015)),
    clarity: clamp01(0.4 + Math.min(0.4, (headings.length + listHits) * 0.05)),
    applicability: clamp01(0.3 + Math.min(0.5, listHits * 0.05 + avgEvidence * 0.3)),
  };

  // 結論の evidenceStrength を根拠の平均で更新（パネル表示用）
  claims[0].evidenceStrength = clamp01(avgEvidence);

  const summary =
    (excerpt?.trim() || sentences[0]?.s || plainText.slice(0, 120)).slice(0, 200);

  return {
    id: `insight_${Date.now().toString(36)}_${Math.floor((Date.now() % 46656)).toString(36)}`,
    articleId: articleId || null,
    sourceTitle: title || '（無題の記事）',
    sourceUrl: sourceUrl || null,
    sourceExcerpt: plainText.slice(0, 800),
    summary,
    claims,
    graph: { items, edges },
    scores,
    keywords: extractKeywords(plainText),
    engine: 'mock',
    ragIngestedAt: null,
    authorUid,
    generatedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
