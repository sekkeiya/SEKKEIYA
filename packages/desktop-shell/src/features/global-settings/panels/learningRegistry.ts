// 学習資産の静的台帳（モデル台帳）と付随メタ。
// ここは純データ（UI/Firebase 非依存）なので、Lv2 サイドバーのネスト生成
// （SettingsSidebar）と本文パネル（LearningSettingsPanel）の両方から import する。
// 実装が増えたらここに1行追加する（将来は Firestore 化も可）。
// 種別: モデル(A)=重みを持つ判定器 / 索引(B)=埋め込み・検索資産 / 資産(C)=ユーザー固有の知識
//       / 生成(D)=画像などを作り出す生成モデル（LoRA・ControlNet 等）
// カテゴリ: 方針「全体はモデルで、個人は記憶で」がそのまま台帳の構造になるように分ける。

export type AssetStatus = '稼働' | '収集中' | '構想' | 'PoC完了・本番統合';
export type AssetCategory = 'fuel' | 'personal' | 'globalModel' | 'generative';

export const CATEGORIES: { key: AssetCategory; label: string; short: string; desc: string }[] = [
  { key: 'fuel',        label: '① 燃料（生データ・集計）',     short: '燃料',     desc: 'すべての学習の材料。溜まらなければ何も賢くならない。' },
  { key: 'personal',    label: '② 個人の記憶（RAG・メモリ）', short: '個人の記憶', desc: '「個人は記憶で」— ユーザーごとに貯めて引く資産。1人分でも効く。' },
  { key: 'globalModel', label: '③ 全体のモデル・索引',        short: '全体のモデル', desc: '「全体はモデルで」— 全ユーザーの反応・データから作る判定器と横断索引。' },
  { key: 'generative',  label: '④ 生成モデル（画像・建築特化）', short: '生成モデル', desc: '用途別LoRA＋ControlNet。公式の安定版を先に作り、将来ユーザー作成へ開放する。' },
];

export interface LearningAsset {
  name: string;
  cat: AssetCategory;
  kind: 'モデル(A)' | '索引(B)' | '資産(C)' | '生成(D)' | '集計';
  scope: 'グローバル' | 'コホート' | '個人';
  source: string;      // 学習・構築の材料
  usedBy: string;      // 使用場所
  status: AssetStatus;
  note?: string;
  // ---- 詳細（解説表示用） ----
  summary: string;     // ひとこと概要（何をするものか）
  how: string;         // 仕組み（どう学ぶ／どう働く）
  location?: string;   // データの場所（Firestore パス等）
  ladder?: string;     // 学習の梯子の何段目か
  next?: string;       // 次の一歩
  benefit: string;     // 学習の成果 — 結果として何が良くなるのか
}

