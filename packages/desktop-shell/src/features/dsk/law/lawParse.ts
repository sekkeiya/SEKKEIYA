// 法規ライブラリ — e-Gov 法令API v2 の law_full_text（JSONツリー）を条文単位に構造化する。
// 仕様: docs/22_law_library_spec.md
//
// law_full_text は {tag, attr, children} の再帰ツリー（children は文字列 or ノードの混在）。
// Law > LawBody > MainProvision > Part/Chapter/Section > Article > Paragraph > Item > Subitem1..3
// 本則（MainProvision）のみを対象とし、附則（SupplProvision）・別表（AppdxTable）は Phase 1 では扱わない。

/** e-Gov law_full_text のノード。 */
export interface LawNode {
  tag: string;
  attr?: Record<string, string>;
  children?: (LawNode | string)[];
}

/** 条単位の構造化レコード。RAG チャンク・条文検索の最小ユニット。 */
export interface LawArticle {
  /** attr.Num（"26"、枝番は "26_2"） */
  num: string;
  /** 「第二十六条」 */
  title: string;
  /** 「（防火壁等）」 */
  caption?: string;
  /** 編/章/節タイトルの階層（TOC・出典表示用） */
  path: string[];
  /** 項・号を全角インデント付きで平文化した条全文 */
  text: string;
}

/** 1法令の条文構造。エントリフォルダの law.json として保存する。 */
export interface LawDoc {
  lawId: string;
  /** 法令番号（例「昭和二十五年法律第二百一号」） */
  lawNum: string;
  lawTitle: string;
  /** 取り込んだ版の改正施行日（amendment_enforcement_date） */
  revisionDate?: string;
  /** 取得日時（RFC3339） */
  fetchedAt: string;
  /** 本則の全条文 */
  articles: LawArticle[];
}

const CONTAINER_TAGS = new Set(['Part', 'Chapter', 'Section', 'Subsection', 'Division']);

const isNode = (c: LawNode | string | undefined | null): c is LawNode =>
  typeof c !== 'string' && !!c && typeof c.tag === 'string';

const kids = (n: LawNode): LawNode[] => (n.children || []).filter(isNode);

/** ノード配下のテキストを平文化。Rt（ルビ振り仮名）は除外、Column（多欄）は全角空白で連結。 */
function textOf(n: LawNode | string | undefined): string {
  if (n == null) return '';
  if (typeof n === 'string') return n;
  if (n.tag === 'Rt') return '';
  const parts: string[] = [];
  for (const c of n.children || []) {
    const t = typeof c === 'string' ? c : textOf(c);
    if (!t) continue;
    if (isNode(c) && c.tag === 'Column' && parts.length > 0) parts.push('　');
    parts.push(t);
  }
  return parts.join('');
}

/** 号（Item / Subitem1..3）を再帰的に行リストへ展開する。 */
function renderItems(parent: LawNode, depth: number, out: string[]): void {
  for (const c of kids(parent)) {
    if (!/^(Item|Subitem[123])$/.test(c.tag)) continue;
    const title = textOf(kids(c).find((k) => k.tag === `${c.tag}Title`));
    const sent = textOf(kids(c).find((k) => k.tag === `${c.tag}Sentence`));
    const indent = '　'.repeat(depth + 1);
    out.push(`${indent}${title}${title ? '　' : ''}${sent}`);
    renderItems(c, depth + 1, out);
  }
}

/** 1条を（項番号＋本文＋号インデント）の平文へ。 */
function renderArticle(article: LawNode): { title: string; caption?: string; text: string } {
  const caption = textOf(kids(article).find((k) => k.tag === 'ArticleCaption')) || undefined;
  const title = textOf(kids(article).find((k) => k.tag === 'ArticleTitle'));
  const lines: string[] = [];
  for (const p of kids(article).filter((k) => k.tag === 'Paragraph')) {
    // 第1項は ParagraphNum が空（法令XML標準の慣行）
    const num = textOf(kids(p).find((k) => k.tag === 'ParagraphNum'));
    const sent = textOf(kids(p).find((k) => k.tag === 'ParagraphSentence'));
    lines.push(`${num}${num ? '　' : ''}${sent}`);
    renderItems(p, 0, lines);
  }
  return { title, caption, text: lines.join('\n') };
}

/** 編/章/節をトラッキングしながら条を収集する。 */
function walkContainers(node: LawNode, pathTitles: string[], out: LawArticle[]): void {
  for (const c of kids(node)) {
    if (c.tag === 'Article') {
      const r = renderArticle(c);
      out.push({
        num: String(c.attr?.Num ?? ''),
        title: r.title,
        caption: r.caption,
        path: [...pathTitles],
        text: r.text,
      });
    } else if (CONTAINER_TAGS.has(c.tag)) {
      const title = textOf(kids(c).find((k) => k.tag === `${c.tag}Title`));
      walkContainers(c, title ? [...pathTitles, title] : pathTitles, out);
    }
  }
}

/**
 * law_full_text（Law ルートノード）→ LawDoc。
 * 検証済み: 建築基準法（2026-05-27版）で本則291条を欠落ゼロで抽出。
 */
export function parseLawFullText(
  fullText: LawNode,
  meta: { lawId: string; lawNum: string; lawTitle: string; revisionDate?: string },
): LawDoc {
  const body = kids(fullText).find((c) => c.tag === 'LawBody');
  if (!body) throw new Error('法令データの解析に失敗しました（LawBody が見つかりません）');
  const main = kids(body).find((c) => c.tag === 'MainProvision');
  if (!main) throw new Error('法令データの解析に失敗しました（MainProvision が見つかりません）');
  const articles: LawArticle[] = [];
  walkContainers(main, [], articles);
  if (articles.length === 0) throw new Error('条文を1件も抽出できませんでした');
  return {
    lawId: meta.lawId,
    lawNum: meta.lawNum,
    lawTitle: meta.lawTitle,
    revisionDate: meta.revisionDate,
    fetchedAt: new Date().toISOString(),
    articles,
  };
}
