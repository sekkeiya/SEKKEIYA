import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import type { RhinoTemplate, UploadStatus, WorkFileToolType } from '../../features/projects/types';
import { useAuthStore } from '../../store/useAuthStore';
// @ts-ignore
import { convert3dmToGlb } from '../../features/dss/upload/utils/convert3dmToGlb';
// @ts-ignore
import { generateThumbnailFromGlb } from '../../features/dss/upload/utils/generateThumbnailFromGlb';

interface Props {
  open: boolean;
  onClose: () => void;
  onRegister: (template: RhinoTemplate, file: File | null, onProgress: (status: UploadStatus) => void, thumbnailFile?: File | null, glbFile?: File | null) => Promise<void>;
  initialData?: RhinoTemplate | null;
}

export const RhinoTemplateRegistrationDialog: React.FC<Props> = ({ open, onClose, onRegister, initialData }) => {
  const { currentUser } = useAuthStore();
  const [toolType, setToolType] = useState<WorkFileToolType>('rhino');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [rhinoVersion, setRhinoVersion] = useState<number>(8);
  const [unitSystem, setUnitSystem] = useState<'mm'|'m'|'inch'>('mm');
  const [category, setCategory] = useState('Architecture');
  const [isPublic, setIsPublic] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [thumbnailUrlPreview, setThumbnailUrlPreview] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.email === 'sekkeiyanosagyoubeya@gmail.com' || currentUser?.email === '3dshapeshare@gmail.com' || currentUser?.email === 's.sekkeiya@gmail.com';

  React.useEffect(() => {
    if (open) {
      setStatus('idle');
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || '');
        setTags(initialData.tags ? initialData.tags.join(', ') : '');
        setSelectedFile(null);
        setIsPublic(initialData.isPublic);
        setIsOfficial(initialData.sourceType === 'official');
        setToolType(initialData.toolType || 'rhino');
        setRhinoVersion(initialData.rhinoVersion || 8);
        setUnitSystem(initialData.unitSystem || 'mm');
        setCategory(initialData.category || 'Architecture');
        setThumbnailUrlPreview(initialData.thumbnailUrl || null);
        setThumbnailFile(null);
        setGlbFile(null);
      } else {
        setName('');
        setDescription('');
        setTags('');
        setSelectedFile(null);
        setIsPublic(false);
        setIsOfficial(false);
        setToolType('rhino');
        setRhinoVersion(8);
        setUnitSystem('mm');
        setCategory('Architecture');
        setThumbnailUrlPreview(null);
        setThumbnailFile(null);
        setGlbFile(null);
      }
    }
    
    // Cleanup ObjectURL
    return () => {
      // Don't revoke if it's an external https URL (from initialData.thumbnailUrl)
      if (thumbnailUrlPreview && thumbnailUrlPreview.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailUrlPreview);
      }
    };
  }, [open, initialData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const extMatch = file.name.match(/\.(3dm|blend)$/i);
      const ext = extMatch ? extMatch[0] : '';
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      
      if (!name) setName(nameWithoutExt);
      if (!description) setDescription(`${nameWithoutExt} template generated automatically.`);
      
      if (file.name.toLowerCase().endsWith('.3dm') || toolType === 'rhino') {
         setIsGeneratingThumbnail(true);
         try {
             if (thumbnailUrlPreview && thumbnailUrlPreview.startsWith('blob:')) {
               URL.revokeObjectURL(thumbnailUrlPreview);
             }
             const generatedGlb = await convert3dmToGlb(file);
             setGlbFile(generatedGlb as File);
             const { file: thumb } = await generateThumbnailFromGlb(generatedGlb as File, { width: 600, height: 400 });
             setThumbnailFile(thumb);
             setThumbnailUrlPreview(URL.createObjectURL(thumb));
         } catch (err) {
             console.warn('[RhinoTemplateRegistrationDialog] Failed to generate thumbnail preview', err);
         } finally {
             setIsGeneratingThumbnail(false);
         }
      }
    }
  };

  const buildTemplate = (asDraft: boolean): RhinoTemplate => ({
    id: initialData ? initialData.id : `tmpl-${Date.now()}`,
    name,
    description,
    sourceType: isOfficial ? 'official' : 'user',
    ownerId: initialData?.ownerId || currentUser!.uid,
    ownerName: initialData?.ownerName || currentUser!.displayName || 'User',
    rhinoVersion: toolType === 'rhino' ? rhinoVersion : undefined,
    unitSystem: toolType === 'rhino' ? unitSystem : undefined,
    category,
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    isPublic: !asDraft && (isOfficial || isPublic),
    templatePath: initialData?.templatePath || '',
    isMock: false,
    usageCount: initialData?.usageCount || 0,
    toolType,
    storagePath: initialData?.storagePath,
    thumbnailUrl: initialData?.thumbnailUrl,
    ...(asDraft ? { isDraft: true } : {}),
  } as RhinoTemplate);

  const handleSubmit = async (asDraft = false) => {
    if (!currentUser) return;
    setStatus('uploading');
    try {
      await onRegister(buildTemplate(asDraft), asDraft ? null : selectedFile, setStatus, thumbnailFile, glbFile);
    } catch (error) {
      setStatus('error');
    }
  };

  const isFormValid = name.trim() !== '' && status !== 'uploading' && status !== 'saving' && status !== 'success';
  const isDraftSave = isFormValid && !selectedFile && !initialData?.templatePath;

  return (
    <Dialog
      open={open}
      onClose={status === 'uploading' || status === 'saving' ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface2)',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
          borderRadius: 4,
          color: 'var(--brand-fg)'
        }
      }}
    >
      <DialogTitle sx={{ m: 0, px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" fontWeight={800}>
          {initialData ? 'テンプレートの編集' : 'テンプレートの登録'}
        </Typography>
        <IconButton onClick={onClose} disabled={status === 'uploading' || status === 'saving'} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      
      {status === 'idle' || status === 'error' ? (
        <DialogContent sx={{ px: 3, pb: 2, pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {status === 'error' && (
            <Box sx={{ p: 1.5, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: 2, border: '1px solid rgba(244, 67, 54, 0.3)', display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorRoundedIcon color="error" fontSize="small" />
              <Typography variant="body2" color="error">登録中にエラーが発生しました。再度お試しください。</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Left side: Upload & Thumbnail */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box 
                sx={{ 
                  width: '100%', 
                  aspectRatio: '16/9', 
                  bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', 
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', 
                  borderRadius: 2, 
                  overflow: 'hidden',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isGeneratingThumbnail ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: 0.7 }}>
                    <CircularProgress size={32} sx={{ color: 'light-dark(#095fa5, #90caf9)' }} />
                    <Typography variant="caption">サムネイル画像を生成中...</Typography>
                  </Box>
                ) : thumbnailUrlPreview ? (
                  <img src={thumbnailUrlPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>No Thumbnail Found</Typography>
                )}
              </Box>

              <Box sx={{ p: 2, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 2, textAlign: 'center', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)' }}>
                <input 
                  type="file" 
                  accept=".3dm"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  disabled={isGeneratingThumbnail}
                />
                <Button 
                  variant="outlined" 
                  onClick={() => fileInputRef.current?.click()}
                  startIcon={<UploadFileRoundedIcon />}
                  disabled={isGeneratingThumbnail}
                  sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', textTransform: 'none', mb: selectedFile ? 2 : 0 }}
                >
                  .3dm ファイルを選択
                </Button>
                {selectedFile && (
                  <Typography variant="body2" sx={{ color: 'light-dark(#095fa5, #90caf9)', mt: 1, fontWeight: 600 }}>
                    選択済み: {selectedFile.name}
                  </Typography>
                )}
                {!selectedFile && !initialData && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                    ※後から追加できます (*.3dm, *.blend)
                  </Typography>
                )}
                {!selectedFile && initialData && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                    ※変更しない場合は選択不要です
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Right side: Form Fields */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>テンプレート名 *</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例: My Custom Architecture Unit"
                  sx={{ input: { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                />
              </Box>
              
              <Box>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>説明</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="用途などを入力"
                  sx={{ '& .MuiInputBase-root': { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>ソフトウェア</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={toolType}
                    onChange={e => setToolType(e.target.value as WorkFileToolType)}
                    sx={{ '& .MuiSelect-select': { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}
                  >
                    <MenuItem value="rhino">Rhino</MenuItem>
                    <MenuItem value="blender">Blender</MenuItem>
                  </TextField>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>カテゴリ</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    sx={{ '& .MuiSelect-select': { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}
                  >
                    <MenuItem value="Architecture">Architecture</MenuItem>
                    <MenuItem value="Large Objects">Large Objects</MenuItem>
                    <MenuItem value="Small Objects">Small Objects</MenuItem>
                    <MenuItem value="Default">Default</MenuItem>
                  </TextField>
                </Box>
              </Box>

              {toolType === 'rhino' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>Rhino バージョン</Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={rhinoVersion}
                      onChange={e => setRhinoVersion(Number(e.target.value))}
                      sx={{ '& .MuiSelect-select': { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                      SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}
                    >
                      <MenuItem value={8}>Rhino 8</MenuItem>
                      <MenuItem value={7}>Rhino 7</MenuItem>
                    </TextField>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>単位</Typography>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={unitSystem}
                      onChange={e => setUnitSystem(e.target.value as any)}
                      sx={{ '& .MuiSelect-select': { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                      SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}
                    >
                      <MenuItem value="mm">ミリメートル (mm)</MenuItem>
                      <MenuItem value="m">メートル (m)</MenuItem>
                      <MenuItem value="inch">インチ (inch)</MenuItem>
                    </TextField>
                  </Box>
                </Box>
              )}

              <Box>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>タグ (カンマ区切り)</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="例: interior, layout"
                  sx={{ input: { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 'auto' }}>
                <FormControlLabel
                  control={<Switch checked={isPublic} onChange={e => setIsPublic(e.target.checked)} disabled={isOfficial} />}
                  label={<Typography sx={{ fontSize: 14 }}>他のユーザーに公開する</Typography>}
                />
                {isAdmin && (
                  <FormControlLabel
                    control={<Switch checked={isOfficial} onChange={e => setIsOfficial(e.target.checked)} color="warning" />}
                    label={<Typography sx={{ fontSize: 14, color: 'light-dark(#ad6700, #ffb74d)' }}>公式テンプレートとして登録 (管理者専用)</Typography>}
                  />
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
      ) : (
        <DialogContent sx={{ px: 3, pb: 6, pt: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          {status === 'success' ? (
            <CheckCircleRoundedIcon sx={{ fontSize: 64, color: '#4caf50' }} />
          ) : (
            <CircularProgress sx={{ color: '#00BFFF' }} size={48} thickness={4} />
          )}
          <Typography variant="h6" fontWeight={700}>
            {status === 'uploading' && (selectedFile ? '3dmファイルをアップロード中...' : '保存中...')}
            {status === 'saving' && 'テンプレート情報を保存中...'}
            {status === 'success' && (initialData ? '更新が完了しました！' : '登録が完了しました！')}
          </Typography>
        </DialogContent>
      )}
      
      {status === 'idle' || status === 'error' ? (
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', gap: 1 }}>
          <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Box sx={{ flex: 1 }} />
          {!initialData && (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={!isFormValid}
              variant="outlined"
              sx={{
                color: 'light-dark(#742e7f, #ce93d8)', borderColor: 'rgba(180,100,255,0.4)', textTransform: 'none', fontWeight: 600,
                '&:hover': { borderColor: '#ce93d8', bgcolor: 'rgba(180,100,255,0.08)' },
                '&.Mui-disabled': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' },
              }}
            >
              下書きとして保存
            </Button>
          )}
          <Button
            onClick={() => handleSubmit(false)}
            disabled={!isFormValid}
            variant="contained"
            sx={{ bgcolor: '#90caf9', color: '#000', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#64b5f6' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}
          >
            {initialData ? '更新する' : '登録する'}
          </Button>
        </DialogActions>
      ) : null}
    </Dialog>
  );
};
