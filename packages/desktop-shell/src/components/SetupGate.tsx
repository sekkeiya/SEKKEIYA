import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Box, Typography, LinearProgress, Button, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';

interface DownloadProgress {
  downloaded: number;
  total: number;
  pct: number;
  phase: 'downloading' | 'extracting' | 'done';
}

type SetupPhase = 'checking' | 'prompt' | 'downloading' | 'done';

export function SetupGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SetupPhase>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    invoke<boolean>('needs_blender_setup')
      .then((needed) => setPhase(needed ? 'prompt' : 'done'))
      .catch(() => setPhase('done')); // エラー時はセットアップをスキップして続行
  }, []);

  const handleDownload = useCallback(async () => {
    setPhase('downloading');
    setErrorMsg(null);

    const unlisten = await listen<DownloadProgress>('blender-download-progress', (ev) => {
      setProgress(ev.payload);
      if (ev.payload.phase === 'done') setPhase('done');
    });

    try {
      await invoke('download_blender');
    } catch (e) {
      setErrorMsg(String(e));
      setPhase('prompt'); // エラー時は確認画面に戻す
    } finally {
      unlisten();
    }
  }, []);

  const handleSkip = useCallback(() => setPhase('done'), []);

  return (
    <>
      {/* 子コンテンツは常にマウント（バックグラウンドで初期化が進む） */}
      <Box sx={{ visibility: phase === 'done' ? 'visible' : 'hidden', height: '100%' }}>
        {children}
      </Box>

      <AnimatePresence>
        {phase !== 'done' && phase !== 'checking' && (
          <Box
            component={motion.div}
            key="setup-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            sx={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              background: 'linear-gradient(135deg, #0c0c1a 0%, #111120 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component={motion.div}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              sx={{ width: 420, textAlign: 'center' }}
            >
              {/* ロゴ */}
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.25em',
                  color: alpha('#fff', 0.3),
                  mb: 1,
                  textTransform: 'uppercase',
                }}
              >
                SEKKEIYA Desktop
              </Typography>

              <Typography
                sx={{ fontSize: 20, fontWeight: 800, color: '#fff', mb: 0.75 }}
              >
                {phase === 'downloading' ? 'セットアップ中…' : '初回セットアップ'}
              </Typography>

              <Typography
                sx={{
                  fontSize: 13,
                  color: alpha('#fff', 0.5),
                  lineHeight: 1.75,
                  mb: 4,
                }}
              >
                {phase === 'prompt' ? (
                  <>
                    高品質 Cycles レンダリングに必要なコンポーネント
                    <br />
                    (Blender, 約 300 MB) をダウンロードします。
                    <br />
                    この処理は一度だけ行われます。
                  </>
                ) : progress?.phase === 'extracting' ? (
                  '展開中です。しばらくお待ちください…'
                ) : (
                  'ダウンロード中です。しばらくお待ちください…'
                )}
              </Typography>

              {/* 進捗バー（ダウンロード中のみ） */}
              {phase === 'downloading' && (
                <Box sx={{ mb: 3.5 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                  >
                    <Typography sx={{ fontSize: 12, color: alpha('#fff', 0.55) }}>
                      {progress?.phase === 'extracting'
                        ? `展開中… ${progress.pct ?? 0}%`
                        : `ダウンロード中… ${progress?.pct ?? 0}%`}
                    </Typography>
                    {progress?.phase === 'downloading' && progress.total > 0 && (
                      <Typography sx={{ fontSize: 12, color: alpha('#fff', 0.35) }}>
                        {Math.round(progress.downloaded / 1024 / 1024)} /{' '}
                        {Math.round(progress.total / 1024 / 1024)} MB
                      </Typography>
                    )}
                  </Stack>

                  <LinearProgress
                    variant={
                      progress?.phase === 'extracting' && (progress?.pct ?? 0) === 0
                        ? 'indeterminate'
                        : 'determinate'
                    }
                    value={progress?.pct ?? 0}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      background: alpha('#fff', 0.08),
                      '& .MuiLinearProgress-bar': {
                        background:
                          'linear-gradient(90deg, #6c87ff 0%, #a78bfa 100%)',
                        borderRadius: 3,
                      },
                    }}
                  />
                </Box>
              )}

              {/* エラー */}
              {errorMsg && (
                <Typography
                  sx={{
                    fontSize: 11,
                    color: '#f87171',
                    mb: 2,
                    background: alpha('#f87171', 0.1),
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.75,
                  }}
                >
                  {errorMsg}
                </Typography>
              )}

              {/* アクションボタン */}
              {phase === 'prompt' && (
                <Stack direction="row" spacing={1.5} justifyContent="center">
                  <Button
                    variant="text"
                    size="small"
                    onClick={handleSkip}
                    sx={{
                      textTransform: 'none',
                      fontSize: 12,
                      color: alpha('#fff', 0.4),
                      '&:hover': { color: alpha('#fff', 0.65) },
                    }}
                  >
                    スキップ（あとで設定）
                  </Button>
                  <Button
                    variant="contained"
                    size="medium"
                    onClick={handleDownload}
                    sx={{
                      textTransform: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                      px: 3,
                      background:
                        'linear-gradient(135deg, #6c87ff 0%, #a78bfa 100%)',
                      boxShadow: '0 4px 20px rgba(108,135,255,0.35)',
                      '&:hover': {
                        background:
                          'linear-gradient(135deg, #7c97ff 0%, #b78bfa 100%)',
                        boxShadow: '0 4px 24px rgba(108,135,255,0.5)',
                      },
                    }}
                  >
                    ダウンロードして始める
                  </Button>
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </AnimatePresence>
    </>
  );
}
