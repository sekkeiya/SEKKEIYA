import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, Box, Typography, Tabs, Tab, InputBase, CircularProgress, Button, IconButton, Chip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useAuthStore } from '../../store/useAuthStore';
import type { MediaKind, MediaPickerItem, MediaSource } from './types';
import { fetchDriveMedia, fetchProjectMedia, fetchGalleryMedia, resolveAuthorNames } from './mediaQueries';

const ACCENT = '#e57373';

type TabKey = 'mine' | 'gallery' | 'upload';

export interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** 選択 / アップロード完了時に呼ばれる（呼び出し側で本文へ挿入）。 */
  onPick: (item: MediaPickerItem) => void;
  /** AI Drive / アップロード先のユーザー。 */
  uid?: string;
  /** プロジェクト成果物を含める場合の projectId（account記事では未指定でOK）。 */
  projectId?: string | null;
  /** 受け入れるメディア種別（既定: 画像+動画）。 */
  accept?: MediaKind[];
  /** ローカルアップロード処理。未指定だとアップロードタブは出さない。 */
  onUpload?: (file: File) => Promise<MediaPickerItem>;
}

const SOURCE_LABEL: Record<MediaSource, string> = {
  drive: 'AI Drive',
  project: 'プロジェクト',
  gallery: '公開',
};

export const MediaPickerDialog: React.FC<MediaPickerDialogProps> = ({
  open, onClose, onPick, uid, projectId, accept = ['image', 'video'], onUpload,
}) => {
  const myUid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined) ?? uid;
  const [tab, setTab] = useState<TabKey>('mine');
  const [search, setSearch] = useState('');
  const [mineItems, setMineItems] = useState<MediaPickerItem[] | null>(null);
  const [galleryItems, setGalleryItems] = useState<MediaPickerItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [galleryMineOnly, setGalleryMineOnly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const acceptAttr = useMemo(() => {
    const parts: string[] = [];
    if (accept.includes('image')) parts.push('image/*');
    if (accept.includes('video')) parts.push('video/*');
    return parts.join(',');
  }, [accept]);

  // タブごとに遅延ロード（開いた時 / タブ切替時に一度だけ）
  const loadMine = useCallback(async () => {
    if (mineItems) return;
    setLoading(true);
    const [drive, project] = await Promise.all([
      myUid ? fetchDriveMedia(myUid, accept) : Promise.resolve([]),
      projectId ? fetchProjectMedia(projectId, accept) : Promise.resolve([]),
    ]);
    const merged = dedupe([...project, ...drive]);
    setMineItems(merged);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mineItems, myUid, projectId]);

  const loadGallery = useCallback(async () => {
    if (galleryItems) return;
    setLoading(true);
    const items = await fetchGalleryMedia(accept);
    const names = await resolveAuthorNames(items.map((i) => i.authorId));
    const withNames = items.map((i) => ({ ...i, authorName: i.authorId ? names[i.authorId] : undefined }));
    setGalleryItems(dedupe(withNames));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryItems]);

  useEffect(() => {
    if (!open) return;
    if (tab === 'mine') loadMine();
    if (tab === 'gallery') loadGallery();
  }, [open, tab, loadMine, loadGallery]);

  // 開閉でキャッシュをリセット（再オープン時に最新を取り直す）
  useEffect(() => {
    if (!open) {
      setMineItems(null);
      setGalleryItems(null);
      setSearch('');
      setTab('mine');
      setGalleryMineOnly(false);
    }
  }, [open]);

  const baseItems = tab === 'mine' ? mineItems : galleryItems;
  const filtered = useMemo(() => {
    let list = baseItems ?? [];
    if (tab === 'gallery' && galleryMineOnly && myUid) list = list.filter((i) => i.authorId === myUid);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => (i.title || '').toLowerCase().includes(q) || (i.authorName || '').toLowerCase().includes(q));
    return list;
  }, [baseItems, tab, galleryMineOnly, myUid, search]);

  const handleUploadFile = async (file: File) => {
    if (!onUpload) return;
    setUploading(true);
    try {
      const item = await onUpload(file);
      onPick(item);
      onClose();
    } catch (e) {
      console.error('[MediaPicker] upload failed', e);
      window.alert(e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'mine', label: 'マイ素材' },
    { key: 'gallery', label: '公開（Gallery）' },
    ...(onUpload ? [{ key: 'upload' as TabKey, label: 'アップロード' }] : []),
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#13151b', backgroundImage: 'none', color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2,
          height: '80vh', maxHeight: 720,
        },
      }}
    >
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.75, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>メディアを挿入</Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, px: 1.5, py: 0.5, border: '1px solid rgba(255,255,255,0.08)' }}>
          <SearchRoundedIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', mr: 1 }} />
          <InputBase placeholder="検索..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ color: '#fff', fontSize: 13, width: 180 }} />
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon /></IconButton>
      </Box>

      {/* タブ */}
      <Box sx={{ px: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => setTab(v)}
          sx={{ minHeight: 42, '& .MuiTabs-indicator': { bgcolor: ACCENT } }}
        >
          {TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} disableRipple
              sx={{ minHeight: 42, fontSize: 13, fontWeight: 700, textTransform: 'none', color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.45)' }} />
          ))}
        </Tabs>
        <Box sx={{ flex: 1 }} />
        {tab === 'gallery' && (
          <Chip
            label="自分の公開のみ"
            size="small"
            onClick={() => setGalleryMineOnly((v) => !v)}
            sx={{
              bgcolor: galleryMineOnly ? `${ACCENT}44` : 'rgba(255,255,255,0.06)',
              color: galleryMineOnly ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: 600,
            }}
          />
        )}
      </Box>

      {/* 本体 */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {tab === 'upload' ? (
          <UploadPane
            uploading={uploading}
            acceptAttr={acceptAttr}
            inputRef={uploadInputRef}
            onFile={handleUploadFile}
          />
        ) : loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'rgba(255,255,255,0.4)' }}>
            <Typography sx={{ fontSize: 14 }}>
              {tab === 'mine' ? '素材がありません。各子アプリや AI Drive に保存すると、ここから挿入できます。' : '公開素材が見つかりません。'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.25 }}>
            {filtered.map((item) => (
              <MediaCard key={item.id} item={item} onClick={() => { onPick(item); onClose(); }} />
            ))}
          </Box>
        )}
      </Box>
    </Dialog>
  );
};

