// Global Settings > 学習（管理者専用）。学習サイクルのモニター。
// - 反応ログ（reactionLogs）の日次集計を aggregateReactions CF で実行し、
//   surface ごとの impressions / clicks / CTR / rank別 / モデル別を表示する。
// - モデル台帳: 学習資産（モデル・索引・知識資産）の一覧と状態を一元把握する。
//   右サイドバーに常時、選択中の資産の詳細説明を表示する（行クリックで切り替え）。
// 管理者のみ到達（サイドバー＋シェルで二重ガード、CF 側は要認証）。
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Chip, Button, TextField, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, Divider, IconButton,
} from '@mui/material';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DragHandleRoundedIcon from '@mui/icons-material/DragHandleRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';

// ---- モデル台帳（レジストリ） ------------------------------------------------
// 学習資産の静的台帳。実装が増えたらここに1行追加する（将来は Firestore 化も可）。
// 種別: モデル(A)=重みを持つ判定器 / 索引(B)=埋め込み・検索資産 / 資産(C)=ユーザー固有の知識
//       / 生成(D)=画像などを作り出す生成モデル（LoRA・ControlNet 等）
// カテゴリ: 方針「全体はモデルで、個人は記憶で」がそのまま台帳の構造になるように分ける。
type AssetStatus = '稼働' | '収集中' | '構想';
type AssetCategory = 'fuel' | 'personal' | 'globalModel' | 'generative';
const CATEGORIES: { key: AssetCategory; label: string; desc: string }[] = [
  { key: 'fuel', label: '① 燃料（生データ・集計）', desc: 'すべての学習の材料。溜まらなければ何も賢くならない。' },
  { key: 'personal', label: '② 個人の記憶（RAG・メモリ）', desc: '「個人は記憶で」— ユーザーごとに貯めて引く資産。1人分でも効く。' },
  { key: 'globalModel', label: '③ 全体のモデル・索引', desc: '「全体はモデルで」— 全ユーザーの反応・データから作る判定器と横断索引。' },
  { key: 'generative', label: '④ 生成モデル（画像・建築特化）', desc: '用途別LoRA＋ControlNet。公式の安定版を先に作り、将来ユーザー作成へ開放する。' },
];
interface LearningAsset {
  name: string;
  cat: AssetCategory;
  kind: 'モデル(A)' | '索引(B)' | '資産(C)' | '生成(D)' | '集計';
  scope: 'グローバル' | 'コホート' | '個人';
  source: string;      // 学習・構築の材料
  usedBy: string;      // 使用場所
  status: AssetStatus;
  note?: string;
  // ---- 詳細（右サイドバー表示用） ----
  summary: string;     // ひとこと概要（何をするものか）
  how: string;         // 仕組み（どう学ぶ／どう働く）
  location?: string;   // データの場所（Firestore パス等）
  ladder?: string;     // 学習の梯子の何段目か
  next?: string;       // 次の一歩
  benefit: string;     // 学習の成果 — 結果として何が良くなるのか
}
const REGISTRY: LearningAsset[] = [
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
    note: 'aggregateReactions で手動集計（下のボタン）',
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

// ---- aggregateReactions のレスポンス型（functions/insights/aggregateReactions.js と揃える） ----
interface SurfaceStat {
  impressions: number;
  clicks: number;
  ctr: number | null;
  actions: Record<string, number>;
  byModel: Record<string, { impressions: number; clicks: number }>;
  byRank: Record<string, number>;
  byPlatform: Record<string, number>;
  anonymousEvents: number;
  topClickedLabels: { label: string; count: number }[];
}
interface AggregateResult {
  success: boolean;
  day: string;
  eventCount: number;
  userCount: number;
  surfaces: Record<string, SurfaceStat>;
}
/** 期間モード({days:N})のレスポンス。日別推移グラフ用。 */
interface DailyPoint { day: string; impressions: number; clicks: number; events: number; ctr: number | null }
interface RangeResult {
  success: boolean;
  mode: 'range';
  start: string;
  end: string;
  daily: DailyPoint[];
  /** surface（機能面）別の日別推移。台帳の資産別グラフに使う。 */
  dailyBySurface?: Record<string, DailyPoint[]>;
  surfaces: Record<string, { impressions: number; clicks: number; ctr: number | null }>;
  eventCount: number;
  userCount: number;
}
/** 件数モード({counts:true})のレスポンス。資産の規模グラフ用。 */
type CountKey = 'reactionLogs' | 'knowledgeChunks' | 'knowledgeSources' | 'driveAssets' | 'aiMemory';
interface CountsResult {
  success: boolean;
  mode: 'counts';
  counts: Partial<Record<CountKey, number | null>>;
  day: string;
}

// ---- 台帳の資産 → グラフのデータ源メタ ----------------------------------------
// REGISTRY 本体は説明テキストなので触らず、グラフに必要な「どのデータを引くか」だけを
// 資産名で引ける別表にする。追加時はここに1行足す。
// - surface: 反応の推移グラフの対象 surface。'global' は全 surface 合算(range.daily)。
//   未指定＝この資産はまだ反応ログに配線されていない。
// - countKey: 資産の規模グラフで数えるコレクション。未指定＝件数で測る資産ではない。
// - rung: 学習の梯子の何段目か（1..6・下の RUNGS と対応）。
interface AssetMeta { surface?: string; countKey?: CountKey; rung: number }
const ASSET_META: Record<string, AssetMeta> = {
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
const RUNGS = ['データ収集', '記憶・RAG', '集計・ルール', '自前MLモデル', '埋め込み検索', 'ファインチューニング'];
const COUNT_LABEL: Record<CountKey, string> = {
  reactionLogs: '反応ログ', knowledgeChunks: 'ナレッジ断片', knowledgeSources: 'ナレッジ元',
  driveAssets: 'Drive資産', aiMemory: '長期記憶',
};


const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
const statusColor: Record<AssetStatus, 'success' | 'info' | 'default'> = {
  '稼働': 'success', '収集中': 'info', '構想': 'default',
};
const ACCENT = 'light-dark(#0875a6, #4fc3f7)';

// ==== 下部ドックのグラフカード群 ==============================================

/** グラフ1枚を包む共通カード（見出し＋補足＋本体） */
const GraphCard: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
      display: 'flex', flexDirection: 'column', minWidth: 260, flex: 1,
    }}
  >
    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.25 }}>{hint}</Typography>
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</Box>
  </Paper>
);

const EmptyNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>{children}</Typography>
);

/** ① 反応の推移 — 選択資産の surface の 表示/クリック/CTR を日別バーで */
const ReactionTrendCard: React.FC<{ series?: DailyPoint[]; wired: boolean; unwiredNote?: string; loading?: boolean; error?: string | null }> = ({ series, wired, unwiredNote, loading, error }) => {
  if (!wired) return <EmptyNote>{unwiredNote || 'この資産はまだ反応ログに配線されていません。'}</EmptyNote>;
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>;
  if (error) return <EmptyNote>取得エラー: {error}</EmptyNote>;
  if (!series || series.length === 0) return <EmptyNote>この期間の反応データがありません。</EmptyNote>;
  const maxImp = Math.max(1, ...series.map(d => d.impressions));
  const ti = series.reduce((s, d) => s + d.impressions, 0);
  const tc = series.reduce((s, d) => s + d.clicks, 0);
  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="body2">表示 <b>{ti.toLocaleString()}</b></Typography>
        <Typography variant="body2">クリック <b>{tc.toLocaleString()}</b></Typography>
        <Typography variant="body2">CTR <b>{ti > 0 ? `${((tc / ti) * 100).toFixed(1)}%` : '—'}</b></Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 96 }}>
        {series.map(d => (
          <Tooltip key={d.day} title={`${d.day}: 表示${d.impressions} / クリック${d.clicks} / CTR ${d.ctr == null ? '—' : `${(d.ctr * 100).toFixed(1)}%`}`}>
            <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Box sx={{
                width: '70%',
                height: `${Math.max(d.impressions > 0 ? 4 : 1, (d.impressions / maxImp) * 100)}%`,
                bgcolor: 'light-dark(rgba(8,117,166,0.25), rgba(79,195,247,0.25))',
                borderRadius: 1, position: 'relative',
              }}>
                <Box sx={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: d.impressions > 0 ? `${(d.clicks / Math.max(1, d.impressions)) * 100}%` : 0,
                  bgcolor: ACCENT, borderRadius: 1,
                }} />
              </Box>
            </Box>
          </Tooltip>
        ))}
      </Box>
      {ti === 0 && <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1 }}>薄い棒＝表示、濃い棒＝クリック。まだ棒はありません。</Typography>}
    </>
  );
};

