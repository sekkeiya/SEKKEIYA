// Phase A の橋渡し用・軽量インテント shim。
// 仕様: docs/10_sekkeiya_chat_spec.md（Phase A）。
//
// バックエンド `proposeDesktopAction`（外部・Gemini）はまだサイト編集ツールを返さないため、
// SEKKEIYA Chat → ProjectSite の接続を「既存の単発フローのまま」実証するための暫定パーサ。
// 自然言語から「セクション追加 / 本文生成」の単発操作だけを拾い、SECTION_ADD / SECTION_UPDATE へ写像する。
//
// ※ Phase B で server 側 `agentTurn`（tool-calling ループ）に置換される前提の stopgap。
//    高度な意図解釈はここでは行わない（誤爆を避けるため保守的に判定）。

import type { SiteSectionType } from '../features/projects/types';

/** 日本語キーワード → SiteSectionType。先に来たものを優先（長い語を前に）。 */
const TYPE_KEYWORDS: { type: SiteSectionType; label: string; words: string[] }[] = [
  { type: 'hero', label: 'ヒーロー', words: ['ヒーロー', 'hero', 'キービジュアル', '表紙'] },
  { type: 'overview', label: '概要', words: ['概要', 'オーバービュー', 'overview', '導入'] },
  { type: 'concept', label: 'コンセプト', words: ['コンセプト', 'concept', '考え方'] },
  { type: 'layout', label: 'レイアウト', words: ['レイアウト', 'layout', '間取り', 'プラン図'] },
  { type: 'presentation', label: 'プレゼン', words: ['プレゼン', 'presentation', 'スライド', 'パース'] },
  { type: 'walkthrough', label: 'ウォークスルー', words: ['ウォークスルー', 'walkthrough', '動画', 'ムービー'] },
  { type: 'diagram', label: 'ダイアグラム', words: ['ダイアグラム', 'diagram', '配置図', '環境図'] },
  { type: 'drawing', label: '図面', words: ['図面', 'drawing', '製図'] },
  { type: 'gallery', label: 'ギャラリー', words: ['ギャラリー', 'gallery', '写真', '画像群'] },
  { type: 'portfolio', label: 'ポートフォリオ', words: ['ポートフォリオ', 'portfolio', '作品集'] },
  { type: 'spec', label: 'スペック', words: ['スペック', 'spec', '仕様表', '諸元'] },
  { type: 'research', label: 'リサーチ', words: ['リサーチ', 'research', '敷地調査', '周辺調査'] },
  { type: 'target', label: 'ターゲット', words: ['ターゲット', 'target', 'ターゲット分析'] },
  { type: 'regulation', label: '法規', words: ['法規', 'regulation', '与条件', '建蔽率', '容積率'] },
  { type: 'process', label: '検討過程', words: ['検討過程', 'process', 'いきさつ', 'タイムライン'] },
  { type: 'zoning', label: 'ゾーニング', words: ['ゾーニング', 'zoning'] },
  { type: 'flow', label: '動線', words: ['動線', 'flow', '導線'] },
  { type: 'itemspec', label: 'アイテム', words: ['アイテムスペック', 'itemspec', '什器', '家具リスト'] },
  { type: 'comparison', label: '比較', words: ['プラン比較', 'comparison', '比較'] },
  { type: 'custom', label: 'カスタム', words: ['カスタム', 'custom', '自由', 'フリー'] },
];

const ADD_VERBS = /(追加|つくって|作って|作成|入れて|足して|加えて|新規|新設|setup|add)/i;
const BODY_NOUNS = /(本文|説明文|説明|文章|テキスト|コピー|リード文|紹介文|ステートメント)/;
const BODY_VERBS = /(書い|書く|生成|作っ|作る|作成|考え|入れ|埋め|まとめ|ドラフト)/;
const TARGET_SELECTED = /(選択中|今の|この|選んだ|現在の)/;

export interface SiteEditIntent {
  actionType: 'SECTION_ADD' | 'SECTION_UPDATE';
  payload: any;
  reply: string;
}

function detectType(text: string): { type: SiteSectionType; label: string } | null {
  for (const entry of TYPE_KEYWORDS) {
    if (entry.words.some(w => text.toLowerCase().includes(w.toLowerCase()))) {
      return { type: entry.type, label: entry.label };
    }
  }
  return null;
}

/**
 * 単発のサイト編集インテントを抽出する。該当しなければ null。
 * @param text             ユーザー発話
 * @param assistantMessage バックエンド LLM の生成テキスト（本文生成時の body 候補に流用）
 */
export function parseSiteEditIntent(text: string, assistantMessage: string): SiteEditIntent | null {
  const t = text.trim();
  if (!t) return null;

  const hit = detectType(t);
  const wantsBody = BODY_NOUNS.test(t) && BODY_VERBS.test(t);
  const wantsAdd = ADD_VERBS.test(t) && (/(セクション|section|ブロック|項目)/.test(t) || !!hit);

  // 1) 本文生成（SECTION_UPDATE）: 「概要の本文を書いて」「選択中のセクションに説明文を入れて」
  if (wantsBody) {
    const body = (assistantMessage || '').trim();
    if (!body) return null; // body 候補が無ければ写像しない
    const targetSelected = TARGET_SELECTED.test(t) || !hit;
    return {
      actionType: 'SECTION_UPDATE',
      payload: {
        targetType: targetSelected ? undefined : hit!.type,
        patch: { body },
      },
      reply: hit
        ? `「${hit.label}」セクションの本文を生成して反映しました。`
        : `選択中のセクションに本文を生成して反映しました。`,
    };
  }

  // 2) セクション追加（SECTION_ADD）: 「概要セクションを追加して」
  if (wantsAdd && hit) {
    return {
      actionType: 'SECTION_ADD',
      payload: { type: hit.type },
      reply: `「${hit.label}」セクションを追加しました。`,
    };
  }

  return null;
}
