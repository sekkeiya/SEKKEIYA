// 開いているチャットのスコープに応じたチャット候補（サジェスト）。
// docs/12 の操作モデルに沿い、「何を頼めばよいか」をユーザーに提示する。

import type { ChatScope } from '../../store/useAIChatStore';

export interface ChatSuggestion {
  /** チップ表示用の短いラベル。 */
  label: string;
  /** クリック時に入力欄へ投入する実際の文面。 */
  text: string;
}

export interface SuggestionContext {
  scope?: ChatScope;
  appScope?: string;        // セッションの子アプリ（'3dsd' 等）
  taskId?: string;          // = diagramId（タスクスコープ）
  activeAppScope?: string;  // 現在開いているワークスペースの子アプリ
  diagramTemplate?: string; // 開いている S.Diagram のテンプレ（sun/layout/site/env）
  activeWorkspaceType?: string; // 開いている子アプリのコード（'3dsl'/'3dsp'/… = workspaceType）
  // 右サイドに開いている AI パネル（プロジェクト/子アプリの上に重なる）
  isAIDriveOpen?: boolean;
  isAIRenderOpen?: boolean;
  isAI3DCreateOpen?: boolean;
}

// ─── S.Diagram: 新規作成サジェスト（子アプリ/プロジェクト共通で使える） ───
const DIAGRAM_CREATE: ChatSuggestion[] = [
  { label: '動線ダイアグラム', text: '平面図をアップするので、玄関→LDK→各室の動線ダイアグラムを作って。水回りは北にまとめて。' },
  { label: 'マッシング進化', text: 'ザハ・ハディド風に、直交ボリュームからフルイドな形態へ変化するマッシング進化ダイアグラムを作って。' },
  { label: '敷地・コンテキスト', text: '敷地図をアップするので、前面道路・周辺建物・歩行者/車のアクセスを示すサイトダイアグラムを作って。' },
  { label: '日照スタディ', text: '建物形状から、夏至と冬至の日照・影の落ち方を示す日照ダイアグラムを作って。' },
  { label: '環境（風・騒音）', text: '南西からの卓越風と前面道路の騒音を示す環境ダイアグラムを作って。' },
];

// ─── S.Diagram: 既存ダイアグラム編集サジェスト（タスクスコープ・テンプレ別） ───
const DIAGRAM_EDIT_COMMON: ChatSuggestion[] = [
  { label: 'スタイルをdarkに', text: 'スタイルを dark にして、見出しを大きくして。' },
  { label: '注記を追加', text: '主要なポイントにテキスト注記と矢印を追加して。' },
  { label: 'Manim動画で書き出し', text: 'この内容で Manim 動画（mp4）を書き出して。' },
];

const DIAGRAM_EDIT_BY_TEMPLATE: Record<string, ChatSuggestion[]> = {
  layout: [
    { label: '水回りを集約', text: '水回り（キッチン・浴室・洗面）を北側にまとめて。' },
    { label: '動線を強調', text: '玄関からLDKへのメイン動線を太く強調して。' },
    { label: 'ゾーンを追加', text: '個室（寝室）をもう1つ追加して、LDKと動線でつないで。' },
  ],
  massing: [
    { label: 'もっと有機的に', text: '形態をもっと有機的（フルイド）にして、うねりを強めて。' },
    { label: '循環動線を追加', text: 'ボリュームを貫く循環動線を1本追加して。' },
  ],
  sun: [
    { label: '夏至の正午', text: '夏至・正午の太陽位置で表示して、影を強調して。' },
    { label: '一日の動きを', text: '日の出から日没まで太陽の動きをアニメーションさせて。' },
  ],
  site: [
    { label: 'アクセスを追加', text: '南側の前面道路から歩行者アクセスと車寄せを追加して。' },
    { label: '緑地を配置', text: '北側に緑地、東側に隣家を配置して。' },
  ],
  env: [
    { label: '卓越風を変更', text: '卓越風を南東からに変えて、風の流れを表示して。' },
    { label: '騒音源を追加', text: '前面道路と東側の隣家を騒音源として追加して。' },
  ],
};

