import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  IconButton,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { BUILT_IN_DECK_TEMPLATES, type BuiltInDeckTemplate } from '../templates/builtInDeckTemplates';
import { dspTemplateRepository, type PresentationTemplate } from '../api/dspTemplateRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import type { PresentationContent } from '../types/dsp.types';

// ─── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = '#29b6f6';

type CategoryFilter = 'all' | 'proposal' | 'list' | 'report' | 'portfolio';

const CATEGORY_CHIPS: { key: CategoryFilter; label: string }[] = [
  { key: 'all',       label: '全て' },
  { key: 'proposal',  label: '提案' },
  { key: 'list',      label: 'リスト' },
  { key: 'report',    label: '報告' },
  { key: 'portfolio', label: 'ポートフォリオ' },
];

// ─── Props ─────────────────────────────────────────────────────────────────────
interface DeckTemplatePanelProps {
  canvasW: number;
  canvasH: number;
  presentation: PresentationContent | null;
  onApplyTemplate: (content: PresentationContent, mode: 'replace' | 'append') => void;
}

// ─── Template Card ─────────────────────────────────────────────────────────────
interface DeckCardProps {
  previewBg: string;
  emoji?: string;
  name: string;
  slideCount?: number;
  byline?: string;
  onDelete?: () => void;
  onClick: () => void;
}

const DeckCard: React.FC<DeckCardProps> = ({ previewBg, emoji, name, slideCount, byline, onDelete, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      borderRadius: 2,
      border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.15s',
      '&:hover': {
        borderColor: ACCENT,
        boxShadow: `0 0 0 2px ${ACCENT}44`,
      },
      position: 'relative',
    }}
  >
    {/* Preview area */}
    <Box
      sx={{
        height: 60,
        bgcolor: previewBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {emoji && (
        <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{emoji}</Typography>
      )}
    </Box>
    {/* Info area */}
    <Box sx={{ p: 0.75, bgcolor: 'rgba(255,255,255,0.03)' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </Typography>
      {slideCount !== undefined && (
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', mt: 0.25 }}>
          {slideCount} スライド
        </Typography>
      )}
      {byline && (
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', mt: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {byline}
        </Typography>
      )}
    </Box>
    {/* Delete button */}
    {onDelete && (
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          bgcolor: 'rgba(0,0,0,0.5)',
          color: '#ff453a',
          width: 22,
          height: 22,
          '&:hover': { bgcolor: 'rgba(255,69,58,0.2)' },
        }}
      >
        <DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} />
      </IconButton>
    )}
  </Box>
);

// ─── Section header ─────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, mt: 0.5 }}>
    {children}
  </Typography>
);

