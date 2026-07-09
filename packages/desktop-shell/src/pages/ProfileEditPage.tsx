import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Avatar, IconButton, Button, TextField,
  CircularProgress, MenuItem, Divider, useMediaQuery,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { BRAND } from '../styles/theme';

type WorkStatus = 'available' | 'open' | 'busy' | 'none';

interface EditableProfile {
  displayName: string;
  title: string;
  bio: string;
  workStatus: WorkStatus;
  contactEmail: string;
  photoURL: string;
  bannerURL: string;
  socials: {
    twitter: string;
    instagram: string;
    artstation: string;
    github: string;
    website: string;
  };
}

const EMPTY_PROFILE: EditableProfile = {
  displayName: '',
  title: '',
  bio: '',
  workStatus: 'none',
  contactEmail: '',
  photoURL: '',
  bannerURL: '',
  socials: { twitter: '', instagram: '', artstation: '', github: '', website: '' },
};

const WORK_STATUS_OPTIONS: { value: WorkStatus; label: string }[] = [
  { value: 'none', label: '非表示' },
  { value: 'available', label: 'Available — フリーランス案件 歓迎' },
  { value: 'open', label: 'Open to Work — 就職・案件 探し中' },
  { value: 'busy', label: 'Busy — 現在は依頼受付なし' },
];

const SOCIAL_FIELDS: { key: keyof EditableProfile['socials']; label: string; placeholder: string }[] = [
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'https://x.com/...' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'artstation', label: 'ArtStation', placeholder: 'https://artstation.com/...' },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/...' },
  { key: 'website', label: 'Website', placeholder: 'https://...' },
];

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
    color: BRAND.text,
    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
    '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
  },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' },
};

const ProfileEditPage: React.FC = () => {
  const isMobile = useMediaQuery('(max-width:768px)');
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const uid: string | undefined = currentUser?.uid;

  const [form, setForm] = useState<EditableProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const goBack = useCallback(() => setCurrentMainView('creator-profile'), [setCurrentMainView]);

  // Load existing profile
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.exists() ? snap.data() : {};
        if (mounted) {
          setForm({
            displayName: data.displayName || currentUser?.displayName || '',
            title: data.title || '',
            bio: data.bio || '',
            workStatus: (data.workStatus as WorkStatus) || 'none',
            contactEmail: data.contactEmail || '',
            photoURL: data.photoURL || currentUser?.photoURL || '',
            bannerURL: data.bannerURL || '',
            socials: { ...EMPTY_PROFILE.socials, ...(data.socials || {}) },
          });
        }
      } catch (e) {
        console.error('Failed to load profile for edit:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid]);

  const handleField = (key: keyof EditableProfile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
  };
  const handleSocial = (key: keyof EditableProfile['socials']) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, socials: { ...prev.socials, [key]: e.target.value } }));
  };

  const uploadImage = async (file: File, kind: 'avatar' | 'banner') => {
    if (!uid) return;
    const setUploading = kind === 'avatar' ? setUploadingAvatar : setUploadingBanner;
    setUploading(true);
    try {
      const path = `users/${uid}/profile/${kind}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm(prev => ({ ...prev, [kind === 'avatar' ? 'photoURL' : 'bannerURL']: url }));
    } catch (e) {
      console.error(`Failed to upload ${kind}:`, e);
      alert('画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const onPickImage = (kind: 'avatar' | 'banner') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file, kind);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', uid), {
        displayName: form.displayName.trim(),
        title: form.title.trim(),
        bio: form.bio,
        workStatus: form.workStatus,
        contactEmail: form.contactEmail.trim(),
        photoURL: form.photoURL,
        bannerURL: form.bannerURL,
        socials: form.socials,
        updatedAt: Date.now(),
      }, { merge: true });
      goBack();
    } catch (e) {
      console.error('Failed to save profile:', e);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (!uid) {
    return (
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: BRAND.bg, color: BRAND.text }}>
        <Typography>ログインが必要です</Typography>
      </Box>
    );
  }

  const px = isMobile ? 2 : 5;

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', bgcolor: BRAND.bg, color: BRAND.text }}>
      {/* ── Top bar ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px, py: 1.5, bgcolor: BRAND.bg, borderBottom: `1px solid ${BRAND.line}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={goBack} sx={{ color: BRAND.text }}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>プロフィールを編集</Typography>
        </Box>
        <Button
          variant="contained" size="small" onClick={handleSave} disabled={saving || loading}
          sx={{ borderRadius: '20px', fontWeight: 700, px: 3 }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: 'var(--brand-fg)' }} /> : '保存'}
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : (
        <Box sx={{ maxWidth: 680, mx: 'auto', px, pb: 8 }}>
          {/* ── Banner ── */}
          <Box
            onClick={() => bannerInputRef.current?.click()}
            sx={{
              mt: 2, position: 'relative', width: '100%', height: isMobile ? 120 : 180,
              borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
              backgroundImage: form.bannerURL ? `url(${form.bannerURL})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))' }} />
            <Box sx={{ position: 'relative', textAlign: 'center', color: 'var(--brand-fg)' }}>
              {uploadingBanner ? <CircularProgress size={24} sx={{ color: 'var(--brand-fg)' }} /> : (
                <>
                  <PhotoCameraRoundedIcon />
                  <Typography variant="caption" sx={{ display: 'block' }}>バナー画像を変更</Typography>
                </>
              )}
            </Box>
          </Box>
          <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={onPickImage('banner')} />

          {/* ── Avatar ── */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: -5 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={form.photoURL || undefined}
                sx={{ width: 88, height: 88, fontSize: '2rem', bgcolor: 'primary.main', border: `4px solid ${BRAND.bg}` }}
              >
                {(form.displayName || 'S').charAt(0).toUpperCase()}
              </Avatar>
              <IconButton
                onClick={() => avatarInputRef.current?.click()}
                sx={{
                  position: 'absolute', bottom: -4, right: -4, width: 32, height: 32,
                  bgcolor: 'primary.main', color: 'var(--brand-fg)', border: `2px solid ${BRAND.bg}`,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                {uploadingAvatar ? <CircularProgress size={16} sx={{ color: 'var(--brand-fg)' }} /> : <PhotoCameraRoundedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Box>
          </Box>
          <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onPickImage('avatar')} />

          {/* ── Fields ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 4 }}>
            <TextField label="表示名" value={form.displayName} onChange={handleField('displayName')} fullWidth size="small" sx={inputSx} />
            <TextField label="肩書き（例: 3DCGアーティスト / 建築デザイナー）" value={form.title} onChange={handleField('title')} fullWidth size="small" sx={inputSx} />
            <TextField label="自己紹介" value={form.bio} onChange={handleField('bio')} fullWidth multiline minRows={3} size="small" sx={inputSx} />
            <TextField select label="仕事ステータス" value={form.workStatus} onChange={handleField('workStatus')} fullWidth size="small" sx={inputSx}>
              {WORK_STATUS_OPTIONS.map(opt => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="連絡先メール" value={form.contactEmail} onChange={handleField('contactEmail')} fullWidth size="small" type="email" sx={inputSx} />

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', my: 1 }} />
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              SNS・リンク
            </Typography>
            {SOCIAL_FIELDS.map(f => (
              <TextField
                key={f.key} label={f.label} placeholder={f.placeholder}
                value={form.socials[f.key]} onChange={handleSocial(f.key)}
                fullWidth size="small" sx={inputSx}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ProfileEditPage;
