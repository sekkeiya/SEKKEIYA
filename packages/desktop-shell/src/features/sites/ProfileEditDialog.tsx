import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, Avatar, IconButton, CircularProgress,
} from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';
import { useAccountProfileStore } from '../../store/useAccountProfileStore';

interface Props { open: boolean; uid: string; onClose: () => void; }

// マイページのプロフィール編集。users/{uid} を更新し、アカウントサイトのヒーロー/概要へ反映する。
export const ProfileEditDialog: React.FC<Props> = ({ open, uid, onClose }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const applyProfileToSite = useProjectSiteStore(s => s.applyProfileToSite);
  const setStoreLogoUrl = useAccountProfileStore(s => s.setLogoUrl);

  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  const [logoURL, setLogoURL] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        const d = snap.exists() ? (snap.data() as any) : {};
        setDisplayName(d.displayName || currentUser?.displayName || '');
        setTitle(d.title || '');
        setBio(d.bio || '');
        setPhotoURL(d.photoURL || currentUser?.photoURL || undefined);
        setLogoURL(d.accountLogoUrl || undefined);
      } catch (e) { console.warn('[profile] load failed', e); }
      finally { setLoading(false); }
    })();
  }, [open, uid]);

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { setPhotoURL(await uploadImageAndGetUrl(file)); }
    catch (err) { console.error('[profile] avatar upload failed', err); }
    finally { setUploading(false); }
  };

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try { setLogoURL(await uploadImageAndGetUrl(file)); }
    catch (err) { console.error('[profile] logo upload failed', err); }
    finally { setUploadingLogo(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'users', uid),
        { displayName, title, bio, photoURL: photoURL ?? null, accountLogoUrl: logoURL ?? null },
        { merge: true },
      );
      applyProfileToSite({ displayName, role: title, bio });
      setStoreLogoUrl(logoURL ?? null);
      onClose();
    } catch (e) { console.error('[profile] save failed', e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: '#11151d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3 } }}>
      <DialogTitle sx={{ color: '#fff', fontWeight: 800 }}>プロフィールを編集</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#00BFFF' }} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {/* アバター */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar src={photoURL} sx={{ width: 72, height: 72 }} />
                <IconButton component="label" size="small" sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>
                  {uploading ? <CircularProgress size={16} sx={{ color: '#000' }} /> : <PhotoCameraRoundedIcon sx={{ fontSize: '1rem' }} />}
                  <input hidden type="file" accept="image/*" onChange={handleAvatar} />
                </IconButton>
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>アイコン画像をアップロード</Typography>
            </Box>

            {/* サイトロゴ（プロフィール写真とは別。サイドバー/アカウントサイトに表示） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={logoURL}
                  variant="rounded"
                  sx={{ width: 72, height: 72, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.06)' }}
                >
                  {(displayName || 'L')[0]?.toUpperCase()}
                </Avatar>
                <IconButton component="label" size="small" sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>
                  {uploadingLogo ? <CircularProgress size={16} sx={{ color: '#000' }} /> : <PhotoCameraRoundedIcon sx={{ fontSize: '1rem' }} />}
                  <input hidden type="file" accept="image/*" onChange={handleLogo} />
                </IconButton>
              </Box>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 600 }}>サイトロゴ</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', mt: 0.25 }}>
                  左のミニサイドバーとアカウントサイトに表示されます。
                </Typography>
                {logoURL && (
                  <Button onClick={() => setLogoURL(undefined)} size="small" sx={{ mt: 0.25, p: 0, minWidth: 0, color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontSize: '0.72rem', '&:hover': { color: '#ff6b6b', bgcolor: 'transparent' } }}>
                    ロゴを削除
                  </Button>
                )}
              </Box>
            </Box>

            <TextField label="表示名" value={displayName} onChange={e => setDisplayName(e.target.value)} fullWidth variant="filled" />
            <TextField label="肩書（例: 建築家 / 3D modeler）" value={title} onChange={e => setTitle(e.target.value)} fullWidth variant="filled" />
            <TextField label="自己紹介" value={bio} onChange={e => setBio(e.target.value)} fullWidth multiline minRows={3} variant="filled" />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={handleSave} disabled={saving || loading} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, textTransform: 'none' }}>
          {saving ? '保存中…' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