/** ② 資産の規模 — 全カウント対象の件数を横棒で比較（選択資産をハイライト） */
const SizeCard: React.FC<{ counts: CountsResult | null; loading: boolean; error: string | null; activeKey?: CountKey }> = ({ counts, loading, error, activeKey }) => {
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>;
  if (error) return <EmptyNote>件数の取得に失敗しました。</EmptyNote>;
  if (!counts) return <EmptyNote>件数データがありません。</EmptyNote>;
  const rows = (Object.keys(COUNT_LABEL) as CountKey[])
    .map(k => ({ key: k, label: COUNT_LABEL[k], value: counts.counts[k] ?? null }))
    .filter(r => r.value != null);
  if (rows.length === 0) return <EmptyNote>件数を取得できるコレクションがありません。</EmptyNote>;
  const max = Math.max(1, ...rows.map(r => r.value as number));
  const activeVal = activeKey ? counts.counts[activeKey] : undefined;
  return (
    <>
      {activeKey != null && (
        <Typography variant="body2" sx={{ mb: 1 }}>
          この資産: <b style={{ fontSize: 20 }}>{activeVal == null ? '—' : (activeVal as number).toLocaleString()}</b> 件
        </Typography>
      )}
      {activeKey == null && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
          この資産は件数では測りません（モデル/集計）。全体の規模の参考です。
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {rows.map(r => {
          const on = r.key === activeKey;
          return (
            <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ width: 78, flexShrink: 0, color: on ? 'text.primary' : 'text.secondary', fontWeight: on ? 700 : 400 }}>{r.label}</Typography>
              <Box sx={{ flex: 1, height: 14, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                <Box sx={{ width: `${((r.value as number) / max) * 100}%`, height: '100%', bgcolor: on ? ACCENT : 'light-dark(rgba(8,117,166,0.3), rgba(79,195,247,0.3))', borderRadius: 1 }} />
              </Box>
              <Typography variant="caption" sx={{ width: 52, flexShrink: 0, textAlign: 'right', fontFamily: 'monospace' }}>{(r.value as number).toLocaleString()}</Typography>
            </Box>
          );
        })}
      </Box>
    </>
  );
};

/** ③ 学習の梯子・成熟度 — 6段のどこまで来たか＋状態 */
const LadderCard: React.FC<{ rung: number; status: AssetStatus }> = ({ rung, status }) => {
  const barColor = status === '稼働' ? ACCENT
    : status === '収集中' ? 'light-dark(rgba(8,117,166,0.5), rgba(79,195,247,0.5))'
    : 'text.disabled';
  return (
    <>
      <Typography variant="body2" sx={{ mb: 1 }}>
        現在 <b style={{ fontSize: 20 }}>{rung}</b> / 6 段目 ・ <b>{RUNGS[rung - 1]}</b>
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25 }}>
        {RUNGS.map((label, i) => {
          const reached = i < rung;
          const current = i === rung - 1;
          return (
            <Tooltip key={label} title={`${i + 1}段目: ${label}`}>
              <Box sx={{
                flex: 1, height: 10, borderRadius: 1,
                bgcolor: reached ? barColor : 'action.hover',
                outline: current ? '2px solid' : 'none',
                outlineColor: ACCENT, outlineOffset: 1,
              }} />
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>1 収集</Typography>
        <Chip label={status} size="small" color={statusColor[status]} variant={status === '構想' ? 'outlined' : 'filled'} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>6 FT</Typography>
      </Box>
    </>
  );
};

export const LearningSettingsPanel = () => {
  const [day, setDay] = useState<string>(jstToday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AggregateResult | null>(null);
  // 右サイドバーに常時表示する資産。初期値は台帳の先頭（reactionLogs）。
  const [selected, setSelected] = useState<LearningAsset>(REGISTRY[0]);
  // 直近14日の推移（パネルを開いたら自動取得してグラフ表示）
  const [range, setRangeData] = useState<RangeResult | null>(null);
  const [rangeLoading, setRangeLoading] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);
  // 資産の規模（件数）— 下部ドックの規模グラフ用
  const [counts, setCounts] = useState<CountsResult | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const fn = httpsCallable(functions, 'aggregateReactions');
      // 反応の推移（14日）
      try {
        const res = await fn({ days: 14 });
        if (alive) setRangeData(res.data as RangeResult);
      } catch (e: any) {
        if (alive) setRangeError(e?.message || '取得に失敗しました');
      } finally {
        if (alive) setRangeLoading(false);
      }
      // 資産の規模（件数）
      try {
        const res = await fn({ counts: true });
        if (alive) setCounts(res.data as CountsResult);
      } catch (e: any) {
        if (alive) setCountsError(e?.message || '取得に失敗しました');
      } finally {
        if (alive) setCountsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 選択中の資産のグラフ用メタ（データ源）を引く
  const meta = ASSET_META[selected.name] as AssetMeta | undefined;
  const trendSeries = meta?.surface === 'global'
    ? range?.daily
    : meta?.surface
      ? range?.dailyBySurface?.[meta.surface]
      : undefined;

  // 下部ドック: 高さ（左ドラッグで可変）＋開閉
  const [dockOpen, setDockOpen] = useState(true);
  const [dockHeight, setDockHeight] = useState(340);
  const leftRef = useRef<HTMLDivElement>(null);
  const startDockResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = dockHeight;
    const onMove = (ev: MouseEvent) => {
      const dy = startY - ev.clientY; // 上へドラッグ＝拡大
      const maxH = (leftRef.current?.clientHeight ?? 800) - 220; // メインに最低限を残す
      setDockHeight(Math.min(Math.max(140, startH + dy), Math.max(160, maxH)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dockHeight]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'aggregateReactions');
      const res = await fn({ day });
      const r = res.data as AggregateResult | undefined;
      if (!r?.success) throw new Error('集計に失敗しました');
      setResult(r);
    } catch (e: any) {
      setError(e?.message || '集計に失敗しました');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [day]);

  const sectionSx = {
    p: 3, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
  } as const;

  const surfaceEntries = Object.entries(result?.surfaces || {});

  /** 右サイドバーの見出し＋本文のセクション */
  const DetailSection: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.8, ...(mono ? { fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' } : {}) }}>
        {children}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* ── 左側: メイン（モデル台帳）＋ 下部ドック（縦積み） ─────────── */}
      <Box ref={leftRef} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* ヘッダ（固定・スクロールしない） */}
        <Box sx={{ px: 4, pt: 4, pb: 2, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyRoundedIcon sx={{ color: ACCENT }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>AI学習モニター</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            学習サイクルの入力データ（反応ログ）と学習資産の状態を把握します。
            方針: 全体はモデルで、個人は記憶（RAG/メモリ）で。
          </Typography>
        </Box>

        {/* ── メイン: モデル台帳（このカード内だけスクロール） ─────────── */}
        <Box sx={{ flex: 1, minHeight: 0, px: 4, pb: 2, display: 'flex', overflow: 'hidden' }}>
          <Paper elevation={0} sx={{ ...sectionSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ flexShrink: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>モデル台帳</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                1行＝1学習資産。何が・何のデータで・どこで効いているか。行をクリックすると右の詳細が切り替わります。
                種別: モデル(A)=判定器 / 索引(B)=埋め込み検索 / 資産(C)=ユーザー固有の知識 / 生成(D)=画像などの生成モデル。
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>資産名</TableCell>
                    <TableCell>種別</TableCell>
                    <TableCell>影響範囲</TableCell>
                    <TableCell>材料</TableCell>
                    <TableCell>使用場所</TableCell>
                    <TableCell>状態</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {CATEGORIES.map(c => {
                    const rows = REGISTRY.filter(a => a.cat === c.key);
                    if (rows.length === 0) return null;
                    return (
                      <React.Fragment key={c.key}>
                        {/* カテゴリ見出し行 — 台帳を「燃料→記憶→モデル→生成」の流れで読めるようにする */}
                        <TableRow>
                          <TableCell colSpan={6} sx={{ bgcolor: 'light-dark(rgba(8,117,166,0.06), rgba(79,195,247,0.06))', py: 0.75 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: ACCENT }}>{c.label}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>{c.desc}</Typography>
                          </TableCell>
                        </TableRow>
                        {rows.map(a => (
                          <TableRow
                            key={a.name}
                            hover
                            selected={selected?.name === a.name}
                            onClick={() => setSelected(a)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell sx={{ fontWeight: 500, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {a.note ? <Tooltip title={a.note} arrow><span>{a.name}</span></Tooltip> : a.name}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.kind}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.scope}</TableCell>
                            <TableCell>{a.source}</TableCell>
                            <TableCell>{a.usedBy}</TableCell>
                            <TableCell>
                              <Chip label={a.status} size="small" color={statusColor[a.status]} variant={a.status === '構想' ? 'outlined' : 'filled'} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </Box>

        {/* ── リサイズハンドル＋開閉ボタン（左ドラッグで高さ可変） ─────────── */}
        <Box
          onMouseDown={dockOpen ? startDockResize : undefined}
          sx={{
            flexShrink: 0, height: 22, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            borderTop: '1px solid', borderColor: 'divider',
            bgcolor: 'light-dark(rgba(0,0,0,0.02), rgba(255,255,255,0.03))',
            cursor: dockOpen ? 'ns-resize' : 'default',
            userSelect: 'none',
            '&:hover': dockOpen ? { bgcolor: 'action.hover' } : {},
          }}
        >
          {dockOpen
            ? <DragHandleRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            : <Typography variant="caption" sx={{ color: 'text.secondary' }}>選択中の資産のグラフ ・ 反応ログ集計</Typography>}
          <IconButton
            size="small"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setDockOpen(o => !o)}
            aria-label={dockOpen ? 'グラフを閉じる' : 'グラフを開く'}
            sx={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', p: 0.25 }}
          >
            {dockOpen ? <KeyboardArrowDownRoundedIcon fontSize="small" /> : <KeyboardArrowUpRoundedIcon fontSize="small" />}
          </IconButton>
        </Box>

        {/* ── 下部ドック（可変高さ・折りたたみ） ─────────────── */}
        {dockOpen && (
          <Box
            sx={{
              flexShrink: 0, height: dockHeight,
              bgcolor: 'light-dark(rgba(0,0,0,0.015), rgba(255,255,255,0.02))',
              px: 3, py: 2, display: 'flex', flexDirection: 'column',
              overflowX: 'auto', overflowY: 'auto',
            }}
          >
            {/* 反応ログ 日次集計（コンパクト・管理者の手動ジョブ） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.25, pb: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
              <Tooltip title="指定日(JST)の reactionLogs を集計して insights/reactionPatterns に保存する管理者用の手動ジョブ。反応の生ログを日次でまとめ、上のグラフの材料にします。">
                <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', fontWeight: 700, cursor: 'help' }}>
                  反応ログ 日次集計
                </Typography>
              </Tooltip>
              <TextField type="date" size="small" value={day} onChange={(e) => setDay(e.target.value)} sx={{ width: 150 }} />
              <Button
                variant="outlined" size="small" disableElevation
                startIcon={loading ? <CircularProgress size={13} color="inherit" /> : <PlayArrowRoundedIcon />}
                onClick={() => void run()} disabled={loading}
                sx={{ textTransform: 'none' }}
              >
                集計を実行
              </Button>
              {error && <Typography variant="caption" sx={{ color: 'error.main' }}>エラー: {error}</Typography>}
              {result && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  <b>{result.day}</b> ・ イベント {result.eventCount.toLocaleString()} ・ ユーザー {result.userCount.toLocaleString()}
                  {surfaceEntries.length > 0
                    ? ` ・ ${surfaceEntries.map(([sf, s]) => `${sf} 表示${s.impressions}/クリック${s.clicks}/CTR ${pct(s.ctr)}`).join(' ／ ')}`
                    : ' ・ この日の反応ログはまだありません'}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', fontWeight: 700 }}>
                選択中の資産の状況
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'monospace', color: ACCENT }}>
                {selected.name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch', minWidth: 'min-content', flexShrink: 0 }}>
              <GraphCard title="① 反応の推移" hint="直近14日の 表示・クリック・CTR">
                <ReactionTrendCard
                  series={trendSeries}
                  wired={!!meta?.surface}
                  loading={rangeLoading}
                  error={rangeError}
                  unwiredNote={selected.name === 'chat-router'
                    ? 'chat 本体の surface 配線待ち（応答の書き直し/再生成を記録してから）。'
                    : 'この資産はまだ反応ログに配線されていません。'}
                />
              </GraphCard>
              <GraphCard title="② 資産の規模" hint="現在の件数（コレクション横断）">
                <SizeCard counts={counts} loading={countsLoading} error={countsError} activeKey={meta?.countKey} />
              </GraphCard>
              <GraphCard title="③ 学習の梯子・成熟度" hint="6段のどこまで来たか＋状態">
                <LadderCard rung={meta?.rung ?? 1} status={selected.status} />
              </GraphCard>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── 右サイドバー: 選択中の資産の詳細（下まで伸ばす・常時表示） ─────────── */}
      <Box
        sx={{
          width: 380, flexShrink: 0, height: '100%', borderLeft: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', p: 3, display: 'flex', flexDirection: 'column', gap: 2.5,
          overflowY: 'auto',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {selected.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: -1 }}>
          <Chip label={selected.status} size="small" color={statusColor[selected.status]} variant={selected.status === '構想' ? 'outlined' : 'filled'} />
          <Chip label={selected.kind} size="small" variant="outlined" />
          <Chip label={selected.scope} size="small" variant="outlined" />
        </Box>
        {selected.note && (
          <Typography variant="body2" sx={{ color: 'info.main', mt: -1 }}>{selected.note}</Typography>
        )}
        <Divider />
        <DetailSection label="これは何？">{selected.summary}</DetailSection>
        <Box sx={{
          p: 1.5, borderRadius: 2,
          bgcolor: 'light-dark(rgba(8,117,166,0.08), rgba(79,195,247,0.08))',
          border: '1px solid', borderColor: 'light-dark(rgba(8,117,166,0.3), rgba(79,195,247,0.3))',
        }}>
          <Typography variant="caption" sx={{ color: 'light-dark(#0875a6, #4fc3f7)', letterSpacing: '0.08em', fontWeight: 700 }}>
            何が良くなる？
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, lineHeight: 1.8 }}>{selected.benefit}</Typography>
        </Box>
        <DetailSection label="仕組み">{selected.how}</DetailSection>
        {selected.location && <DetailSection label="データの場所" mono>{selected.location}</DetailSection>}
        <DetailSection label="材料">{selected.source}</DetailSection>
        <DetailSection label="使用場所">{selected.usedBy}</DetailSection>
        {selected.ladder && <DetailSection label="学習の梯子">{selected.ladder}</DetailSection>}
        {selected.next && <DetailSection label="次の一歩">{selected.next}</DetailSection>}
      </Box>
    </Box>
  );
};