export const REGISTRY: LearningAsset[] = [
  {
    name: 'reactionLogs', cat: 'fuel', kind: '集計', scope: 'グローバル',
    source: 'チップ表示/クリック等の暗黙反応', usedBy: '（学習の生データ）', status: '収集中',
    note: 'chat-suggest 配線済み。Web 2026-07-10 リリース',
    summary: 'ユーザーの暗黙の反応（表示・クリック・採用・書き直し…）を1イベント＝1ドキュメントで記録する追記専用ログ。学習サイクル全体の生データで、すべての自前モデルの材料になる。',
    how: 'クライアントの logReaction() が操作の瞬間に fire-and-forget で追記（失敗してもUXに影響しない）。本人のみ作成でき、変更・削除はルールで永久禁止。生の会話文・本文は保存せず、粗い特徴（文字数・画像有無など）とラベル文言だけを残す（PIIなし）。ポイントは「表示（impression）」も記録すること — これがCTRの分母になり、「無視された」を差分で導出できる。',
    location: 'users/{uid}/reactionLogs/{autoId}',
    ladder: '—（データ収集。全段の土台）',
    next: 'surface の追加（記事の公開/書き直し、読み上げの離脱位置、3D操作など）。現在は chat-suggest（先回り提案チップ）のみ。',
    benefit: 'これが溜まるほど、下のすべての「良くなる」が可能になる。ユーザーには直接見えないが、全改善の燃料。溜まらなければ何も賢くならない。',
  },
  {
    name: 'reactionPatterns', cat: 'fuel', kind: '集計', scope: 'グローバル',
    source: 'reactionLogs（日次）', usedBy: 'この画面・学習ジョブ', status: '収集中',
    note: 'aggregateReactions で手動集計（分析タブのボタン）',
    summary: 'reactionLogs の日次ロールアップ。surface（機能面）ごとに 表示数・クリック数・CTR・表示順別・モデル別・クリックされた文言Top10 を集計する。',
    how: 'Cloud Function aggregateReactions が collectionGroup で全ユーザー分を吸い上げて匿名集計する（UID・プロジェクトIDは出力に残さない、ユーザー数のカウントのみ）。管理者APIモニターの usageDaily と同じ「生ログ→日次集計」パターン。',
    location: 'insights/reactionPatterns/days/{YYYY-MM-DD}',
    ladder: '—（集計。モデルの一歩手前）',
    next: 'Cloud Scheduler で毎晩自動実行に切り替え。数週間分溜まったら chip-ranker の学習データにする。',
    benefit: 'どの提案が効いているかが数字（CTR）で見える → 勘ではなくデータで機能を改善できるようになる。',
  },
  {
    name: 'knowledgeChunks', cat: 'personal', kind: '索引(B)', scope: '個人',
    source: 'S.Library / ナレッジソース', usedBy: 'RAG（Chat 注入）', status: '稼働',
    summary: 'S.Library などのドキュメントを検索できる断片（チャンク）に分割し、意味の座標（埋め込みベクトル）を付けた索引。「貯めて引く」学習＝RAG の実体。',
    how: '取り込み時に Cloud Function が文書をチャンク化→埋め込みベクトルに変換して保存。Chat で質問すると、質問文に意味が近い断片を検索して AI のコンテキストに注入する。モデルの重みは変えずに「持ち込み資料」で賢くする方式なので、追加コストが小さく即時に効く。',
    location: 'users/{uid}/knowledgeChunks（＋ knowledgeSources）',
    ladder: '2段目（RAG）＋ 5段目（埋め込み）',
    next: '検索ヒット率・引用された断片の反応を reactionLogs に記録し、索引の質を測れるようにする。',
    benefit: 'AIが一般論ではなく「あなたの資料」を根拠に答えるようになる → 回答の的確さと信頼性が上がる。',
  },
  {
    name: 'driveAssets 埋め込み', cat: 'personal', kind: '索引(B)', scope: '個人',
    source: 'AI Drive のファイル分析', usedBy: 'Drive 検索', status: '稼働',
    summary: 'AI Drive にあるファイルを AI が分析（カテゴリ・タグ・要約）し、意味で検索できるようにした索引。',
    how: 'ファイルの追加・更新をトリガーに Cloud Function が Gemini で内容を分析し、カテゴリ/タグ/埋め込みを driveAssets に書き戻す。Drive 検索や Chat の添付検索（Ctrl+Alt+S）がこの索引を引く。',
    location: 'users/{uid}/driveAssets',
    ladder: '5段目（埋め込み）',
    next: '検索結果のクリック/採用を reactionLogs に記録して、検索品質の教師信号にする。',
    benefit: 'ファイル名を覚えていなくても意味で見つかる → 探す時間が減り、過去の資産が死蔵されなくなる。',
  },
  {
    name: 'aiMemory', cat: 'personal', kind: '資産(C)', scope: '個人',
    source: '会話からの決定・制約の蒸留', usedBy: 'agentTurn（_digest 注入）', status: '稼働',
    summary: '会話から蒸留した「決まったこと・制約・好み」の長期記憶。ユーザー固有の知識資産で、個人化の主役。',
    how: '会話の要点を Cloud Function が蒸留して保存し、予約ID _digest にダイジェストを維持。Chat の各ターンの前置きに注入されるので、AI が案件の経緯や本人の流儀を「覚えている」ように振る舞える。1人分のデータが少なくても効く＝「個人は記憶で、全体はモデルで」の実装。',
    location: 'users/{uid}/aiMemory ／ projects/{pid}/aiMemory',
    ladder: '2段目（メモリ）',
    next: 'R&M のユーザーロジック（思考の構造）をプレイブック化して、ここに合流させる構想。',
    benefit: '毎回イチから説明し直さなくてよくなる → 会話が短くなり、手戻りが減る。使うほど「話が早い」AIになる。',
  },
  {
    name: 'chip-ranker', cat: 'globalModel', kind: 'モデル(A)', scope: 'グローバル',
    source: 'reactionLogs（CTR）', usedBy: 'suggestNextActions', status: '構想',
    note: 'データが溜まってから着手',
    summary: '「どの提案チップが押されるか」を予測する採用ランカー。SEKKEIYA 最初の自前モデル候補。',
    how: 'reactionLogs の impression（表示）と clicked（クリック）を setId で突合し、文言タイプ・表示順・文脈ごとの CTR を学習する。巨大なニューラルネットは不要 — まずは「CTR の低い型のチップを出さない」ルールから始め、効果が見えたら軽量な分類器（ロジスティック回帰級）に昇格する。',
    location: '（学習ジョブ＋ suggestNextActions への組み込み）',
    ladder: '4段目（自前の小さなMLモデル）',
    next: 'CTR データが数週間分溜まったら着手。まず reactionPatterns で「表示順バイアス」「効く文言型」を目視確認するところから。',
    benefit: '先回り提案の的中率が上がる → 次にやることをワンタップで開始でき、操作の迷いが減る。',
  },
  {
    name: 'chat-router', cat: 'globalModel', kind: 'モデル(A)', scope: 'グローバル',
    source: 'reactionLogs + usageLogs', usedBy: 'routeChat（auto 振り分け）', status: '構想',
    summary: 'Chat 入力の特徴から Haiku／Sonnet の最適な振り分けを判定する分類器。品質を保ちながらコストを下げる。',
    how: '現在の routeChat.js はルールベース（文字数・画像・キーワード等）。学習版は reactionLogs の特徴（inputLen / hasTool / intent）と応答への反応（書き直し・再生成＝失敗信号）、usageLogs のコストを突合して「安いモデルで十分だった入力」を学習する。',
    location: 'functions/llm/routeChat.js（ルール版が実装済み・enabled=false）',
    ladder: '4段目（自前の小さなMLモデル）',
    next: 'chat 本体の surface を reactionLogs に配線（応答への書き直し/再生成の記録）してから着手。',
    benefit: '同じ品質のまま応答が速く・安くなる → 待ち時間とAPIコストが下がる（浮いた分は機能開発へ）。',
  },
  {
    name: 'ssot-case-index', cat: 'globalModel', kind: '索引(B)', scope: 'グローバル',
    source: 'projects / SSOT 設計データ', usedBy: 'Chat / 類似事例提案', status: '構想',
    summary: '過去プロジェクト（SSOT）の設計データを埋め込み索引化し、「この条件に似た過去案件」を引けるようにする。データ堀の本命。',
    how: 'プロジェクトの設計データ（用途・規模・配置・素材など）を埋め込みベクトルに変換して索引化。新しい案件で Chat が「似た事例ではこうしていた」を検索して提案に使う。全ユーザー横断は匿名化・k-匿名性フィルタが前提。',
    location: 'projects/{pid}/workspaces/{wid}/items（材料）',
    ladder: '5段目（埋め込み＋ベクトル検索）',
    next: 'SSOT のどのフィールドを埋め込みに含めるかの設計から。knowledgeChunks の実装パターンを流用できる。',
    benefit: '「似た案件ではこうした」が提案に根拠として付く → 提案の説得力と設計の初速が上がる。',
  },
  // ---- ④ 生成モデル（画像・建築特化）。公式の安定版を先に作り、将来ユーザー作成へ開放 ----
  {
    name: 'lora-interior-perspective', cat: 'generative', kind: '生成(D)', scope: 'グローバル',
    source: 'キュレーション教師画像＋reactionLogs採用画像', usedBy: 'airender（内観パース）', status: 'PoC完了・本番統合',
    note: '公式LoRA第一号（PoC完走: tools/lora で学習 → airender の flux-lora プロバイダに搭載済。教師データは当面PoCシード、本命はS.Layout/S.Imageの自前レンダへ差し替え）',
    summary: '内観パース特化の画像生成LoRA。FLUX/SDXL等のベースモデルはそのまま、その上に載せる薄い追加重み（数十〜数百MB）で「SEKKEIYAらしい内観表現」を学習させる。用途別LoRA戦略（パース/家具/素材…）の第一号。',
    how: 'ベースモデルの重みは変えず、数十〜数百枚の教師画像＋キャプションでLoRA（低ランク適応）を学習する。レンタルGPUで数時間・数ドル〜のオーダーなので用途を分けて何本も回せる。将来はユーザーの採用/破棄（reactionLogs）を教師データの選別に使い、使われるほど賢くなるループにする。',
    ladder: '6段目（ファインチューニング＝LoRA）',
    next: 'airender の flux-lora プロバイダをデプロイ＆UIから選択可能に → 本命の教師データ（S.Layout/S.Imageの自前レンダ）で再学習して堀版へ。将来はローカルGPU推論（原価≒0）でデスクトップ版に載せる。',
    benefit: '汎用モデルでは出ない「SEKKEIYAらしい」内観が安定して出る → 生成の当たり率が上がり、他社が真似できない差別化資産になる。ローカル実行なら生成原価も0に近づく。',
  },
  {
    name: 'lora-furniture', cat: 'generative', kind: '生成(D)', scope: 'グローバル',
    source: '家具画像＋S.Model アセット', usedBy: 'airender / S.Model', status: '構想',
    summary: '家具・プロダクト画像特化のLoRA。S.Model のアセットを材料に、カタログ調の家具画像や差し替え素材を安定生成する。内観パースLoRAで確立したパイプラインの横展開第一弾。',
    how: 'lora-interior-perspective と同じ学習パイプライン（キュレーション→キャプション→学習→評価）を家具ドメインで回す。S.Model の既存アセットとメタデータが教師データの母体になるため、材料調達コストが小さい。',
    ladder: '6段目（ファインチューニング＝LoRA）',
    next: 'lora-interior-perspective でパイプラインを通し切ってから。S.Model アセットの教師データ化（画像＋キャプション抽出）の設計が先行タスク。',
    benefit: '家具の物撮り・カタログ画像を撮影なしで量産できる → S.Model の商品訴求力が上がり、素材差し替え等の編集機能の土台になる。',
  },
  {
    name: 'controlnet-floorplan', cat: 'generative', kind: '生成(D)', scope: 'グローバル',
    source: 'SSOT 設計データ（正寸レイアウト）', usedBy: 'airender（図面系・制約付き生成）', status: '構想',
    note: '図面系はDiffusion単体では寸法が狂うため、制約付き生成が必須',
    summary: '平面図・展開図など図面系のための制約付き生成。Diffusion単体は「図面っぽい絵」しか描けず寸法が狂うので、正しい寸法はSSOTデータが担保し、AIは見た目だけを整えるという役割分担にする。',
    how: 'SSOT のレイアウト（壁・開口・寸法）を ControlNet の条件画像（線画/セグメンテーション）に変換し、生成がそれを守るよう強制する。「入力を守る（ControlNet）×それらしく（LoRA）」の組み合わせ。設計ツールとしての本命はこの制御側。',
    ladder: '6段目（ファインチューニング＋制約付き生成）',
    next: 'SSOT→条件画像の変換設計から。レンダ系LoRA（内観・家具）で足場を固めた後に着手する。',
    benefit: '「それっぽいだけで寸法が狂った図面」を排除しつつ、正確なデータから見栄えのする図面表現を一瞬で作れる → SSOT が生成AIの品質保証になる。',
  },
  {
    name: 'user-lora', cat: 'generative', kind: '生成(D)', scope: '個人',
    source: 'ユーザー持込画像＋本人の採用履歴', usedBy: 'airender（本人のみ）', status: '構想',
    note: 'Phase 2（遠い将来・1年以上先）。SEKKEIYAが実運用で安定してからのアップグレードとして実装',
    summary: 'ユーザーが自分の作風・事務所のテイストを学習させる個人LoRA。「AIモデルはユーザーでも作れる」というSEKKEIYA思想の実装で、方針「個人は記憶で」を「個人のモデルで」へ意識的に拡張する新カテゴリ。',
    how: '公式LoRAで確立した学習パイプラインをそのままプロダクト化して提供する。持込画像の権利同意（利用規約）と不適切データのフィルタが開放の前提条件。学習ジョブはクラウドGPUで代行し、生成はローカル/クラウドのハイブリッド。',
    ladder: '6段目（ファインチューニング＝LoRA）',
    next: '当面は着手しない（Phase 2）。SEKKEIYA本体が実際に使われ安定してから、アップグレード機能として開放する想定（1年以上先）。前提として公式LoRAでパイプラインを通し切り、利用規約での学習同意・ライセンス整理を済ませておく。',
    benefit: '「自分の事務所のテイストで出るAI」になる → 個人単位のデータ堀ができ、乗り換えられない理由になる。',
  },
];

