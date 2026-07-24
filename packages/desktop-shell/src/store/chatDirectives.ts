// チャットの明示指定（/=アプリ、@=プロジェクト）。
//
// 補助機能: 何も指定しなければ従来どおり文脈（開いているタブ・キーワード・セッション）から
// 推測する。指定されたときだけ、推測をクライアント側の確定配線で上書きする——
// テキストのヒントに頼らず、keepSilos（ツール保証）・プレイブック注入・projectId 解決を
// 決定的に切り替えるのが肝（モデル任せにすると効かないことがある）。
//
// 入力欄（AIChatPanel）がユーザーの選択をメッセージ送信オプションに載せ、
// オーケストレーターが送信開始時に setTurnDirectives で「このターンの指定」として保持する。
// 毎送信で必ず上書きされるため、前ターンの指定が漏れて残ることはない。

/** 「/」で選べるアプリ指定の1件。 */
export interface AppDirective {
  key: string;
  /** パレット・チップに出す名前。 */
  label: string;
  /** パレットの補足説明。 */
  description: string;
  /** サーバーの silo 除外から保護するキー（agentTurn の SILOS と一致させる）。 */
  silos: string[];
  /** モデルへ渡す一行（[明示指定] ブロックに載る）。 */
  hint: string;
}

export const APP_DIRECTIVES: AppDirective[] = [
  {
    key: 'mindmap', label: 'マインドマップ',
    description: 'Research & Memo のマインドマップにトピックを生やす',
    silos: ['research'],
    hint: 'mindmap_get で現状を見て、mindmap_add_topics 等のマインドマップツールで実行すること。',
  },
  {
    key: 'board', label: 'リサーチボード（ノード）',
    description: 'Research & Memo のノード画面（論証グラフ）にカードを置く',
    silos: ['research'],
    hint: 'research_board_get で現状を見て、research_board_* のカード・エッジツールで実行すること。',
  },
  {
    key: 'layout', label: 'S.Layout',
    description: '3D レイアウト（家具配置・間取り・レンダリング）を操作する',
    silos: ['layout'],
    hint: 'layout_* / run_auto_layout / render_layout などのレイアウトツールで実行すること。',
  },
  {
    key: 'slide', label: 'S.Slide',
    description: 'プレゼン資料（スライド）を作成・編集する',
    silos: ['slide'],
    hint: 'edit_presentation / build_slides_from_layout などのプレゼンツールで実行すること。',
  },
  {
    key: 'blog', label: 'S.Blog',
    description: '記事の下書き・編集・参照',
    silos: ['blog'],
    hint: 'blog_list / blog_get / create_blog_draft などの記事ツールで実行すること。',
  },
  {
    key: 'image', label: 'S.Image（画像生成）',
    description: 'コンセプト・ムードイメージを AI で生成する',
    silos: [],
    hint: '画像生成ツール（generate_image 系。ボード配置なら research_board_generate_image）で実行すること。',
  },
  {
    key: 'knowledge', label: '知識（S.Library）',
    description: 'S.Library・RAG から知識を検索・参照する',
    silos: ['library'],
    hint: 'search_knowledge / library_* の知識ツールで実行すること。',
  },
  {
    key: 'drive', label: 'SEKKEIYA Drive',
    description: 'Drive の資産（画像・モデル・ファイル）を探す・使う',
    silos: ['drive'],
    hint: 'list_drive_assets / search_drive の Drive ツールで実行すること。',
  },
];

export const APP_DIRECTIVE_MAP: Map<string, AppDirective> =
  new Map(APP_DIRECTIVES.map(d => [d.key, d]));

/** 「@」で選ぶプロジェクト指定。 */
export interface ProjectDirective {
  id: string;
  name: string;
}

/** 1メッセージ（＝1ターン）に付く明示指定。 */
export interface TurnDirectives {
  app?: string;
  project?: ProjectDirective;
}

// このターンの指定。sendMessageToOrchestrator が送信のたびに必ず上書きする
// （指定なしの送信では {} が入るので、前ターンの指定が漏れ残ることはない）。
let turnDirectives: TurnDirectives = {};

export function setTurnDirectives(d: TurnDirectives): void {
  turnDirectives = d ?? {};
}

export function getTurnDirectives(): TurnDirectives {
  return turnDirectives;
}
