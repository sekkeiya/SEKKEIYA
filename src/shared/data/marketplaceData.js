import icon3DSS from "@/assets/icons/share.png";
import icon3DSL from "@/assets/icons/layout.png";
import icon3DSC from "@/assets/icons/create.png";
import icon3DSP from "@/assets/icons/presents.png";
import icon3DSMT from "@/assets/icons/material.png";
import icon3DSD from "@/assets/icons/diagram.png";
import icon3DSR from "@/assets/icons/drawing.png";
import icon3DSI from "@/assets/icons/image.png";
import icon3DSM from "@/assets/icons/movie.png";
import icon3DSQ from "@/assets/icons/quest.png";
import icon3DSF from "@/assets/icons/books.png";
import icon3DSK from "@/assets/icons/library.png";
import icon3DSB from "@/assets/icons/blog.png";
import { PRODUCT_SLUGS } from "./productSlugs.mjs";
import { PRODUCT_CONTENT } from "./productContent.js";

export const SERVICE_CATEGORIES = [
  {
    id: "design",
    label: "DESIGN & 3D",
    subtitle: "空間をかたちにする",
    desc: "3Dモデルの共有・配置・生成・プレゼンまで、空間デザインの中核ワークフローを担うアプリ群。",
    themeColor: "#4A90E2",
  },
  {
    id: "document",
    label: "DRAWING & VISUAL",
    subtitle: "図面とビジュアル資料",
    desc: "ダイアグラム・図面・パース／AI画像・動画など、設計の意図を伝えるビジュアルドキュメントを管理するアプリ群。",
    themeColor: "#50E3C2",
  },
  {
    id: "growth",
    label: "LEARNING & SHOWCASE",
    subtitle: "学び、貯め、発信する",
    desc: "学習プラットフォーム・知識管理・ブログ・ポートフォリオ。スキルと知識を育てて発信するアプリ群。",
    themeColor: "#E24A9A",
  },
];

