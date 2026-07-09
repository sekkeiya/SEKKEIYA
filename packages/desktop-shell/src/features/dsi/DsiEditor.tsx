import React, { useEffect } from 'react';
import { Box, Typography, IconButton, Button, Tooltip } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import HighlightAltRoundedIcon from '@mui/icons-material/HighlightAltRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useDsiEditorStore } from './store/useDsiEditorStore';
import { DsiEditorChat } from './editor/DsiEditorChat';
import { RegionSelectLayer } from './editor/RegionSelectLayer';
import { BRAND } from '../../styles/theme';

const ACCENT = '#ec407a';

interface DsiEditorProps {
  payload?: { projectId?: string; workspaceName?: string };
  onBack: () => void;
}

/**
 * S.Image エディター — 3ペイン構成。
 * 左サイドバー（素材ブラウザ）は MainLayout が DsiEditorSidebar に差し替える。
 * 中央 = アクティブ系統の最新画像を大きく表示。右 = 派生系統チャット（v1/v2/…）。
 */
export const DsiEditor: React.FC<DsiEditorProps> = ({ payload, onBack }) => {
  const branches = useDsiEditorStore(s => s.branches);
  const activeBranchId = useDsiEditorStore(s => s.activeBranchId);
  const originImageUrl = useDsiEditorStore(s => s.originImageUrl);
  const originTitle = useDsiEditorStore(s => s.originTitle);
  const selectedImageUrl = useDsiEditorStore(s => s.selectedImageUrl);
  const region = useDsiEditorStore(s => s.region);
  const regionMode = useDsiEditorStore(s => s.regionMode);
  const setRegion = useDsiEditorStore(s => s.setRegion);
  const setRegionMode = useDsiEditorStore(s => s.setRegionMode);

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0] || null;
  const displayUrl = selectedImageUrl || activeBranch?.currentImageUrl || originImageUrl || null;
  const running = !!activeBranch?.messages.some(m => m.status === 'running');
  const isEditing = !!originImageUrl;

  // セッション未初期化（直接遷移など）でも落ちないように、最低限のガード。
  useEffect(() => {
    if (branches.length === 0) {
      const st = useDsiEditorStore.getState();
      st.initSession({ originImageUrl: null, originTitle: '', targetProjectId: st.targetProjectId || payload?.projectId || null, provider: st.provider });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg }}>
      {/* ヘッダー */}
      <Box sx={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, borderBottom: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
        <IconButton size="small" onClick={onBack} sx={{ color: 'var(--brand-fg)' }}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)' }}>S.Image エディター</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
          {isEditing ? `編集中: ${originTitle || '画像'}` : '画像生成'}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {/* ツールバー: 編集対象の範囲選択 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2, px: 0.5, py: 0.25 }}>
          <Button
            size="small"
            startIcon={<HighlightAltRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setRegionMode(!regionMode)}
            disabled={!displayUrl}
            sx={{
              fontSize: 11, textTransform: 'none', borderRadius: 1.5, px: 1,
              color: regionMode ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
              bgcolor: regionMode ? ACCENT : 'transparent',
              '&:hover': { bgcolor: regionMode ? '#f48fb1' : 'rgb(var(--brand-fg-rgb) / 0.08)' },
            }}
          >
            範囲選択
          </Button>
          <Tooltip title="範囲をクリア">
            <span>
              <IconButton
                size="small"
                disabled={!region}
                onClick={() => { setRegion(null); setRegionMode(false); }}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', '&:hover': { color: 'var(--brand-fg)' } }}
              >
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1 }} />

        {activeBranch && (
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>系統 {activeBranch.name}</Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 中央: アクティブ系統の画像を大きく表示 */}
        <Box sx={{ flex: 1, minWidth: 0, p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{
            width: '100%', height: '100%', borderRadius: 3, border: `1px solid ${BRAND.line}`,
            bgcolor: 'light-dark(rgba(15,23,42,0.06), rgba(0,0,0,0.3))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
          }}>
            {displayUrl ? (
              <>
                <img src={displayUrl} alt="active" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <RegionSelectLayer imageUrl={displayUrl} enabled={regionMode} />
                {running && (
                  <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1.5 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 40, color: ACCENT, animation: 'pulse 1.2s ease-in-out infinite' }} />
                    <Typography sx={{ color: 'var(--brand-fg)', fontSize: 13 }}>この系統で生成中…</Typography>
                  </Box>
                )}
              </>
            ) : running ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: 44, color: ACCENT, animation: 'pulse 1.2s ease-in-out infinite' }} />
                <Typography sx={{ fontSize: 13 }}>生成中…</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                <WallpaperRoundedIcon sx={{ fontSize: 64, opacity: 0.5 }} />
                <Typography variant="body1">画像はまだありません</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)', textAlign: 'center' }}>
                  右のチャットでプロンプトを入力するか<br />左の素材から編集する画像を選んでください
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* 右: 派生系統チャット */}
        <DsiEditorChat />
      </Box>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </Box>
  );
};

export default DsiEditor;
