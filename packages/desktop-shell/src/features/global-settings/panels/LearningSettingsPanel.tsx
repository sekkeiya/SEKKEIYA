// Global Settings > 学習（管理者専用）。学習サイクルのモニター。
// - 反応ログ（reactionLogs）の日次集計を aggregateReactions CF で実行し、
//   surface ごとの impressions / clicks / CTR / rank別 / モデル別を表示する。
// - モデル台帳: 学習資産（モデル・索引・知識資産）の一覧と状態を一元把握する。
//   右サイドバーに常時、選択中の資産の詳細説明を表示する（行クリックで切り替え）。
// 管理者のみ到達（サイドバー＋シェルで二重ガード、CF 側は要認証）。
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Chip, Button, TextField, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, Divider,
} from '@mui/material';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';

// ---- モデル台帳（レジストリ） ------------------------------------------------
// 学習資産の静的台帳。実装が増えたらここに1行追加する（将来は Firestore 化も可）。
// 種別: モデル(A)=重みを持つ判定器 / 索引(B)=埋め込み・検索資産 / 資産(C)=ユーザー固有の知識
type AssetStatus = '稼働' | '収集中' | '構想';
interface LearningAsset {
  name: string;
  kind: 'モデル(A)' | '索引(B)' | '資産(C)' | '集計';
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
    name: 'reactionLogs', kind: '集計', scope: 'グローバル',
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
    name: 'reactionPatterns', kind: '集計', scope: 'グローバル',
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
    name: 'knowledgeChunks', kind: '索引(B)', scope: '個人',
    source: 'S.Library / ナレッジソース', usedBy: 'RAG（Chat 注入）', status: '稼働',
    summary: 'S.Library などのドキュメントを検索できる断片（チャンク）に分割し、意味の座標（埋め込みベクトル）を付けた索引。「貯めて引く」学習＝RAG の実体。',
    how: '取り込み時に Cloud Function が文書をチャンク化→埋め込みベクトルに変換して保存。Chat で質問すると、質問文に意味が近い断片を検索して AI のコンテキストに注入する。モデルの重みは変えずに「持ち込み資料」で賢くする方式なので、追加コストが小さく即時に効く。',
    location: 'users/{uid}/knowledgeChunks（＋ knowledgeSources）',
    ladder: '2段目（RAG）＋ 5段目（埋め込み）',
    next: '検索ヒット率・引用された断片の反応を reactionLogs に記録し、索引の質を測れるようにする。',
    benefit: 'AIが一般論ではなく「あなたの資料」を根拠に答えるようになる → 回答の的確さと信頼性が上がる。',
  },
  {
    name: 'driveAssets 埋め込み', kind: '索引(B)', scope: '個人',
    source: 'AI Drive のファイル分析', usedBy: 'Drive 検索', status: '稼働',
    summary: 'AI Drive にあるファイルを AI が分析（カテゴリ・タグ・要約）し、意味で検索できるようにした索引。',
    how: 'ファイルの追加・更新をトリガーに Cloud Function が Gemini で内容を分析し、カテゴリ/タグ/埋め込みを driveAssets に書き戻す。Drive 検索や Chat の添付検索（Ctrl+Alt+S）がこの索引を引く。',
    location: 'users/{uid}/driveAssets',
    ladder: '5段目（埋め込み）',
    next: '検索結果のクリック/採用を reactionLogs に記録して、検索品質の教師信号にする。',
    benefit: 'ファイル名を覚えていなくても意味で見つかる → 探す時間が減り、過去の資産が死蔵されなくなる。',
  },
  {
    name: 'aiMemory', kind: '資産(C)', scope: '個人',
    source: '会話からの決定・制約の蒸留', usedBy: 'agentTurn（_digest 注入）', status: '稼働',
    summary: '会話から蒸留した「決まったこと・制約・好み」の長期記憶。ユーザー固有の知識資産で、個人化の主役。',
    how: '会話の要点を Cloud Function が蒸留して保存し、予約ID _digest にダイジェストを維持。Chat の各ターンの前置きに注入されるので、AI が案件の経緯や本人の流儀を「覚えている」ように振る舞える。1人分のデータが少なくても効く＝「個人は記憶で、全体はモデルで」の実装。',
    location: 'users/{uid}/aiMemory ／ projects/{pid}/aiMemory',
    ladder: '2段目（メモリ）',
    next: 'R&M のユーザーロジック（思考の構造）をプレイブック化して、ここに合流させる構想。',
    benefit: '毎回イチから説明し直さなくてよくなる → 会話が短くなり、手戻りが減る。使うほど「話が早い」AIになる。',
  },
  {
    name: 'chip-ranker', kind: 'モデル(A)', scope: 'グローバル',
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
    name: 'chat-router', kind: 'モデル(A)', scope: 'グローバル',
    source: 'reactionLogs + usageLogs', usedBy: 'routeChat（auto 振り分け）', status: '構想',
    summary: 'Chat 入力の特徴から Haiku／Sonnet の最適な振り分けを判定する分類器。品質を保ちながらコストを下げる。',
    how: '現在の routeChat.js はルールベース（文字数・画像・キーワード等）。学習版は reactionLogs の特徴（inputLen / hasTool / intent）と応答への反応（書き直し・再生成＝失敗信号）、usageLogs のコストを突合して「安いモデルで十分だった入力」を学習する。',
    location: 'functions/llm/routeChat.js（ルール版が実装済み・enabled=false）',
    ladder: '4段目（自前の小さなMLモデル）',
    next: 'chat 本体の surface を reactionLogs に配線（応答への書き直し/再生成の記録）してから着手。',
    benefit: '同じ品質のまま応答が速く・安くなる → 待ち時間とAPIコストが下がる（浮いた分は機能開発へ）。',
  },
  {
    name: 'ssot-case-index', kind: '索引(B)', scope: 'グローバル',
    source: 'projects / SSOT 設計データ', usedBy: 'Chat / 類似事例提案', status: '構想',
    summary: '過去プロジェクト（SSOT）の設計データを埋め込み索引化し、「この条件に似た過去案件」を引けるようにする。データ堀の本命。',
    how: 'プロジェクトの設計データ（用途・規模・配置・素材など）を埋め込みベクトルに変換して索引化。新しい案件で Chat が「似た事例ではこうしていた」を検索して提案に使う。全ユーザー横断は匿名化・k-匿名性フィルタが前提。',
    location: 'projects/{pid}/workspaces/{wid}/items（材料）',
    ladder: '5段目（埋め込み＋ベクトル検索）',
    next: 'SSOT のどのフィールドを埋め込みに含めるかの設計から。knowledgeChunks の実装パターンを流用できる。',
    benefit: '「似た案件ではこうした」が提案に根拠として付く → 提案の説得力と設計の初速が上がる。',
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
  surfaces: Record<string, { impressions: number; clicks: number; ctr: number | null }>;
  eventCount: number;
  userCount: number;
}

