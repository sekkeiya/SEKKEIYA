// 法規ライブラリ — e-Gov 法令API v2 の薄いラッパー。
// 通信は Rust 側 fetch_egov_api（laws.e-gov.go.jp/api/2/ 固定・CORS回避）を経由する。
// 仕様: docs/22_law_library_spec.md

import { fetchEgovApi } from '../api/knowledgeApi';
import type { LawNode } from './lawParse';

/** /laws の1件（law_info + revision_info を平坦化した要約）。 */
export interface EgovLawSummary {
  lawId: string;
  /** 法令番号（例「昭和二十五年法律第二百一号」） */
  lawNum: string;
  lawTitle: string;
  /** 「Act」「CabinetOrder」等 */
  lawType?: string;
  promulgationDate?: string;
  /** 現行版の改正施行日（amendment_enforcement_date）。改正検知のキー。 */
  revisionDate?: string;
}

/** /laws のアイテム（law_info / current_revision_info のネスト）を平坦化する。 */
function normalizeLawItem(item: any): EgovLawSummary | null {
  const info = item?.law_info ?? {};
  const rev = item?.current_revision_info ?? item?.revision_info ?? {};
  const lawId = info.law_id ?? item?.law_id;
  if (!lawId) return null;
  return {
    lawId: String(lawId),
    lawNum: String(info.law_num ?? item?.law_num ?? ''),
    lawTitle: String(rev.law_title ?? item?.law_title ?? ''),
    lawType: info.law_type ?? undefined,
    promulgationDate: info.promulgation_date ?? undefined,
    revisionDate: rev.amendment_enforcement_date ?? undefined,
  };
}

/** 法令名で検索（部分一致・最大20件）。 */
export async function searchLawsByTitle(title: string): Promise<EgovLawSummary[]> {
  const raw = await fetchEgovApi(`laws?law_title=${encodeURIComponent(title.trim())}&limit=20`);
  const data = JSON.parse(raw);
  return ((data?.laws ?? []) as any[]).map(normalizeLawItem).filter((x): x is EgovLawSummary => !!x);
}

/** 法令番号で1件特定（更新確認用・軽量）。 */
export async function searchLawByNum(lawNum: string): Promise<EgovLawSummary | null> {
  const raw = await fetchEgovApi(`laws?law_num=${encodeURIComponent(lawNum.trim())}&limit=5`);
  const data = JSON.parse(raw);
  const list = ((data?.laws ?? []) as any[]).map(normalizeLawItem).filter((x): x is EgovLawSummary => !!x);
  return list[0] ?? null;
}

/** 全文取得の結果。 */
export interface EgovLawData {
  lawInfo: { law_id: string; law_num: string; promulgation_date?: string };
  revisionInfo: { law_title: string; amendment_enforcement_date?: string };
  fullText: LawNode;
}

/** 法令IDで全文（JSONツリー）を取得。建築基準法クラスで1〜2MB程度。 */
export async function fetchLawData(lawId: string): Promise<EgovLawData> {
  const raw = await fetchEgovApi(`law_data/${encodeURIComponent(lawId)}?law_full_text_format=json`);
  const data = JSON.parse(raw);
  if (!data?.law_full_text) throw new Error('e-Gov API の応答に law_full_text がありません');
  return {
    lawInfo: data.law_info ?? {},
    revisionInfo: data.revision_info ?? {},
    fullText: data.law_full_text as LawNode,
  };
}

/** e-Gov 法令検索の閲覧ページ URL（sourceUrl / 出典リンク用）。 */
export function egovLawPageUrl(lawId: string): string {
  return `https://laws.e-gov.go.jp/law/${encodeURIComponent(lawId)}`;
}
