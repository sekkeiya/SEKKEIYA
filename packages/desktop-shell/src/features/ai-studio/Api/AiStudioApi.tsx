/**
 * AI Studio「API・利用状況」パネル。
 * SEKKEIYA で使えるAIモデル/API を「用途・コスト（クレジット）・今月の利用状況」で一覧化し、
 * 上部にプラン別クレジットのサマリーを出す読み取り専用ダッシュボード。
 *
 * データ源（すべて既存・新規API不要）:
 *  - コスト/プランの正典: features/billing/creditModel.ts（CREDIT_COST / PLANS）
 *  - クレジット残高（購読）: features/billing/useCredits.ts
 *  - モデル別の月次利用/上限: features/ai-studio/hooks/useAiModelLimits.ts（users/{uid}.aiUsage）
 *  - チャット/画像プロバイダの一覧: store/useAiSettingsStore.ts
 *  - RAG ソース件数: store/useAiProfileStore.ts（knowledgeSources）
 *  - TTS 利用枠: Cloud Function getTtsUsage（best-effort）
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Chip, LinearProgress, Tooltip, CircularProgress } from '@mui/material';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { useCredits } from '../../billing/useCredits';
import { CREDIT_COST, PLANS, getPlan, formatJpy } from '../../billing/creditModel';
import { CHAT_MODEL_OPTIONS, IMAGE_PROVIDER_OPTIONS } from '../../../store/useAiSettingsStore';
import { useAiModelLimits } from '../hooks/useAiModelLimits';
import { useAiProfileStore } from '../../../store/useAiProfileStore';

const ACCENT = '#a855f7';

/** 1行 = 1モデル/プロバイダ。 */
interface CatalogRow {
  model: string;
  engine?: string;
  /** クレジット単価の表示（例「1 cr / 枚」）。0=ローカル無料。 */
  cost: string;
  /** 今月の利用状況（可能なら実データ、無ければ '—' や '従量'）。 */
  usage: string;
  /** 状態バッジ（有効/準備中/ローカル等）。 */
  status?: { label: string; tone: 'ok' | 'muted' | 'warn' };
  note?: string;
}

interface CatalogGroup {
  key: string;
  label: string;
  icon: React.ReactNode;
  desc: string;
  rows: CatalogRow[];
}

