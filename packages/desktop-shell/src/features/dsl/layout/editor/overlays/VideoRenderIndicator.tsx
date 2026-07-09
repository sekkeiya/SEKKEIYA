import { useEffect, useState } from 'react';
import { Box, Stack, Typography, LinearProgress, IconButton, Button, Fade } from '@mui/material';
import { alpha } from '@mui/material/styles';
import MovieCreationRoundedIcon from '@mui/icons-material/MovieCreationRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { useVideoRenderStore } from '../../store/useVideoRenderStore';

/**
 * 動画レンダリングの常駐インジケータ。
 * Media パネルを閉じても進捗が見えるよう、LayoutShell に常時マウントする。
 * 状態は useVideoRenderStore（グローバル）から購読する。
 */
function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoRenderIndicator({ onOpenMedia }: { onOpenMedia: () => void }) {
  const status = useVideoRenderStore((s) => s.status);
  const frame = useVideoRenderStore((s) => s.frame);
  const totalFrames = useVideoRenderStore((s) => s.totalFrames);
  const sample = useVideoRenderStore((s) => s.sample);
  const sampleTotal = useVideoRenderStore((s) => s.sampleTotal);
  const shotName = useVideoRenderStore((s) => s.shotName);
  const startedAt = useVideoRenderStore((s) => s.startedAt);
  const error = useVideoRenderStore((s) => s.error);
  const dismissError = useVideoRenderStore((s) => s.dismissError);
  const cancelVideoRender = useVideoRenderStore((s) => s.cancelVideoRender);

  const rendering = status === 'rendering';
  const done = status === 'done';
  const failed = status === 'error';

  // レンダリング中は経過/残り時間を 1 秒ごとに更新する
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rendering) return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [rendering]);

  // 完了インジケータを手動で隠す（結果はストアに保持＝破棄しない）。
  // 新しいレンダリングが始まったら再表示する。
  const [hiddenDone, setHiddenDone] = useState(false);
  useEffect(() => {
    if (rendering) setHiddenDone(false);
  }, [rendering]);

  if (status === 'idle') return null;
  if (done && hiddenDone) return null;

  // フレーム＋サンプルで滑らかな全体進捗を算出
  const frac =
    totalFrames > 0
      ? Math.min(1, Math.max(0, (Math.max(0, frame - 1) + (sampleTotal ? sample / sampleTotal : 0)) / totalFrames))
      : 0;
  const pct = Math.round(frac * 100);

  const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const eta = frac > 0.01 ? (elapsed / frac) * (1 - frac) : NaN;

  return (
    <Fade in>
      <Box
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 84,
          zIndex: 1400,
          width: 320,
          p: 1.75,
          borderRadius: 2,
          background: 'var(--brand-surface2)',
          border: `1px solid ${alpha('#fff', 0.1)}`,
          boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          color: 'var(--brand-fg)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          {rendering && <MovieCreationRoundedIcon sx={{ fontSize: 18, color: 'light-dark(#0020ad, #6c87ff)' }} />}
          {done && <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#4ade80' }} />}
          {failed && <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: 'light-dark(#a50808, #f87171)' }} />}
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, flex: 1 }} noWrap>
            {rendering && '動画をレンダリング中'}
            {done && '動画レンダリング完了'}
            {failed && 'レンダリング失敗'}
          </Typography>
          {rendering && (
            <IconButton
              size="small"
              onClick={cancelVideoRender}
              title="レンダリングを中止"
              sx={{ color: 'light-dark(rgba(165,8,8,0.7), rgba(248,113,113,0.7))', p: 0.25, '&:hover': { color: 'light-dark(#a50808, #f87171)' } }}
            >
              <StopCircleRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
          {(done || failed) && (
            <IconButton
              size="small"
              onClick={failed ? dismissError : () => setHiddenDone(true)}
              sx={{ color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", p: 0.25 }}
            >
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>

        {shotName && (
          <Typography sx={{ fontSize: 11, opacity: 0.55, mb: rendering ? 0.75 : 0 }} noWrap>
            {shotName}
          </Typography>
        )}

        {rendering && (
          <>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: 11, opacity: 0.7 }}>
                フレーム {frame || 0} / {totalFrames}
              </Typography>
              <Typography sx={{ fontSize: 11, opacity: 0.5 }}>{pct}%</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                borderRadius: 1,
                height: 5,
                background: alpha('#fff', 0.1),
                '& .MuiLinearProgress-bar': { background: '#6c87ff', borderRadius: 1 },
              }}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.6 }}>
              <Typography sx={{ fontSize: 10, opacity: 0.45 }}>
                サンプル {sample}/{sampleTotal || '—'}
              </Typography>
              <Typography sx={{ fontSize: 10, opacity: 0.45 }}>
                経過 {fmtClock(elapsed)} ・ 残り {fmtClock(eta)}
              </Typography>
            </Stack>
          </>
        )}

        {done && (
          <Button
            fullWidth
            size="small"
            startIcon={<CloudUploadRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={onOpenMedia}
            sx={{
              mt: 1,
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--brand-fg)',
              background: '#6c87ff',
              '&:hover': { background: '#5a73e8' },
            }}
          >
            開いてアップロード
          </Button>
        )}

        {failed && error && (
          <Typography sx={{ fontSize: 11, opacity: 0.6, mt: 0.5, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto' }}>
            {error.split('\n').slice(0, 3).join('\n')}
          </Typography>
        )}
      </Box>
    </Fade>
  );
}
