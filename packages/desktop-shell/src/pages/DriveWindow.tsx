// DriveWindow — SEKKEIYA Drive（旧 AI Drive）の独立ネイティブウィンドウ（/?driveWindow=true）。
// SEKKEIYA OS のランチャー、またはグローバルショートカット Ctrl+Alt+D から開く。
// 中身は既存の AIDriveFullScreen をそのまま全面表示し、閉じる／Esc は窓のクローズへ振り替える。
//
// 「とりあえず放り込む」最速動線: この窓へ
//   - OS ファイルをドロップ（Explorer/ブラウザから）
//   - Ctrl+V でクリップボード画像を貼り付け
// すると自動で Drive（My Library もしくはアクティブプロジェクト）へ取り込む（stashFilesToDrive）。
// 同名の既存ファイルがある場合は「上書き / 別名で保存 / スキップ」を選ぶダイアログを出す。
// ※ Tauri は OS ファイルドロップを横取りするため、HTML5 の ondrop ではなく onDragDropEvent で受ける。
import React, { useEffect, useState } from 'react';
import { Box, Fade, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CircularProgress from '@mui/material/CircularProgress';
import AIDriveFullScreen from '../components/AI/AIDriveFullScreen';
import { stashFilesToDrive, type DuplicateMode } from '../features/drive/drivePublish';
import type { AIDriveAsset } from '../store/useAIDriveStore';
import { useAppStore } from '../store/useAppStore';

type DupPrompt = { name: string; existing: AIDriveAsset; resolve: (m: DuplicateMode) => void };

export const DriveWindow: React.FC = () => {
  const projectId = useAppStore((s) => s.activeProjectId) ?? null;
  const [status, setStatus] = useState<{ busy: boolean; msg: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dupPrompt, setDupPrompt] = useState<DupPrompt | null>(null);

  const handleClose = () => {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().close())
      .catch(() => {});
  };

  useEffect(() => {
    import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setTitle('SEKKEIYA Drive'))
      .catch(() => {});
  }, []);

  const flash = (msg: string) => {
    setStatus({ busy: false, msg });
    setTimeout(() => setStatus(null), 2800);
  };

  const summarize = (r: { ok: number; fail: number; skipped: number; overwritten: number }): string => {
    const parts: string[] = [];
    if (r.ok) parts.push(`${r.ok}件取り込み`);
    if (r.overwritten) parts.push(`${r.overwritten}件上書き`);
    if (r.skipped) parts.push(`${r.skipped}件スキップ`);
    if (r.fail) parts.push(`${r.fail}件失敗`);
    return parts.length ? `${parts.join('・')}` : '取り込むファイルがありませんでした';
  };

  // 同名の既存ファイルがあれば、ユーザーに上書き/別名/スキップを尋ねる（1件ずつ順に解決）。
  const resolveDuplicate = (existing: AIDriveAsset, file: File) =>
    new Promise<DuplicateMode>((resolve) => setDupPrompt({ name: file.name, existing, resolve }));

  const answerDup = (mode: DuplicateMode) => {
    dupPrompt?.resolve(mode);
    setDupPrompt(null);
  };

  const runStash = async (files: File[]) => {
    const r = await stashFilesToDrive(files, projectId, { resolveDuplicate });
    flash(summarize(r));
  };

  // OS ファイルドロップ（Tauri がネイティブに横取りするイベント）→ Drive へ取り込み。
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const { invoke } = await import('@tauri-apps/api/core');
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent(async (event: any) => {
          const p = event?.payload;
          if (!p) return;
          if (p.type === 'over' || p.type === 'enter') { setDragOver(true); return; }
          if (p.type === 'leave') { setDragOver(false); return; }
          if (p.type !== 'drop') return;
          setDragOver(false);
          const paths: string[] = Array.isArray(p.paths) ? p.paths : [];
          if (!paths.length) return;
          setStatus({ busy: true, msg: `${paths.length}件を取り込み中…` });
          const files: File[] = [];
          for (const path of paths) {
            try {
              const bytes = await invoke<number[]>('read_local_binary_file', { path });
              const name = path.split(/[\\/]/).pop() || 'file';
              files.push(new File([new Uint8Array(bytes)], name));
            } catch (e) {
              console.warn('[DriveWindow] read dropped file failed:', path, e);
            }
          }
          await runStash(files);
        });
      } catch (e) {
        console.warn('[DriveWindow] onDragDrop wiring failed:', e);
      }
    })();
    return () => { if (unlisten) unlisten(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Ctrl+V 貼り付け（クリップボード画像/ファイル）→ Drive へ取り込み。
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (!files.length) return;
      e.preventDefault();
      setStatus({ busy: true, msg: `${files.length}件を貼り付け中…` });
      await runStash(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: 'var(--brand-surface)', overflow: 'hidden', position: 'relative' }}>
      <AIDriveFullScreen onRequestClose={handleClose} />

      {/* ドラッグ中のオーバーレイ（放り込み先が Drive だと分かるように） */}
      <Fade in={dragOver}>
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '3px dashed #00BFFF',
        }}>
          <Box sx={{ px: 3, py: 2, borderRadius: 3, bgcolor: 'rgba(18,22,32,0.92)', color: 'var(--brand-fg)', fontWeight: 700, fontSize: 15 }}>
            ここにドロップして SEKKEIYA Drive に取り込む
          </Box>
        </Box>
      </Fade>

      {/* 取り込み進捗/完了トースト */}
      <Fade in={!!status}>
        <Box sx={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.1, borderRadius: 99,
          bgcolor: 'rgba(18,22,32,0.96)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.18)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        }}>
          {status?.busy
            ? <CircularProgress size={16} thickness={5} sx={{ color: '#00BFFF' }} />
            : <CloudDoneRoundedIcon sx={{ fontSize: 18, color: '#00BFFF' }} />}
          <Box sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)', whiteSpace: 'nowrap' }}>{status?.msg}</Box>
        </Box>
      </Fade>

      {/* 重複ダイアログ（同名ファイルが既にある場合） */}
      <Dialog open={!!dupPrompt} onClose={() => answerDup('skip')} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>同名のファイルが既にあります</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13.5, color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>
            「<b>{dupPrompt?.name}</b>」は SEKKEIYA Drive に既に存在します。<br />
            どうしますか？
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => answerDup('skip')} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', textTransform: 'none' }}>スキップ</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => answerDup('rename')} variant="outlined" sx={{ textTransform: 'none', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', color: 'var(--brand-fg)' }}>別名で保存</Button>
          <Button onClick={() => answerDup('overwrite')} variant="contained" sx={{ textTransform: 'none', bgcolor: '#00BFFF', color: '#03121b', fontWeight: 700, '&:hover': { bgcolor: '#33ccff' } }}>上書き</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
