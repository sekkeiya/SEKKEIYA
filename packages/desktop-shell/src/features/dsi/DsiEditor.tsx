import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Button, Tooltip, CircularProgress } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import HighlightAltRoundedIcon from '@mui/icons-material/HighlightAltRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useDsiEditorStore, type DsiEditorMode } from './store/useDsiEditorStore';
import { DsiEditorChat } from './editor/DsiEditorChat';
import { DsiHistoryPanel } from './editor/DsiHistoryPanel';
import { RegionSelectLayer } from './editor/RegionSelectLayer';
import { useAuthStore } from '../../store/useAuthStore';
import { saveCurrentSession } from './dsiSessions';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { isEditCapableProvider, DEFAULT_EDIT_PROVIDER } from '../../store/useAiSettingsStore';
import { BRAND } from '../../styles/theme';

const ACCENT = '#ec407a';

/** 起動時のモード選択カード（テキストから / 画像から / 編集）。 */
const ModeCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void; disabled?: boolean }>
  = ({ icon, title, desc, onClick, disabled }) => (
  <Box
    onClick={disabled ? undefined : onClick}
    sx={{
      width: 210, p: 2.5, borderRadius: 3, cursor: disabled ? 'default' : 'pointer',
      bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center',
      opacity: disabled ? 0.5 : 1, transition: 'border-color .15s, transform .15s',
      '&:hover': disabled ? undefined : { borderColor: ACCENT, transform: 'translateY(-2px)' },
    }}
  >
    <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: `${ACCENT}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>{icon}</Box>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)' }}>{title}</Typography>
    <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.6 }}>{desc}</Typography>
  </Box>
);

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
  const mode = useDsiEditorStore(s => s.mode);
  const showStart = useDsiEditorStore(s => s.showStart);
  const chooseMode = useDsiEditorStore(s => s.chooseMode);

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0] || null;
  const displayUrl = selectedImageUrl || activeBranch?.currentImageUrl || originImageUrl || null;
  const running = !!activeBranch?.messages.some(m => m.status === 'running');

  // 「画像から生成 / 画像を編集」を選んだら、まずローカル画像を読み込んで元画像にする。
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingModeRef = useRef<Exclude<DsiEditorMode, 'text'>>('edit');
  const [uploading, setUploading] = useState(false);
  // 右パネルのタブ: 'chat'=生成/編集チャット, 'projects'=プロジェクト→チャット一覧。
  const [rightTab, setRightTab] = useState<'chat' | 'history'>('chat');
  const startWithImage = (m: Exclude<DsiEditorMode, 'text'>) => { pendingModeRef.current = m; fileRef.current?.click(); };
  const handleStartFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageAndGetUrl(file);
      const st = useDsiEditorStore.getState();
      // 画像入力を使うモードは画像編集対応モデル必須（FLUX schnell 等は入力画像を無視する）。
      const provider = isEditCapableProvider(st.provider) ? st.provider : DEFAULT_EDIT_PROVIDER;
      st.initSession({ originImageUrl: url, originTitle: file.name.replace(/\.[^.]+$/, ''), targetProjectId: st.targetProjectId, provider });
      st.chooseMode(pendingModeRef.current);
    } catch (err: any) {
      console.error('[DsiEditor] 画像読み込みに失敗', err);
      alert('画像の読み込みに失敗しました: ' + (err?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  // セッション未初期化（直接遷移など）でも落ちないように、最低限のガード。
  useEffect(() => {
    if (branches.length === 0) {
      const st = useDsiEditorStore.getState();
      st.initSession({ originImageUrl: null, originTitle: '', targetProjectId: st.targetProjectId || payload?.projectId || null, provider: st.provider });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自動保存: 生成履歴（branches）が変わるたびに Firestore へ debounce 保存（クラウド同期）。
  useEffect(() => {
    const uid = useAuthStore.getState().currentUser?.uid;
    if (!uid) return;
    let prev = useDsiEditorStore.getState().branches;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useDsiEditorStore.subscribe((s) => {
      if (s.branches === prev) return;
      prev = s.branches;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { saveCurrentSession(uid).catch((e) => console.warn('[DsiEditor] session save failed', e)); }, 1200);
    });
    return () => {
      unsub();
      if (timer) { clearTimeout(timer); saveCurrentSession(uid).catch(() => {}); } // 保留中を離脱時にフラッシュ
    };
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
          {mode === 'edit' ? `編集中: ${originTitle || '画像'}`
            : mode === 'img2img' ? '画像から生成'
            : 'テキストから生成'}
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
            ) : showStart ? (
              // 起動時のモード選択（テキストから / 画像から / 画像を編集）。
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, px: 3 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-fg)' }}>何を作りますか？</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: -1 }}>作りたいものを選んでください</Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <ModeCard icon={<TextFieldsRoundedIcon />} title="テキストから生成" desc="プロンプトだけで新しい画像を作る" onClick={() => chooseMode('text')} disabled={uploading} />
                  <ModeCard icon={<ImageRoundedIcon />} title="画像から生成" desc="手持ちの画像を参考に新しい画像を作る" onClick={() => startWithImage('img2img')} disabled={uploading} />
                  <ModeCard icon={<EditRoundedIcon />} title="画像を編集" desc="既存の画像の一部だけを指示で変える" onClick={() => startWithImage('edit')} disabled={uploading} />
                </Box>
                {uploading && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                    <CircularProgress size={16} sx={{ color: ACCENT }} />
                    <Typography sx={{ fontSize: 12 }}>画像を読み込み中…</Typography>
                  </Box>
                )}
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleStartFile} />
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

        {/* 右: タブ（チャット / プロジェクト→チャット一覧） */}
        <Box sx={{ width: 360, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
          <Box sx={{ display: 'flex', flexShrink: 0, borderBottom: `1px solid ${BRAND.line}` }}>
            {([['chat', 'チャット'], ['history', '生成履歴']] as const).map(([key, label]) => (
              <Box
                key={key}
                onClick={() => setRightTab(key)}
                sx={{
                  flex: 1, textAlign: 'center', py: 1, fontSize: 12, cursor: 'pointer',
                  fontWeight: rightTab === key ? 700 : 500,
                  color: rightTab === key ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.5)',
                  borderBottom: rightTab === key ? `2px solid ${ACCENT}` : '2px solid transparent',
                  '&:hover': { color: 'var(--brand-fg)' },
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
          {/* チャットは非表示時もアンマウントしない（生成中ジョブ購読を保つため display 切替）。 */}
          <Box sx={{ flex: 1, minHeight: 0, display: rightTab === 'chat' ? 'flex' : 'none' }}>
            <DsiEditorChat />
          </Box>
          {rightTab === 'history' && (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <DsiHistoryPanel />
            </Box>
          )}
        </Box>
      </Box>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </Box>
  );
};

export default DsiEditor;