const PROJECT_GENERAL: ChatSuggestion[] = [
  { label: 'AIタスクを登録', text: 'このプロジェクトで定例の作業を自動実行する AIタスクを登録したい。内容と実行タイミングを一緒に決めて。' },
  { label: '紹介サイトを作る', text: 'このプロジェクトの紹介サイトのたたき台を作って。' },
  { label: '動線図を作る', text: 'S.Diagram で、平面図から動線ダイアグラムを作って。' },
  { label: 'プレゼン構成', text: 'プレゼンテーションの構成（章立て）を提案して。' },
];

const ACCOUNT_GENERAL: ChatSuggestion[] = [
  { label: 'ポートフォリオ構成', text: 'ポートフォリオサイトの構成を提案して。' },
  { label: 'Worksを整える', text: 'Works に最新のプロジェクトを並べて、見やすく整えて。' },
  { label: '得意ジャンル', text: '公開モデルから得意ジャンルをまとめて紹介文を作って。' },
];

// ─── AI パネル（右サイドに重なるツール）別サジェスト ───
const AI_DRIVE: ChatSuggestion[] = [
  { label: '一括AI整理', text: 'AI Drive の未整理アセットを内容から判定して、タグ付け・フォルダ分けして。' },
  { label: '推定モデル', text: '選択中の画像から、家具の推定モデル候補を出して。' },
  { label: '重複を整理', text: '似ている画像・重複アセットをまとめて整理して。' },
  { label: 'プロジェクトへ紐付け', text: '選択中のアセットを適切なプロジェクト/フォルダへ紐付けて。' },
];

const AI_RENDER: ChatSuggestion[] = [
  { label: '外観パース', text: 'このベース画像を、夕景の温かい光で外観パース風にレンダリングして。' },
  { label: '内観イメージ', text: '木質系の素材で、自然光あふれる内観イメージにレンダリングして。' },
  { label: '素材を変える', text: '外壁をコンクリート打ち放しに変えてレンダリングして。' },
  { label: '人と植栽を追加', text: '前景に植栽と歩く人を足して、スケール感を出して。' },
];

const AI_3D_CREATE: ChatSuggestion[] = [
  { label: '画像から一括3D生成', text: '画像から3Dモデルを生成したい。' },
  { label: '家具を3D化', text: 'この家具画像から、配置用の3Dメッシュを生成して。' },
  { label: '高品質で生成', text: 'Pro/高品質モードで、ディテール重視の3Dモデルを生成して。' },
  { label: 'Workspaceに配置', text: '生成したモデルを現在のWorkspaceに配置して。' },
  { label: 'S.Modelsに保存', text: '生成したモデルを S.Models に保存して、タグを付けて。' },
];