// 各サービスの LP 用コンテンツ:
//   catchphrase … LPヒーローの見出し（短く）
//   longDesc    … LPヒーローの本文 兼 meta description
//   seoTitle    … <title> 用のキーワード句（アプリ名以外の検索語で流入させる。
//                 「S.Layout｜{seoTitle} | SEKKEIYA」の形で出力される）
//   features    … LP「できること」カード（title + desc）
// メガメニュー / Marketplace カードは title / desc を使う。
const SERVICES = [
  // ── DESIGN & 3D ──────────────────────────────────────────────
  {
    id: "3dss",
    category: "design",
    title: "S.Model",
    desc: "3Dモデルをブラウザ上で高速に共有し、ウォークスルーや注釈付けでレビューできるクラウド共有アプリ。",
    color: "#34A853",
    icon: icon3DSS,
    status: "ACTIVE",
    path: "/app/share",
    workspaceId: "models",
    scope: "3dss",
    seoTitle: "3Dモデルをブラウザで共有・閲覧できるクラウドビューワ",
    catchphrase: "3Dモデルを、URLひとつで世界と共有。",
    longDesc:
      "BIM/CADの重たい3DモデルをWebGLでブラウザ上に軽量描画。アップロードすると自動でカテゴリ整理され、URLを送るだけで誰でもすぐに閲覧できます。マテリアルの切り替えやウォークスルーなど、閲覧体験そのものが提案になります。",
    features: [
      { title: "ブラウザだけで高速閲覧", desc: "専用ソフトは不要。リンクを開くだけで、クライアントも協力会社もすぐに3Dモデルを確認できます。" },
      { title: "アップロードで自動整理", desc: "家具・什器・建材などをアップロードすると自動でカテゴリ・タグ付け。探せるライブラリが自然に育ちます。" },
      { title: "マテリアル・コンフィギュレーター", desc: "部位ごとに複数のマテリアルを登録し、閲覧者がスウォッチでライブ切り替え。仕上げの検討がその場で進みます。" },
    ],
  },
  {
    id: "3dsl",
    category: "design",
    title: "S.Layout",
    desc: "登録済みの3Dアセットを使い、ブラウザ上で直感的に空間レイアウトを組み立てる配置シミュレータ。",
    color: "#E8542A",
    icon: icon3DSL,
    status: "ACTIVE",
    path: "/app/layout",
    workspaceId: "layout",
    scope: "3dsl",
    seoTitle: "間取り・家具配置を3Dでシミュレーションできるレイアウトツール",
    catchphrase: "AIと組み立てる、歩ける空間。",
    longDesc:
      "登録済みの3Dアセットをブラウザ上でレイアウトし、自動マテリアル・自動ライティング・自動アングルまでAIが伴走。完成した空間は一人称ウォークスルーで歩いて確かめ、そのまま客先用のプレゼンビューワとして共有できます。",
    features: [
      { title: "「自動○○」で一気に仕上げる", desc: "自動レイアウト・自動マテリアル・自動ライティングなど、時間のかかる工程をワンクリックで下ごしらえ。" },
      { title: "歩いて確かめるウォークスルー", desc: "一人称視点で空間の中を歩き、スケール感と動線を体感的に検証できます。" },
      { title: "プロ品質の自動アングル", desc: "不動産・雑誌・カタログなどの撮影スタイルでカメラアングルを自動生成。パース出力まで一直線。" },
      { title: "そのまま客先プレゼンへ", desc: "概要・間取り・ギャラリー・内観をまとめた鑑賞ビューワをWebで共有できます。" },
    ],
  },
  {
    id: "3dsc",
    category: "design",
    title: "S.Create",
    desc: "画像やテキストから独自の3Dアセットを素早く生成するAIモデリングジェネレーター。",
    color: "#F2C12E",
    icon: icon3DSC,
    status: "ACTIVE",
    path: "/app/create",
    workspaceId: "create",
    scope: "3dsc",
    seoTitle: "画像・テキストから3Dモデルを作るAI 3D生成ツール",
    catchphrase: "画像とテキストから、3Dアセットを。",
    longDesc:
      "参考画像やテキストプロンプトからAIが3Dモデルを生成。生成したアセットはそのままライブラリに登録され、S.Layoutの空間に配置できます。「見つからないなら、つくる」を当たり前にするジェネレーターです。",
    features: [
      { title: "画像から3D生成", desc: "商品写真やスケッチ1枚から、配置可能な3Dモデルを自動生成します。" },
      { title: "テキストからも生成", desc: "「北欧風の1人掛けソファ」のような言葉から、イメージに近いアセットを提案します。" },
      { title: "エコシステム直結", desc: "生成物はワンクリックでライブラリ登録。S.Layoutへの配置までシームレスにつながります。" },
    ],
  },
  {
    id: "3dsp",
    category: "design",
    title: "S.Slide",
    desc: "シネマティックなスクロール型プレゼンテーションを自動構築・配信するPresentsビルダー。",
    color: "#D2A24E",
    icon: icon3DSP,
    status: "BETA",
    path: "/app/presents",
    workspaceId: "presents",
    scope: "3dsp",
    seoTitle: "建築・インテリアの3Dプレゼンテーション作成ツール",
    catchphrase: "スクロールするだけで、空間が動き出す。",
    longDesc:
      "シネマティックなスクロール型プレゼンテーションを自動構築。3Dシーンやパースを織り交ぜたストーリーを、URLひとつで配信できます。重いファイルの受け渡しはもう必要ありません。",
    features: [
      { title: "スクロール駆動の演出", desc: "縦にスクロールするだけでカメラが動き、シーンが切り替わる没入型プレゼン。" },
      { title: "AIによる自動構築", desc: "成果物を選ぶだけで、構成・レイアウト・演出のたたき台をAIが用意します。" },
      { title: "URLで配信", desc: "リンクを共有するだけでプレゼンが届く。閲覧側の環境構築はゼロです。" },
    ],
  },
  {
    id: "3dsmt",
    category: "design",
    title: "S.Material",
    desc: "木材・金属・ファブリックなどのマテリアルを在庫として管理し、家具や空間へワンクリックで適用する素材管理アプリ。",
    color: "#8B5E3C",
    icon: icon3DSMT,
    status: "IN DEVELOPMENT",
    path: "/workspace",
    workspaceId: "material",
    scope: "3dsmt",
    seoTitle: "建材・マテリアルをライブラリ管理して3Dに適用する素材ツール",
    catchphrase: "素材を、資産として管理する。",
    longDesc:
      "木材・金属・ファブリックといったマテリアルを「素材在庫」として一元管理。S.Layoutの空間やS.Modelの家具にワンクリックで張り替え、どこに何を使ったかのバインディングまで記録します。仕上げ検討の記憶が、次のプロジェクトの資産になります。",
    features: [
      { title: "素材在庫ライブラリ", desc: "手持ちのマテリアルをカテゴリ・用途（床/壁/家具など）で整理して、いつでも引き出せる在庫に。" },
      { title: "ワンクリック張り替え", desc: "S.Modelの家具詳細やS.Layoutのプロパティから、部位を選んでその場で仕上げを差し替え。" },
      { title: "適用の記録（バインディング）", desc: "「どのモデルのどの部位に何を使ったか」を永続化。プロジェクトを跨いで再利用できます。" },
    ],
  },

  // ── DRAWING & VISUAL ─────────────────────────────────────────
  {
    id: "3dsd",
    category: "document",
    title: "S.Diagram",
    desc: "ゾーニングや動線、システム構成などの設計ダイアグラムを作成・共有するドローイングツール。",
    color: "#3B45D4",
    icon: icon3DSD,
    status: "ACTIVE",
    path: "/app/diagram",
    workspaceId: "diagram",
    scope: "3dsd",
    seoTitle: "ゾーニング図・動線図を作る建築ダイアグラム作成ツール",
    catchphrase: "設計の意図を、伝わる図に。",
    longDesc:
      "ゾーニング・動線・システム構成などの設計ダイアグラムをブラウザで作成・共有。設計初期の思考をすばやく図に落とし、チームと検討を進められます。",
    features: [
      { title: "ゾーニング・動線図", desc: "設計初期の思考をすばやく図にして、チームと共有できます。" },
      { title: "AIによる下書き", desc: "条件を伝えるとダイアグラムのたたき台をAIが生成。ゼロから描く時間を削減します。" },
      { title: "プロジェクト連携", desc: "S.LayoutやS.Drawingと同じプロジェクトで管理し、資料間の行き来を最小に。" },
    ],
  },
  {
    id: "3dsr",
    category: "document",
    title: "S.Drawing",
    desc: "平面図・立面図などの図面をセット単位でアップロード・管理し、チームと共有する図面管理アプリ。",
    color: "#E23B3B",
    icon: icon3DSR,
    status: "ACTIVE",
    path: "/app/drawing",
    workspaceId: "drawing",
    scope: "3dsr",
    seoTitle: "平面図・立面図をクラウドで管理・共有する図面管理アプリ",
    catchphrase: "図面を、セットで美しく管理。",
    longDesc:
      "平面図・立面図・詳細図をセット単位でアップロードして整理。チーム共有から公開まで対応した、プロジェクトの図面管理ハブです。",
    features: [
      { title: "セット単位の管理", desc: "意匠・構造・設備など、図面をまとまりで整理。差し替えにも迷いません。" },
      { title: "グリッドで一覧", desc: "サムネイル一覧から目的の図面へ即アクセスできます。" },
      { title: "共有とアクセス管理", desc: "チーム内共有から公開まで、必要な範囲で図面を届けられます。" },
    ],
  },
  {
    id: "3dsi",
    category: "document",
    title: "S.Image",
    desc: "パース・動画・AI生成画像などのビジュアル成果物を横断的に集約・管理するイメージライブラリ。",
    color: "#2E9BE6",
    icon: icon3DSI,
    status: "ACTIVE",
    path: "/app/image",
    workspaceId: "image",
    scope: "3dsi",
    seoTitle: "建築パース・AI画像・動画をまとめる素材管理ライブラリ",
    catchphrase: "パースも、AI画像も、ここに集まる。",
    longDesc:
      "パース・動画・AI生成画像などのビジュアル成果物を横断管理するイメージライブラリ。ローカルフォルダの素材も接続でき、プロジェクトの「見た目の資産」を一元化します。",
    features: [
      { title: "成果物の横断管理", desc: "各アプリで生まれたビジュアルをプロジェクト横断で集約します。" },
      { title: "ローカルフォルダ接続", desc: "手元の素材フォルダを複数接続し、クラウドと同じ画面で扱えます。" },
      { title: "Gallery連携", desc: "選んだ成果物をそのままポートフォリオやギャラリーへ公開できます。" },
    ],
  },
  {
    id: "3dsm",
    category: "document",
    title: "S.Movie",
    desc: "レンダリングしたクリップから、カット構成まで自動編集エンジンが組み立てる建築・インテリア向け動画ツール。",
    color: "#5A3FD4",
    icon: icon3DSM,
    status: "IN DEVELOPMENT",
    path: "/workspace",
    workspaceId: "movie",
    scope: "3dsm",
    seoTitle: "建築・インテリア動画を自動編集でつくるムービーツール",
    catchphrase: "空間の動画を、自動で編集。",
    longDesc:
      "S.Layoutでレンダリングしたウォークスルーやカメラパスのクリップを入力に、カット構成を自動編集エンジンが組み立てる動画ツール。タイムラインと格闘せずに、SNSやプレゼンで使える空間ムービーが仕上がります。",
    features: [
      { title: "カットシーケンス自動編集", desc: "クリップを選ぶだけで、見せ場を押さえたカット構成を自動生成します。" },
      { title: "レンダリングと直結", desc: "S.Layoutの動画レンダリング出力をそのまま素材に。書き出し→取り込みの手間がありません。" },
      { title: "用途別の書き出し", desc: "SNS・プレゼン・Webサイト向けなど、届け先に合わせたフォーマットで出力できます。" },
    ],
  },

  // ── LEARNING & SHOWCASE ──────────────────────────────────────
  {
    id: "3dsq",
    category: "growth",
    title: "S.Quest",
    desc: "建築・インテリア向けの学習プラットフォーム。動画講座やステップ式のコースでスキルを体系的に習得。",
    color: "#1FAE7E",
    icon: icon3DSQ,
    status: "BETA",
    path: "/app/quest",
    workspaceId: "quest",
    scope: "3dsq",
    seoTitle: "建築・インテリアをオンラインで学ぶ学習プラットフォーム",
    catchphrase: "建築とインテリアを、体系的に学ぶ。",
    longDesc:
      "建築・インテリア分野に特化した学習プラットフォーム。動画講座とステップ式のコースで、ツールの使い方から設計の考え方までを体系的に習得できます。",
    features: [
      { title: "ステップ式コース", desc: "順番に進めるだけで身につくカリキュラム設計。" },
      { title: "実務直結のテーマ", desc: "SEKKEIYAの各アプリを使った実践的な演習で、学びが仕事につながります。" },
      { title: "進捗トラッキング", desc: "学習の進み具合をひと目で確認できます。" },
    ],
  },
  {
    id: "3dsf",
    category: "growth",
    title: "S.Portfolio",
    desc: "プロジェクトの成果物をまとめ、実績として発信できるポートフォリオ＆ナレッジベース。",
    color: "#9B51E0",
    icon: icon3DSF,
    status: "IN DEVELOPMENT",
    path: "/app/portfolio",
    workspaceId: "portfolio",
    scope: "3dsf",
    seoTitle: "建築ポートフォリオをフリップブックで公開・共有",
    catchphrase: "実績を、ページをめくる体験で。",
    longDesc:
      "PDFのポートフォリオを本のようにめくって閲覧できる発信ツール。プロジェクトの成果物をまとめ、あなたの実績として世界に届けます。",
    features: [
      { title: "フリップブック閲覧", desc: "PDFをアップロードするだけで、ページをめくる上質な閲覧体験に。" },
      { title: "実績の一元化", desc: "プロジェクトの成果物をまとめ、営業・採用・SNSで使える1枚のURLに。" },
      { title: "Gallery公開", desc: "SEKKEIYAのGalleryに公開して、コミュニティに見つけてもらえます。" },
    ],
  },
  {
    id: "3dsk",
    category: "growth",
    title: "S.Library",
    desc: "本・PDF・Web記事・メモといった知識資源をローカルで一元管理し、AIの知識源にもなるナレッジライブラリ。",
    color: "#C99A2E",
    icon: icon3DSK,
    status: "ACTIVE",
    path: "/workspace",
    workspaceId: "library",
    scope: "3dsk",
    seoTitle: "本・PDF・Webをまとめる建築ナレッジ管理（AI知識ベース）",
    catchphrase: "本もPDFもWebも、設計の知識庫に。",
    longDesc:
      "書籍・PDF・URL・メモといった知識資源を端末内で一元管理するナレッジライブラリ。自動カテゴリ分けで棚が育ち、SEKKEIYAのAIがチャットからあなたの蔵書を参照する「外付けの脳」になります。",
    features: [
      { title: "ローカル完結の知識庫", desc: "データは端末内に保存。社外に出せない資料も安心して蓄積できます。" },
      { title: "自動カテゴリ・タグ付け", desc: "登録するだけで素材・構法・デザインなどの棚に自動分類。探す手間が消えます。" },
      { title: "ブラウザから1クリック登録", desc: "ブックマーク感覚で、いま見ているWebページをそのまま知識庫へ。" },
      { title: "AIの知識源（RAG）", desc: "チャットで質問すると、AIがあなたのライブラリを参照して答えます。" },
    ],
  },
  {
    id: "3dsb",
    category: "growth",
    title: "S.Blog",
    desc: "AIと議論しながら記事を執筆し、自分の知識庫とSEOに強い公開サイトの両方へ同時配信するブログ執筆ハブ。",
    color: "#E24A6E",
    icon: icon3DSB,
    status: "ACTIVE",
    path: "/workspace",
    workspaceId: "blog",
    scope: "3dsb",
    seoTitle: "建築・インテリア特化のAIブログ執筆・SEO配信ツール",
    catchphrase: "書く・貯める・届けるを、ひとつに。",
    longDesc:
      "AIと議論を交わしながら記事を執筆し、1本の記事を「自分の知識庫（S.Library）」と「SEOに強い公開サイト」の両方へ同時配信。デザインテーマやアイキャッチ画像もAIが整える、建築・インテリアの発信ハブです。",
    features: [
      { title: "AIとの議論から記事へ", desc: "テーマについてAIと議論すると、その内容がそのまま記事の下書きになります。" },
      { title: "デュアル配信", desc: "1本の記事を自分のナレッジとしても、公開ブログとしても保存。書いた資産が二度働きます。" },
      { title: "デザインもAIにおまかせ", desc: "記事テーマに合わせた配色・レイアウト・アイキャッチ画像を自動で整えます。" },
    ],
  },
];

// スラッグ正典（productSlugs.mjs）＋ LP 詳細本文（productContent.js）を焼き込む。
// LP の URL は /products/{slug}。overview/useCases/faq は productContent 側にあり、
// 未定義のアプリでは ProductLP が該当セクションを描画しない。
export const ECOSYSTEM_SERVICES = SERVICES.map((s) => ({
  ...s,
  slug: PRODUCT_SLUGS[s.id],
  ...(PRODUCT_CONTENT[s.id] || {}),
}));

/** 旧スラッグ（改名前）→ 現行 id。旧URL（/products/s-models 等）を救済し canonical へ寄せる。 */
export const LEGACY_PRODUCT_SLUGS = {
  "s-models": "3dss",
  "s-presentations": "3dsp",
};

/** /products/:slug 用ルックアップ。旧IDでのアクセス（/3dss 等）・旧スラッグも救済する。 */
export function findServiceBySlug(slugOrId) {
  if (!slugOrId) return null;
  const key = LEGACY_PRODUCT_SLUGS[slugOrId] || slugOrId;
  return ECOSYSTEM_SERVICES.find((s) => s.slug === key || s.id === key) || null;
}
