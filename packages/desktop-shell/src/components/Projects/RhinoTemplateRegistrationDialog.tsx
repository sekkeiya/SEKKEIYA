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
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import { invoke } from '@tauri-apps/api/core';
import { writeFile, mkdir } from '@tauri-apps/plugin-fs';
import type { RhinoTemplate, UploadStatus, WorkFileToolType } from '../../features/projects/types';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [saveLocation, setSaveLocation] = useState<'cloud' | 'local'>('cloud');
  /** 「CAD で新規作成」モード。ここでは選択のみ行い、登録ボタンで CAD を起動する */
  const [createTool, setCreateTool] = useState<'rhino' | 'blender' | null>(null);
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
      setSaveLocation('cloud');
      setCreateTool(null);
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
      setCreateTool(null); // ファイル登録と新規作成は排他
      
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      
      if (!name) setName(nameWithoutExt);
      if (!description) setDescription(`${nameWithoutExt} template generated automatically.`);

      // 拡張子からソフトウェアを自動判定
      if (file.name.toLowerCase().endsWith('.blend')) setToolType('blender');
      else if (file.name.toLowerCase().endsWith('.3dm')) setToolType('rhino');

      if (file.name.toLowerCase().endsWith('.3dm')) {
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

  // ローカル保存はこの PC でしか実体にアクセスできないため、公開/公式にはできない
  const isLocalMode = !initialData && saveLocation === 'local';

  const buildTemplate = (asDraft: boolean, overrides?: { id?: string; templatePath?: string }): RhinoTemplate => ({
    id: overrides?.id ?? (initialData ? initialData.id : `tmpl-${Date.now()}`),
    name,
    description,
    sourceType: isOfficial && !isLocalMode ? 'official' : 'user',
    ownerId: initialData?.ownerId || currentUser!.uid,
    ownerName: initialData?.ownerName || currentUser!.displayName || 'User',
    rhinoVersion: toolType === 'rhino' ? rhinoVersion : undefined,
    unitSystem: toolType === 'rhino' ? unitSystem : undefined,
    category,
    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    isPublic: !asDraft && !isLocalMode && (isOfficial || isPublic),
    templatePath: overrides?.templatePath ?? (initialData?.templatePath || ''),
    isMock: false,
    usageCount: initialData?.usageCount || 0,
    toolType,
    storagePath: initialData?.storagePath,
    thumbnailUrl: initialData?.thumbnailUrl,
    ...(asDraft ? { isDraft: true } : {}),
  } as RhinoTemplate);

  /** 「CAD で新規作成」の選択。ここでは起動せず、登録ボタン押下時に起動する */
  const handleSelectCreateTool = (tool: 'rhino' | 'blender') => {
    if (createTool === tool) { setCreateTool(null); return; }
    setCreateTool(tool);
    setToolType(tool);
    // 新規作成はローカルの Templates フォルダに実体を作るため、保存先はローカル固定
    setSaveLocation('local');
    // ファイル登録とは排他
    setSelectedFile(null);
    if (thumbnailUrlPreview && thumbnailUrlPreview.startsWith('blob:')) URL.revokeObjectURL(thumbnailUrlPreview);
    setThumbnailUrlPreview(null);
    setThumbnailFile(null);
    setGlbFile(null);
  };

  const templatesDirLabel = 'PC\\SEKKEIYA\\Accounts\\（アカウント）\\Templates';
  const safeFileName = (name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'template');

  /** ローカルテンプレート保存先を解決する。
   *  新コマンド未搭載の旧バックエンド（Rust リビルド前）でも動くよう、
   *  失敗時は既存の get_account_dir + Templates で組み立てる。 */
  const resolveTemplatesDir = async (): Promise<string> => {
    try {
      return await invoke<string>('get_local_templates_dir');
    } catch {
      const acct = await invoke<string>('get_account_dir');
      const dir = `${acct}\\Templates`;
      await mkdir(dir, { recursive: true });
      return dir;
    }
  };

  const handleSubmit = async (asDraft = false) => {
    if (!currentUser) return;
    setErrorDetail(null);
    // 新規作成モードは CAD 起動オーバーレイだけを見せる。ダイアログ内の進捗/完了表示は出さない
    // （二重に画面が重なるため）。登録はオーバーレイの裏で完了させ、最後にダイアログを閉じる。
    const silent = !asDraft && !initialData && !!createTool;
    if (!silent) setStatus('uploading');
    try {
      if (silent && createTool) {
        // 新規作成モード: 保存先（Templates フォルダ）に実体を用意してから CAD を起動し、
        // そのパスを指すローカルテンプレートとして登録する
        const dir = await resolveTemplatesDir();
        const ext = createTool === 'rhino' ? '.3dm' : '.blend';
        const tmplId = `tmpl-${Date.now()}`;
        const localPath = `${dir}\\${safeFileName}_${tmplId}${ext}`;
        // 既存の起動オーバーレイ（GlobalLaunchOverlay）で「〜を起動しています...」を表示
        useAppStore.getState().setGlobalLaunchingTool(createTool);
        try {
          if (createTool === 'rhino') {
            // Rhino: 公式テンプレートフォルダから単位に合うシードを選び、
            // localPath に新規ファイルを作って開く（Ctrl+S でそのまま保存先に入る）。
            // 環境によっては Rhino の Default.3dm が無いため、空指定に頼らない。
            // fs スコープ（$HOME/SEKKEIYA 限定）の外なので readDir はせず、既知のファイル名を
            // 直接組み立てる。存在チェックとフォールバックは launch_rhino（Rust 側）が行う。
            let seedPath = '';
            try {
              const tdir = await invoke<string>('get_rhino_templates_dir');
              const seedFile = unitSystem === 'm' ? 'Large Objects - Meters.3dm'
                : unitSystem === 'inch' ? 'Large Objects - Inches.3dm'
                : 'Large Objects - Millimeters.3dm';
              seedPath = `${tdir}\\${seedFile}`;
            } catch { /* テンプレートフォルダが見つからなければ空指定（Rhino 既定にフォールバック） */ }
            await invoke('launch_rhino', { templatePath: seedPath, targetFilePath: localPath });
          } else {
            // Blender: 空の .blend を事前生成できないため、新規シーンで起動し保存先フォルダを開いて誘導する
            try {
              await invoke('launch_cad_app', { tool: 'blender' });
            } catch (e: any) {
              // 旧バックエンド（Rust リビルド前）にはこのコマンドが無い
              throw new Error(`Blender を起動できませんでした（アプリの再起動が必要な可能性があります）: ${e?.message || e}`);
            }
            try {
              const { openPath } = await import('@tauri-apps/plugin-opener');
              await openPath(dir);
            } catch { /* Explorer が開けなくても登録は続行 */ }
          }
          // 起動オーバーレイを出したまま登録まで済ませる。CAD 側で保存した時点で
          // このパスに実体ができ、そのままテンプレートとして使える状態になる。
          await onRegister(buildTemplate(false, { id: tmplId, templatePath: localPath }), null, () => {}, null, null);
        } finally {
          useAppStore.getState().setGlobalLaunchingTool(null);
        }
        onClose();
      } else if (!asDraft && !initialData && saveLocation === 'local' && selectedFile) {
        // ローカル保存: 実体は PC\SEKKEIYA\Accounts\<アカウント>\Templates に置き、
        // メタデータ（＋サムネイル/GLB）のみクラウドに登録する。templatePath はローカル絶対パス。
        const dir = await resolveTemplatesDir();
        const extMatch = selectedFile.name.match(/\.(3dm|blend)$/i);
        const ext = extMatch ? extMatch[0] : '.3dm';
        const tmplId = `tmpl-${Date.now()}`;
        const localPath = `${dir}\\${safeFileName}_${tmplId}${ext}`;
        await writeFile(localPath, new Uint8Array(await selectedFile.arrayBuffer()));
        await onRegister(buildTemplate(false, { id: tmplId, templatePath: localPath }), null, setStatus, thumbnailFile, glbFile);
      } else {
        await onRegister(buildTemplate(asDraft), asDraft ? null : selectedFile, setStatus, thumbnailFile, glbFile);
      }
    } catch (error: any) {
      console.error('[RhinoTemplateRegistrationDialog] register failed:', error);
      setErrorDetail(error?.message || String(error));
      setStatus('error');
    }
  };

  const isFormValid = name.trim() !== '' && status !== 'uploading' && status !== 'saving' && status !== 'success';

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
            <Box sx={{ p: 1.5, bgcolor: 'rgba(244, 67, 54, 0.1)', borderRadius: 2, border: '1px solid rgba(244, 67, 54, 0.3)', display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <ErrorRoundedIcon color="error" fontSize="small" sx={{ mt: 0.25 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="error">登録中にエラーが発生しました。再度お試しください。</Typography>
                {errorDetail && (
                  <Typography variant="caption" sx={{ color: 'rgba(244,67,54,0.8)', wordBreak: 'break-all', display: 'block', mt: 0.5 }}>
                    {errorDetail}
                  </Typography>
                )}
              </Box>
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
                {/* これから CAD で作成する場合の選択（起動は登録ボタン押下時） */}
                <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                  CAD で新規作成する
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
                  {([['rhino', 'Rhino'], ['blender', 'Blender']] as const).map(([tool, label]) => {
                    const selected = createTool === tool;
                    return (
                      <Button
                        key={tool}
                        variant="outlined"
                        size="small"
                        onClick={() => handleSelectCreateTool(tool)}
                        startIcon={selected
                          ? <CheckCircleRoundedIcon sx={{ fontSize: '15px !important' }} />
                          : <LaunchRoundedIcon sx={{ fontSize: '15px !important' }} />}
                        sx={{
                          color: selected ? '#00BFFF' : 'var(--brand-fg)',
                          borderColor: selected ? 'rgba(0,191,255,0.7)' : 'rgb(var(--brand-fg-rgb) / 0.25)',
                          bgcolor: selected ? 'rgba(0,191,255,0.08)' : 'transparent',
                          textTransform: 'none', fontWeight: selected ? 800 : 600,
                          '&:hover': { borderColor: 'rgba(0,191,255,0.5)', bgcolor: 'rgba(0,191,255,0.06)' },
                        }}
                      >
                        {label} で作成
                      </Button>
                    );
                  })}
                </Box>
                {createTool && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: 'light-dark(#095fa5, #90caf9)', lineHeight: 1.7 }}>
                    「登録して作成開始」を押すと {createTool === 'rhino' ? 'Rhino' : 'Blender'} が起動します。<br />
                    ファイルは {templatesDirLabel} に「{safeFileName}_…」として作成されます。
                    {createTool === 'blender' && <><br />※ Blender では起動後、開かれる Templates フォルダにこの名前で保存してください。</>}
                  </Typography>
                )}

                <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'rgb(var(--brand-fg-rgb) / 0.45)', borderTop: '1px dashed rgb(var(--brand-fg-rgb) / 0.12)', pt: 1.5 }}>
                  作成済みのファイルを登録する
                </Typography>
                <input
                  type="file"
                  accept=".3dm,.blend"
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
                  ファイルを選択 (.3dm / .blend)
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
                    disabled={!!createTool}
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

              {!initialData && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>保存先</Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={saveLocation}
                    disabled={!!createTool}
                    onChange={e => setSaveLocation(e.target.value as 'cloud' | 'local')}
                    sx={{ '& .MuiSelect-select': { color: 'var(--brand-fg)' }, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}
                  >
                    <MenuItem value="cloud">クラウド（他のPCでも利用可）</MenuItem>
                    <MenuItem value="local">ローカル（このPCのみ）</MenuItem>
                  </TextField>
                  {createTool ? (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                      CAD で新規作成する場合はローカル保存になります。作成後、「編集」からクラウドへアップロードできます。
                    </Typography>
                  ) : saveLocation === 'local' && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                      実体は PC\SEKKEIYA\Accounts\（アカウント）\Templates に保存され、クラウドには一覧情報のみ登録されます。公開はできません。
                    </Typography>
                  )}
                </Box>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 'auto' }}>
                <FormControlLabel
                  control={<Switch checked={isPublic && saveLocation !== 'local'} onChange={e => setIsPublic(e.target.checked)} disabled={isOfficial || saveLocation === 'local'} />}
                  label={<Typography sx={{ fontSize: 14 }}>他のユーザーに公開する</Typography>}
                />
                {isAdmin && (
                  <FormControlLabel
                    control={<Switch checked={isOfficial && saveLocation !== 'local'} onChange={e => setIsOfficial(e.target.checked)} color="warning" disabled={saveLocation === 'local'} />}
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
          {!initialData && !createTool && (
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
            {initialData ? '更新する' : createTool ? '登録して作成開始' : '登録する'}
          </Button>
        </DialogActions>
      ) : null}
    </Dialog>
  );
};