// ─── その他の子アプリ別サジェスト（開いている子アプリのコード=workspaceType で判定）───
const SUBAPP_BY_APPSCOPE: Record<string, ChatSuggestion[]> = {
  '3dsl': [ // S.Layout
    { label: '自動レイアウト', text: 'このプロジェクトのレイアウトを自動で作成して。' },
    { label: '部屋を指定して配置', text: 'リビング 5000×4000mm にルールベースで家具を自動配置して。' },
    { label: 'Optionを作る', text: '現在のPlanを複製して、水回りを東に寄せたOptionを作って。' },
    { label: '家具を選定', text: 'S.Models の家具を探して LDK 向けの候補を提案して。' },
  ],
  '3dsp': [ // S.Presentations
    { label: 'プレゼン構成', text: 'このプロジェクトのプレゼン構成（章立て）を提案して。' },
    { label: '表紙を作る', text: 'プロジェクト名と概要を入れた表紙スライドを作って。' },
    { label: '画像を流し込む', text: 'AI Drive の画像をスライドに流し込んで、レイアウトを整えて。' },
  ],
  '3dsr': [ // S.Drawing
    { label: '図面を整理', text: 'アップした図面をセットごとに整理して、命名を統一して。' },
    { label: '寸法を補完', text: '主要な開口と家具に寸法線を追加して。' },
    { label: '共有リンク', text: 'この図面セットの共有リンクを作って。' },
  ],
  '3dsi': [ // S.Image
    { label: '3Dモデルを生成', text: '画像から3Dモデルを生成したい。' },
    { label: 'パースを整理', text: 'パース・動画・AI画像を種類ごとに整理してタグ付けして。' },
    { label: 'バリエーション', text: 'このパースから、時間帯違いのバリエーションを作って。' },
    { label: 'Galleryへ公開', text: '選んだ画像を Gallery に公開用として整えて。' },
  ],
  '3dss': [ // S.Models
    { label: 'モデルを探す', text: '北欧系のダイニングチェアのモデルを探して。' },
    { label: 'タグを整える', text: '未整理のモデルにカテゴリとタグを付けて。' },
    { label: 'AIで3D生成', text: '手持ちの家具画像から3Dモデルを生成して登録して。' },
  ],
  '3dsq': [ // S.Quest
    { label: 'コースを探す', text: '初心者向けのレイアウト基礎コースを探して。' },
    { label: '学習プラン', text: '私のレベルに合わせた学習プランを提案して。' },
  ],
  '3dsf': [ // S.Portfolio
    { label: 'PDFを構成', text: '代表作をめくって見せるポートフォリオの構成を提案して。' },
    { label: '作品を並べる', text: 'プロジェクトを魅力的な順に並べ替えて。' },
  ],
  '3dsk': [ // S.Library
    { label: '資料を要約', text: '登録した本/PDFの要点を要約して。' },
    { label: '資料を探す', text: '法規・寸法のリファレンス資料を探して。' },
  ],
  '3dsc': [ // S.Create
    { label: '3Dを生成', text: '画像から配置用の3Dメッシュを生成して。' },
    { label: 'コンセプト模型', text: 'コンセプトを表すスタディ模型のアイデアを出して。' },
  ],
  '3dsmt': [ // S.Material
    { label: 'テクスチャからマテリアル生成', text: 'S.Image のテクスチャ画像からマテリアルを一括生成して。' },
    { label: 'ローカルから一括生成', text: 'ローカル素材のテクスチャフォルダからマテリアルを生成して。' },
    { label: '素材を整理', text: 'マテリアルのカテゴリとタグを整理して。' },
  ],
};

/** スコープ文脈に応じた候補を返す（最大6件目安）。 */
export function getChatSuggestions(ctx: SuggestionContext): ChatSuggestion[] {
  // ① AI パネル（プロジェクト/子アプリの上に重なるツール）を最優先。
  //    開いている＝ユーザーがそのツールを操作中なので、専用候補を出す。
  if (ctx.isAIRenderOpen) return AI_RENDER;
  if (ctx.isAI3DCreateOpen) return AI_3D_CREATE;
  if (ctx.isAIDriveOpen) return AI_DRIVE;

  // 現在開いている子アプリのコード（workspaceType を優先、なければ起動ペイロード）
  const app = ctx.activeWorkspaceType || ctx.activeAppScope;

  const isDiagramTask =
    ctx.scope === 'task' && (ctx.appScope === '3dsd' || app === '3dsd');
  const isDiagramSubapp =
    ctx.appScope === '3dsd' || app === '3dsd';

  // ② ダイアグラムを開いている（タスク）→ 編集サジェスト
  if (isDiagramTask) {
    const tmpl = ctx.diagramTemplate && DIAGRAM_EDIT_BY_TEMPLATE[ctx.diagramTemplate];
    return [...(tmpl ?? []), ...DIAGRAM_EDIT_COMMON];
  }

  // ③ S.Diagram の子アプリ/ワークスペースにいる → 新規作成サジェスト
  if (isDiagramSubapp) {
    return DIAGRAM_CREATE;
  }

  // ④ その他の子アプリ（開いている子アプリのコードで判定）
  if (app && SUBAPP_BY_APPSCOPE[app]) {
    return SUBAPP_BY_APPSCOPE[app];
  }

  // ⑤ アカウントサイト（マイページ）
  if (ctx.scope === 'account' || ctx.scope === 'global') {
    return [...ACCOUNT_GENERAL, ...DIAGRAM_CREATE.slice(0, 2)];
  }

  // ⑥ プロジェクトサイト（既定）
  return [...PROJECT_GENERAL, ...DIAGRAM_CREATE.slice(0, 2)];
}
