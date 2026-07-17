/**
 * TtsUsageMeter — AI音声（ニューラルTTS）の利用枠メーター（Claude式・時間窓リセット）。
 * CF getTtsUsage を呼び、直近5時間/7日間の使用分数をプログレスバーで表示する。
 * 新規合成分だけが減り、キャッシュ再生は無制限。枠切れ時は回復予定時刻も出す。
 *
 * 使用箇所: Global Settings > 音声 / 読み上げ設定ダイアログ（Reader ⚙）/ AI使用量モニター。
 * 未デプロイ・未ログイン時は静かに非表示（呼び出し側のレイアウトを崩さない）。
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

const ACCENT = '#8ab4f8';

interface TtsUsage {
  used5hSec: number; limit5hSec: number;
  used7dSec: number; limit7dSec: number;
  reset5At?: number | null; reset7At?: number | null;
}

const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

export const TtsUsageMeter: React.FC<{ dense?: boolean }> = ({ dense = false }) => {
  const [usage, setUsage] = useState<TtsUsage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void import('../../lib/firebase/client')
      .then(async ({ functions }) => {
        const { httpsCallable } = await import('firebase/functions');
        const r: any = await httpsCallable(functions, 'getTtsUsage')({});
        if (alive && r.data?.success) setUsage(r.data);
        else if (alive) setFailed(true);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  if (failed) return null; // 未デプロイ/未ログイン時は静かに非表示
  const rows = usage ? [
    { label: '直近5時間', used: usage.used5hSec, limit: usage.limit5hSec, resetAt: usage.reset5At },
    { label: '直近7日間', used: usage.used7dSec, limit: usage.limit7dSec, resetAt: usage.reset7At },
  ] : [];
  return (
    <Box sx={dense ? {} : { mt: 2, pt: 1.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 1 }}>
        AI音声の利用枠（時間経過で自動回復）
      </Typography>
      {!usage ? (
        <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>読み込み中…</Typography>
      ) : rows.map((r) => {
        const pct = Math.min(100, Math.round((r.used / Math.max(1, r.limit)) * 100));
        return (
          <Box key={r.label} sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{r.label}</Typography>
              <Typography sx={{ fontSize: 11, color: pct >= 100 ? 'light-dark(#961818, #ef9a9a)' : 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                {Math.round(r.used / 60)} / {Math.round(r.limit / 60)} 分
                {pct >= 100 && r.resetAt ? `（${fmtClock(r.resetAt)}頃に回復）` : ''}
              </Typography>
            </Box>
            <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', overflow: 'hidden' }}>
              <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 3,
                bgcolor: pct >= 100 ? '#ef9a9a' : pct >= 80 ? '#ffb74d' : ACCENT, transition: 'width .3s' }} />
            </Box>
          </Box>
        );
      })}
      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.6 }}>
        カウントされるのは新しく合成した分だけです。一度聴いた記事の再生や保存済みの音声は無制限。
        枠を使い切っても標準音声（無料）に自動で切り替わり、時間が経つと回復します。
      </Typography>
    </Box>
  );
};