/** JST 現在月キー（aiUsage の月次リセット境界に一致）。 */
function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const StatusChip: React.FC<{ status: NonNullable<CatalogRow['status']> }> = ({ status }) => {
  const palette = {
    ok: { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' },
    warn: { bg: 'rgba(255,179,0,0.16)', fg: 'light-dark(#8a5b00, #ffd54f)' },
    muted: { bg: 'rgb(var(--brand-fg-rgb) / 0.08)', fg: 'rgb(var(--brand-fg-rgb) / 0.55)' },
  }[status.tone];
  return (
    <Chip label={status.label} size="small"
      sx={{ height: 20, fontSize: 10.5, fontWeight: 700, bgcolor: palette.bg, color: palette.fg }} />
  );
};

export const AiStudioApi: React.FC = () => {
  const credits = useCredits();
  const { userAiUsage, getRemainingText } = useAiModelLimits();
  const knowledgeSources = useAiProfileStore((s) => s.knowledgeSources);

  // TTS 利用枠（未デプロイ/未ログインなら静かに省略）
  const [tts, setTts] = useState<{ used5hSec: number; limit5hSec: number; used7dSec: number; limit7dSec: number } | null>(null);
  useEffect(() => {
    let alive = true;
    void import('../../../lib/firebase/client')
      .then(async ({ functions }) => {
        const { httpsCallable } = await import('firebase/functions');
        const r: any = await httpsCallable(functions, 'getTtsUsage')({});
        if (alive && r.data?.success) setTts(r.data);
      })
      .catch(() => { /* 静かに省略 */ });
    return () => { alive = false; };
  }, []);

  const monthKey = currentMonthKey();
  const monthlyCountOf = (id: string): number => {
    const u = userAiUsage?.[id] || {};
    return u.lastMonthlyResetAt === monthKey ? (u.monthlyCount || 0) : 0;
  };

  const planDef = credits.planId === 'official' ? null : getPlan(credits.planId);
  const planLabel = credits.planId === 'official' ? '公式（無制限）' : (planDef?.label ?? 'Free');

  const groups: CatalogGroup[] = useMemo(() => {
    const ttsUsage = tts
      ? `直近5h ${Math.round(tts.used5hSec / 60)}/${Math.round(tts.limit5hSec / 60)}分・7d ${Math.round(tts.used7dSec / 60)}/${Math.round(tts.limit7dSec / 60)}分`
      : '時間枠制（音声設定で確認）';

    return [
      {
        key: 'chat',
        label: 'チャット / オーケストレーション',
        icon: <SmartToyRoundedIcon />,
        desc: '設計フローの司令塔。ツール選択・提案・対話。',
        rows: CHAT_MODEL_OPTIONS.map((m) => ({
          model: m.label,
          cost: `${CREDIT_COST.chatTurn} cr / ターン`,
          usage: '従量（下のクレジット残に集計）',
        })),
      },
      {
        key: 'image',
        label: '画像生成',
        icon: <ImageRoundedIcon />,
        desc: 'パース・下絵・イメージの生成。',
        rows: IMAGE_PROVIDER_OPTIONS.map((p) => ({
          model: p.label,
          engine: p.description,
          cost: `${CREDIT_COST.image} cr / 枚`,
          usage: `今月 ${monthlyCountOf(p.value)} 枚`,
          status: p.available
            ? { label: '有効', tone: 'ok' as const }
            : { label: '準備中', tone: 'warn' as const },
        })),
      },
      {
        key: 'model3d',
        label: '画像 → 3D 化',
        icon: <ViewInArRoundedIcon />,
        desc: '写真・パースから 3D モデルを生成（クラウド Tripo）。原価の基準点。',
        rows: [{
          model: 'Tripo API（高品質）',
          engine: 'tripo3d',
          cost: `${CREDIT_COST.model3d} cr / 個`,
          usage: `今月 ${monthlyCountOf('tripo3d')} 個${getRemainingText('tripo3d')}`,
          status: { label: 'クラウド', tone: 'muted' as const },
        }],
      },
      {
        key: 'render',
        label: 'レンダリング',
        icon: <MovieRoundedIcon />,
        desc: 'フォトリアル静止画・動画。ユーザーのローカル GPU で実行。',
        rows: [{
          model: 'Cycles（ローカル GPU）',
          cost: `${CREDIT_COST.render} cr・無制限`,
          usage: 'ローカル実行（クレジット消費なし）',
          status: { label: 'ローカル', tone: 'muted' as const },
        }],
      },
      {
        key: 'voice',
        label: '音声（TTS）',
        icon: <RecordVoiceOverRoundedIcon />,
        desc: '記事・提案の読み上げ。新規合成分のみ時間枠を消費（キャッシュ再生は無制限）。',
        rows: [{
          model: 'AI 音声（Claude 式・時間窓）',
          cost: '時間枠制',
          usage: ttsUsage,
          status: { label: '時間で回復', tone: 'muted' as const },
        }],
      },
      {
        key: 'rag',
        label: 'ナレッジ（RAG）/ 埋め込み',
        icon: <AutoStoriesRoundedIcon />,
        desc: '資料・法令・メモを外付けの脳として AI の判断根拠に。',
        rows: [{
          model: 'gemini-embedding-001',
          cost: '取り込みに含む',
          usage: `取り込み済み ${knowledgeSources.length} 件`,
          status: { label: 'RAG', tone: 'muted' as const },
        }],
      },
    ];
  }, [tts, userAiUsage, knowledgeSources.length, monthKey, getRemainingText]);

  // クレジット消費バー
  const used = credits.monthlyUsed;
  const allot = credits.monthlyAllotment;
  const pct = credits.isUnlimited || !isFinite(allot) || allot <= 0
    ? 0
    : Math.min(100, Math.round((used / allot) * 100));

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
        <BoltRoundedIcon sx={{ color: ACCENT, fontSize: 24 }} />
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-fg)' }}>API・利用状況</Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 2.5 }}>
        SEKKEIYA で使える AI モデル／API を、用途・コスト（クレジット）・今月の利用状況で一覧表示します。
      </Typography>

      {/* Summary card */}
      <Box sx={{ p: 2.5, mb: 3, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>クレジット利用状況</Typography>
            <Chip label={planLabel} size="small"
              sx={{ height: 22, fontSize: 11, fontWeight: 800, bgcolor: 'rgba(168,85,247,0.14)', color: 'light-dark(#470ea0, #c4a3f7)' }} />
          </Box>
          {credits.loading && <CircularProgress size={14} sx={{ color: ACCENT }} />}
        </Box>

        {credits.isUnlimited ? (
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>無制限プラン（クレジット消費なし）</Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                今月の消費 {used} / {isFinite(allot) ? allot : '∞'} cr
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: pct >= 90 ? 'light-dark(#961818, #ef9a9a)' : 'var(--brand-fg)' }}>
                残り {isFinite(credits.remaining) ? credits.remaining : '∞'} cr
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct}
              sx={{ height: 8, borderRadius: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: pct >= 90 ? '#ef5350' : pct >= 70 ? '#ffb74d' : ACCENT, borderRadius: 4 } }} />
            <Box sx={{ display: 'flex', gap: 3, mt: 1.25, flexWrap: 'wrap' }}>
              <SummaryStat label="月次付与" value={`${isFinite(allot) ? allot : '∞'} cr`} />
              <SummaryStat label="Top-up 残" value={`${credits.topupBalance} cr`} />
              <SummaryStat label="今月あと 3D 化" value={credits.isUnlimited ? '∞' : `約 ${credits.model3dRemaining} 個`} />
              {planDef && <SummaryStat label="プラン月額" value={formatJpy(planDef.priceJpy)} />}
            </Box>
          </>
        )}
        <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1.5, lineHeight: 1.6 }}>
          1 クレジット ≈ ¥{Math.round(PLANS.standard.priceJpy! / PLANS.standard.monthlyCredits!)} 相当。ローカル実行（ルールベース自動処理・Cycles レンダ）は 0 クレジット。
          残高・消費の正本はサーバ側です。
        </Typography>
      </Box>

      {/* Catalog */}
      {groups.map((g) => (
        <Box key={g.key} sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ color: ACCENT, display: 'flex' }}>{React.cloneElement(g.icon as React.ReactElement<any>, { sx: { fontSize: 19 } })}</Box>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: 'var(--brand-fg)' }}>{g.label}</Typography>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 1, ml: 3.5 }}>{g.desc}</Typography>

          <Box sx={{ borderRadius: 2.5, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', overflow: 'hidden' }}>
            {g.rows.map((r, i) => (
              <Box key={i}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                  borderTop: i === 0 ? 'none' : '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)' }}>{r.model}</Typography>
                  {r.engine && <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{r.engine}</Typography>}
                </Box>
                <Box sx={{ width: 140, flexShrink: 0, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: r.cost.startsWith('0 ') ? '#4ade80' : 'light-dark(#470ea0, #c4a3f7)' }}>{r.cost}</Typography>
                </Box>
                <Tooltip title={r.usage}>
                  <Box sx={{ width: 180, flexShrink: 0, textAlign: 'right' }}>
                    <Typography noWrap sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{r.usage}</Typography>
                  </Box>
                </Tooltip>
                <Box sx={{ width: 80, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  {r.status && <StatusChip status={r.status} />}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      ))}

      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1, lineHeight: 1.6 }}>
        ※ コスト・プランは creditModel（docs/17）を単一の真実として表示しています。使用量はサーバの記録に最大1時間の反映遅れが出る場合があります。
      </Typography>
    </Box>
  );
};

const SummaryStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box>
    <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
    <Typography sx={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-fg)' }}>{value}</Typography>
  </Box>
);