// ---- 台帳の資産 → グラフのデータ源メタ ----------------------------------------
export type CountKey = 'reactionLogs' | 'knowledgeChunks' | 'knowledgeSources' | 'driveAssets' | 'aiMemory';
export interface AssetMeta { surface?: string; countKey?: CountKey; rung: number }
export const ASSET_META: Record<string, AssetMeta> = {
  'reactionLogs':        { surface: 'global',       countKey: 'reactionLogs',    rung: 1 },
  'reactionPatterns':    { surface: 'global',       rung: 3 },
  'knowledgeChunks':     { countKey: 'knowledgeChunks', rung: 5 },
  'driveAssets 埋め込み':  { countKey: 'driveAssets',   rung: 5 },
  'aiMemory':            { countKey: 'aiMemory',     rung: 2 },
  'chip-ranker':         { surface: 'chat-suggest',  rung: 4 },
  'chat-router':         { rung: 4 },
  'ssot-case-index':     { rung: 5 },
  'lora-interior-perspective': { rung: 6 },
  'lora-furniture':      { rung: 6 },
  'controlnet-floorplan': { rung: 6 },
  'user-lora':           { rung: 6 },
};
// 学習の梯子（6段）。REGISTRY の ladder テキストの段番号と対応。
export const RUNGS = ['データ収集', '記憶・RAG', '集計・ルール', '自前MLモデル', '埋め込み検索', 'ファインチューニング'];
export const COUNT_LABEL: Record<CountKey, string> = {
  reactionLogs: '反応ログ', knowledgeChunks: 'ナレッジ断片', knowledgeSources: 'ナレッジ元',
  driveAssets: 'Drive資産', aiMemory: '長期記憶',
};

export const statusColor: Record<AssetStatus, 'success' | 'info' | 'default'> = {
  '稼働': 'success', '収集中': 'info', '構想': 'default', 'PoC完了・本番統合': 'success',
};
export const ACCENT = 'light-dark(#0875a6, #4fc3f7)';
export const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
export const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
