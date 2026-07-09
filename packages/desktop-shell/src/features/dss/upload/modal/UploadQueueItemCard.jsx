import React, { useMemo, useState } from 'react';
import {
  Box, Typography, IconButton, Card, CardContent,
  FormControl, Select, MenuItem, Stack, Switch, FormControlLabel,
  LinearProgress, Chip, TextField, Grid, InputAdornment, Autocomplete,
  ToggleButton, ToggleButtonGroup, Button, Checkbox, Collapse, Divider,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { useUserSettingsStore } from '../../../../store/useUserSettingsStore';
import { useAuthStore } from '../../../../store/useAuthStore';

import CircularProgress from '@mui/material/CircularProgress';

// Helper to determine icon/color based on status
const getStatusDisplay = (status, progress) => {
  const isSpinning = ['parsing', 'processing', 'thumbnailing', 'saving_doc'].includes(status);
  const icon = isSpinning ? <CircularProgress size={12} color="inherit" /> : undefined;

  switch (status) {
    case 'parsing': return { label: '内容解析中...', color: 'info', icon };
    case 'waiting': return { label: '待機中', color: 'default', icon: undefined };
    case 'processing': return { label: '変換中（3DM → GLB）', color: 'info', icon };
    case 'thumbnailing': return { label: 'サムネイル生成中...', color: 'info', icon };
    case 'ready': 
    case 'queued': return { label: '待機中', color: 'default', icon: undefined };
    case 'uploading_model': return { label: `モデルアップロード中 ${Math.round(progress)}%`, color: 'primary', icon };
    case 'uploading_thumbnail': return { label: `サムネイルアップロード中 ${Math.round(progress)}%`, color: 'primary', icon };
    case 'saving_doc': return { label: 'データ保存中...', color: 'info', icon };
    case 'done': return { label: '完了', color: 'success', icon: undefined };
    case 'error': return { label: 'エラー', color: 'error', icon: <WarningIcon fontSize="small" /> };
    default: return { label: '待機中', color: 'default', icon: undefined };
  }
};

const UploadQueueItemCard = ({ item, setters, onAttachRhino, isGridView, onOpenCheatSheet, isSelected, onToggleSelect, index, total, mergedCategoryMap }) => {
  const isCompactView = false; // Force detailed card layout for the secondary branch
  const customOptions = useUserSettingsStore(s => s.customOptions);
  const addCustomCategory = useUserSettingsStore(s => s.addCustomCategory);
  const addSystemCategory = useUserSettingsStore(s => s.addSystemCategory);
  const { currentUser } = useAuthStore();

  const [addCatSpec, setAddCatSpec] = useState({ open: false, level: '', macro: '', main: '', sub: '', isSystem: false });

  const { updateQueueItem, removeQueueItem } = setters;

  const handleUpdate = (updates) => {
    updateQueueItem(item.id, updates);
  };

  const statusDisplay = getStatusDisplay(item.status, item.progress);
  const isPreparing = ['parsing', 'processing', 'thumbnailing'].includes(item.status);
  const isUploading = ['uploading_model', 'uploading_thumbnail', 'saving_doc'].includes(item.status);
  const isDone = item.status === 'done';
  const isError = item.status === 'error';
  const isDisabled = isUploading || isDone || isPreparing;

  // Categories based on macroCategory
  const availableMacroCategories = Object.keys(mergedCategoryMap);
  const safeMacroCategories = [...new Set([...availableMacroCategories, "その他"])];
  
  const isValidMacro = safeMacroCategories.includes(item.macroCategory);
  const normalizedMacroCategory = isValidMacro ? item.macroCategory : "家具 (既製品)";

  // Main Categories logic
  const categoryData = mergedCategoryMap[normalizedMacroCategory] || {};
  const availableMainCategories = Object.keys(categoryData);
  const safeMainCategories = [...availableMainCategories, "その他"];
  
  const isValidMainCategory = safeMainCategories.includes(item.mainCategory);
  const normalizedMainCategory = isValidMainCategory ? item.mainCategory : "";

  // Sub Categories logic
  const availableSubCategories = categoryData[normalizedMainCategory] || [];
  const isValidSubCategory = availableSubCategories.includes(item.subCategory);
  const normalizedSubCategory = isValidSubCategory ? item.subCategory : "";

  // Needs review?
  const isUnset = !normalizedMacroCategory || !normalizedMainCategory;

  // Duplicate logic
  const isDuplicateExact = item.duplicateInfo?.level === 'exact';
  const isDuplicateStrong = item.duplicateInfo?.level === 'strong';
  const hasDuplicate = isDuplicateExact || isDuplicateStrong;

  // Update borderColor to be blue-ish when valid, else red/orange for errors/warnings
  const hasErrorOrUnset = isError || (isUnset && !isUploading && !isDone);
  const borderColor = isError ? '#ff4444' : (isUnset && !isUploading && !isDone) ? '#ff9800' : '#4dabf5';

  // Extract dimensions defensively
  const dims = item.dimensions || { width: '', depth: '', height: '' };

  // AI states
  const isAiLoading = item.aiStatus === 'loading';
  const isAiError = item.aiStatus === 'error';
  const isAiGenerated = item.ai?.generated;

  // Modern UI: Less colorful, more unified.
  // AI Generated fields get a very subtle tint instead of bright purple.
  const aiBgColor = isAiGenerated ? 'rgba(30, 144, 255, 0.05)' : 'rgb(var(--brand-fg-rgb) / 0.03)';
  const aiBorderColor = isAiGenerated ? 'rgba(30, 144, 255, 0.3)' : 'rgb(var(--brand-fg-rgb) / 0.15)';
  const [showExtras, setShowExtras] = useState(false);

  // Rule Applied state
  const hasRuleApplied = item.ruleApplied && Object.values(item.ruleApplied).some(v => v);

  // Reset AI flag on manual edit
  const clearAiFlag = () => {
    if (isAiGenerated) return { ai: { ...item.ai, generated: false } };
    return {};
  };

  // Tag handler
  const handleTagsChange = (event, newTags) => {
    handleUpdate({ tags: newTags, ...clearAiFlag() });
  };

  const PremiumLoadingOverlay = () => (
    <Box sx={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      bgcolor: 'light-dark(rgba(255,255,255,0.8), rgba(10, 15, 25, 0.65))',
      backdropFilter: 'blur(8px)',
      zIndex: 50,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 3,
      borderRadius: 'inherit'
    }}>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={56} thickness={1.5} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.05)', position: 'absolute' }} />
        <CircularProgress size={56} thickness={1.5} disableShrink sx={{
          color: 'transparent',
          animationDuration: '2.5s',
          '& circle': { stroke: `url(#premium-spinner-${item.id})`, strokeLinecap: 'round' }
        }} />
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id={`premium-spinner-${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4dabf5" />
              <stop offset="100%" stopColor="#ba68c8" />
            </linearGradient>
          </defs>
        </svg>
      </Box>
      <Typography variant="body2" sx={{ 
        fontWeight: 500, letterSpacing: '0.08em', fontSize: '0.85rem',
        background: 'linear-gradient(90deg, #4dabf5, #ba68c8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        animation: 'pulse-opacity 2s infinite ease-in-out',
        '@keyframes pulse-opacity': { '0%, 100%': { opacity: 0.6 }, '50%': { opacity: 1 } }
      }}>
        モデルを準備中… {item.preparingProgress ? `${item.preparingProgress}%` : ''}
      </Typography>
      {total > 0 && index !== undefined && (
        <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.75rem', mt: -2 }}>
          {index + 1} / {total} 件
        </Typography>
      )}
    </Box>
  );

  const renderMetaAutocomplete = (field, label) => (
    <Autocomplete
      multiple
      size="small"
      freeSolo
      options={customOptions[field] || []}
      value={item[field] || []}
      onChange={(e, newVal) => handleUpdate({ [field]: newVal, ...clearAiFlag() })}
      disabled={isDisabled}
      componentsProps={{
        paper: {
          sx: {
            bgcolor: 'var(--brand-surface2)',
            color: 'var(--brand-fg)',
            backgroundImage: 'none',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)'
          }
        }
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip 
              variant="outlined" size="small" label={option} key={key} {...tagProps} 
              sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} 
            />
          );
        })
      }
      renderInput={(params) => (
          <TextField
          {...params}
          variant="outlined"
          label={label}
          placeholder="追加"
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <>
                {isAiGenerated && <InputAdornment position="start" sx={{ mt: 0, mr: 0, ml: 0.5 }}><AutoAwesomeIcon sx={{ color: '#1e90ff', fontSize: 16 }} /></InputAdornment>}
                {params.InputProps.startAdornment}
              </>
            ),
          }}
          sx={{ 
             '& .MuiInputBase-root': { bgcolor: aiBgColor, borderRadius: 1.5, color: 'var(--brand-fg)' },
             '& .MuiInputLabel-root': { color: isAiGenerated ? '#1e90ff' : 'rgb(var(--brand-fg-rgb) / 0.58)' },
             '& .MuiOutlinedInput-notchedOutline': { borderColor: aiBorderColor }
          }}
        />
      )}
    />
  );

  if (isGridView) {
    return (
      <Card
        onClick={(e) => {
          if (!onToggleSelect) return;
          if (e.target.closest('button, input, [role="button"], [role="switch"], .no-select-propagate')) return;
          onToggleSelect(item.id);
        }}
        sx={{
          cursor: onToggleSelect ? 'pointer' : 'default',
          bgcolor: isSelected ? 'rgba(30, 144, 255, 0.12)' : item.uploadEnabled ? (hasErrorOrUnset ? 'rgba(255, 152, 0, 0.05)' : 'rgba(77, 171, 245, 0.08)') : 'rgb(var(--brand-fg-rgb) / 0.02)',
          borderRadius: 2,
          border: isSelected ? '1px solid #1e90ff' : `1px solid ${item.uploadEnabled ? (hasErrorOrUnset ? 'rgba(255, 152, 0, 0.3)' : 'rgba(77, 171, 245, 0.35)') : 'rgb(var(--brand-fg-rgb) / 0.06)'}`,
          transition: 'all 0.2s',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          '&:hover': {
            bgcolor: isSelected ? 'rgba(30, 144, 255, 0.18)' : item.uploadEnabled ? (hasErrorOrUnset ? 'rgba(255, 152, 0, 0.08)' : 'rgba(77, 171, 245, 0.12)') : 'rgb(var(--brand-fg-rgb) / 0.04)',
            boxShadow: isSelected ? '0 0 0 1px rgba(30, 144, 255, 0.6), 0 4px 16px rgba(30, 144, 255, 0.2)' : '0 4px 12px rgba(0,0,0,0.3)'
          }
        }}
      >
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <Box sx={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}>
            <Checkbox checked={!!isSelected} onChange={() => onToggleSelect(item.id)} size="small" sx={{ p: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.7)', bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1, '&.Mui-checked': { color: '#1e90ff', bgcolor: 'rgba(0,0,0,0.6)' } }} />
          </Box>
        )}

        {/* Thumbnail area */}
        <Box sx={{ height: 110, width: '100%', bgcolor: 'rgba(0,0,0,0.6)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {item.thumbnailPreviewUrl || item.thumbnailUrl ? (
            <img src={item.thumbnailPreviewUrl || item.thumbnailUrl} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.uploadEnabled ? 1 : 0.4, filter: item.uploadEnabled ? 'none' : 'grayscale(80%)' }} />
          ) : (
            <Typography variant="h5" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontWeight: 800 }}>{item.filename.split('.').pop().toUpperCase()}</Typography>
          )}

          {/* Badges Overlay */}
          <Stack spacing={0.5} sx={{ position: 'absolute', top: 4, left: 4, zIndex: 5, alignItems: 'flex-start', display: isPreparing ? 'none' : 'flex' }}>
            {!item.uploadEnabled && <Chip label="除外" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#444', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)' }} />}
            {isUnset && !isError && !isUploading && !isDone && <Chip icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />} label="未設定" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#ff9800', color: '#000', '& .MuiChip-icon': { color: '#000', ml: 0.5, mr: -0.5 } }} />}
            {hasDuplicate && !isDone && <Chip icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />} label={isDuplicateExact ? "重複" : "類似"} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: isDuplicateExact ? '#ff9800' : '#ffcc80', color: '#000', '& .MuiChip-icon': { color: '#000' } }} />}
            {hasRuleApplied && !isAiGenerated && <Chip label="✨ ルール自動入力" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(0, 150, 136, 0.2)', color: '#4db6ac', border: '1px solid rgba(77, 182, 172, 0.3)' }} />}
            {isAiGenerated && <Chip label="🪄 AI補完" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#ba68c8', color: 'var(--brand-fg)' }} />}
            {item.conversionStatus === 'done' && <Chip label="GLB生成済" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#2e7d32', color: 'var(--brand-fg)' }} />}
            {item.conversionStatus === 'error' && <Chip icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />} label="GLB変換失敗" title={item.conversionError} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#d32f2f', color: 'var(--brand-fg)', '& .MuiChip-icon': { ml: 0.5, color: 'var(--brand-fg)' } }} />}
            {item.thumbnailStatus === 'error' && <Chip icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />} label="サムネ生成失敗" title={item.thumbnailError} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#d32f2f', color: 'var(--brand-fg)', '& .MuiChip-icon': { ml: 0.5, color: 'var(--brand-fg)' } }} />}
            {(!isDone && isUploading || isError || ['waiting'].includes(item.status)) && (
              <Chip icon={statusDisplay.icon} label={statusDisplay.label} color={statusDisplay.color} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, backdropFilter: 'blur(4px)', background: statusDisplay.color === 'default' ? 'rgba(0,0,0,0.6)' : undefined, '& .MuiChip-icon': { ml: 0.5 } }} />
            )}
          </Stack>
        </Box>

        {/* Content area */}
        <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ maxWidth: '100%' }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'var(--brand-fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.filename}>
              {item.filename}
            </Typography>
            <Chip label={item.ext.toUpperCase()} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.7)', borderRadius: 1 }} />
          </Stack>
          
          <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Switch size="small" checked={item.uploadEnabled} onChange={(e) => handleUpdate({ uploadEnabled: e.target.checked })} disabled={isDisabled} color="primary" sx={{ mr: 0 }} />
              }
              label={<Typography variant="caption" sx={{ fontWeight: 600, color: item.uploadEnabled ? 'rgb(var(--brand-fg-rgb) / 0.9)' : 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{item.uploadEnabled ? 'ON' : 'OFF'}</Typography>}
              sx={{ m: 0 }}
            />
          </Box>
        </Box>
        {isPreparing && <PremiumLoadingOverlay />}
      </Card>
    );
  }

  return (
    <Card 
      onClick={(e) => {
        if (!onToggleSelect) return;
        if (e.target.closest('button, input, [role="button"], [role="switch"], [role="combobox"], [role="listbox"], .no-select-propagate')) return;
        onToggleSelect(item.id);
      }}
      sx={{ 
      cursor: onToggleSelect ? 'pointer' : 'default',
      bgcolor: isSelected 
        ? 'rgba(30, 144, 255, 0.12)' 
        : item.uploadEnabled ? (hasErrorOrUnset ? 'rgba(255, 152, 0, 0.05)' : 'rgba(77, 171, 245, 0.08)') : 'rgb(var(--brand-fg-rgb) / 0.02)', 
      borderRadius: isCompactView ? 2 : 3, 
      border: isSelected
        ? '1px solid #1e90ff'
        : `1px solid ${item.uploadEnabled ? (hasErrorOrUnset ? 'rgba(255, 152, 0, 0.3)' : 'rgba(77, 171, 245, 0.35)') : 'rgb(var(--brand-fg-rgb) / 0.06)'}`,
      borderLeft: item.uploadEnabled ? `4px solid ${borderColor}` : `4px solid rgb(var(--brand-fg-rgb) / 0.1)`,
      transition: 'all 0.2s',
      boxShadow: isSelected
        ? '0 0 0 1px rgba(30, 144, 255, 0.5), 0 4px 20px rgba(30, 144, 255, 0.15)'
        : item.uploadEnabled ? (hasErrorOrUnset ? '0 0 12px rgba(255, 152, 0, 0.1)' : '0 0 12px rgba(77, 171, 245, 0.15)') : 'none',
      position: 'relative',
      overflow: 'visible',
      '&:hover': { 
        bgcolor: isSelected ? 'rgba(30, 144, 255, 0.18)' : item.uploadEnabled ? (hasErrorOrUnset ? 'rgba(255, 152, 0, 0.08)' : 'rgba(77, 171, 245, 0.12)') : 'rgb(var(--brand-fg-rgb) / 0.04)', 
        boxShadow: isSelected ? '0 0 0 1px rgba(30, 144, 255, 0.6), 0 6px 24px rgba(30, 144, 255, 0.25)' : item.uploadEnabled ? (hasErrorOrUnset ? '0 4px 20px rgba(255, 152, 0, 0.15)' : '0 4px 20px rgba(77, 171, 245, 0.25)') : '0 4px 16px rgba(0,0,0,0.4)' 
      }
    }}>
      {/* Badge for unset / error */}
      {isUnset && !isError && !isUploading && !isDone && (
         <Chip 
           icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />}
           label="カテゴリ未設定" 
           sx={{ position: 'absolute', top: -10, left: -6, fontWeight: 700, height: 22, fontSize: '0.7rem', zIndex: 10, bgcolor: '#ff9800', color: '#000', '& .MuiChip-icon': { color: '#000', ml: 0.5, mr: -0.5 } }}
         />
      )}
      {!item.uploadEnabled && (
         <Chip 
           label="除外" 
           size="small" 
           sx={{ position: 'absolute', top: -10, right: isCompactView ? 30 : 100, fontWeight: 700, height: 20, fontSize: '0.65rem', zIndex: 10, bgcolor: '#444444', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)' }}
         />
      )}
      
      {/* Duplicate Warning Badge */}
      {hasDuplicate && !isDone && (
         <Chip 
           icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />}
           label={isDuplicateExact ? "重複の可能性" : "類似名のファイル"} 
           size="small" 
           color="warning"
           sx={{ 
             position: 'absolute', top: -10, left: isUnset ? 100 : -6, 
             fontWeight: 700, height: 22, fontSize: '0.7rem', zIndex: 10, 
             bgcolor: isDuplicateExact ? '#ff9800' : '#ffcc80', 
             color: '#000', 
             '& .MuiChip-icon': { color: '#000' } 
           }}
         />
      )}

      {/* Rule Applied Badge */}
      {hasRuleApplied && !isAiGenerated && (
         <Chip 
           label="✨ ルール自動入力" 
           size="small" 
           sx={{ 
             position: 'absolute', top: -10, right: isCompactView ? 80 : 160, 
             fontWeight: 700, height: 22, fontSize: '0.7rem', zIndex: 10, 
             bgcolor: 'rgba(0, 150, 136, 0.1)', 
             color: '#4db6ac',
             border: '1px solid rgba(77, 182, 172, 0.3)'
           }}
         />
      )}

      {/* AI Completed Badge */}
      {isAiGenerated && (
         <Chip 
           label="🪄 AI補完済み" 
           size="small" 
           sx={{ 
             position: 'absolute', top: -10, right: isCompactView ? 80 : 160, 
             fontWeight: 700, height: 22, fontSize: '0.7rem', zIndex: 10, 
             bgcolor: '#ba68c8', 
             color: 'var(--brand-fg)'
           }}
         />
      )}

      <CardContent sx={{ p: isCompactView ? 1.5 : 2, '&:last-child': { pb: isCompactView ? 1.5 : 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={isCompactView ? 2 : 3} alignItems={isCompactView ? 'center' : 'stretch'}>
          
          {/* Thumbnail / Ext Preview */}
          <Box sx={{
            width: isCompactView ? 90 : { xs: '100%', sm: 140 },
            height: isCompactView ? 90 : 140,
            bgcolor: 'rgba(0,0,0,0.4)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            position: 'relative',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)'
          }}>
            {item.thumbnailPreviewUrl || item.thumbnailUrl ? (
              <img
                src={item.thumbnailPreviewUrl || item.thumbnailUrl}
                alt="thumbnail"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: item.uploadEnabled ? 1 : 0.4, filter: item.uploadEnabled ? 'none' : 'grayscale(80%)' }}
              />
            ) : (
              <Typography variant={isCompactView ? "h5" : "h3"} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontWeight: 800 }}>
                {item.filename.split('.').pop().toUpperCase()}
              </Typography>
            )}
            
            {(!isCompactView || isUploading || isError || isDone || ['waiting'].includes(item.status)) && !isPreparing && (
              <Stack spacing={0.5} sx={{ position: 'absolute', top: 4, left: 4, zIndex: 10, alignItems: 'flex-start' }}>
                {item.conversionStatus === 'done' && <Chip label="GLB生成済" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#2e7d32', color: 'var(--brand-fg)' }} />}
                {item.conversionStatus === 'error' && <Chip icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />} label="GLB変換失敗" title={item.conversionError} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#d32f2f', color: 'var(--brand-fg)', '& .MuiChip-icon': { ml: 0.5, color: 'var(--brand-fg)' } }} />}
                {item.thumbnailStatus === 'error' && <Chip icon={<WarningIcon sx={{ fontSize: '0.8rem' }} />} label="サムネ生成失敗" title={item.thumbnailError} size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#d32f2f', color: 'var(--brand-fg)', '& .MuiChip-icon': { ml: 0.5, color: 'var(--brand-fg)' } }} />}
                {(!isDone && isUploading || isError || ['waiting'].includes(item.status)) && (
                  <Chip
                    icon={statusDisplay.icon}
                    label={statusDisplay.label}
                    color={statusDisplay.color}
                    size="small"
                    sx={{ 
                      fontWeight: 700, fontSize: isCompactView ? '0.65rem' : '0.7rem', height: 20, 
                      backdropFilter: 'blur(4px)', 
                      background: statusDisplay.color === 'default' ? 'rgba(0,0,0,0.6)' : undefined,
                      '& .MuiChip-icon': { ml: 0.5 }
                    }}
                  />
                )}
              </Stack>
            )}
          </Box>

          {/* Form Controls */}
          <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            
            <Stack direction="row" justifyContent="space-between" alignItems={isCompactView ? "center" : "flex-start"} mb={isCompactView ? 1.5 : 2}>
              <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
                {!isCompactView && (
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.58)', letterSpacing: '0.05em', fontWeight: 600 }}>
                    ORIGINAL FILE
                  </Typography>
                )}
                <Typography component="div" variant="body2" noWrap sx={{ fontWeight: 600, mt: 0.2, color: 'var(--brand-fg)', display: 'flex', alignItems: 'center', gap: 1 }} title={item.filename}>
                  {item.filename}
                  {isAiLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#1e90ff', bgcolor: 'rgba(30, 144, 255, 0.1)', px: 1, py: 0.25, borderRadius: 1 }}>
                      <CircularProgress size={10} color="inherit" />
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>AI入力中...</Typography>
                    </Box>
                  )}
                  {isAiError && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'light-dark(#ad6700, #ffb74d)', bgcolor: 'rgba(255, 152, 0, 0.15)', px: 1, py: 0.25, borderRadius: 1 }}>
                      <WarningIcon sx={{ fontSize: 12 }} />
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>AI入力失敗</Typography>
                    </Box>
                  )}
                </Typography>
              </Box>
                <Stack direction="row" alignItems="center" spacing={0}>
                  {onToggleSelect && (
                    <Checkbox
                      checked={!!isSelected}
                      onChange={() => onToggleSelect(item.id)}
                      size="small"
                      sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&.Mui-checked': { color: '#1e90ff' } }}
                    />
                  )}
                  <FormControlLabel
                    control={
                      <Switch 
                        size="small" 
                        checked={!!item.uploadEnabled} 
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (hasDuplicate) {
                            const newAction = isChecked ? (item.duplicateInfo.action === 'skip' ? 'overwrite' : item.duplicateInfo.action) : 'skip';
                            handleUpdate({ uploadEnabled: isChecked, duplicateInfo: { ...item.duplicateInfo, action: newAction } });
                          } else {
                            handleUpdate({ uploadEnabled: isChecked });
                          }
                        }} 
                        disabled={isDisabled}
                        color="success"
                      />
                    }
                    label={<Typography variant="caption" sx={{ fontWeight: 600, color: item.uploadEnabled ? 'rgb(var(--brand-fg-rgb) / 0.78)' : 'rgb(var(--brand-fg-rgb) / 0.58)' }}>{item.uploadEnabled ? "アップロード対象" : "除外"}</Typography>}
                    sx={{ m: 0, mr: 1 }}
                  />
                  {!isUploading && !isDone && (
                    <IconButton 
                      size="small" 
                      onClick={() => removeQueueItem(item.id)} 
                      sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: '#ff4444', bgcolor: 'rgba(255,68,68,0.1)' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
            </Stack>

            {/* Duplicate Action Area */}
            {hasDuplicate && !isDone && !isCompactView && (
              <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0, 0, 0, 0.2))', border: `1px solid ${isDuplicateExact ? 'rgba(255,152,0,0.4)' : 'rgba(255,204,128,0.3)'}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ color: isDuplicateExact ? 'light-dark(#ad6700, #ffb74d)' : 'light-dark(#ad6800, #ffe0b2)', fontWeight: 600 }}>
                  {isDuplicateExact ? '⚠️ 完全一致するファイル（名前＋サイズ）が既に存在します' : '💡 同名のファイルが存在します'}
                </Typography>
                
                <Stack direction="row" spacing={2} alignItems="center">
                  {item.duplicateInfo?.matchedThumb ? (
                    <img src={item.duplicateInfo.matchedThumb} alt="matched" style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', opacity: 0.8 }} />
                  ) : (
                    <Box sx={{ width: 44, height: 44, borderRadius: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'var(--brand-fg)', fontSize: '0.6rem' }}>NO IMG</Typography>
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" noWrap sx={{ display: 'block', color: 'rgb(var(--brand-fg-rgb) / 0.9)', fontWeight: 600 }}>既存: {item.duplicateInfo?.matchedFilename}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                       {item.duplicateInfo?.matchedSize ? `${(item.duplicateInfo.matchedSize / 1024 / 1024).toFixed(2)} MB` : ''} 
                       {item.duplicateInfo?.matchedUpdatedAt ? ` • 最終更新: ${new Date(item.duplicateInfo.matchedUpdatedAt).toLocaleDateString()}` : ''}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} mt={0.5}>
                  <ToggleButtonGroup
                    size="small"
                    value={item.duplicateInfo?.action || 'skip'}
                    exclusive
                    onChange={(e, val) => {
                      if (val) {
                         handleUpdate({ 
                           duplicateInfo: { ...item.duplicateInfo, action: val }, 
                           uploadEnabled: val !== 'skip' 
                         });
                         // Auto-deselect if excluded
                         if (val === 'skip' && isSelected && onToggleSelect) {
                           onToggleSelect(item.id);
                         }
                      }
                    }}
                    disabled={isDisabled}
                    sx={{
                      bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))',
                      height: 28,
                      '& .MuiToggleButton-root': {
                        color: 'rgb(var(--brand-fg-rgb) / 0.6)',
                        borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)',
                        py: 0, px: 2,
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        '&.Mui-selected': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)', color: 'var(--brand-fg)' }
                      }
                    }}
                  >
                    <ToggleButton value="skip" sx={{ '&.Mui-selected': { color: '#ff5252 !important', bgcolor: 'rgba(255, 82, 82, 0.15) !important' } }}>重複を除外</ToggleButton>
                    <ToggleButton value="overwrite">上書き更新</ToggleButton>
                    <ToggleButton value="new">新規登録</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Box>
            )}

            {/* .gh standalone item: require Rhino file selection */}
            {item.ext === 'gh' && (
              <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.4)' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                  <WarningIcon sx={{ color: 'light-dark(#ad6700, #ffb74d)', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: 'light-dark(#ad6700, #ffb74d)', fontWeight: 700, fontSize: '0.78rem' }}>
                    RhinoファイルをこのGHスクリプトに紐づけてください
                  </Typography>
                </Stack>
                {item.companion3dmFile ? (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 1, px: 1.5, py: 0.75 }}>
                    <Typography variant="caption" noWrap sx={{ flex: 1, color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      ✓ {item.companion3dmFile.name}
                    </Typography>
                    {!isDisabled && (
                      <IconButton
                        size="small"
                        onClick={() => handleUpdate({ companion3dmFile: null, uploadEnabled: false })}
                        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', p: 0.25, '&:hover': { color: '#ff4444' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Stack>
                ) : (
                  <Button
                    size="small"
                    component="label"
                    startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                    variant="outlined"
                    sx={{ color: 'light-dark(#ad6700, #ffb74d)', borderColor: 'rgba(255,152,0,0.5)', fontSize: '0.75rem', '&:hover': { borderColor: '#ffb74d', bgcolor: 'rgba(255,152,0,0.1)' } }}
                  >
                    Rhinoファイルを選択 (.3dm)
                    <input
                      type="file"
                      accept=".3dm"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files[0];
                        if (f && onAttachRhino) {
                          // Bind a Rhino (.3dm) to this .gh and run the full auto-fill pipeline
                          onAttachRhino(item, f);
                        }
                        e.target.value = '';
                      }}
                    />
                  </Button>
                )}
              </Box>
            )}

            {/* Main metadata fields — hidden for standalone .gh items (shown after Rhino is selected and item transforms to .3dm) */}
            {item.ext !== 'gh' && <Grid container spacing={isCompactView ? 1.5 : 2}>
              {/* Row 1: Title & AI */}
              <Grid size={{ xs: 12, md: 12 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    size="small"
                    label={isAiGenerated ? "表示タイトル (AI)" : "表示タイトル"}
                    value={item.title}
                    onChange={(e) => handleUpdate({ title: e.target.value, ...clearAiFlag() })}
                    disabled={isDisabled}
                    fullWidth
                    InputProps={{
                      startAdornment: isAiGenerated ? <InputAdornment position="start"><AutoAwesomeIcon sx={{ color: '#1e90ff', fontSize: 16 }} /></InputAdornment> : null,
                    }}
                    sx={{ 
                      '& .MuiInputBase-root': { bgcolor: aiBgColor, borderRadius: 1.5, color: 'var(--brand-fg)' },
                      '& .MuiInputLabel-root': { color: isAiGenerated ? '#1e90ff' : 'rgb(var(--brand-fg-rgb) / 0.58)' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: aiBorderColor }
                    }}
                  />
                  {!isDisabled && onOpenCheatSheet && (
                    <Tooltip 
                      title="カテゴリの早見表を表示" 
                      placement="top"
                      arrow
                    >
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => onOpenCheatSheet()}
                        startIcon={<MenuBookIcon />}
                        sx={{ 
                          height: 40, 
                          minWidth: 'auto', 
                          px: 2, 
                          borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)', 
                          color: 'rgb(var(--brand-fg-rgb) / 0.7)',
                          whiteSpace: 'nowrap',
                          '&:hover': {
                             bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)',
                             borderColor: '#fff',
                             color: 'var(--brand-fg)'
                          }
                        }}
                      >
                        早見表
                      </Button>
                    </Tooltip>
                  )}
                </Stack>
              </Grid>

              {/* Row 2: Type, Main, Sub, Detail */}
              <Grid size={{ xs: 6, md: isCompactView ? 6 : 3 }}>
                <FormControl size="small" fullWidth disabled={isDisabled}>
                  <Select
                    value={normalizedMacroCategory}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setAddCatSpec({ open: true, level: 'macro', macro: '', main: '', sub: '', isSystem: false });
                        return;
                      }
                      handleUpdate({ macroCategory: e.target.value, mainCategory: '', subCategory: '', ...clearAiFlag() })
                    }}
                    startAdornment={isAiGenerated ? <InputAdornment position="start" sx={{ pl: 1, mr: -0.5 }}><AutoAwesomeIcon sx={{ color: '#1e90ff', fontSize: 16 }} /></InputAdornment> : null}
                    sx={{ bgcolor: aiBgColor, borderRadius: 1.5, color: 'var(--brand-fg)', '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.78)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: aiBorderColor } }}
                    MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                  >
                    {safeMacroCategories.map(cat => (
                      <MenuItem key={cat} value={cat}>
                        {cat} {isAiGenerated && normalizedMacroCategory === cat && ' 🪄'}
                      </MenuItem>
                    ))}
                    <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                    <MenuItem value="__add_new__" sx={{ color: 'light-dark(#0a5fa4, #64b5f6)', fontWeight: 'bold' }}>
                      <AddIcon fontSize="small" sx={{ mr: 1 }} />
                      新しいカテゴリを追加
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6, md: isCompactView ? 6 : 3 }}>
                <FormControl size="small" fullWidth disabled={isDisabled} error={isUnset}>
                  <Select
                    value={normalizedMainCategory}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setAddCatSpec({ open: true, level: 'main', macro: normalizedMacroCategory, main: '', sub: '', isSystem: false });
                        return;
                      }
                      handleUpdate({ mainCategory: e.target.value, subCategory: '', ...clearAiFlag() })
                    }}
                    displayEmpty
                    startAdornment={isAiGenerated ? <InputAdornment position="start" sx={{ pl: 1, mr: -0.5 }}><AutoAwesomeIcon sx={{ color: '#1e90ff', fontSize: 16 }} /></InputAdornment> : null}
                    sx={{ bgcolor: isUnset && item.uploadEnabled && !isUploading && !isDone ? 'rgba(255, 152, 0, 0.1)' : aiBgColor, borderRadius: 1.5, color: 'var(--brand-fg)', '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.78)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: isUnset && item.uploadEnabled && !isUploading && !isDone ? '#ff9800' : aiBorderColor } }}
                    MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                  >
                    <MenuItem value="" disabled sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>カテゴリを選択...</MenuItem>
                    {safeMainCategories.map(cat => (
                      <MenuItem key={cat} value={cat}>
                        {cat} {isAiGenerated && normalizedMainCategory === cat && ' 🪄'}
                      </MenuItem>
                    ))}
                    {normalizedMacroCategory && [
                      <Divider key="div" sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />,
                      <MenuItem key="add" value="__add_new__" sx={{ color: 'light-dark(#0a5fa4, #64b5f6)', fontWeight: 'bold' }}>
                        <AddIcon fontSize="small" sx={{ mr: 1 }} />
                        新しいカテゴリを追加
                      </MenuItem>
                    ]}
                  </Select>
                </FormControl>
              </Grid>
              {!isCompactView && (
                <>

                  <Grid size={{ xs: 6, md: 6 }}>
                    <FormControl size="small" fullWidth disabled={isDisabled || availableSubCategories.length === 0}>
                      <Select
                        value={normalizedSubCategory}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setAddCatSpec({ open: true, level: 'sub', macro: normalizedMacroCategory, main: normalizedMainCategory, sub: '', isSystem: false });
                            return;
                          }
                          handleUpdate({ subCategory: e.target.value, ...clearAiFlag() })
                        }}
                        displayEmpty
                        startAdornment={isAiGenerated ? <InputAdornment position="start" sx={{ pl: 1, mr: -0.5 }}><AutoAwesomeIcon sx={{ color: '#1e90ff', fontSize: 16 }} /></InputAdornment> : null}
                        sx={{ bgcolor: aiBgColor, borderRadius: 1.5, color: 'var(--brand-fg)', '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.78)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: aiBorderColor } }}
                        MenuProps={{ PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)' } } }}
                      >
                        <MenuItem value="" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{availableSubCategories.length > 0 ? '詳細選択...' : '詳細なし'}</MenuItem>
                        {availableSubCategories.map(sub => (
                          <MenuItem key={sub} value={sub}>
                            {sub} {isAiGenerated && normalizedSubCategory === sub && ' 🪄'}
                          </MenuItem>
                        ))}
                        {normalizedMainCategory && [
                          <Divider key="div" sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />,
                          <MenuItem key="add" value="__add_new__" sx={{ color: 'light-dark(#0a5fa4, #64b5f6)', fontWeight: 'bold' }}>
                            <AddIcon fontSize="small" sx={{ mr: 1 }} />
                            新しいカテゴリを追加
                          </MenuItem>
                        ]}
                      </Select>
                    </FormControl>
                  </Grid>
                  {/* Phase 2: Dimensions */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        label="W (幅)"
                        type="number"
                        value={dims.width}
                        onChange={(e) => handleUpdate({ dimensions: { ...dims, width: e.target.value }, dimensionSource: 'manual' })}
                        disabled={isDisabled}
                        InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="rgb(var(--brand-fg-rgb) / 0.5)">mm</Typography></InputAdornment> }}
                        sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'var(--brand-surface2)', borderRadius: 1.5, color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.58)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
                      />
                      <TextField
                        size="small"
                        label="D (奥)"
                        type="number"
                        value={dims.depth}
                        onChange={(e) => handleUpdate({ dimensions: { ...dims, depth: e.target.value }, dimensionSource: 'manual' })}
                        disabled={isDisabled}
                        InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="rgb(var(--brand-fg-rgb) / 0.5)">mm</Typography></InputAdornment> }}
                        sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'var(--brand-surface2)', borderRadius: 1.5, color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.58)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
                      />
                      <TextField
                        size="small"
                        label="H (高)"
                        type="number"
                        value={dims.height}
                        onChange={(e) => handleUpdate({ dimensions: { ...dims, height: e.target.value }, dimensionSource: 'manual' })}
                        disabled={isDisabled}
                        InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="rgb(var(--brand-fg-rgb) / 0.5)">mm</Typography></InputAdornment> }}
                        sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'var(--brand-surface2)', borderRadius: 1.5, color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.58)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
                      />
                    </Stack>
                  </Grid>

                  {/* Phase 2: Tags */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      multiple
                      size="small"
                      freeSolo
                      options={[]} // Add dynamic options list if available in Phase 3
                      value={item.tags || []}
                      onChange={handleTagsChange}
                      disabled={isDisabled}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => {
                          const { key, ...tagProps } = getTagProps({ index });
                          return (
                            <Chip 
                              variant="outlined" 
                              size="small" 
                              label={option} 
                              key={key} 
                              {...tagProps} 
                              sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} 
                            />
                          );
                        })
                      }
                      renderInput={(params) => (
                          <TextField
                          {...params}
                          variant="outlined"
                          label={isAiGenerated ? "タグ (AI提案)" : "タグ (Enterで追加)"}
                          placeholder="タグ追加"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                {isAiGenerated && <InputAdornment position="start" sx={{ mt: 0, mr: 0, ml: 0.5 }}><AutoAwesomeIcon sx={{ color: '#1e90ff', fontSize: 16 }} /></InputAdornment>}
                                {params.InputProps.startAdornment}
                              </>
                            ),
                          }}
                          sx={{ 
                             '& .MuiInputBase-root': { bgcolor: aiBgColor, borderRadius: 1.5, color: 'var(--brand-fg)' },
                             '& .MuiInputLabel-root': { color: isAiGenerated ? '#1e90ff' : 'rgb(var(--brand-fg-rgb) / 0.58)' },
                             '& .MuiOutlinedInput-notchedOutline': { borderColor: aiBorderColor }
                          }}
                        />
                      )}
                    />
                  </Grid>

                  {!isCompactView && (
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 0.5, borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                      <Button 
                        size="small" 
                        onClick={() => setShowExtras(!showExtras)}
                        endIcon={<ExpandMoreIcon sx={{ transform: showExtras ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />}
                        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'transparent' }, px: 0, fontWeight: 600, fontSize: '0.75rem' }}
                      >
                        詳細メタデータ (マテリアル・機能空間など)
                      </Button>
                      <Collapse in={showExtras}>
                        <Grid container spacing={2} sx={{ mt: 0.5, mb: 1 }}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            {renderMetaAutocomplete("materials", "マテリアル (材質・仕上げ)")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            {renderMetaAutocomplete("buildingTypes", "建物タイプ (利用先)")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            {renderMetaAutocomplete("rooms", "部屋タイプ (利用先)")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            {renderMetaAutocomplete("zones", "機能ゾーン (ZONES)")}
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            {renderMetaAutocomplete("companionClasses", "セット家具タグ")}
                          </Grid>
                        </Grid>
                      </Collapse>
                    </Grid>
                  )}
                </>
              )}
              {isCompactView && (
                <Grid size={{ xs: 12, md: 2 }} display="flex" alignItems="center" justifyContent="flex-end">
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={item.visibility === 'public'}
                        onChange={(e) => handleUpdate({ visibility: e.target.checked ? 'public' : 'private' })}
                        disabled={isDisabled}
                        color="primary"
                      />
                    }
                    label={<Typography variant="caption" sx={{ fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.78)' }}>公開する</Typography>}
                    sx={{ m: 0 }}
                  />
                </Grid>
              )}
            </Grid>}

            {/* Grasshopper Files section (only for .3dm items) */}
            {item.ext === '3dm' && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: 'rgba(100,200,100,0.07)', border: '1px solid rgba(100,200,100,0.2)' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={(item.ghFiles?.length > 0) ? 1 : 0}>
                  <Typography variant="caption" sx={{ color: 'rgba(100,220,100,0.85)', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1 }}>
                    Grasshopper スクリプト
                  </Typography>
                  {!isDisabled && (
                    <Button
                      size="small"
                      component="label"
                      startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                      variant="outlined"
                      sx={{ color: 'rgba(100,220,100,0.8)', borderColor: 'rgba(100,200,100,0.35)', fontSize: '0.68rem', py: 0.15, px: 1, minWidth: 0, '&:hover': { borderColor: 'rgba(100,220,100,0.6)', bgcolor: 'rgba(100,200,100,0.1)' } }}
                    >
                      .ghを追加
                      <input
                        type="file"
                        accept=".gh"
                        multiple
                        hidden
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          if (files.length > 0) {
                            handleUpdate({ ghFiles: [...(item.ghFiles || []), ...files] });
                          }
                          e.target.value = '';
                        }}
                      />
                    </Button>
                  )}
                </Stack>
                {(item.ghFiles?.length > 0) ? (
                  <Stack spacing={0.5}>
                    {item.ghFiles.map((ghFile, idx) => (
                      <Stack key={idx} direction="row" alignItems="center" spacing={0.5} sx={{ bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 1, px: 1, py: 0.4 }}>
                        <Typography variant="caption" noWrap sx={{ flex: 1, color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                          {ghFile.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: '0.65rem', flexShrink: 0 }}>
                          {(ghFile.size / 1024).toFixed(1)} KB
                        </Typography>
                        {!isDisabled && (
                          <IconButton
                            size="small"
                            onClick={() => handleUpdate({ ghFiles: (item.ghFiles || []).filter((_, i) => i !== idx) })}
                            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.25)', p: 0.2, '&:hover': { color: '#ff4444' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: '0.68rem' }}>
                    Grasshopperスクリプト未添付（任意）
                  </Typography>
                )}
              </Box>
            )}

            {/* Footer / Toggles / Progress (Default View) */}
            {(!isCompactView || isError || isUploading) && (
              <Box sx={{ mt: isCompactView ? 1 : 'auto', pt: isCompactView ? 0 : 2.5 }}>
                {!isCompactView && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={item.visibility === 'public'}
                          onChange={(e) => handleUpdate({ visibility: e.target.checked ? 'public' : 'private' })}
                          disabled={isDisabled}
                          color="primary"
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.78)' }}>一般公開する</Typography>}
                    />
                  </Stack>
                )}

                {/* Error Message */}
                {isError && item.errorMsg && (
                  <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
                    {item.errorMsg}
                  </Typography>
                )}

                {/* Progress Bar */}
                {isUploading && (
                  <Box sx={{ width: '100%', mt: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" sx={{ color: 'light-dark(#0960a4, #4dabf5)', fontWeight: 600 }}>{statusDisplay.label}</Typography>
                      <Typography variant="caption" sx={{ color: 'light-dark(#0960a4, #4dabf5)', fontWeight: 600 }}>{Math.round(item.progress)}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={item.progress} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                  </Box>
                )}
              </Box>
            )}

          </Box>
        </Stack>
      </CardContent>
      {isPreparing && <PremiumLoadingOverlay />}
      {/* Bottom Settings Fold */}
      <Collapse in={isSelected && !isCompactView && isDone} unmountOnExit>
         ... (Existing settings omitted as we won't touch it here) ...
      </Collapse>

      {/* Add Category Dialog */}
      <Dialog 
        open={addCatSpec.open} 
        onClose={() => setAddCatSpec({ ...addCatSpec, open: false })}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}
      >
        <DialogTitle sx={{ color: 'var(--brand-fg)' }}>新しいカテゴリの追加</DialogTitle>
        <DialogContent>
           <Typography variant="body2" sx={{ mb: 2, color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
             {addCatSpec.level === 'macro' && '新しいマクロカテゴリ（大分類）を追加します。'}
             {addCatSpec.level === 'main' && `${addCatSpec.macro} の下に新しいメインカテゴリを追加します。`}
             {addCatSpec.level === 'sub' && `${addCatSpec.macro} > ${addCatSpec.main} の下に新しい詳細カテゴリを追加します。`}
           </Typography>

           {addCatSpec.level === 'macro' && (
             <TextField variant="outlined" autoFocus fullWidth label="マクロカテゴリ名" value={addCatSpec.macro} onChange={e => setAddCatSpec({...addCatSpec, macro: e.target.value})} sx={{ mt: 1, '& .MuiInputBase-root': { color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }} />
           )}
           {addCatSpec.level === 'main' && (
             <TextField variant="outlined" autoFocus fullWidth label="メインカテゴリ名" value={addCatSpec.main} onChange={e => setAddCatSpec({...addCatSpec, main: e.target.value})} sx={{ mt: 1, '& .MuiInputBase-root': { color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }} />
           )}
           {addCatSpec.level === 'sub' && (
             <TextField variant="outlined" autoFocus fullWidth label="詳細カテゴリ名" value={addCatSpec.sub} onChange={e => setAddCatSpec({...addCatSpec, sub: e.target.value})} sx={{ mt: 1, '& .MuiInputBase-root': { color: 'var(--brand-fg)' }, '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }} />
           )}

           {currentUser?.role === 'admin' && (
             <FormControlLabel
               control={<Checkbox checked={addCatSpec.isSystem} onChange={e => setAddCatSpec({...addCatSpec, isSystem: e.target.checked})} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-checked': { color: 'light-dark(#0a5fa4, #64b5f6)' } }} />}
               label="システム全体のカテゴリとして登録する"
               sx={{ mt: 3, display: 'block', color: 'rgb(var(--brand-fg-rgb) / 0.8)' }}
             />
           )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
           <Button onClick={() => setAddCatSpec({ ...addCatSpec, open: false })} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
           <Button variant="contained" sx={{ bgcolor: '#64b5f6', color: '#000', '&:hover': { bgcolor: '#42a5f5' } }} onClick={async () => {
             const isSystem = currentUser?.role === 'admin' && addCatSpec.isSystem;
             const { macro, main, sub } = addCatSpec;
             if (!macro) return;
             
             if (isSystem) {
               await addSystemCategory(macro, main, sub);
             } else {
               addCustomCategory({
                 baseMainCategory: macro,
                 baseSubCategory: main,
                 name: sub || ""
               });
             }
             
             handleUpdate({
               macroCategory: macro,
               mainCategory: main || '',
               subCategory: sub || '',
               ...clearAiFlag()
             });
             setAddCatSpec({ open: false, level: '', macro: '', main: '', sub: '', isSystem: false });
           }}>追加する</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default UploadQueueItemCard;