// ---- 「学習で何が良くなるのか」成果カード -------------------------------------
const OUTCOMES: { icon: React.ReactNode; title: string; body: string; by: string }[] = [
  {
    icon: <AutoAwesomeRoundedIcon fontSize="small" />,
    title: '提案が当たるようになる',
    body: '先回りチップの的中率(CTR)が上がり、次にやることをワンタップで開始できる。',
    by: 'reactionLogs → chip-ranker',
  },
  {
    icon: <BoltRoundedIcon fontSize="small" />,
    title: '速く・安くなる',
    body: '質問の難易度に合ったモデルが選ばれ、同じ品質のまま待ち時間とコストが下がる。',
    by: 'chat-router',
  },
  {
    icon: <PersonRoundedIcon fontSize="small" />,
    title: 'あなた仕様になる',
    body: '決定・制約・好みを覚え、説明のし直しと手戻りが減る。使うほど話が早くなる。',
    by: 'aiMemory / 設計スタイル',
  },
  {
    icon: <HistoryEduRoundedIcon fontSize="small" />,
    title: '過去の経験が活きる',
    body: '「似た案件ではこうした」が提案に根拠として付き、説得力と初速が上がる。',
    by: 'ssot-case-index / knowledgeChunks',
  },
];

const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const pct = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`);
const statusColor: Record<AssetStatus, 'success' | 'info' | 'default'> = {
  '稼働': 'success', '収集中': 'info', '構想': 'default',
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const fn = httpsCallable(functions, 'aggregateReactions');
        const res = await fn({ days: 14 });
        if (alive) setRangeData(res.data as RangeResult);
      } catch (e: any) {
        if (alive) setRangeError(e?.message || '取得に失敗しました');
      } finally {
        if (alive) setRangeLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
      {/* ── メインカラム ─────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0, p: 4, display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PsychologyRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>学習モニター</Typography>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: -1.5 }}>
        学習サイクルの入力データ（反応ログ）と学習資産の状態を把握します。
        方針: 全体はモデルで、個人は記憶（RAG/メモリ）で。
      </Typography>

      {/* ── 学習で何が良くなる？（成果カード） ─────────────── */}
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>学習すると、何が良くなる？</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
          {OUTCOMES.map(o => (
            <Paper key={o.title} elevation={0} sx={{ ...sectionSx, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'light-dark(#0875a6, #4fc3f7)', mb: 0.5 }}>
                {o.icon}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>{o.title}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{o.body}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7, fontFamily: 'monospace', display: 'block', mt: 1 }}>
                担い手: {o.by}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* ── 学習の今（直近14日の推移グラフ） ─────────────── */}
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>学習の今 — 直近14日の反応</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          薄い棒＝提案が表示された回数、濃い棒＝クリックされた回数。
          <b>濃い棒の割合（CTR）が上がっていけば「提案が当たるようになってきた」＝学習が効いている証拠</b>です。
        </Typography>
        {rangeLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : rangeError ? (
          <Typography variant="body2" sx={{ color: 'error.main' }}>取得エラー: {rangeError}</Typography>
        ) : range && (
          <>
            {/* サマリー */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
              {(() => {
                const ti = range.daily.reduce((s, d) => s + d.impressions, 0);
                const tc = range.daily.reduce((s, d) => s + d.clicks, 0);
                return (
                  <>
                    <Typography variant="body2">表示 <b>{ti.toLocaleString()}</b> 回</Typography>
                    <Typography variant="body2">クリック <b>{tc.toLocaleString()}</b> 回</Typography>
                    <Typography variant="body2">CTR <b>{ti > 0 ? `${((tc / ti) * 100).toFixed(1)}%` : '—'}</b></Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>ユーザー {range.userCount} 人 / {range.start}〜{range.end}</Typography>
                  </>
                );
              })()}
            </Box>
            {/* 日別バー: 表示(薄)とクリック(濃)を重ねる */}
            {(() => {
              const maxImp = Math.max(1, ...range.daily.map(d => d.impressions));
              return (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120 }}>
                  {range.daily.map(d => (
                    <Tooltip key={d.day} title={`${d.day}: 表示${d.impressions} / クリック${d.clicks} / CTR ${d.ctr == null ? '—' : `${(d.ctr * 100).toFixed(1)}%`}`}>
                      <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                        <Box sx={{
                          width: '70%',
                          height: `${Math.max(d.impressions > 0 ? 4 : 1, (d.impressions / maxImp) * 100)}%`,
                          bgcolor: 'light-dark(rgba(8,117,166,0.25), rgba(79,195,247,0.25))',
                          borderRadius: 1,
                          position: 'relative',
                        }}>
                          <Box sx={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            height: d.impressions > 0 ? `${(d.clicks / Math.max(1, d.impressions)) * 100}%` : 0,
                            bgcolor: 'light-dark(#0875a6, #4fc3f7)',
                            borderRadius: 1,
                          }} />
                        </Box>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              );
            })()}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{range.start}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{range.end}</Typography>
            </Box>
            {range.daily.every(d => d.events === 0) && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                まだデータがありません。反応ログは Web 2026-07-10 / Desktop 0.1.12 から収集開始 — チップが表示・クリックされると、ここに棒が伸びていきます。
              </Typography>
            )}
          </>
        )}
      </Paper>

      {/* ── モデル台帳 ─────────────────────────────── */}
      <Paper elevation={0} sx={sectionSx}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>モデル台帳</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          1行＝1学習資産。何が・何のデータで・どこで効いているか。行をクリックすると右の詳細が切り替わります。
          種別: モデル(A)=判定器 / 索引(B)=埋め込み検索 / 資産(C)=ユーザー固有の知識。
        </Typography>
        <Table size="small">
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
            {REGISTRY.map(a => (
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
          </TableBody>
        </Table>
      </Paper>

      {/* ── 反応ログ 日次集計 ─────────────────────────── */}
      <Paper elevation={0} sx={sectionSx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>反応ログ 日次集計</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              指定日(JST)の reactionLogs を集計し insights/reactionPatterns に保存して表示します。
            </Typography>
          </Box>
          <TextField
            type="date" size="small" value={day}
            onChange={(e) => setDay(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained" size="small" disableElevation
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon />}
            onClick={() => void run()} disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            集計を実行
          </Button>
        </Box>

        {error && (
          <Typography variant="body2" sx={{ color: 'error.main', mt: 2 }}>エラー: {error}</Typography>
        )}

        {result && (
          <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2"><b>{result.day}</b></Typography>
              <Typography variant="body2">イベント: <b>{result.eventCount.toLocaleString()}</b></Typography>
              <Typography variant="body2">ユーザー: <b>{result.userCount.toLocaleString()}</b></Typography>
            </Box>
            {surfaceEntries.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                この日の反応ログはまだありません。クライアントのリリース後、チップの表示/クリックで貯まります。
              </Typography>
            ) : surfaceEntries.map(([surface, s]) => (
              <Paper key={surface} elevation={0} sx={{ ...sectionSx, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 600, fontFamily: 'monospace' }}>{surface}</Typography>
                  <Typography variant="body2">表示 <b>{s.impressions}</b></Typography>
                  <Typography variant="body2">クリック <b>{s.clicks}</b></Typography>
                  <Typography variant="body2">CTR <b>{pct(s.ctr)}</b></Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>匿名イベント {s.anonymousEvents}</Typography>
                </Box>
                {Object.keys(s.byRank).length > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                    表示順別クリック: {Object.entries(s.byRank).sort((a, b) => Number(a[0]) - Number(b[0])).map(([r, c]) => `#${Number(r) + 1}:${c}`).join('  ')}
                  </Typography>
                )}
                {s.topClickedLabels.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                    {s.topClickedLabels.map(l => (
                      <Chip key={l.label} size="small" variant="outlined" label={`${l.label} ×${l.count}`} />
                    ))}
                  </Box>
                )}
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      </Box>

      {/* ── 右サイドバー: 選択中の資産の詳細（常時表示） ─────────── */}
      <Box
        sx={{
          width: 380, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider',
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
