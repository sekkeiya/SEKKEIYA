import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box, Typography, Chip, IconButton, Menu, MenuItem, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Select,
  Button, ButtonGroup, ToggleButton, ToggleButtonGroup, Tooltip, Divider,
} from '@mui/material';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { dspTemplateRepository, type PresentationTemplate } from './api/dspTemplateRepository';
import { dspRepository } from './api/dspRepository';
import { dspAssetUploadService } from './upload/dspAssetUploadService';
import { parsePptx, pptxToPresentation } from './import/pptxImport';
import { getOrCreateTemplateWorkspace, TEMPLATE_WORKSPACE_NAME } from './api/templateWorkspace';
import { MiniSlidePreview } from './components/MiniSlidePreview';
import { TEMPLATES } from './DspDashboard';
import { buildInitialContent, type TemplateId } from './templates/initialContentBuilders';

const ACCENT = '#29b6f6';

// テンプレ下書き用の隠しワークスペース名（保存先ヒント表示に使用）
const TEMPLATE_WS_NAME = TEMPLATE_WORKSPACE_NAME;

const CATEGORY_LABELS: Record<PresentationTemplate['category'], string> = {
  proposal: '提案', list: 'リスト', report: '報告', portfolio: 'ポートフォリオ', other: 'その他',
};

// ─── Template Card ─────────────────────────────────────────────────────────────

