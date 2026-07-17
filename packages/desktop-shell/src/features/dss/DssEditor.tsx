import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, IconButton, Button, CircularProgress, Dialog, Modal, FormControl, Select, MenuItem, TextField, Chip, InputAdornment } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import CloudRoundedIcon from '@mui/icons-material/CloudRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import AddToPhotosRoundedIcon from '@mui/icons-material/AddToPhotosRounded';

import { doc, onSnapshot } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '../../lib/firebase/client';

import { useAI3DCreateStore } from '../../store/useAI3DCreateStore';
import { useAuth } from '../dsl/layout/hooks/useAuthProxy';
import { useDriveAssets, PICKER_LAYERS } from '../drive/driveAccess';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { MODEL_3D_DISPLAY_NAMES } from '../ai-studio/constants/ai-model-plans';
import { useAiModelLimits } from '../ai-studio/hooks/useAiModelLimits';
import AI3DHistorySidebar, { type AIJob } from '../../components/AI/AI3DHistorySidebar';
import UploadModalContent from './upload/modal/UploadModalContent';
import { BRAND } from '../../styles/theme';

const ACCENT = '#ff5252'; // S.Model ブランドカラー
// model-viewer はグローバル登録済みの Web Component（JSX 型宣言が無いため any 経由で使用）。
const ModelViewer = 'model-viewer' as any;

const AI_MODELS = [{ id: 'tripo3d', label: MODEL_3D_DISPLAY_NAMES['tripo3d'] }];

// Drive 画像ピッカーのカテゴリ絞り込み。Drive 画像は家具/建築の厳密なカテゴリ列を持たないため、
// name / tags / memo / appScope をキーワード照合して S.Model のカテゴリ相当に振り分ける。
interface PickerCategory { key: string; label: string; kw: string[] }
const PICKER_CATEGORIES: PickerCategory[] = [
  { key: 'furniture', label: '家具', kw: ['家具', 'furniture', 'ソファ', 'sofa', 'チェア', 'chair', '椅子', 'テーブル', 'table', 'デスク', 'desk', 'ベッド', 'bed', '収納', '棚', 'shelf', 'キャビネット', 'cabinet', 'ラック', 'rack', 'スツール'] },
  { key: 'architecture', label: '建築・空間', kw: ['建築', 'architecture', '間取', 'floorplan', 'floor plan', 'plan', '平面', '空間', '内観', 'interior', '外観', 'exterior', 'パース', 'render', 'room', '部屋', '住宅', '店舗', 'オフィス', 'office', '3dsl'] },
  { key: 'decor', label: 'インテリア小物', kw: ['小物', '雑貨', 'decor', 'インテリア', 'ラグ', 'rug', '照明', 'light', 'ランプ', 'lamp', 'アート', 'art', '花瓶', 'vase', 'クッション', 'cushion', '時計', 'clock', 'ミラー', 'mirror'] },
  { key: 'equipment', label: '設備・備品', kw: ['設備', '備品', '家電', 'appliance', 'キッチン', 'kitchen', '洗面', 'トイレ', 'toilet', 'バス', 'bath', '空調', 'equipment', 'コンロ', 'シンク', 'sink', '冷蔵庫'] },
  { key: 'green', label: 'グリーン', kw: ['グリーン', 'green', '植物', 'plant', '観葉', '樹木', 'tree', '芝', '庭', 'garden', '花', 'flower', 'プランター'] },
];

/** 起動時のモード選択カード（S.Image エディターと同じ見た目・挙動）。 */
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

interface DssEditorProps {
  payload?: { projectId?: string; workspaceId?: string; workspaceName?: string };
  onBack: () => void;
}

/**
 * S.Model エディター — S.Image エディターと同じ 3ペイン構成の UI/UX。
 * 中央 = 起動時はモード選択カード → 画像選択後はプレビュー → 生成後は 3D ビューア。
 * 右 = 生成コンソール（AI モデル選択・生成開始・ステータス）／生成履歴。
 * 生成ロジックは既存の AI 3D 生成基盤（requestAiGeneration / aiJobs）を再利用する。
 */
