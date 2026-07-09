import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box, DialogActions, Button, TextField, Divider, Alert, CircularProgress, Tabs, Tab, Avatar, IconButton, Select, MenuItem, FormControl, InputLabel, LinearProgress, Chip } from '@mui/material';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { uploadImageAndGetUrl } from '../../lib/firebase/uploadImage';
import { SystemCategoryAdminPanel } from './SystemCategoryAdminPanel';
import { OFFICIAL_EMAILS } from '../../features/ai-studio/constants/ai-model-plans';
import { PLANS, PLAN_ORDER, getPlan, formatJpy, monthlyModel3dQuota, type PlanId } from '../../features/billing/creditModel';

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
    <div role="tabpanel" hidden={value !== index} {...other}>
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
  initialTab?: number;
}> = ({ open, onClose, initialTab = 0 }) => {
  const { currentUser, logout } = useAuthStore() as any;
  const { setGlobalLoading } = useAppStore();
  const [tabIndex, setTabIndex] = useState(0);

  const isAdmin = currentUser?.email === 'sekkeiyanosagyoubeya@gmail.com';

  const [formData, setFormData] = useState<UserProfileData>({
    displayName: '',
    bio: '',
    title: '',
    photoURL: '',
    bannerURL: '',
    workStatus: 'none',
    contactEmail: '',
    socials: { twitter: '', instagram: '', artstation: '', github: '', website: '' },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [planData, setPlanData] = useState<{ plan: string; monthlyCount: number; lastResetAt: string } | null>(null);

  useEffect(() => {
    if (currentUser && open) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const snap = await getDoc(doc(db, 'users', currentUser.uid));
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
              },
            });
            const now = new Date();
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const aiUsage = data.aiUsage?.tripo3d || {};
            const monthlyCount = aiUsage.lastMonthlyResetAt === currentMonthStr ? (aiUsage.monthlyCount || 0) : 0;
            const isOfficial = OFFICIAL_EMAILS.has(currentUser.email || '');
            setPlanData({ plan: isOfficial ? 'official' : (data.plan || 'free'), monthlyCount, lastResetAt: currentMonthStr });
          } else {
            setFormData(prev => ({ ...prev, displayName: currentUser.displayName || '', photoURL: currentUser.photoURL || '' }));
            setPlanData({ plan: 'free', monthlyCount: 0, lastResetAt: '' });
          }
        } catch (e) {
          console.error('Failed to fetch user settings', e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
      setTabIndex(initialTab);
      setUpdateSuccess(false);
      setUpdateError('');
      setDeleteError('');
    }
  }, [currentUser, open, initialTab]);

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    setIsUpdating(true);
    setUpdateSuccess(false);
    setUpdateError('');
    try {
      const updates: any = {};
      if (formData.displayName !== currentUser.displayName) updates.displayName = formData.displayName;
      if (formData.photoURL !== currentUser.photoURL) updates.photoURL = formData.photoURL;
      if (Object.keys(updates).length > 0) await updateProfile(currentUser, updates);

      await setDoc(doc(db, 'users', currentUser.uid), {
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
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      setUpdateError(e.message || '更新に失敗しました');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'banner') => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) { alert('ファイルサイズは5MB以下にしてください'); return; }
    setGlobalLoading(true, '画像をアップロード中...');
    try {
      const url = await uploadImageAndGetUrl(file);
      setFormData(prev => type === 'photo' ? { ...prev, photoURL: url } : { ...prev, bannerURL: url });
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('アップロードに失敗しました');
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    if (!window.confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) return;
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
    setFormData(prev => ({ ...prev, socials: { ...prev.socials, [field]: value } }));
  };

  // tab 2 = プラン / tab 3 = アカウント / tab 4 = システムマスター (admin only)
  const isSaveDisabled = isLoading || isUpdating || tabIndex === 2 || tabIndex === 3 || (isAdmin && tabIndex === 4);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minHeight: '600px' } }}
    >
      <DialogTitle sx={{ pb: 0, pt: 3, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
        <Typography component="div" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>アカウント設定</Typography>
        <Tabs
          value={tabIndex}
          onChange={(_e, v) => setTabIndex(v)}
          textColor="inherit"
          indicatorColor="primary"
          sx={{ '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' } }}
        >
          <Tab label="プロフィール" />
          <Tab label="SNS・リンク" />
          <Tab label="プラン" />
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
            {/* ── プロフィール ── */}
            <CustomTabPanel value={tabIndex} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {updateSuccess && <Alert severity="success">プロフィールを更新しました</Alert>}
                {updateError && <Alert severity="error">{updateError}</Alert>}

                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1 }}>バナー画像</Typography>
                  <Box sx={{ width: '100%', height: '120px', borderRadius: '12px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', backgroundImage: formData.bannerURL ? `url(${formData.bannerURL})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    <Button component="label" variant="contained" size="small" startIcon={<PhotoCameraRoundedIcon />} sx={{ bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}>
                      変更
                      <input type="file" hidden accept="image/*" onChange={e => handleImageUpload(e, 'banner')} />
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>アイコン</Typography>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar src={formData.photoURL} sx={{ width: 80, height: 80, fontSize: '2rem' }}>
                        {(formData.displayName || 'U').charAt(0).toUpperCase()}
                      </Avatar>
                      <IconButton component="label" size="small" sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                        <PhotoCameraRoundedIcon fontSize="small" sx={{ color: 'var(--brand-fg)' }} />
                        <input type="file" hidden accept="image/*" onChange={e => handleImageUpload(e, 'photo')} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField label="ユーザー名" variant="outlined" size="small" fullWidth value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
                    <TextField label="肩書き (例: 3D Environment Artist)" variant="outlined" size="small" fullWidth value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
                  </Box>
                </Box>

                <TextField label="自己紹介" variant="outlined" size="small" fullWidth multiline rows={4} value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder="好きなモデリングソフトや、得意なジャンルなどを書いてみましょう" sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />

                <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />

                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1.5 }}>お仕事ステータス</Typography>
                  <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                    <InputLabel>ステータス</InputLabel>
                    <Select value={formData.workStatus || 'none'} label="ステータス" onChange={e => setFormData({ ...formData, workStatus: e.target.value as WorkStatus })} sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }}>
                      <MenuItem value="none">非表示</MenuItem>
                      <MenuItem value="available"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#22c55e' }} />Available — フリーランス案件 歓迎</Box></MenuItem>
                      <MenuItem value="open"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#eab308' }} />Open to Work — 就職・案件 探し中</Box></MenuItem>
                      <MenuItem value="busy"><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ef4444' }} />Busy — 現在は依頼受付なし</Box></MenuItem>
                    </Select>
                  </FormControl>
                  <TextField label="お問い合わせ用メールアドレス" variant="outlined" size="small" fullWidth placeholder="contact@example.com" value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} helperText="マイページに公開されます。空欄の場合は非表示になります。" />
                </Box>
              </Box>
            </CustomTabPanel>

            {/* ── SNS・リンク ── */}
            <CustomTabPanel value={tabIndex} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>マイページに表示される各種SNSやポートフォリオサイトのリンクを設定できます。</Typography>
                <TextField label="X (旧Twitter) Web URL" variant="outlined" size="small" fullWidth placeholder="https://x.com/username" value={formData.socials?.twitter} onChange={e => handleChangeSocial('twitter', e.target.value)} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
                <TextField label="Instagram Web URL" variant="outlined" size="small" fullWidth placeholder="https://instagram.com/username" value={formData.socials?.instagram} onChange={e => handleChangeSocial('instagram', e.target.value)} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
                <TextField label="ArtStation Profile URL" variant="outlined" size="small" fullWidth placeholder="https://www.artstation.com/username" value={formData.socials?.artstation} onChange={e => handleChangeSocial('artstation', e.target.value)} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
                <TextField label="GitHub Profile URL" variant="outlined" size="small" fullWidth placeholder="https://github.com/username" value={formData.socials?.github} onChange={e => handleChangeSocial('github', e.target.value)} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
                <TextField label="Web Site / Portfolio URL" variant="outlined" size="small" fullWidth placeholder="https://myportfolio.com" value={formData.socials?.website} onChange={e => handleChangeSocial('website', e.target.value)} sx={{ '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }} />
              </Box>
            </CustomTabPanel>

            {/* ── プラン ── */}
            <CustomTabPanel value={tabIndex} index={2}>
              <PlanTabContent planData={planData} />
            </CustomTabPanel>

            {/* ── アカウント ── */}
            <CustomTabPanel value={tabIndex} index={3}>
              <Box sx={{ p: 4, borderRadius: '12px', bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#ef4444', mb: 1 }}>アカウントの削除</Typography>
                <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 3 }}>
                  アカウントを削除すると、これまで作成したプロジェクトやアセットなどのすべてのデータが永久に失われます。この操作は元に戻すことができません。
                </Typography>
                {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
                <Button variant="contained" color="error" onClick={handleDeleteAccount} disabled={isDeleting}>
                  {isDeleting ? <CircularProgress size={20} color="inherit" /> : 'アカウントを完全に削除する'}
                </Button>
              </Box>
            </CustomTabPanel>

            {isAdmin && (
              <CustomTabPanel value={tabIndex} index={4}>
                <SystemCategoryAdminPanel />
              </CustomTabPanel>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button variant="contained" color="primary" onClick={handleUpdateProfile} disabled={isSaveDisabled}>
          {isUpdating ? <CircularProgress size={20} color="inherit" /> : '変更を保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── プランタブ内容 ───────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  ...Object.fromEntries(PLAN_ORDER.map((p) => [p, PLANS[p].label])),
  official: 'Official',
};
const PLAN_COLORS: Record<string, string> = {
  ...Object.fromEntries(PLAN_ORDER.map((p) => [p, PLANS[p].color])),
  official: '#ab47bc',
};

function priceCell(p: PlanId): string {
  const v = PLANS[p].priceJpy;
  if (v == null) return '応相談';
  if (v === 0) return '¥0';
  return `${formatJpy(v)}/月`;
}

const COMPARE_ROWS: { label: string; render: (p: PlanId) => string }[] = [
  { label: '月額', render: priceCell },
  { label: '月次クレジット', render: (p) => (PLANS[p].monthlyCredits == null ? 'カスタム' : `${PLANS[p].monthlyCredits} cr`) },
  { label: 'AI 3D生成（月）', render: (p) => { const q = monthlyModel3dQuota(p); return q === Infinity ? '無制限' : `${q} 件`; } },
  { label: 'クラウドストレージ', render: (p) => PLANS[p].storageLabel },
  { label: '商用利用', render: (p) => (PLANS[p].commercial ? '◯' : '×') },
  { label: 'API アクセス', render: (p) => (PLANS[p].api ? '◯' : '×') },
  { label: 'チーム権限', render: (p) => (PLANS[p].teamRoles ? '◯' : '×') },
];

function PlanTabContent({ planData }: { planData: { plan: string; monthlyCount: number; lastResetAt: string } | null }) {
  if (!planData) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>;
  }

  const { plan, monthlyCount } = planData;
  const isOfficial = plan === 'official';
  const planDef = getPlan(plan);
  const quota = isOfficial ? Infinity : monthlyModel3dQuota(planDef.id);
  const isUnlimited = quota === Infinity;
  const limit3d = quota;
  const used3d = isUnlimited ? monthlyCount : Math.min(monthlyCount, limit3d);
  const progress3d = isUnlimited ? 0 : (limit3d > 0 ? (used3d / limit3d) * 100 : 100);
  const planColor = PLAN_COLORS[plan] || PLAN_COLORS.free;
  const planLabel = PLAN_LABELS[plan] || plan;
  const monthlyCredits = isOfficial ? null : planDef.monthlyCredits;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 現在のプラン */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: `1px solid color-mix(in srgb, ${planColor} 25%, transparent)` }}>
        <WorkspacePremiumRoundedIcon sx={{ color: planColor, fontSize: '2rem' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>現在のプラン</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: planColor }}>{planLabel}</Typography>
            <Chip label="現在" size="small" sx={{ bgcolor: `color-mix(in srgb, ${planColor} 13%, transparent)`, color: planColor, fontWeight: 600, fontSize: '0.65rem' }} />
          </Box>
        </Box>
      </Box>

      {/* 今月の使用状況 */}
      <Box>
        <Typography variant="subtitle2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1.5 }}>今月の使用状況</Typography>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}>AI 3D生成</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontWeight: 600 }}>
              {isUnlimited ? `${used3d} 件 / 無制限` : `${used3d} / ${limit3d} 件`}
            </Typography>
          </Box>
          {monthlyCredits != null && (
            <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 1 }}>
              月次クレジット {monthlyCredits} cr（3D化 約{quota}個・1個=10cr）
            </Typography>
          )}
          <LinearProgress
            variant="determinate"
            value={Math.min(progress3d, 100)}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)',
              '& .MuiLinearProgress-bar': { bgcolor: progress3d >= 100 ? '#ff7043' : planColor, borderRadius: 3 },
            }}
          />
          {!isUnlimited && progress3d >= 100 && (
            <Typography sx={{ fontSize: '0.7rem', color: '#ff7043', mt: 0.75 }}>今月の上限に達しています</Typography>
          )}
          {isUnlimited && (
            <Typography sx={{ fontSize: '0.7rem', color: planColor, mt: 0.75 }}>制限なし</Typography>
          )}
        </Box>
      </Box>

      {/* プラン比較 */}
      <Box>
        <Typography variant="subtitle2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 1.5 }}>プラン比較</Typography>
        <Box sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
          <Box sx={{ minWidth: 560 }}>
            {/* ヘッダー */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(5, 1fr)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 1.25, borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>機能</Typography>
              {PLAN_ORDER.map((p, i) => (
                <Typography key={p} sx={{ fontSize: '0.7rem', fontWeight: 700, color: PLANS[p].color, p: 1.25, textAlign: 'center', borderRight: i < PLAN_ORDER.length - 1 ? '1px solid rgb(var(--brand-fg-rgb) / 0.06)' : 'none' }}>
                  {PLANS[p].label}{plan === p && <CheckCircleRoundedIcon sx={{ fontSize: '0.75rem', ml: 0.4, verticalAlign: 'middle' }} />}
                </Typography>
              ))}
            </Box>
            {COMPARE_ROWS.map((row, ri) => (
              <Box key={row.label} sx={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(5, 1fr)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', bgcolor: ri % 2 === 0 ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.02)' }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)', p: 1.25, borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>{row.label}</Typography>
                {PLAN_ORDER.map((p, i) => (
                  <Typography key={p} sx={{ fontSize: '0.7rem', color: plan === p ? PLANS[p].color : 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: plan === p ? 600 : 400, p: 1.25, textAlign: 'center', borderRight: i < PLAN_ORDER.length - 1 ? '1px solid rgb(var(--brand-fg-rgb) / 0.06)' : 'none' }}>
                    {row.render(p)}
                  </Typography>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
        <Typography sx={{ fontSize: '0.66rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1 }}>
          Cyclesレンダはローカルのお使いの GPU で実行されるため、全プランで無制限です。
        </Typography>
      </Box>

      {/* アップグレードボタン */}
      {(plan === 'free' || plan === 'standard' || plan === 'premium') && (
        <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'rgba(66,165,245,0.06)', border: '1px solid rgba(66,165,245,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: 'light-dark(#095fa5, #42a5f5)', fontWeight: 600 }}>プランをアップグレード</Typography>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>より多くのAI生成枠やストレージをご利用いただけます</Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            sx={{ flexShrink: 0, borderColor: '#42a5f5', color: 'light-dark(#095fa5, #42a5f5)', '&:hover': { bgcolor: 'rgba(66,165,245,0.1)', borderColor: '#42a5f5' } }}
            onClick={() => window.open('mailto:sekkeiyanosagyoubeya@gmail.com?subject=プランアップグレードのお問い合わせ', '_blank')}
          >
            お問い合わせ
          </Button>
        </Box>
      )}
    </Box>
  );
}
