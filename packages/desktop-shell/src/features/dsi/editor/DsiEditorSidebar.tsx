/**
 * DsiEditorSidebar — S.Image エディター画面用の左サイドバー（版管理ツリー）。
 *
 * ダッシュボードの DsiSidebar（プロジェクトナビ）と切り替わり、編集中は編集セッションの
 * ツリーを表示する:
 *   元画像
 *   v1 / 画像3・画像2・画像1
 *   v2 / …
 *   v3 / …
 * ノードをクリックすると中央にその画像を表示（系統も切り替わる）。「系統を追加」で別方向を試す。
 * 下部のボタンからローカル画像を読み込んで新しい編集セッションを開始できる。
 */
import React, { useCallback, useRef, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Button, CircularProgress } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { uploadImageAndGetUrl } from '../../../lib/firebase/uploadImage';
import { useAppStore } from '../../../store/useAppStore';
import { isEditCapableProvider, DEFAULT_EDIT_PROVIDER } from '../../../store/useAiSettingsStore';
import { useDsiEditorStore } from '../store/useDsiEditorStore';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ec407a';

// 系統サムネ（画像ノード）
const NodeThumb: React.FC<{ url: string; label: string; active: boolean; onClick: () => void; indent?: boolean }>
  = ({ url, label, active, onClick, indent }) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 0.75, py: 0.5, ml: indent ? 1.5 : 0, borderRadius: 1.5, cursor: 'pointer',
      border: active ? `1px solid ${ACCENT}` : '1px solid transparent',
      bgcolor: active ? `${ACCENT}18` : 'transparent',
      transition: 'background-color 0.15s, border-color 0.15s',
      '&:hover': { bgcolor: active ? `${ACCENT}22` : 'rgb(var(--brand-fg-rgb) / 0.05)' },
    }}
  >
    <Box sx={{ width: 40, height: 30, borderRadius: 1, overflow: 'hidden', flexShrink: 0, bgcolor: 'var(--brand-bg)' }}>
      <img src={url} alt={label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </Box>
    <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 11, color: active ? ACCENT : 'var(--brand-fg)' }}>{label}</Typography>
  </Box>
);

export const DsiEditorSidebar: React.FC = () => {
  const isProjectSidebarOpen = useAppStore(s => s.isProjectSidebarOpen);
  const setDsiShellMode = useAppStore(s => s.setDsiShellMode);
  const branches = useDsiEditorStore(s => s.branches);
  const originImageUrl = useDsiEditorStore(s => s.originImageUrl);
  const originTitle = useDsiEditorStore(s => s.originTitle);
  const activeBranchId = useDsiEditorStore(s => s.activeBranchId);
  const selectedImageUrl = useDsiEditorStore(s => s.selectedImageUrl);
  const setActiveBranch = useDsiEditorStore(s => s.setActiveBranch);
  const setSelectedImage = useDsiEditorStore(s => s.setSelectedImage);
  const addBranch = useDsiEditorStore(s => s.addBranch);
  const removeBranch = useDsiEditorStore(s => s.removeBranch);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectImage = useCallback((branchId: string, url: string) => {
    setActiveBranch(branchId);
    setSelectedImage(url);
  }, [setActiveBranch, setSelectedImage]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageAndGetUrl(file);
      const st = useDsiEditorStore.getState();
      // 画像を起点にする＝編集。編集対応モデルでなければ既定の編集対応モデルへ。
      const provider = isEditCapableProvider(st.provider) ? st.provider : DEFAULT_EDIT_PROVIDER;
      st.initSession({ originImageUrl: url, originTitle: file.name.replace(/\.[^.]+$/, ''), targetProjectId: st.targetProjectId, provider });
    } catch (err: any) {
      console.error('[DsiEditorSidebar] アップロードに失敗', err);
      alert('画像アップロードに失敗しました: ' + (err?.message || ''));
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: '100%',
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        overflowY: 'hidden', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 1, borderBottom: `1px solid ${BRAND.line}` }}>
        <Button
          size="small"
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => setDsiShellMode('dashboard')}
          sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, textTransform: 'none', mb: 1, '&:hover': { color: 'var(--brand-fg)' } }}
        >
          ダッシュボードへ戻る
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase' }}>
            系統ツリー
          </Typography>
          <Tooltip title="系統を追加（元画像から別方向を試す）">
            <IconButton size="small" onClick={() => addBranch()} sx={{ color: ACCENT }}>
              <AddRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ツリー */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {/* 元画像 */}
        {originImageUrl ? (
          <Box sx={{ mb: 0.5 }}>
            <NodeThumb
              url={originImageUrl}
              label={`元画像${originTitle ? `（${originTitle}）` : ''}`}
              active={selectedImageUrl === originImageUrl}
              onClick={() => setSelectedImage(originImageUrl)}
            />
          </Box>
        ) : (
          <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', px: 1, py: 0.5 }}>
            元画像なし（プロンプトから生成）
          </Typography>
        )}

        {/* 各系統 */}
        {branches.map((b) => {
          const results = b.messages.filter(m => m.role === 'assistant' && m.status === 'done' && m.imageUrl);
          const running = b.messages.some(m => m.status === 'running');
          const branchActive = b.id === activeBranchId;
          return (
            <Box key={b.id} sx={{ mt: 0.75 }}>
              {/* 系統ヘッダー */}
              <Box
                onClick={() => setActiveBranch(b.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                  bgcolor: branchActive ? `${ACCENT}14` : 'transparent',
                  '&:hover': { bgcolor: branchActive ? `${ACCENT}22` : 'rgb(var(--brand-fg-rgb) / 0.05)', '& .del': { opacity: 1 } },
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: branchActive ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.3)', flexShrink: 0 }} />
                <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 700, color: branchActive ? ACCENT : 'var(--brand-fg)' }}>{b.name}</Typography>
                {running && <CircularProgress size={11} sx={{ color: ACCENT }} />}
                {branches.length > 1 && (
                  <IconButton
                    className="del" size="small"
                    onClick={(e) => { e.stopPropagation(); removeBranch(b.id); }}
                    sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: '#ef9a9a' } }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                )}
              </Box>
              {/* 世代画像（新しい順） */}
              {results.length === 0 && !running ? (
                <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', ml: 2, py: 0.25 }}>まだ生成なし</Typography>
              ) : (
                results.slice().reverse().map((m, idx) => {
                  const genNo = results.length - idx; // 画像N（生成順）
                  return (
                    <NodeThumb
                      key={m.id}
                      url={m.imageUrl!}
                      label={`画像${genNo}`}
                      indent
                      active={selectedImageUrl === m.imageUrl && branchActive}
                      onClick={() => selectImage(b.id, m.imageUrl!)}
                    />
                  );
                })
              )}
            </Box>
          );
        })}
      </Box>

      {/* フッター: ローカルから読み込み */}
      <Box sx={{ p: 1.25, borderTop: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        <Button
          fullWidth size="small"
          startIcon={uploading ? <CircularProgress size={13} sx={{ color: 'inherit' }} /> : <CollectionsRoundedIcon />}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          sx={{
            color: 'rgb(var(--brand-fg-rgb) / 0.75)', fontSize: 11, justifyContent: 'flex-start', textTransform: 'none',
            border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 2, px: 1.5,
            '&:hover': { borderColor: ACCENT, color: 'var(--brand-fg)', bgcolor: `${ACCENT}11` },
          }}
        >
          {uploading ? '読み込み中…' : '別の画像を編集（ローカル）'}
        </Button>
      </Box>
    </Box>
  );
};

export default DsiEditorSidebar;