export const DssEditor: React.FC<DssEditorProps> = ({ payload, onBack }) => {
  const { user } = useAuth();
  const { getRemainingText, isModelLocked } = useAiModelLimits();
  const {
    taskId, status, glbUrl, busy, selectedModel, imageUrl,
    setTaskId, setStatus, setGlbUrl, setBusy, setSelectedModel, setImageUrl,
  } = useAI3DCreateStore();

  const [urlInput, setUrlInput] = useState(imageUrl || '');
  const [rightTab, setRightTab] = useState<'chat' | 'history'>('chat');
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerCat, setPickerCat] = useState<string>('all');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { assets: driveAssets } = useDriveAssets({ media: 'image', layers: PICKER_LAYERS });

  // 検索テキスト＋カテゴリでピッカーを絞り込む（name / tags / memo / appScope を横断照合）。
  const filteredDriveAssets = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const cat = pickerCat === 'all' ? null : PICKER_CATEGORIES.find((c) => c.key === pickerCat) || null;
    if (!q && !cat) return driveAssets;
    return driveAssets.filter((a: any) => {
      const hay = [a.name, a.memo, a.appScope, ...(Array.isArray(a.tags) ? a.tags : [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (cat && !cat.kw.some((k) => hay.includes(k.toLowerCase()))) return false;
      return true;
    });
  }, [driveAssets, pickerQuery, pickerCat]);

  // 起動時: 生成中でなければクリーンな「何を作りますか？」から始める。保存先コンテキストを設定。
  useEffect(() => {
    const st = useAI3DCreateStore.getState();
    if (!st.busy && st.status !== 'running') {
      st.reset();
      setUrlInput('');
    }
    st.setContext(payload?.projectId || null, payload?.workspaceId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (imageUrl) setUrlInput(imageUrl); }, [imageUrl]);

  const running = busy || status === 'running';
  const showStart = !urlInput && !glbUrl && !running;

  const pickLocalImage = () => fileRef.current?.click();

  const handleFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setUrlInput(URL.createObjectURL(file));
      const url = await uploadImageAndGetUrl(file);
      setUrlInput(url);
      setImageUrl(url);
      setTaskId(null);
      setStatus('idle');
      setGlbUrl(null);
    } catch (err: any) {
      alert('画像の読み込みに失敗しました: ' + (err?.message || ''));
      setUrlInput('');
    } finally {
      setBusy(false);
    }
  };

  const pickDriveImage = (url: string) => {
    setUrlInput(url);
    setImageUrl(url);
    setTaskId(null);
    setStatus('idle');
    setGlbUrl(null);
    setIsDrivePickerOpen(false);
  };

  const clearImage = () => {
    setUrlInput('');
    setImageUrl(null);
    setTaskId(null);
    setStatus('idle');
    setGlbUrl(null);
  };

  const startGeneration = async (img: string) => {
    if (!user) { alert('ログインが必要です'); return; }
    if (isModelLocked(selectedModel)) { alert('利用上限に達しました。プランのアップグレードをご検討ください。'); return; }
    setTaskId(null);
    setStatus('running');
    setGlbUrl(null);
    setBusy(true);
    try {
      const requestAiGeneration = httpsCallable(functions, 'requestAiGeneration');
      const result = await requestAiGeneration({
        provider: selectedModel,
        type: 'image_to_3d',
        inputImageUrl: img,
        inputImageStoragePath: null,
        projectId: payload?.projectId || null,
        workspaceId: payload?.workspaceId || null,
        autoPlace: false,
        imageHash: 'hash_' + Date.now(),
      });
      const data = result.data as any;
      if (!data.success || !data.jobId) throw new Error(data.message || 'Failed to start generation job');
      setTaskId(data.jobId);
    } catch (err: any) {
      console.error('[DssEditor] generation start failed', err);
      alert('生成の開始に失敗しました: ' + (err?.message || ''));
      setStatus('error');
      setBusy(false);
    }
  };

  // aiJob の完了/失敗を購読。
  useEffect(() => {
    if (!taskId || status !== 'running' || !user) return;
    const jobRef = doc(db, 'users', user.uid, 'aiJobs', taskId);
    const unsub = onSnapshot(jobRef, async (snap) => {
      if (!snap.exists()) return;
      const jobData = snap.data();
      if (jobData.status === 'completed') {
        let finalUrl = jobData.glbUrl;
        if (!finalUrl && jobData.glbStoragePath) {
          try { finalUrl = await getDownloadURL(ref(storage, jobData.glbStoragePath)); }
          catch (e) { console.error('[DssEditor] glb url fetch failed', e); }
        }
        setGlbUrl(finalUrl || null);
        setStatus('done');
        setBusy(false);
      } else if (jobData.status === 'failed') {
        alert('3D生成に失敗しました: ' + (jobData.errorMessage || 'エラーが発生しました'));
        setStatus('error');
        setBusy(false);
      }
    }, (error) => {
      console.error('[DssEditor] job listener error', error);
      setStatus('error');
      setBusy(false);
    });
    return () => unsub();
  }, [taskId, status, user, setGlbUrl, setStatus, setBusy]);

  const handleLoadJob = async (job: AIJob) => {
    setUrlInput(job.inputImageUrl || '');
    setImageUrl(job.inputImageUrl || null);
    setTaskId(job.id);
    if (job.status === 'completed') {
      let finalUrl = job.glbUrl;
      if (!finalUrl && job.glbStoragePath) {
        try { finalUrl = await getDownloadURL(ref(storage, job.glbStoragePath)); }
        catch (e) { console.error('[DssEditor] job glb url fetch failed', e); }
      }
      setGlbUrl(finalUrl || null);
      setStatus('done');
    } else if (job.status === 'processing' || job.status === 'pending') {
      setStatus('running');
      setGlbUrl(null);
    } else {
      setStatus('error');
      setGlbUrl(null);
    }
    setRightTab('chat');
  };

  const handleDownload = (downloadUrl?: string) => {
    const url = downloadUrl || glbUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `model_${taskId || Date.now()}.glb`;
    a.click();
  };

  const handleSaveToModel = async (downloadUrl?: string) => {
    const url = downloadUrl || glbUrl;
    if (!url) return;
    try {
      setBusy(true);
      const res = await fetch(url, { cache: 'no-store' });
      const blob = await res.blob();
      const file = new File([blob], `AI_Model_${taskId || Date.now()}.glb`, { type: 'model/gltf-binary' });
      setUploadFiles([file]);
      setUploadModalOpen(true);
    } catch (e: any) {
      alert('モデルの保存準備に失敗しました: ' + (e?.message || ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg }}>
      {/* ヘッダー */}
      <Box sx={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.5, px: 2, borderBottom: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
        <IconButton size="small" onClick={onBack} sx={{ color: 'var(--brand-fg)' }}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <ViewInArRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)' }}>S.Model エディター</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
          {glbUrl ? '生成完了' : running ? '生成中…' : urlInput ? '画像から3D生成' : '3Dモデル生成'}
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 中央 */}
        <Box sx={{ flex: 1, minWidth: 0, p: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{
            width: '100%', height: '100%', borderRadius: 3, border: `1px solid ${BRAND.line}`,
            bgcolor: 'light-dark(rgba(15,23,42,0.06), rgba(0,0,0,0.3))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
          }}>
            {glbUrl ? (
              <>
                <ModelViewer
                  style={{ width: '100%', height: '100%', background: 'transparent' }}
                  src={glbUrl}
                  camera-controls
                  auto-rotate
                  shadow-intensity="1"
                  exposure="1.05"
                  environment-image="neutral"
                  ar
                  ar-modes="quick-look"
                  ar-scale="fixed"
                  ar-placement="floor"
                />
                <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained" size="small" startIcon={<CloudUploadRoundedIcon />}
                    onClick={() => handleSaveToModel()}
                    sx={{ textTransform: 'none', borderRadius: 2, bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#e53935' } }}
                  >
                    S.Modelに保存
                  </Button>
                  <Button
                    variant="outlined" size="small" startIcon={<DownloadRoundedIcon />}
                    onClick={() => handleDownload()}
                    sx={{ textTransform: 'none', borderRadius: 2, borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', color: 'var(--brand-fg)' }}
                  >
                    ダウンロード
                  </Button>
                  <Button
                    variant="text" size="small"
                    onClick={clearImage}
                    sx={{ textTransform: 'none', borderRadius: 2, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}
                  >
                    新規生成
                  </Button>
                </Box>
              </>
            ) : running ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {urlInput && <img src={urlInput} alt="input" style={{ maxWidth: 220, maxHeight: 220, objectFit: 'contain', borderRadius: 12, opacity: 0.5 }} />}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
                  <ViewInArRoundedIcon sx={{ fontSize: 44, color: ACCENT, animation: 'pulse 1.2s ease-in-out infinite' }} />
                  <Typography sx={{ fontSize: 13 }}>3Dモデルを生成中…（数分かかる場合があります）</Typography>
                </Box>
              </Box>
            ) : urlInput ? (
              // 画像選択済み: プレビュー＋生成開始。
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, px: 3, maxWidth: 420 }}>
                <Box sx={{ position: 'relative' }}>
                  <img src={urlInput} alt="input" style={{ maxWidth: 340, maxHeight: 320, objectFit: 'contain', borderRadius: 12 }} />
                  <IconButton size="small" onClick={clearImage} sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
                    <CloseRoundedIcon fontSize="small" sx={{ color: 'var(--brand-fg)' }} />
                  </IconButton>
                </Box>
                <Button
                  variant="contained" disabled={busy}
                  startIcon={<AutoFixHighRoundedIcon />}
                  onClick={() => startGeneration(urlInput)}
                  sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 3, py: 1, bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#e53935' } }}
                >
                  この画像から3Dモデルを生成
                </Button>
              </Box>
            ) : showStart ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, px: 3 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-fg)' }}>何を作りますか？</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: -1 }}>元にする画像を選んでください（画像から3Dモデルを生成します）</Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <ModeCard icon={<ImageRoundedIcon />} title="画像から生成" desc="手持ちの画像をアップロードして3D化" onClick={pickLocalImage} disabled={busy} />
                  <ModeCard icon={<CloudRoundedIcon />} title="Driveから生成" desc="SEKKEIYA Drive の画像から3D化" onClick={() => setIsDrivePickerOpen(true)} disabled={busy} />
                </Box>
                {busy && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                    <CircularProgress size={16} sx={{ color: ACCENT }} />
                    <Typography sx={{ fontSize: 12 }}>画像を読み込み中…</Typography>
                  </Box>
                )}
              </Box>
            ) : null}
          </Box>
        </Box>

        {/* 右: タブ（生成コンソール / 生成履歴） */}
        <Box sx={{ width: 360, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${BRAND.line}`, bgcolor: BRAND.panel }}>
          <Box sx={{ display: 'flex', flexShrink: 0, borderBottom: `1px solid ${BRAND.line}` }}>
            {([['chat', '生成'], ['history', '生成履歴']] as const).map(([key, label]) => (
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

          {rightTab === 'chat' ? (
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* AI モデル選択 */}
              <Box>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>AI モデル</Typography>
                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                  <Select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={running}
                    sx={{ color: 'var(--brand-fg)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
                  >
                    {AI_MODELS.map((m) => (
                      <MenuItem key={m.id} value={m.id} disabled={isModelLocked(m.id)}>
                        {m.label} {getRemainingText(m.id)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* 入力画像 */}
              <Box>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>入力画像</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    variant="outlined" size="small" fullWidth disabled={running}
                    startIcon={<UploadFileRoundedIcon />} onClick={pickLocalImage}
                    sx={{ borderRadius: 1.5, textTransform: 'none', color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', borderStyle: 'dashed' }}
                  >
                    ローカルから
                  </Button>
                  <Button
                    variant="outlined" size="small" fullWidth disabled={running}
                    startIcon={<AddToPhotosRoundedIcon />} onClick={() => setIsDrivePickerOpen(true)}
                    sx={{ borderRadius: 1.5, textTransform: 'none', color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', borderStyle: 'dashed' }}
                  >
                    Driveから
                  </Button>
                </Box>
                {urlInput && (
                  <Box sx={{ mt: 1.5, position: 'relative', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.25)' }}>
                    <img src={urlInput} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'contain' }} />
                  </Box>
                )}
              </Box>

              {/* 生成 */}
              <Button
                variant="contained" disabled={!urlInput || running}
                startIcon={running ? <CircularProgress size={16} sx={{ color: 'var(--brand-fg)' }} /> : <AutoFixHighRoundedIcon />}
                onClick={() => urlInput && startGeneration(urlInput)}
                sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700, py: 1, bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: '#e53935' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', color: 'rgb(var(--brand-fg-rgb) / 0.4)' } }}
              >
                {running ? '生成中…' : '3Dモデルを生成'}
              </Button>

              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', lineHeight: 1.7 }}>
                家具や小物などは、正面がはっきり写った1枚の画像がきれいに3D化できます。生成には数分かかることがあります。
              </Typography>
            </Box>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <AI3DHistorySidebar
                onSelectJob={handleLoadJob}
                onRetryJob={(job) => job.inputImageUrl && startGeneration(job.inputImageUrl)}
                onSaveTo3DSS={(job) => handleSaveToModel(job.glbUrl)}
                onDownload={(job) => handleDownload(job.glbUrl)}
                selectedJobId={taskId}
              />
            </Box>
          )}
        </Box>
      </Box>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFromFile} />

      {/* SEKKEIYA Drive 画像ピッカー */}
      <Dialog open={isDrivePickerOpen} onClose={() => setIsDrivePickerOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: BRAND.bg, backgroundImage: 'none', height: '60vh' } }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'var(--brand-fg)', fontWeight: 700 }}>SEKKEIYA Drive から画像を選択</Typography>
          <IconButton onClick={() => setIsDrivePickerOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><CloseRoundedIcon /></IconButton>
        </Box>
        {/* 絞り込み: 検索テキスト＋カテゴリチップ（家具/建築 など） */}
        <Box sx={{ px: 2, pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flexShrink: 0 }}>
          <TextField
            size="small" fullWidth
            placeholder="キーワードで検索（例: ソファ, 間取り, キッチン）"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
                </InputAdornment>
              ),
            }}
            sx={{ '.MuiOutlinedInput-root': { color: 'var(--brand-fg)', borderRadius: 2 }, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
          />
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {[{ key: 'all', label: 'すべて' }, ...PICKER_CATEGORIES].map((c) => {
              const active = pickerCat === c.key;
              return (
                <Chip
                  key={c.key}
                  label={c.label}
                  size="small"
                  onClick={() => setPickerCat(c.key)}
                  sx={{
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.65)',
                    bgcolor: active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.06)',
                    border: `1px solid ${active ? ACCENT : 'transparent'}`,
                    '&:hover': { bgcolor: active ? '#e53935' : 'rgb(var(--brand-fg-rgb) / 0.12)' },
                  }}
                />
              );
            })}
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 2 }}>
            {filteredDriveAssets.length === 0 ? (
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                {driveAssets.length === 0 ? '画像アセットが見つかりません' : '条件に一致する画像がありません'}
              </Typography>
            ) : (
              filteredDriveAssets.map((asset) => (
                <Box
                  key={asset.id}
                  onClick={() => pickDriveImage(asset.storageUrl || asset.url || '')}
                  sx={{ aspectRatio: '1', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 2, overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent', '&:hover': { borderColor: ACCENT } }}
                >
                  <img src={asset.storageUrl || asset.url || ''} alt={asset.title || 'image'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Dialog>

      {/* S.Model へ保存（アップロードモーダル） */}
      <Modal open={uploadModalOpen} onClose={() => setUploadModalOpen(false)}>
        {/* @ts-ignore */}
        <UploadModalContent open={uploadModalOpen} onClose={() => setUploadModalOpen(false)} initialFiles={uploadFiles} />
      </Modal>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
    </Box>
  );
};

export default DssEditor;
