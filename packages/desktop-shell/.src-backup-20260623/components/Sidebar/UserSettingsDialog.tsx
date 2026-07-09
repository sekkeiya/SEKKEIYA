import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box, DialogActions, Button, TextField, Divider, Alert, CircularProgress, Tabs, Tab, Avatar, IconButton, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { SystemCategoryAdminPanel } from './SystemCategoryAdminPanel';

type WorkStatus = 'available' | 'open' | 'busy' | 'none';

interface UserProfileData {
  displayName?: string;
  bio?: string;
  title?: string;
  photoURL?: string;
  bannerURL?: string;
  workStatus?: WorkStatus;
  contactEmail?: string;
  socials?: {
    twitter?: string;
    instagram?: string;
    artstation?: string;
    github?: string;
    website?: string;
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3, pb: 1, pr: 1, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export const UserSettingsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { currentUser, logout } = useAuthStore() as any;
  const { setGlobalLoading } = useAppStore();
  const [tabIndex, setTabIndex] = useState(0);

  const isAdmin = currentUser?.email === 'sekkeiyanosagyoubeya@gmail.com';

  // States
  const [formData, setFormData] = useState<UserProfileData>({
    displayName: '',
    bio: '',
    title: '',
    photoURL: '',
    bannerURL: '',
    workStatus: 'none',
    contactEmail: '',
    socials: {
      twitter: '',
      instagram: '',
      artstation: '',
      github: '',
      website: ''
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Fetch initial data
  useEffect(() => {
    if (currentUser && open) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setFormData({
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              bio: data.bio || '',
              title: data.title || '',
              bannerURL: data.bannerURL || '',
              workStatus: (data.workStatus as WorkStatus) || 'none',
              contactEmail: data.contactEmail || '',
              socials: {
                twitter: data.socials?.twitter || '',
                instagram: data.socials?.instagram || '',
                artstation: data.socials?.artstation || '',
                github: data.socials?.github || '',
                website: data.socials?.website || '',
              }
            });
          } else {
            setFormData({
              ...formData,
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
            });
          }
        } catch (e) {
          console.error("Failed to fetch user settings", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
      setTabIndex(0);
      setUpdateSuccess(false);
      setUpdateError('');
      setDeleteError('');
    }
  }, [currentUser, open]);

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    setIsUpdating(true);
    setUpdateSuccess(false);
    setUpdateError('');
    try {
      // 1. Update Firebase Auth Profile (displayName, photoURL)
      const updates: any = {};
      if (formData.displayName !== currentUser.displayName) updates.displayName = formData.displayName;
      if (formData.photoURL !== currentUser.photoURL) updates.photoURL = formData.photoURL;
      
      if (Object.keys(updates).length > 0) {
        await updateProfile(currentUser, updates);
      }

      // 2. Update Firestore User Document
      const docRef = doc(db, 'users', currentUser.uid);
      await setDoc(docRef, {
        displayName: formData.displayName,
        photoURL: formData.photoURL,
        bio: formData.bio,
        title: formData.title,
        bannerURL: formData.bannerURL,
        workStatus: formData.workStatus || 'none',
        contactEmail: formData.contactEmail || '',
        socials: formData.socials,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setUpdateSuccess(true);
      // clear success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      setUpdateError(e.message || '更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'banner') => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    // Quick validation
    if (file.size > 5 * 1024 * 1024) {
      alert("ファイルサイズは5MB以下にしてください");
      return;
    }

    setGlobalLoading(true, "画像をアップロード中...");
    try {
      const url = await uploadImageAndGetUrl(file);
      if (type === 'photo') {
        setFormData(prev => ({ ...prev, photoURL: url }));
      } else {
        setFormData(prev => ({ ...prev, bannerURL: url }));
      }
    } catch (err: any) {
      console.error("Error uploading image:", err);
      alert("アップロードに失敗しました");
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    const confirmed = window.confirm('本当にアカウントを削除しますか？この操作は取り消せません。');
    if (!confirmed) return;

    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteUser(currentUser);
      onClose();
      if (logout) logout();
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/requires-recent-login') {
        setDeleteError('セキュリティのため、アカウントを削除するには直近での再ログインが必要です。一度ログアウトしてから再度ログインし直してください。');
      } else {
        setDeleteError(e.message || 'アカウント削除に失敗しました');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangeSocial = (field: keyof UserProfileData['socials'], value: string) => {
    setFormData(prev => ({
      ...prev,
      socials: {
        ...prev.socials,
        [field]: value
      }
    }));
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1e293b',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          minHeight: '600px',
        }
      }}
    >
      <DialogTitle sx={{ pb: 0, pt: 3, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Typography component="div" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>設定</Typography>
        <Tabs 
          value={tabIndex} 
          onChange={(e, v) => setTabIndex(v)} 
          textColor="inherit"
          indicatorColor="primary"
          sx={{ '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' } }}
        >
          <Tab label="プロフィール" />
          <Tab label="SNS・リンク" />
          <Tab label="アカウント" />
          {isAdmin && <Tab label="システムマスター" />}
        </Tabs>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, px: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '300px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <CustomTabPanel value={tabIndex} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {updateSuccess && <Alert severity="success">プロフィールを更新しました</Alert>}
                {updateError && <Alert severity="error">{updateError}</Alert>}
                
                {/* Visuals */}
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>バナー画像</Typography>
                  <Box 
                    sx={{ 
                      width: '100%', 
                      height: '120px', 
                      borderRadius: '12px', 
                      bgcolor: 'rgba(255,255,255,0.05)',
                      backgroundImage: formData.bannerURL ? `url(${formData.bannerURL})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                      border: '1px dashed rgba(255,255,255,0.2)',
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      overflow: 'hidden'
                    }}
                  >
                     <Button component="label" variant="contained" size="small" startIcon={<PhotoCameraRoundedIcon />} sx={{ bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
                        変更
                        <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
                     </Button>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.6)' }}>アイコン</Typography>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar src={formData.photoURL} sx={{ width: 80, height: 80, fontSize: '2rem' }}>
                        {(formData.displayName || "U").charAt(0).toUpperCase()}
                      </Avatar>
                      <IconButton 
                        component="label" 
                        size="small" 
                        sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
                      >
                        <PhotoCameraRoundedIcon fontSize="small" sx={{ color: '#fff' }}/>
                        <input type="file" hidden accept="image/*" onChange={(e) => handleImageUpload(e, 'photo')} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField 
                      label="ユーザー名" variant="outlined" size="small" fullWidth
                      value={formData.displayName} onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    />
                    <TextField 
                      label="肩書き (例: 3D Environment Artist)" variant="outlined" size="small" fullWidth
                      value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})}
                      sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    />
                  </Box>
                </Box>

                <TextField
                  label="自己紹介" variant="outlined" size="small" fullWidth multiline rows={4}
                  value={formData.bio} onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="好きなモデリングソフトや、得意なジャンルなどを書いてみましょう"
                  sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                />

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                {/* Work Status */}
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1.5 }}>
                    お仕事ステータス
                  </Typography>
                  <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                    <InputLabel>ステータス</InputLabel>
                    <Select
                      value={formData.workStatus || 'none'}
                      label="ステータス"
                      onChange={(e) => setFormData({ ...formData, workStatus: e.target.value as WorkStatus })}
                      sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
                    >
                      <MenuItem value="none">非表示</MenuItem>
                      <MenuItem value="available">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }} />
                          Available — フリーランス案件 歓迎
                        </Box>
                      </MenuItem>
                      <MenuItem value="open">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#eab308' }} />
                          Open to Work — 就職・案件 探し中
                        </Box>
                      </MenuItem>
                      <MenuItem value="busy">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />
                          Busy — 現在は依頼受付なし
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="お問い合わせ用メールアドレス"
                    variant="outlined" size="small" fullWidth
                    placeholder="contact@example.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                    helperText="マイページに公開されます。空欄の場合は非表示になります。"
                  />
                </Box>

              </Box>
            </CustomTabPanel>

            <CustomTabPanel value={tabIndex} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  マイページに表示される各種SNSやポートフォリオサイトのリンクを設定できます。
                </Typography>
                
                <TextField 
                  label="X (旧Twitter) Web URL" variant="outlined" size="small" fullWidth
                  placeholder="https://x.com/username"
                  value={formData.socials?.twitter} onChange={(e) => handleChangeSocial('twitter', e.target.value)}
                  sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
                <TextField 
                  label="Instagram Web URL" variant="outlined" size="small" fullWidth
                  placeholder="https://instagram.com/username"
                  value={formData.socials?.instagram} onChange={(e) => handleChangeSocial('instagram', e.target.value)}
                  sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
                <TextField 
                  label="ArtStation Profile URL" variant="outlined" size="small" fullWidth
                  placeholder="https://www.artstation.com/username"
                  value={formData.socials?.artstation} onChange={(e) => handleChangeSocial('artstation', e.target.value)}
                  sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
                <TextField 
                  label="GitHub Profile URL" variant="outlined" size="small" fullWidth
                  placeholder="https://github.com/username"
                  value={formData.socials?.github} onChange={(e) => handleChangeSocial('github', e.target.value)}
                  sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
                <TextField 
                  label="Web Site / Portfolio URL" variant="outlined" size="small" fullWidth
                  placeholder="https://myportfolio.com"
                  value={formData.socials?.website} onChange={(e) => handleChangeSocial('website', e.target.value)}
                  sx={{ '& .MuiInputBase-root': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                />
              </Box>
            </CustomTabPanel>

            <CustomTabPanel value={tabIndex} index={2}>
               <Box sx={{ p: 4, borderRadius: '12px', bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#ef4444', mb: 1 }}>アカウントの削除</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 3 }}>
                  アカウントを削除すると、これまで作成したプロジェクトやアセットなどのすべてのデータが永久に失われます。この操作は元に戻すことができません。
                </Typography>
                {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
                <Button 
                  variant="contained" 
                  color="error" 
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? <CircularProgress size={20} color="inherit" /> : 'アカウントを完全に削除する'}
                </Button>
              </Box>
            </CustomTabPanel>

            {isAdmin && (
              <CustomTabPanel value={tabIndex} index={3}>
                <SystemCategoryAdminPanel />
              </CustomTabPanel>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleUpdateProfile}
          disabled={isLoading || isUpdating || tabIndex === 2 || tabIndex === 3} // don't show explicitly if on delete or admin tab
        >
          {isUpdating ? <CircularProgress size={20} color="inherit" /> : '変更を保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
