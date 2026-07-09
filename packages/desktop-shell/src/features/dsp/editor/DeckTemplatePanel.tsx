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
import { renderPresentationThumbnail } from '../utils/dspThumbnailService';
import { collectSlots, fillSlots, hasSlots, type CollectedSlot } from '../lib/templateSlots';
import { useDspStore } from '../store/useDspStore';
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
      border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
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
    <Box sx={{ p: 0.75, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </Typography>
      {slideCount !== undefined && (
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mt: 0.25 }}>
          {slideCount} スライド
        </Typography>
      )}
      {byline && (
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1, mt: 0.5 }}>
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
  const pendingSaveTemplate = useDspStore(s => s.pendingSaveTemplate);
  const setPendingSaveTemplate = useDspStore(s => s.setPendingSaveTemplate);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [publicTemplates, setPublicTemplates] = useState<PresentationTemplate[]>([]);
  const [myTemplates, setMyTemplates] = useState<PresentationTemplate[]>([]);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const [isLoadingMy, setIsLoadingMy] = useState(false);

  // Apply confirm dialog
  const [applyTarget, setApplyTarget] = useState<BuiltInDeckTemplate | PresentationTemplate | null>(null);

  // Slot fill step (テンプレに差し替え枠があるとき、適用前に中身を入力)
  const [slotFill, setSlotFill] = useState<{
    content: PresentationContent;
    mode: 'replace' | 'append';
    slots: CollectedSlot[];
    values: Record<string, string>;
  } | null>(null);

  // Save template dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
  const [overwriteTargetId, setOverwriteTargetId] = useState<string>('');
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

  // 上部バー等からの「テンプレートとして保存」リクエストを受けてダイアログを開く
  useEffect(() => {
    if (pendingSaveTemplate) {
      setSaveMode('new');
      setShowSaveDialog(true);
      setPendingSaveTemplate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSaveTemplate]);

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

    setApplyTarget(null);

    // 差し替え枠があるテンプレは、中身入力ステップを挟む
    if (hasSlots(content)) {
      setSlotFill({ content, mode, slots: collectSlots(content), values: {} });
      return;
    }

    onApplyTemplate(content, mode);
  };

  // ── Slot fill commit ──────────────────────────────────────────────────────
  const handleSlotFillCommit = () => {
    if (!slotFill) return;
    const filled = fillSlots(slotFill.content, slotFill.values);
    onApplyTemplate(filled, slotFill.mode);
    setSlotFill(null);
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
    if (!currentUser || !presentation) return;
    if (saveMode === 'new' && !saveForm.name.trim()) return;
    if (saveMode === 'overwrite' && !overwriteTargetId) return;
    setIsSaving(true);
    try {
      // 1枚目のサムネイルを生成（失敗しても保存自体は継続）
      let thumbBlob: Blob | null = null;
      try { thumbBlob = await renderPresentationThumbnail(presentation); } catch { /* non-fatal */ }

      if (saveMode === 'overwrite') {
        await dspTemplateRepository.updateTemplateContent(
          overwriteTargetId,
          presentation,
          presentation.pages.length,
          currentUser.uid,
        );
        if (thumbBlob) await dspTemplateRepository.uploadTemplateThumbnail(overwriteTargetId, thumbBlob);
      } else {
        const now = new Date().toISOString();
        const newId = await dspTemplateRepository.createTemplate({
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
        if (thumbBlob) await dspTemplateRepository.uploadTemplateThumbnail(newId, thumbBlob);
      }

      setShowSaveDialog(false);
      setSaveMode('new');
      setOverwriteTargetId('');
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
                bgcolor: categoryFilter === c.key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.08)',
                color: categoryFilter === c.key ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.65)',
                fontWeight: categoryFilter === c.key ? 700 : 400,
                cursor: 'pointer',
                '&:hover': { bgcolor: categoryFilter === c.key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.14)' },
              }}
            />
          ))}
        </Box>

        {/* ── Built-in templates ──────────────────────────────────────────── */}
        <Box>
          <SectionHeader>組み込みテンプレート</SectionHeader>
          {filteredBuiltIn.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textAlign: 'center', py: 2 }}>
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
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textAlign: 'center', py: 2 }}>
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
            <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textAlign: 'center', py: 2 }}>
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
            '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.25)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
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
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', minWidth: 360, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>
          テンプレートを適用
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>
            {applyTarget?.name}
          </Typography>
          {applyTargetDesc && (
            <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.65)', mb: 1, lineHeight: 1.6 }}>
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
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}
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
          Slot fill dialog（差し替え枠に中身を流し込む）
      ─────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={!!slotFill}
        onClose={() => setSlotFill(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', minWidth: 420, maxWidth: 480, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 0.5 }}>
          テンプレートの中身を入力
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.6 }}>
            このテンプレートには差し替え枠があります。埋めた枠だけが差し替わり、空欄はテンプレートの元の内容のままになります。
          </Typography>
          {slotFill?.slots.map(slot => (
            <TextField
              key={slot.id}
              label={slot.label || slot.role || (slot.kind === 'image' ? '画像' : 'テキスト')}
              size="small"
              fullWidth
              multiline={slot.kind === 'text'}
              minRows={slot.kind === 'text' ? 2 : undefined}
              placeholder={slot.kind === 'image' ? (slot.placeholder || '画像URLを貼り付け') : (slot.placeholder || slot.currentValue)}
              value={slotFill.values[slot.id] ?? ''}
              onChange={e => setSlotFill(s => s ? { ...s, values: { ...s.values, [slot.id]: e.target.value } } : s)}
              helperText={slot.kind === 'image' ? '画像URL（適用後にSEKKEIYA Driveから差し替えも可）' : undefined}
              FormHelperTextProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 10 } }}
              InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13 } }}
              InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
              sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setSlotFill(null)} size="small" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}>
            キャンセル
          </Button>
          <Button
            onClick={handleSlotFillCommit}
            size="small"
            variant="contained"
            sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}
          >
            この内容で適用
          </Button>
        </DialogActions>
      </Dialog>

      {/* ────────────────────────────────────────────────────────────────────────
          Save template dialog
      ─────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', minWidth: 400, borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>
          テンプレートとして保存
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          {/* 新規保存 / 既存を上書き */}
          <ToggleButtonGroup
            value={saveMode}
            exclusive
            fullWidth
            onChange={(_, v) => { if (v) setSaveMode(v); }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgb(var(--brand-fg-rgb) / 0.5)',
                borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                fontSize: 12,
                '&.Mui-selected': { color: '#000', bgcolor: ACCENT, borderColor: ACCENT },
                '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' },
              },
            }}
          >
            <ToggleButton value="new">新規保存</ToggleButton>
            <ToggleButton value="overwrite" disabled={myTemplates.length === 0}>既存を上書き</ToggleButton>
          </ToggleButtonGroup>

          {saveMode === 'overwrite' ? (
            <>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                現在のスライド内容で、選択したマイテンプレートを上書きします。
              </Typography>
              <Select
                size="small"
                displayEmpty
                value={overwriteTargetId}
                onChange={e => setOverwriteTargetId(e.target.value)}
                sx={{ color: 'var(--brand-fg)', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '.MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } }}
              >
                <MenuItem value="" disabled>上書きするテンプレートを選択</MenuItem>
                {myTemplates.map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.name}（{t.slideCount}スライド）</MenuItem>
                ))}
              </Select>
            </>
          ) : (
            <>
              <TextField
                label="テンプレート名 *"
                size="small"
                fullWidth
                value={saveForm.name}
                onChange={e => setSaveForm(f => ({ ...f, name: e.target.value }))}
                InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13 } }}
                InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
              />
              <TextField
                label="説明"
                size="small"
                fullWidth
                multiline
                rows={3}
                value={saveForm.description}
                onChange={e => setSaveForm(f => ({ ...f, description: e.target.value }))}
                InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13 } }}
                InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
              />
              <Select
                size="small"
                value={saveForm.category}
                onChange={e => setSaveForm(f => ({ ...f, category: e.target.value as typeof f.category }))}
                sx={{ color: 'var(--brand-fg)', fontSize: 13, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '.MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } }}
              >
                <MenuItem value="proposal">提案</MenuItem>
                <MenuItem value="list">リスト</MenuItem>
                <MenuItem value="report">報告</MenuItem>
                <MenuItem value="portfolio">ポートフォリオ</MenuItem>
                <MenuItem value="other">その他</MenuItem>
              </Select>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 0.5 }}>公開設定</Typography>
                <ToggleButtonGroup
                  value={saveForm.visibility}
                  exclusive
                  onChange={(_, v) => { if (v) setSaveForm(f => ({ ...f, visibility: v })); }}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      color: 'rgb(var(--brand-fg-rgb) / 0.5)',
                      borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)',
                      fontSize: 12,
                      '&.Mui-selected': { color: '#000', bgcolor: ACCENT, borderColor: ACCENT },
                    },
                  }}
                >
                  <ToggleButton value="private">非公開</ToggleButton>
                  <ToggleButton value="public">公開</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setShowSaveDialog(false)}
            size="small"
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            size="small"
            variant="contained"
            disabled={isSaving || (saveMode === 'new' ? !saveForm.name.trim() : !overwriteTargetId)}
            sx={{ fontSize: 12, bgcolor: ACCENT, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#1aa9e0' } }}
          >
            {isSaving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : (saveMode === 'overwrite' ? '上書き保存' : '保存')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