const TemplateCard: React.FC<{
  tpl: PresentationTemplate;
  canApply: boolean;
  selected: boolean;
  onSelect: () => void;
  onApply: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}> = ({ tpl, canApply, selected, onSelect, onApply, onEdit, onDuplicate, onToggleVisibility, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isPublic = tpl.visibility === 'public';
  const firstPage = tpl.content?.pages?.[0];
  const hasElements = (firstPage?.elements?.length ?? 0) > 0;

  return (
    <Box
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      sx={{
        borderRadius: 2,
        border: selected ? `2px solid ${ACCENT}` : '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
        overflow: 'hidden',
        bgcolor: 'var(--brand-bg)',
        display: 'flex', flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 0 0 3px ${ACCENT}33` : 'none',
        '&:hover': { borderColor: `${ACCENT}66`, boxShadow: selected ? `0 0 0 3px ${ACCENT}33` : `0 6px 18px rgba(0,0,0,0.35)` },
        '&:hover .tpl-apply': { opacity: 1 },
      }}
    >
      {/* Preview */}
      <Box sx={{ position: 'relative', aspectRatio: '4 / 3', bgcolor: tpl.thumbnailUrl || hasElements ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.04)', overflow: 'hidden' }}>
        {tpl.thumbnailUrl ? (
          <Box component="img" src={tpl.thumbnailUrl} alt={tpl.name}
            sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : hasElements ? (
          <MiniSlidePreview page={firstPage} canvasSize={tpl.content?.canvasSize} containerSize={260} />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DashboardCustomizeRoundedIcon sx={{ fontSize: 48, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
          </Box>
        )}

        {/* Visibility badge */}
        <Chip
          size="small"
          icon={isPublic ? <PublicRoundedIcon sx={{ fontSize: '13px !important' }} /> : <LockRoundedIcon sx={{ fontSize: '13px !important' }} />}
          label={isPublic ? '公開' : '非公開'}
          sx={{
            position: 'absolute', top: 6, left: 6, height: 22, fontSize: 10, fontWeight: 700,
            bgcolor: isPublic ? 'rgba(41,182,246,0.9)' : 'rgba(0,0,0,0.6)',
            color: isPublic ? '#00263b' : 'rgba(255,255,255,0.85)',
            '& .MuiChip-icon': { color: 'inherit' },
          }}
        />

        {/* Apply (hover) */}
        <Tooltip title={canApply ? 'このテンプレートで新規プレゼンを作成' : 'アクティブなプロジェクトを選択してください'}>
          <Box className="tpl-apply" sx={{ position: 'absolute', bottom: 6, right: 6, opacity: 0, transition: 'opacity 0.15s' }}>
            <span>
              <IconButton
                size="small"
                disabled={!canApply}
                onClick={(e) => { e.stopPropagation(); onApply(); }}
                sx={{
                  bgcolor: ACCENT, color: '#00263b',
                  '&:hover': { bgcolor: '#4fc3f7' },
                  '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.3)' },
                }}
              >
                <RocketLaunchRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Box>
        </Tooltip>
      </Box>

      {/* Info */}
      <Box sx={{ p: 1, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tpl.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.4 }}>
            <Chip label={CATEGORY_LABELS[tpl.category]} size="small"
              sx={{ height: 17, fontSize: 9.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
            <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              {tpl.slideCount} スライド
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchorEl(e.currentTarget); }} sx={{ p: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}
      >
        <MenuItem onClick={() => { setAnchorEl(null); onEdit(); }} sx={{ fontSize: 13, gap: 1 }}>
          <EditRoundedIcon sx={{ fontSize: 16 }} /> 名前・説明・カテゴリを編集
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onToggleVisibility(); }} sx={{ fontSize: 13, gap: 1 }}>
          {isPublic ? <LockRoundedIcon sx={{ fontSize: 16 }} /> : <PublicRoundedIcon sx={{ fontSize: 16 }} />}
          {isPublic ? '非公開にする' : '公開する'}
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onDuplicate(); }} sx={{ fontSize: 13, gap: 1 }}>
          <ContentCopyRoundedIcon sx={{ fontSize: 16 }} /> 複製
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onDelete(); }} sx={{ fontSize: 13, gap: 1, color: '#ff4d4f' }}>
          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /> 削除
        </MenuItem>
      </Menu>
    </Box>
  );
};

// ─── Edit Meta Dialog ──────────────────────────────────────────────────────────

const EditMetaDialog: React.FC<{
  tpl: PresentationTemplate | null;
  onClose: () => void;
  onSave: (patch: { name: string; description: string; category: PresentationTemplate['category']; visibility: 'public' | 'private' }) => Promise<void>;
}> = ({ tpl, onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', description: '', category: 'proposal' as PresentationTemplate['category'], visibility: 'private' as 'public' | 'private' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tpl) setForm({ name: tpl.name, description: tpl.description || '', category: tpl.category, visibility: tpl.visibility });
  }, [tpl?.id]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave({ ...form, name: form.name.trim(), description: form.description.trim() }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!tpl} onClose={onClose}
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', minWidth: 400, borderRadius: 2 } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>テンプレートを編集</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField label="テンプレート名 *" size="small" fullWidth value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13 } }}
          InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }} />
        <TextField label="説明" size="small" fullWidth multiline rows={3} value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13 } }}
          InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }} />
        <Select size="small" value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value as PresentationTemplate['category'] }))}
          sx={{ color: 'var(--brand-fg)', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '.MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } }}>
          <MenuItem value="proposal">提案</MenuItem>
          <MenuItem value="list">リスト</MenuItem>
          <MenuItem value="report">報告</MenuItem>
          <MenuItem value="portfolio">ポートフォリオ</MenuItem>
          <MenuItem value="other">その他</MenuItem>
        </Select>
        <Box>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.5 }}>公開設定</Typography>
          <ToggleButtonGroup value={form.visibility} exclusive size="small"
            onChange={(_, v) => { if (v) setForm(f => ({ ...f, visibility: v })); }}
            sx={{ '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 12, '&.Mui-selected': { color: '#000', bgcolor: ACCENT, borderColor: ACCENT } } }}>
            <ToggleButton value="private">非公開</ToggleButton>
            <ToggleButton value="public">公開</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}>キャンセル</Button>
        <Button onClick={handleSave} size="small" variant="contained" disabled={!form.name.trim() || saving}
          sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}>
          {saving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Template detail right panel (portal → #dsp-right-sidebar-portal) ────────────

const fmtDate = (str?: string) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return str; }
};

const TemplateRightPanel: React.FC<{
  tpl: PresentationTemplate | null;
  canApply: boolean;
  onApply: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}> = ({ tpl, canApply, onApply, onEdit, onDuplicate, onToggleVisibility, onDelete }) => {
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let unmounted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const find = () => {
      if (unmounted) return;
      const node = document.getElementById('dsp-right-sidebar-portal');
      if (node) setPortalNode(node); else timer = setTimeout(find, 100);
    };
    find();
    return () => { unmounted = true; if (timer) clearTimeout(timer); };
  }, []);

  if (!portalNode) return null;

  const firstPage = tpl?.content?.pages?.[0];
  const hasElements = (firstPage?.elements?.length ?? 0) > 0;
  const isPublic = tpl?.visibility === 'public';

  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', bgcolor: 'var(--brand-bg)' }}>
      {!tpl ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3, textAlign: 'center' }}>
          <DashboardCustomizeRoundedIcon sx={{ fontSize: 40, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            テンプレートを選択すると<br />ここに詳細が表示されます
          </Typography>
        </Box>
      ) : (
        <Box sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Preview */}
          <Box sx={{
            aspectRatio: `${(tpl.content?.canvasSize?.width || 1587) / (tpl.content?.canvasSize?.height || 1122)}`,
            borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', overflow: 'hidden', position: 'relative',
            bgcolor: tpl.thumbnailUrl || hasElements ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.04)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {tpl.thumbnailUrl ? (
              <Box component="img" src={tpl.thumbnailUrl} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : hasElements ? (
              <MiniSlidePreview page={firstPage} canvasSize={tpl.content?.canvasSize} containerSize={240} />
            ) : (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DashboardCustomizeRoundedIcon sx={{ fontSize: 48, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
              </Box>
            )}
          </Box>

          {/* Title + chips */}
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-fg)', mb: 0.75, lineHeight: 1.4 }}>{tpl.name}</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip label={CATEGORY_LABELS[tpl.category]} size="small" sx={{ height: 20, fontSize: 11, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }} />
              <Chip size="small" icon={isPublic ? <PublicRoundedIcon sx={{ fontSize: '12px !important' }} /> : <LockRoundedIcon sx={{ fontSize: '12px !important' }} />}
                label={isPublic ? '公開' : '非公開'}
                sx={{ height: 20, fontSize: 11, bgcolor: isPublic ? 'rgba(41,182,246,0.15)' : 'rgb(var(--brand-fg-rgb) / 0.08)', color: isPublic ? 'light-dark(#0775a6, #29b6f6)' : 'rgb(var(--brand-fg-rgb) / 0.6)', '& .MuiChip-icon': { color: 'inherit' } }} />
            </Box>
          </Box>

          {tpl.description && (
            <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.65)', lineHeight: 1.6 }}>{tpl.description}</Typography>
          )}

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />

          {/* Metadata */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {([
              ['スライド数', `${tpl.slideCount}`],
              ['使用回数', `${tpl.usageCount ?? 0}`],
              ['作成日', fmtDate(tpl.createdAt)],
              ['更新日', fmtDate(tpl.updatedAt)],
              ['作成者', tpl.createdByName || '—'],
            ] as [string, string][]).map(([k, v]) => (
              <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{k}</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)', fontWeight: 600 }}>{v}</Typography>
              </Box>
            ))}
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)' }} />

          {/* Visibility toggle */}
          <Box>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', display: 'block', mb: 0.75 }}>公開設定</Typography>
            <ToggleButtonGroup value={tpl.visibility} exclusive size="small" fullWidth
              onChange={(_, v) => { if (v && v !== tpl.visibility) onToggleVisibility(); }}
              sx={{ '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 12, textTransform: 'none', py: 0.5, '&.Mui-selected': { color: '#000', bgcolor: ACCENT, borderColor: ACCENT } } }}>
              <ToggleButton value="private"><LockRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />非公開</ToggleButton>
              <ToggleButton value="public"><PublicRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />公開</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 2 }}>
            <Tooltip title={canApply ? '' : 'アクティブなプロジェクトを選択してください'}>
              <span>
                <Button fullWidth variant="contained" disabled={!canApply} onClick={onApply} startIcon={<RocketLaunchRoundedIcon />}
                  sx={{ bgcolor: ACCENT, color: '#00263b', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#4fc3f7' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                  このテンプレートで作成
                </Button>
              </span>
            </Tooltip>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button fullWidth size="small" variant="outlined" onClick={onEdit} startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{ textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.7)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', '&:hover': { borderColor: ACCENT, color: 'var(--brand-fg)' } }}>編集</Button>
              <Button fullWidth size="small" variant="outlined" onClick={onDuplicate} startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{ textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.7)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', '&:hover': { borderColor: ACCENT, color: 'var(--brand-fg)' } }}>複製</Button>
            </Box>
            <Button fullWidth size="small" variant="outlined" onClick={onDelete} startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', color: 'rgba(249,115,22,0.8)', borderColor: 'rgba(249,115,22,0.25)', '&:hover': { color: '#f97316', borderColor: 'rgba(249,115,22,0.6)', bgcolor: 'rgba(249,115,22,0.05)' } }}>削除</Button>
          </Box>
        </Box>
      )}
    </Box>
  );

  return createPortal(content, portalNode);
};

// ─── Main View ─────────────────────────────────────────────────────────────────

export const DspTemplatesView: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const projects = useAppStore(s => s.projects);

  const [templates, setTemplates] = useState<PresentationTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<PresentationTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedTemplate = templates.find(t => t.id === selectedId) || null;

  // 種別トグル（すべて/スライド/無限ボード → プレゼンへ、テンプレートは現在地）
  const switchToPresentations = (type: 'all' | 'presentation' | 'canvas') => {
    const s = useAppStore.getState();
    s.setDspTypeFilter(type);
    s.setDspScope('my_private_presentations');
    s.setGlobalDspHub();
  };

  // 新規テンプレート作成（＝ベースからプレゼンを作りエディタで開く→そこで「テンプレートとして保存」）
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', baseId: 'blank' as TemplateId });

  const ownerName = currentUser?.displayName || currentUser?.email || 'User';

  const openCreate = () => {
    const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    setCreateError(null);
    setCreateForm({ name: `新しいテンプレート ${dateStr}`, baseId: 'blank' });
    setShowCreate(true);
  };

  // プレゼン(下書き)を作ってエディタへ遷移する共通処理
  const openDraftInEditor = (projectId: string, wf: any) => {
    const isTeam = !!(projects.find(p => p.id === projectId) as any)?.isTeam;
    const store = useAppStore.getState();
    store.setActiveProjectId(projectId);
    store.setDspScope(isTeam ? 'team_project_presentations' : 'project_presentations');
    store.setPanelSelection('presents', wf);
    store.setLastLaunchPayload({ projectId, workspaceId: 'presents', appScope: '3dsp' });
    store.setActiveWorkspaceId('presents');
    store.setCurrentMainView('workspace');
    store.setDspShellMode('editor');
    window.dispatchEvent(new CustomEvent('dsp-presentations-updated', { detail: { projectId } }));
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!currentUser) { setCreateError('ログイン情報が取得できません。'); return; }
    if (!createForm.name.trim()) { setCreateError('下書き名を入力してください。'); return; }
    setCreating(true);
    try {
      const projectId = await getOrCreateTemplateWorkspace(currentUser.uid, ownerName);
      const content = buildInitialContent(createForm.baseId);
      const wf = await dspRepository.createPresentationWorkFile(
        projectId, createForm.name.trim(), currentUser.uid, 'presentation', content,
      );
      openDraftInEditor(projectId, wf);
      setShowCreate(false);
    } catch (e: any) {
      console.error('[DspTemplatesView] Create failed', e);
      setCreateError(e?.message || 'プレゼンの作成に失敗しました。');
    } finally {
      setCreating(false);
    }
  };

  // ── パワポ取り込み（docs/25 P1）─────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const openImport = () => {
    setImportError(null);
    setImportStatus('');
    setImportFile(null);
    setShowImport(true);
  };

  const handleImport = async () => {
    setImportError(null);
    if (!currentUser) { setImportError('ログイン情報が取得できません。'); return; }
    if (!importFile) { setImportError('.pptx ファイルを選択してください。'); return; }
    setImporting(true);
    try {
      setImportStatus('準備しています…');
      const projectId = await getOrCreateTemplateWorkspace(currentUser.uid, ownerName);
      setImportStatus('パワポを解析しています…');
      const deck = await parsePptx(importFile);
      setImportStatus('画像を取り込んでいます…');
      const content = await pptxToPresentation(deck, {
        // Storage 保存のみ（projectAsset を作らない＝S.Model 等の一覧を汚さない）
        uploadImage: async (bytes, mime) => dspAssetUploadService.uploadImageBytesOnly(projectId, bytes, mime),
      });
      setImportStatus('スライドを作成しています…');
      const baseName = importFile.name.replace(/\.pptx$/i, '') || 'パワポ取り込み';
      const wf = await dspRepository.createPresentationWorkFile(
        projectId, baseName, currentUser.uid, 'presentation', content,
      );
      openDraftInEditor(projectId, wf);
      setShowImport(false);
    } catch (e: any) {
      console.error('[DspTemplatesView] Import failed', e);
      setImportError(e?.message || 'パワポの取り込みに失敗しました。');
    } finally {
      setImporting(false);
      setImportStatus('');
    }
  };

  const refresh = useCallback(async () => {
    if (!currentUser) { setTemplates([]); return; }
    setLoading(true);
    try {
      const data = await dspTemplateRepository.listMyTemplates(currentUser.uid);
      setTemplates(data);
    } catch (e) {
      console.error('[DspTemplatesView] Failed to load templates', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleEditSave = async (patch: { name: string; description: string; category: PresentationTemplate['category']; visibility: 'public' | 'private' }) => {
    if (!editTarget) return;
    await dspTemplateRepository.updateTemplate(editTarget.id, patch);
    setTemplates(prev => prev.map(t => t.id === editTarget.id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t));
  };

  const handleToggleVisibility = async (tpl: PresentationTemplate) => {
    const next = tpl.visibility === 'public' ? 'private' : 'public';
    await dspTemplateRepository.updateTemplate(tpl.id, { visibility: next });
    setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, visibility: next } : t));
  };

  const handleDuplicate = async (tpl: PresentationTemplate) => {
    if (!currentUser) return;
    await dspTemplateRepository.duplicateTemplate(tpl, currentUser.uid, currentUser.displayName || '匿名');
    await refresh();
  };

  const handleDelete = async (tpl: PresentationTemplate) => {
    if (!window.confirm(`テンプレート「${tpl.name}」を削除しますか？`)) return;
    await dspTemplateRepository.deleteTemplate(tpl.id);
    setTemplates(prev => prev.filter(t => t.id !== tpl.id));
  };

  const handleApply = async (tpl: PresentationTemplate) => {
    if (!activeProjectId || !currentUser) return;
    try {
      const name = `${tpl.name} ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '')}`;
      const wf = await dspRepository.createPresentationWorkFile(
        activeProjectId, name, currentUser.uid, 'presentation', tpl.content,
      );
      dspTemplateRepository.incrementUsage(tpl.id).catch(() => {});
      // エディタへ遷移
      const store = useAppStore.getState();
      store.setActiveProjectId(activeProjectId);
      store.setDspScope('project_presentations');
      store.setPanelSelection('presents', wf);
      store.setLastLaunchPayload({ projectId: activeProjectId, workspaceId: 'presents', appScope: '3dsp' });
      store.setActiveWorkspaceId('presents');
      store.setCurrentMainView('workspace');
      store.setDspShellMode('editor');
      window.dispatchEvent(new CustomEvent('dsp-presentations-updated', { detail: { projectId: activeProjectId } }));
    } catch (e) {
      console.error('[DspTemplatesView] Apply failed', e);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.5, mb: 0.3 }}>
            My Templates
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 22 }}>テンプレート</Typography>
            <Typography sx={{ color: 'light-dark(#0775a6, #29b6f6)', fontWeight: 700, fontSize: 22 }}>管理</Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 0.5 }}>
            自作テンプレートの編集・複製・公開設定・削除。エディタで「このプレゼンをテンプレートとして保存」から追加できます。
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0, display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileRoundedIcon />}
            onClick={openImport}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap', color: ACCENT, borderColor: `${ACCENT}66`, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}11` } }}
          >
            パワポを読み込む
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            sx={{ bgcolor: ACCENT, color: '#00263b', fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { bgcolor: '#4fc3f7' } }}
          >
            テンプレートを作成
          </Button>
        </Box>
      </Box>

      {/* ── 種別トグル（プレゼン ⇄ テンプレート）── */}
      <Box sx={{ px: 3, height: 44, display: 'flex', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
        <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { py: 0.5, px: 2, textTransform: 'none', fontSize: 13, fontWeight: 600 } }}>
          {([
            { key: 'all' as const, label: 'すべて' },
            { key: 'presentation' as const, label: 'スライド' },
            { key: 'canvas' as const, label: '無限ボード' },
          ]).map(opt => (
            <Button
              key={opt.key}
              onClick={() => switchToPresentations(opt.key)}
              sx={{
                color: 'rgb(var(--brand-fg-rgb) / 0.5)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.12)',
                '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.85)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
              }}
            >
              {opt.label}
            </Button>
          ))}
          {/* テンプレート＝現在地（アクティブ表示） */}
          <Button
            sx={{
              color: 'light-dark(#0775a6, #29b6f6)',
              bgcolor: 'rgba(41,182,246,0.12)',
              borderColor: 'rgba(41,182,246,0.35)',
              '&:hover': { bgcolor: 'rgba(41,182,246,0.18)' },
            }}
          >
            テンプレート
          </Button>
        </ButtonGroup>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }} onClick={() => setSelectedId(null)}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: ACCENT }} />
          </Box>
        ) : templates.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 1.5 }}>
            <DashboardCustomizeRoundedIcon sx={{ fontSize: 56, color: 'rgb(var(--brand-fg-rgb) / 0.15)' }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              まだテンプレートがありません
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)', textAlign: 'center' }}>
              「テンプレートを作成」でベースを選んでエディタで整え、<br />「テンプレートとして保存」すると、ここに表示されます。
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={openCreate}
              sx={{ mt: 1, textTransform: 'none', color: ACCENT, borderColor: `${ACCENT}66`, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}11` } }}
            >
              テンプレートを作成
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
            {templates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                canApply={!!activeProjectId}
                selected={selectedId === tpl.id}
                onSelect={() => setSelectedId(tpl.id)}
                onApply={() => handleApply(tpl)}
                onEdit={() => setEditTarget(tpl)}
                onDuplicate={() => handleDuplicate(tpl)}
                onToggleVisibility={() => handleToggleVisibility(tpl)}
                onDelete={() => handleDelete(tpl)}
              />
            ))}
          </Box>
        )}
      </Box>

      <EditMetaDialog tpl={editTarget} onClose={() => setEditTarget(null)} onSave={handleEditSave} />

      {/* 選択テンプレートの詳細（右サイドバー portal） */}
      <TemplateRightPanel
        tpl={selectedTemplate}
        canApply={!!activeProjectId}
        onApply={() => selectedTemplate && handleApply(selectedTemplate)}
        onEdit={() => selectedTemplate && setEditTarget(selectedTemplate)}
        onDuplicate={() => selectedTemplate && handleDuplicate(selectedTemplate)}
        onToggleVisibility={() => selectedTemplate && handleToggleVisibility(selectedTemplate)}
        onDelete={() => selectedTemplate && handleDelete(selectedTemplate)}
      />

      {/* ── Create template dialog ─────────────────────────────────────────── */}
      <Dialog
        open={showCreate}
        onClose={() => !creating && setShowCreate(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', minWidth: 420, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 0.5 }}>新しいテンプレートを作成</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.6 }}>
            ベースを選ぶとエディタが開きます。レイアウトや差し替え枠を整えてから、エディタの
            「このプレゼンをテンプレートとして保存」で登録してください。
          </Typography>

          {createError && (
            <Typography sx={{ fontSize: 12, color: '#ff453a', bgcolor: 'rgba(255,69,58,0.1)', p: 1, borderRadius: 1 }}>
              {createError}
            </Typography>
          )}

          <Box>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.5 }}>ベース</Typography>
            <Select
              size="small" fullWidth value={createForm.baseId}
              onChange={e => setCreateForm(f => ({ ...f, baseId: e.target.value as TemplateId }))}
              sx={{ color: 'var(--brand-fg)', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '.MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
              MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } }}
            >
              {TEMPLATES.filter(t => t.id !== 'infinite_board').map(t => (
                <MenuItem key={t.id} value={t.id}>{t.title.replace(/\n/g, ' ')}{t.badge ? `（${t.badge}）` : ''}</MenuItem>
              ))}
            </Select>
          </Box>

          <TextField
            label="テンプレート下書き名 *" size="small" fullWidth value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13 } }}
            InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
          />
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            下書きは「{TEMPLATE_WS_NAME}」ワークスペースに保存されます。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setShowCreate(false)} size="small" disabled={creating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}>
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            size="small"
            variant="contained"
            disabled={creating || !createForm.name.trim()}
            sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}
          >
            {creating ? <CircularProgress size={16} sx={{ color: '#000' }} /> : 'エディタで作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Import pptx dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={showImport}
        onClose={() => !importing && setShowImport(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', minWidth: 440, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 0.5 }}>パワポ（.pptx）を読み込む</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.6 }}>
            既存のパワポを解析し、文字・画像・図形を編集可能なスライドに変換してエディタで開きます。
            整えてから「テンプレートとして保存」で登録してください。
            <br />※ フォント・テーマ色・効果・アニメ・表/グラフは簡略化または未対応です。
          </Typography>

          {importError && (
            <Typography sx={{ fontSize: 12, color: '#ff453a', bgcolor: 'rgba(255,69,58,0.1)', p: 1, borderRadius: 1 }}>
              {importError}
            </Typography>
          )}

          <Box>
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.5 }}>.pptx ファイル</Typography>
            <Button
              component="label"
              variant="outlined"
              fullWidth
              disabled={importing}
              startIcon={<UploadFileRoundedIcon />}
              sx={{ justifyContent: 'flex-start', textTransform: 'none', color: importFile ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.5)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: ACCENT } }}
            >
              {importFile ? importFile.name : 'ファイルを選択…'}
              <input
                type="file"
                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                hidden
                onChange={e => { const f = e.target.files?.[0] || null; setImportFile(f); setImportError(null); }}
              />
            </Button>
          </Box>

          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            下書きと画像は「{TEMPLATE_WS_NAME}」ワークスペースに保存されます。
          </Typography>

          {importing && importStatus && (
            <Typography sx={{ fontSize: 12, color: ACCENT }}>{importStatus}</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setShowImport(false)} size="small" disabled={importing} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            size="small"
            variant="contained"
            disabled={importing || !importFile}
            sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}
          >
            {importing ? <CircularProgress size={16} sx={{ color: '#000' }} /> : '取り込んでエディタで開く'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