// ── 1枚のサムネカード ──────────────────────────────────────
const MediaCard: React.FC<{ item: MediaPickerItem; onClick: () => void }> = ({ item, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      position: 'relative', borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer',
      border: '1px solid rgba(255,255,255,0.08)', bgcolor: '#0a0d17', aspectRatio: '4/3',
      transition: 'border-color 0.12s, transform 0.1s',
      '&:hover': { borderColor: ACCENT, transform: 'translateY(-1px)', '& .ov': { opacity: 1 } },
    }}
  >
    <Box component="img" src={item.thumbnailUrl} alt={item.title || ''} loading="lazy"
      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    {item.kind === 'video' && (
      <PlayCircleOutlineRoundedIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 30, color: 'rgba(255,255,255,0.92)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }} />
    )}
    {/* ソースバッジ */}
    <Box sx={{ position: 'absolute', top: 5, left: 5 }}>
      <Chip label={SOURCE_LABEL[item.source]} size="small" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 800, bgcolor: 'rgba(0,0,0,0.65)', color: item.source === 'gallery' ? '#ffd36b' : '#9db4ff' }} />
    </Box>
    {/* 下部：タイトル＋出典 */}
    <Box className="ov" sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, px: 0.75, py: 0.5, background: 'linear-gradient(transparent, rgba(0,0,0,0.85))', opacity: 0.85, transition: 'opacity 0.12s' }}>
      {item.title && <Typography noWrap sx={{ fontSize: '0.62rem', color: '#fff', fontWeight: 600 }}>{item.title}</Typography>}
      {item.source === 'gallery' && item.authorName && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'rgba(255,255,255,0.7)' }}>
          <PersonRoundedIcon sx={{ fontSize: 10 }} />
          <Typography noWrap sx={{ fontSize: '0.55rem' }}>{item.authorName}</Typography>
        </Box>
      )}
    </Box>
  </Box>
);

// ── アップロードペイン ──────────────────────────────────────
const UploadPane: React.FC<{
  uploading: boolean;
  acceptAttr: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}> = ({ uploading, acceptAttr, inputRef, onFile }) => {
  const [dragOver, setDragOver] = useState(false);
  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      sx={{
        height: '100%', minHeight: 320, borderRadius: 2, border: `2px dashed ${dragOver ? ACCENT : 'rgba(255,255,255,0.18)'}`,
        bgcolor: dragOver ? `${ACCENT}0f` : 'rgba(255,255,255,0.02)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, transition: 'all 0.15s',
      }}
    >
      {uploading ? (
        <>
          <CircularProgress sx={{ color: ACCENT }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>アップロード中...</Typography>
        </>
      ) : (
        <>
          <CloudUploadRoundedIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.35)' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>ファイルをドラッグ＆ドロップ、または</Typography>
          <Button
            variant="contained" startIcon={<CloudUploadRoundedIcon />}
            onClick={() => inputRef.current?.click()}
            sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}
          >
            ファイルを選択
          </Button>
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>画像（PNG/JPG/WebP/GIF）・動画（MP4/MOV/WebM）</Typography>
          <input ref={inputRef} type="file" accept={acceptAttr} hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) onFile(f); e.currentTarget.value = ''; }} />
        </>
      )}
    </Box>
  );
};

// 重複排除（url 基準）
function dedupe(items: MediaPickerItem[]): MediaPickerItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = i.url || i.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