// ─── Main Component ─────────────────────────────────────────────────────────────
export const DeckTemplatePanel: React.FC<DeckTemplatePanelProps> = ({
  canvasW,
  canvasH,
  presentation,
  onApplyTemplate,
}) => {
  const currentUser = useAuthStore(s => s.currentUser);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [publicTemplates, setPublicTemplates] = useState<PresentationTemplate[]>([]);
  const [myTemplates, setMyTemplates] = useState<PresentationTemplate[]>([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const [isLoadingMy, setIsLoadingMy] = useState(false);

  // Apply confirm dialog
  const [applyTarget, setApplyTarget] = useState<BuiltInDeckTemplate | PresentationTemplate | null>(null);

  // Save template dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    category: 'proposal' as 'proposal' | 'list' | 'report' | 'portfolio' | 'other',
    visibility: 'private' as 'public' | 'private',
  });
  const [isSaving, setIsSaving] = useState(false);

  // ── Fetch public templates ────────────────────────────────────────────────
  const fetchPublic = async (cat: CategoryFilter) => {
    setIsLoadingPublic(true);
    try {
      const data = await dspTemplateRepository.listPublicTemplates(cat === 'all' ? undefined : cat);
      setPublicTemplates(data);
    } catch (e) {
      console.error('[DeckTemplatePanel] Failed to fetch public templates', e);
    } finally {
      setIsLoadingPublic(false);
    }
  };

  // ── Fetch my templates ────────────────────────────────────────────────────
  const fetchMy = async () => {
    if (!currentUser) return;
    setIsLoadingMy(true);
    try {
      const data = await dspTemplateRepository.listMyTemplates(currentUser.uid);
      setMyTemplates(data);
    } catch (e) {
      console.error('[DeckTemplatePanel] Failed to fetch my templates', e);
    } finally {
      setIsLoadingMy(false);
    }
  };

  // Mount
  useEffect(() => {
    fetchPublic('all');
    fetchMy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Category change — re-fetch public only
  useEffect(() => {
    fetchPublic(categoryFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  // ── Filtered built-ins ────────────────────────────────────────────────────
  const filteredBuiltIn = BUILT_IN_DECK_TEMPLATES.filter(
    t => categoryFilter === 'all' || t.category === categoryFilter,
  );

  // ── Apply handler ─────────────────────────────────────────────────────────
  const handleApply = async (mode: 'replace' | 'append') => {
    if (!applyTarget) return;

    let content: PresentationContent;
    const isBuiltIn = 'buildContent' in applyTarget;

    if (isBuiltIn) {
      content = (applyTarget as BuiltInDeckTemplate).buildContent(canvasW, canvasH);
    } else {
      content = (applyTarget as PresentationTemplate).content;
      // Increment usage for community templates
      try {
        await dspTemplateRepository.incrementUsage(applyTarget.id);
      } catch {
        // Non-fatal
      }
    }

    onApplyTemplate(content, mode);
    setApplyTarget(null);
  };

  // ── Delete my template ────────────────────────────────────────────────────
  const handleDeleteMyTemplate = async (templateId: string) => {
    try {
      await dspTemplateRepository.deleteTemplate(templateId);
      setMyTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (e) {
      console.error('[DeckTemplatePanel] Failed to delete template', e);
    }
  };

  // ── Save current presentation as template ─────────────────────────────────
  const handleSave = async () => {
    if (!currentUser || !presentation || !saveForm.name.trim()) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      await dspTemplateRepository.createTemplate({
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        category: saveForm.category,
        visibility: saveForm.visibility,
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || '匿名',
        createdAt: now,
        updatedAt: now,
        content: presentation,
        slideCount: presentation.pages.length,
        canvasSize: presentation.canvasSize,
      });
      setShowSaveDialog(false);
      setSaveForm({ name: '', description: '', category: 'proposal', visibility: 'private' });
      await fetchMy();
    } catch (e) {
      console.error('[DeckTemplatePanel] Failed to save template', e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Apply target info ─────────────────────────────────────────────────────
  const applyTargetSlideCount = applyTarget
    ? 'buildContent' in applyTarget
      ? (applyTarget as BuiltInDeckTemplate).slideCount
      : (applyTarget as PresentationTemplate).slideCount
    : 0;

  const applyTargetDesc = applyTarget
    ? 'buildContent' in applyTarget
      ? (applyTarget as BuiltInDeckTemplate).description
      : (applyTarget as PresentationTemplate).description
    : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* ── Category filter ─────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {CATEGORY_CHIPS.map(c => (
            <Chip
              key={c.key}
              label={c.label}
              size="small"
              onClick={() => setCategoryFilter(c.key)}
              sx={{
                fontSize: 11,
                height: 24,
                bgcolor: categoryFilter === c.key ? ACCENT : 'rgba(255,255,255,0.08)',
                color: categoryFilter === c.key ? '#000' : 'rgba(255,255,255,0.65)',
                fontWeight: categoryFilter === c.key ? 700 : 400,
                cursor: 'pointer',
                '&:hover': { bgcolor: categoryFilter === c.key ? ACCENT : 'rgba(255,255,255,0.14)' },
              }}
            />
          ))}
        </Box>

        {/* ── Built-in templates ──────────────────────────────────────────── */}
        <Box>
          <SectionHeader>組み込みテンプレート</SectionHeader>
          {filteredBuiltIn.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', py: 2 }}>
              このカテゴリのテンプレートはありません
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {filteredBuiltIn.map(t => (
                <DeckCard
                  key={t.id}
                  previewBg={t.previewBg}
                  emoji={t.emoji}
                  name={t.name}
                  slideCount={t.slideCount}
                  onClick={() => setApplyTarget(t)}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* ── Community templates ─────────────────────────────────────────── */}
        <Box>
          <SectionHeader>コミュニティ</SectionHeader>
          {isLoadingPublic ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          ) : publicTemplates.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', py: 2 }}>
              まだテンプレートがありません
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {publicTemplates.map(t => (
                <DeckCard
                  key={t.id}
                  previewBg="#1a2a3a"
                  name={t.name}
                  slideCount={t.slideCount}
                  byline={t.createdByName}
                  onClick={() => setApplyTarget(t)}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* ── My templates ────────────────────────────────────────────────── */}
        <Box>
          <SectionHeader>マイテンプレート</SectionHeader>
          {isLoadingMy ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          ) : myTemplates.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', py: 2 }}>
              保存済みテンプレートはありません
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {myTemplates.map(t => (
                <DeckCard
                  key={t.id}
                  previewBg="#1a2a1a"
                  name={t.name}
                  slideCount={t.slideCount}
                  byline={t.visibility === 'public' ? '公開中' : '非公開'}
                  onDelete={() => handleDeleteMyTemplate(t.id)}
                  onClick={() => setApplyTarget(t)}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* ── Save current presentation ────────────────────────────────────── */}
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={() => setShowSaveDialog(true)}
          disabled={!presentation}
          sx={{
            fontSize: 12,
            color: ACCENT,
            borderColor: `${ACCENT}66`,
            '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}11` },
            '&.Mui-disabled': { color: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.1)' },
          }}
        >
          このプレゼンをテンプレートとして保存
        </Button>

      </Box>

      {/* ────────────────────────────────────────────────────────────────────────
          Apply confirm dialog
      ─────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!applyTarget}
        onClose={() => setApplyTarget(null)}
        PaperProps={{ sx: { bgcolor: '#1a1f2e', color: '#fff', minWidth: 360, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>
          テンプレートを適用
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>
            {applyTarget?.name}
          </Typography>
          {applyTargetDesc && (
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', mb: 1, lineHeight: 1.6 }}>
              {applyTargetDesc}
            </Typography>
          )}
          <Typography sx={{ fontSize: 12, color: ACCENT, mb: 2 }}>
            {applyTargetSlideCount} スライド
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#ff453a', bgcolor: 'rgba(255,69,58,0.1)', p: 1, borderRadius: 1 }}>
            「置換して開始」を選ぶと、現在のスライドはすべて削除されます。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setApplyTarget(null)}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={() => handleApply('append')}
            size="small"
            variant="outlined"
            sx={{ fontSize: 12, color: ACCENT, borderColor: `${ACCENT}66`, '&:hover': { borderColor: ACCENT } }}
          >
            末尾に追加
          </Button>
          <Button
            onClick={() => handleApply('replace')}
            size="small"
            variant="contained"
            sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}
          >
            置換して開始
          </Button>
        </DialogActions>
      </Dialog>

      {/* ────────────────────────────────────────────────────────────────────────
          Save template dialog
      ─────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        PaperProps={{ sx: { bgcolor: '#1a1f2e', color: '#fff', minWidth: 400, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>
          テンプレートとして保存
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="テンプレート名 *"
            size="small"
            fullWidth
            value={saveForm.name}
            onChange={e => setSaveForm(f => ({ ...f, name: e.target.value }))}
            InputProps={{ sx: { color: '#fff', fontSize: 13 } }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
          />
          <TextField
            label="説明"
            size="small"
            fullWidth
            multiline
            rows={3}
            value={saveForm.description}
            onChange={e => setSaveForm(f => ({ ...f, description: e.target.value }))}
            InputProps={{ sx: { color: '#fff', fontSize: 13 } }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' } }}
          />
          <Select
            size="small"
            value={saveForm.category}
            onChange={e => setSaveForm(f => ({ ...f, category: e.target.value as typeof f.category }))}
            sx={{ color: '#fff', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '.MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}
            MenuProps={{ PaperProps: { sx: { bgcolor: '#232b3b', color: '#fff' } } }}
          >
            <MenuItem value="proposal">提案</MenuItem>
            <MenuItem value="list">リスト</MenuItem>
            <MenuItem value="report">報告</MenuItem>
            <MenuItem value="portfolio">ポートフォリオ</MenuItem>
            <MenuItem value="other">その他</MenuItem>
          </Select>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>公開設定</Typography>
            <ToggleButtonGroup
              value={saveForm.visibility}
              exclusive
              onChange={(_, v) => { if (v) setSaveForm(f => ({ ...f, visibility: v })); }}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgba(255,255,255,0.5)',
                  borderColor: 'rgba(255,255,255,0.2)',
                  fontSize: 12,
                  '&.Mui-selected': { color: '#000', bgcolor: ACCENT, borderColor: ACCENT },
                },
              }}
            >
              <ToggleButton value="private">非公開</ToggleButton>
              <ToggleButton value="public">公開</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setShowSaveDialog(false)}
            size="small"
            sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            size="small"
            variant="contained"
            disabled={!saveForm.name.trim() || isSaving}
            sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}
          >
            {isSaving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
