// S.Library (3DSK) — ルールベースの自動カテゴライズ（完全ローカル・クラウド送信なし）。
//
// S.Models の smartCategoryEngine と同じ思想で、ファイル名＋（PDF なら先頭ページの）
// 抽出テキストからキーワードを照合し、建築・設計ドメインの知識カテゴリ
// （法規 / 構造 / 意匠 / 設備 / 環境 / 積算 / その他）と候補タグを推定する。
// AI 分類（クラウド）はあくまで任意ボタン。これはその前段の即時分類。

import { type DskCategory } from '../types';

interface Keyword {
  /** 照合語（日本語は部分一致、ASCII 単語は語境界一致） */
  kw: string;
  category: DskCategory;
}

// 具体語ほど優先したいので、後段で長さ降順にソートする。
const KEYWORDS: Keyword[] = [
  // 法規 ---------------------------------------------------------
  ...['建築基準法', '法規', '法令', '条例', '確認申請', '防火', '耐火', '容積率', '建ぺい率',
    '斜線制限', '日影', '用途地域', '消防法', 'バリアフリー法', '都市計画法', '基準法',
    'building code', 'regulation', 'compliance', 'zoning', 'fire code'].map((kw) => ({ kw, category: '法規' as DskCategory })),

  // 構造 ---------------------------------------------------------
  ...['構造計算', '構造設計', '耐震', '制震', '免震', '構造', '梁', '柱', '基礎', '杭',
    '鉄骨', '鉄筋', 'RC造', 'SRC', '木造', '荷重', '応力', '許容応力度', '保有水平耐力',
    'structural', 'structure', 'seismic', 'rebar', 'foundation'].map((kw) => ({ kw, category: '構造' as DskCategory })),

  // 意匠 ---------------------------------------------------------
  ...['意匠', '平面図', '立面図', '断面図', '矩計', '展開図', '詳細図', 'ディテール',
    '仕上表', '仕上げ', '建具表', 'デザイン', '設計図', 'プラン', 'パース',
    'design', 'elevation', 'floor plan', 'section', 'detail', 'finish'].map((kw) => ({ kw, category: '意匠' as DskCategory })),

  // 設備 ---------------------------------------------------------
  ...['設備', '空調', '換気', '給排水', '衛生設備', '電気設備', '照明計画', '配管', '配線',
    'ダクト', '受変電', '弱電', '機械設備', 'HVAC', 'MEP', 'plumbing', 'electrical',
    'mechanical', 'duct', 'piping'].map((kw) => ({ kw, category: '設備' as DskCategory })),

  // 環境 ---------------------------------------------------------
  ...['環境', '省エネ', '断熱', '採光', '通風', '日射', '温熱環境', '結露', '遮音',
    '環境性能', '一次エネルギー', 'CASBEE', 'BELS', 'ZEH', 'LCCM', 'カーボン',
    'sustainability', 'energy', 'insulation', 'daylight', 'thermal', 'eco'].map((kw) => ({ kw, category: '環境' as DskCategory })),

  // 積算 ---------------------------------------------------------
  ...['積算', '見積', '見積書', 'コスト', '工事費', '数量', '数量拾い', '内訳書',
    '単価', '予算', '原価', 'estimate', 'cost', 'quantity', 'budget', 'boq'].map((kw) => ({ kw, category: '積算' as DskCategory })),

  // 素材・建材（マテリアル / テクスチャ / 仕上材カタログ） ----------
  ...['素材', '建材', 'マテリアル', 'テクスチャ', '質感', '仕上材', '仕上げ材', 'サンプル帳',
    'タイル', 'フローリング', '床材', '壁材', 'クロス', '壁紙', '塗装', '左官', '石材', '木材',
    '突板', '金属', 'メタル', 'ガラス', '木目', '石目', 'カラーバリエーション',
    'material', 'texture', 'finish', 'tile', 'flooring', 'laminate', 'veneer',
    'wood', 'stone', 'metal', 'fabric'].map((kw) => ({ kw, category: '素材・建材' as DskCategory })),

  // カタログ（製品総合カタログ。素材カタログより一般的な製品資料） ----
  ...['カタログ', '総合カタログ', '製品カタログ', 'パンフレット', '製品資料', '仕様書',
    'スペックシート', 'select', 'catalog', 'catalogue', 'brochure', 'datasheet',
    'spec sheet', 'lineup'].map((kw) => ({ kw, category: 'カタログ' as DskCategory })),

  // 家具・什器 ---------------------------------------------------
  ...['家具', '什器', '造作家具', 'チェア', 'テーブル', 'デスク', 'ソファ', '収納',
    'キャビネット', '照明器具', 'furniture', 'chair', 'table', 'desk', 'sofa',
    'cabinet', 'fixture'].map((kw) => ({ kw, category: '家具・什器' as DskCategory })),
];

const SORTED = [...KEYWORDS].sort((a, b) => b.kw.length - a.kw.length);

const isAscii = (s: string) => /^[\x00-\x7f]+$/.test(s);

/** ファイル名・テキストから語境界トークン集合を作る（ASCII 完全一致照合用）。 */
function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2),
  );
}

export interface RuleClassifyResult {
  category: DskCategory;
  tags: string[];
  /** 1件でもキーワードに当たったか（外れたら呼び出し側で既定維持の判断に使う） */
  matched: boolean;
}

/**
 * ファイル名＋抽出テキストからカテゴリと候補タグを推定する。
 * - カテゴリ: 最多ヒットのカテゴリ。ヒット 0 件なら 'その他'（matched=false）。
 * - タグ: ヒットしたキーワード（最大 6 件、日本語優先で重複排除）。
 */
export function classifyKnowledge(input: { fileName?: string; text?: string }): RuleClassifyResult {
  const hay = `${input.fileName || ''} ${input.text || ''}`;
  const lower = hay.toLowerCase();
  const tokens = tokenSet(hay);

  const counts: Record<string, number> = {};
  const tags: string[] = [];
  const seenTags = new Set<string>();

  for (const { kw, category } of SORTED) {
    const hit = isAscii(kw) && !kw.includes(' ') ? tokens.has(kw.toLowerCase()) : lower.includes(kw.toLowerCase());
    if (!hit) continue;
    counts[category] = (counts[category] || 0) + 1;
    const tagKey = kw.toLowerCase();
    if (!seenTags.has(tagKey) && tags.length < 6) {
      seenTags.add(tagKey);
      tags.push(kw);
    }
  }

  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const category = (best?.[0] as DskCategory) || 'その他';
  // タグは日本語を前に寄せる（検索性のため）
  tags.sort((a, b) => Number(isAscii(a)) - Number(isAscii(b)));

  return {
    // category は KEYWORDS が出力するバケット名そのまま（シード外の 'カタログ'/'家具・什器' も許容）。
    category,
    tags,
    matched: !!best,
  };
}
