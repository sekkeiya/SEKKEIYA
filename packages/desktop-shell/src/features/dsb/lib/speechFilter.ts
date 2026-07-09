/**
 * speechFilter — 記事読み上げ時に「読む必要のない文」を判定する。
 *
 * ArchDaily 等の記事本文には、読み上げると耳障りなだけの行が混ざる:
 * - 操作導線: "Save this picture!" / シェアボタンの文言
 * - クレジット: "© Photographer" / "Photographs: ..." / 写真提供
 * - メタデータ: "建築家：..." "面積：25528㎡" "竣工年：2024"（翻訳後も同型）
 * これらを**表示はそのまま**に、読み上げキューからだけ除外する。
 * 判定は保守的に（誤って本文を飛ばすくらいなら読んでしまう方がよい）。
 * 将来はAIに「朗読台本化」させる後段も考えられるが、まずは即時・無料のルールで。
 */

// 行頭のメタデータ・ラベル（英語原文/日本語訳の両方）。コロン等の区切りが続く形のみ。
const META_LABEL_RE = new RegExp(
  '^(?:' +
  [
    // EN（ArchDaily 定型）
    'architects?', 'lead architects?', 'design team', 'area', 'year', 'photographs?',
    'photography', 'manufacturers?', 'city', 'country', 'clients?', 'category',
    'curated by', 'text description provided by the architects?',
    // JA（翻訳後の定型）
    '建築家', '主任建築家', '設計(?:チーム)?', 'デザインチーム', '面積', '竣工年?', '完成年',
    '所在地', '都市', '国', '写真(?:家|撮影)?', '撮影', 'メーカー', 'クライアント', '施主',
    'カテゴリー?', 'キュレーション', 'キュレーター',
  ].join('|') +
  ')[\\s:：]',
  'i',
);

/** この文は読み上げをスキップしてよいか（表示には影響しない）。 */
export function isSpeechSkippable(sentence: string): boolean {
  const t = String(sentence || '').trim();
  if (!t) return true;
  // 操作導線・広告
  if (/^(save this picture!?|(この)?(画像|写真)を保存|share|シェア|advertisement|広告|sponsored|スポンサー)/i.test(t)) return true;
  // クレジット表記
  if (/^(©|photo(graph)?s?\s*(by|©|:)|courtesy of|via\s|image ©|写真提供|画像提供|提供[:：])/i.test(t)) return true;
  // メタデータ行（短い行のみ対象にして本文の誤爆を防ぐ）
  if (t.length <= 120 && (META_LABEL_RE.test(t) || /(の面積|竣工年|完成年)[はも]?[:：]/.test(t))) return true;
  // 記号・数値だけの断片（"25528 m²" など）
  if (/^[\d\s.,:;：、。・•·–—\-±²㎡m%()（）年]+$/.test(t)) return true;
  return false;
}
