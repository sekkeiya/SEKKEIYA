import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardActionArea, Box, Chip, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AutoAwesomeMotionRoundedIcon from '@mui/icons-material/AutoAwesomeMotionRounded'; // Rhino
import ThreeDRotationRoundedIcon from '@mui/icons-material/ThreeDRotationRounded'; // Blender
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';

import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';

import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import { invoke } from '@tauri-apps/api/core';
import { useDccStore } from '../../store/useDccStore';
import { getModelLocalPathCached, invalidateModelLocalPathCacheByModelId } from '../../lib/modelLocalPathCache';
import { useAppStore } from '../../store/useAppStore';
import { useDssSyncStore } from '../../store/useDssSyncStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getCanonicalModelId, getAvailableFormatsFromModel, getSizeLabelForModel, resolveDownloadUrl, buildOpenTargets } from './utils/modelUtils';
import { useLocalModelThumbnail } from './hooks/useLocalModelThumbnail';
import { useLocalUploadStore } from './store/useLocalUploadStore';
import { DssModelCardActionBar } from './DssModelCardActionBar';

const BUSY_MIN_DURATION_MS = 1200;

export const DssModelCard: React.FC<{
  model: any;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, model: any) => void;
  badgeColor?: string;
  showDetails?: boolean;
  onSave?: (model: any) => void;
  onShare?: (model: any) => void;
  onDelete?: (model: any) => void;
  onAuthorClick?: (model: any) => void;
  onDoubleClick?: (model: any) => void;
  cardContext?: "models" | "boards" | "publicModels" | "privateModels" | "boardModels";
  usageCount?: number;   // total placements across all layouts
  layoutCount?: number;  // number of distinct layouts / option plans
}> = ({ model, isSelected, onClick, onDragStart, badgeColor, showDetails, cardContext, onSave, onShare, onDelete, onAuthorClick, onDoubleClick, usageCount, layoutCount }) => {
  // (Cache state no longer needed)
  const [busyMode, setBusyMode] = useState<"caching" | "opening" | null>(null);
  const busyStartRef = useRef<number | null>(null);

  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchorEl);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rhinoStatus = useDccStore(s => s.rhinoStatus);
  const openSetupModal = useDccStore(s => s.openSetupModal);
  const currentUid = useAuthStore(s => s.currentUser?.uid);
  const [defaultSetSnack, setDefaultSetSnack] = useState<string | null>(null);
  const snackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const computedThumbnailUrl =
    model?.metadata?.thumbnailFilePath?.url ||
    model?.metadata?.thumbnailUrl ||
    model?.metadata?.thumbnail?.url ||
    model?.thumbnailFilePath?.url ||
    model?.thumbnailUrl ||
    model?.thumbnail?.url ||
    model?.imageUrl ||
    model?.previewUrl ||
    model?.src ||
    model?.downloadUrl ||
    model?.modelUrl ||
    model?.storageUrl ||
    '';

  const [asyncAssetData, setAsyncAssetData] = useState<any>(null);

  const masterRefId = model?.assetRef || model?.metadata?.sourceModelId || model?.sourceModelId || model?.originalModelId;

  useEffect(() => {
    if (masterRefId) {
      let isMounted = true;
      const fetchAsset = async () => {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../../lib/firebase/client');
          const assetDoc = await getDoc(doc(db, "assets", masterRefId));
          if (assetDoc.exists() && isMounted) {
            setAsyncAssetData(assetDoc.data());
          }
        } catch (err: any) {
          if (err.code !== 'permission-denied') {
            console.error("Failed to fetch fallback asset", err);
          }
        }
      };
      fetchAsset();
      return () => { isMounted = false; };
    } else {
      setAsyncAssetData(null);
    }
  }, [masterRefId]);

  const resolvedModel = useMemo(() => {
    if (asyncAssetData) {
      const merged = { ...asyncAssetData, ...model };
      if (asyncAssetData.files || model.files) {
        merged.files = { ...(asyncAssetData.files || {}), ...(model.files || {}) };
      }
      return merged;
    }
    return model;
  }, [model, asyncAssetData]);

  const thumbnailUrl =
    computedThumbnailUrl ||
    asyncAssetData?.metadata?.thumbnailFilePath?.url ||
    asyncAssetData?.metadata?.thumbnailUrl ||
    asyncAssetData?.metadata?.thumbnail?.url ||
    asyncAssetData?.thumbnailFilePath?.url ||
    asyncAssetData?.thumbnailUrl ||
    asyncAssetData?.thumbnail?.url ||
    asyncAssetData?.imageUrl ||
    asyncAssetData?.previewUrl ||
    asyncAssetData?.src ||
    asyncAssetData?.downloadUrl ||
    asyncAssetData?.storageUrl ||
    resolvedModel?.thumbnailUrl ||
    resolvedModel?.imageUrl ||
    resolvedModel?.src ||
    resolvedModel?.downloadUrl ||
    resolvedModel?.storageUrl;

  // ローカルモデルは GLB から遅延生成したサムネを使う（クラウド側に画像が無いため）。
  const localThumb = useLocalModelThumbnail(resolvedModel);
  const displayThumbnailUrl = thumbnailUrl || localThumb;

  // ローカルモデルのクラウド保存状態（公開/非公開）。
  const uploadRecords = useLocalUploadStore(s => s.records);
  const localUploadRec = resolvedModel?.isLocal && resolvedModel?.localPath
    ? uploadRecords[String(resolvedModel.localPath).toLowerCase()] || null
    : null;

  const title = resolvedModel?.title || resolvedModel?.name || 'Untitled';
  const modelId = useMemo(() => getCanonicalModelId(resolvedModel), [resolvedModel]);

  const formats = useMemo(() => getAvailableFormatsFromModel(resolvedModel), [resolvedModel]);
  const sizes = useMemo(
    () => ({
      "3dm": getSizeLabelForModel(resolvedModel, "3dm"),
      glb: getSizeLabelForModel(resolvedModel, "glb"),
      blend: getSizeLabelForModel(resolvedModel, "blend"),
    }),
    [resolvedModel]
  );
  
  // NOTE: thumbnailUrl, title, modelId are already up to date above.

  const defaultExt = useMemo(() => {
    if (formats.has3dm) return "3dm";
    if (formats.hasGlb) return "glb";
    if (formats.hasBlend) return "blend";
    return "3dm";
  }, [formats]);

  const dimensionsStr = useMemo(() => {
    const md = resolvedModel?.metadata?.dimensions;
    const d = md || resolvedModel?.dimensions || resolvedModel?.size;
    if (!d) {
      if (resolvedModel?.width !== undefined || resolvedModel?.w !== undefined || resolvedModel?.W !== undefined) {
        return `W${resolvedModel?.width ?? resolvedModel?.w ?? resolvedModel?.W ?? '-'} × D${resolvedModel?.depth ?? resolvedModel?.d ?? resolvedModel?.D ?? '-'} × H${resolvedModel?.height ?? resolvedModel?.h ?? resolvedModel?.H ?? '-'}`;
      }
      return 'W - × D - × H -';
    }
    if (typeof d === 'string') return d;
    if (d.width !== undefined || d.w !== undefined) {
      const w = d.width ?? d.w ?? '-';
      const dp = d.depth ?? d.d ?? d.length ?? d.l ?? '-';
      const h = d.height ?? d.h ?? '-';
      return `W${w} × D${dp} × H${h}`;
    }
    return 'W - × D - × H -';
  }, [resolvedModel]);

  const openTargets = useMemo(() => buildOpenTargets(formats), [formats]);

  const beginBusy = useCallback((mode: "caching" | "opening") => {
    busyStartRef.current = Date.now();
    setBusyMode(mode);
  }, []);

  const endBusy = useCallback(() => {
    const startedAt = busyStartRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remain = BUSY_MIN_DURATION_MS - elapsed;

    const clear = () => {
      busyStartRef.current = null;
      setBusyMode(null);
    };

    if (remain > 0) setTimeout(clear, remain);
    else clear();
  }, []);

  const cancelCloseMenuTimer = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const scheduleCloseMenu = () => {
    cancelCloseMenuTimer();
    hoverCloseTimerRef.current = setTimeout(() => {
      setMenuAnchorEl(null);
      hoverCloseTimerRef.current = null;
    }, 600);
  };

  useEffect(() => {
    return () => cancelCloseMenuTimer();
  }, []);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (busyMode) return;
    cancelCloseMenuTimer();
    setMenuAnchorEl(e.currentTarget);
  };

  const handleCloseMenu = () => {
    cancelCloseMenuTimer();
    setMenuAnchorEl(null);
  };

  const handleIconMouseLeave = () => {
    if (busyMode) return;
    scheduleCloseMenu();
  };

  const handleSelectTarget = async (target: any) => {
    handleCloseMenu();
    if (!modelId) return;

    const openExt = (() => {
      if (Array.isArray(target.extCandidates) && target.extCandidates.length > 0) {
        for (const e of target.extCandidates) {
          if (e === "blend" && formats.hasBlend) return "blend";
          if (e === "glb" && formats.hasGlb) return "glb";
          if (e === "3dm" && formats.has3dm) return "3dm";
        }
      }
      return target.ext || defaultExt || "3dm";
    })();

    beginBusy("opening");
    if (target.app === "rhino" || target.app === "blender") {
      useAppStore.getState().setGlobalLaunchingTool(target.app);
    }

    try {
      let filePath = await getModelLocalPathCached(modelId, openExt);

      if (!filePath) {
        const url = await resolveDownloadUrl(model, openExt, modelId);
        if (!url) return;

        await invoke("ensure_model_cached", {
          modelId,
          ext: openExt,
          downloadUrl: url,
        });

        invalidateModelLocalPathCacheByModelId(modelId);
        filePath = await getModelLocalPathCached(modelId, openExt);
      }

      if (target.app === "rhino") {
        await invoke("open_model_in_rhino", { modelId, ext: openExt });
        if (filePath) {
          useDssSyncStore.getState().registerActiveModel(modelId, filePath);
        }
        // 外部重負荷アプリの起動待ち時間
        await new Promise(resolve => setTimeout(resolve, 4500));
      } else if (target.app === "blender") {
        await invoke("open_model_in_blender", { modelId, ext: openExt });
        if (filePath) {
          useDssSyncStore.getState().registerActiveModel(modelId, filePath);
        }
        await new Promise(resolve => setTimeout(resolve, 4500));
      }
    } catch (err) {
      console.error("Failed to open model in external app:", err);
    } finally {
      if (target.app === "rhino" || target.app === "blender") {
        useAppStore.getState().setGlobalLaunchingTool(null);
      }
      endBusy();
    }
  };

  const isBusy = busyMode !== null;

  const p3dm = sizes["3dm"] ? `3DM ${sizes["3dm"]}` : "3DM";
  const pglb = sizes.glb ? `GLB ${sizes.glb}` : "GLB";
  const pblend = sizes.blend ? `BLEND ${sizes.blend}` : "BLEND";

  const getFormatChipSx = (format: string) => {
    const base = {
      height: 22,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "0.01em",
      boxShadow: "0 1px 0 rgba(0,0,0,0.22), 0 0 0 1px rgb(var(--slate-panel-rgb) / 0.6)",
    };
    if (format === "3dm") {
      return {
        ...base,
        color: "#052e16",
        background: "linear-gradient(135deg, rgba(34,197,94,0.95), rgba(74,222,128,0.92))",
        border: "1px solid rgba(187,247,208,0.65)",
      };
    }
    if (format === "glb") {
      return {
        ...base,
        color: "#0b1b3a",
        background: "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(147,197,253,0.9))",
        border: "1px solid rgba(191,219,254,0.75)",
      };
    }
    return {
      ...base,
      color: "#3b0a0a",
      background: "linear-gradient(135deg, rgba(239,68,68,0.95), rgba(252,165,165,0.9))",
      border: "1px solid rgba(254,202,202,0.8)",
    };
  };

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const mouseXSpring = useSpring(mouseX, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(mouseY, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["9deg", "-9deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-9deg", "9deg"]);

  // Removed central glareBackground in favor of a static top-diagonal lighting & drop-shadow

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX.set(x / width - 0.5);
    mouseY.set(y / height - 0.5);
  };

  const handlePointerLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <Box
      sx={{ width: '100%', height: '100%', perspective: 1400 }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <Card
          elevation={0}
          data-model-card="true"
          data-debug-component="DssModelCard"
          draggable={true}
          onClick={(e) => onClick?.(e)}
          onDoubleClick={() => {
            if (onDoubleClick) onDoubleClick(model);
          }}
          onDragStart={(e) => {
            console.log('[DssModelCard] DragStart payload:', model);
            e.dataTransfer.setData('application/sekkeiya-asset', JSON.stringify(model));
            if (onDragStart) onDragStart(e, model);
          }}
          sx={{
            position: 'relative',
            height: '100%',
            aspectRatio: '1 / 1',
            backgroundColor: 'var(--brand-bg)',
            backgroundImage: 'radial-gradient(circle at 20% 0%, rgb(var(--slate-mid-rgb) / 0.4) 0%, rgb(var(--slate-deep-rgb) / 1) 70%)',
            borderRadius: 3,
            border: '1px solid rgb(var(--slate-800-rgb) / 0.9)',
            boxShadow: isSelected
              ? `0 18px 30px rgb(var(--slate-panel-rgb) / 0.9), 0 0 18px color-mix(in srgb, ${badgeColor ? badgeColor : '#38bdf8'} 20%, transparent)`
              : '0 8px 16px rgba(0,0,0,0.4)',
            borderColor: isSelected ? undefined : 'rgb(var(--slate-ink-rgb) / 0.2)',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            overflow: 'hidden',
            userSelect: 'none',
            '&:hover': {
              boxShadow: isSelected
                ? `0 24px 40px rgb(var(--slate-panel-rgb) / 1), 0 0 24px color-mix(in srgb, ${badgeColor ? badgeColor : '#38bdf8'} 20%, transparent)`
                : '0 16px 32px rgba(0,0,0,0.6), 0 0 4px rgb(var(--slate-ink-rgb) / 0.3)',
              borderColor: isSelected ? undefined : 'rgb(var(--slate-ink-rgb) / 0.4)',
            },
            '&:hover .DesktopModelCard-thumbnail': !isBusy ? {
              transform: 'translateZ(0) scale(1.2) translateY(-4px)',
              filter: 'drop-shadow(8px 16px 20px rgba(0,0,0,0.8))',
            } : {},
            '& .DssModelCard-details': {
              opacity: showDetails ? 1 : 0,
              pointerEvents: showDetails ? 'auto' : 'none',
              transition: 'opacity 0.2s ease',
            },
            '&:hover .DssModelCard-details': {
              opacity: 1,
              pointerEvents: 'auto',
            },
        '&::after': isSelected ? {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          border: `3px solid ${badgeColor ? badgeColor : 'rgba(56, 191, 248, 0.4)'}`,
          pointerEvents: 'none',
          zIndex: 20,
        } : undefined,
      }}
    >
      {/* Removed the moving glare div for a cleaner look with static lighting */}
      <CardActionArea
        component="div"
        draggable={false}
        onClick={isBusy ? undefined : (e) => onClick?.(e)}
        onDoubleClick={!isBusy ? () => onDoubleClick?.(resolvedModel) : undefined}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          p: 0,
          borderRadius: 3,
          overflow: 'hidden',
          cursor: isBusy ? 'default' : 'pointer',
          userSelect: 'none',
          WebkitUserDrag: 'none',
          pointerEvents: 'none', // TEMP DEBUG
        }}
      >
        {/* Background Thumbnail */}
        {displayThumbnailUrl ? (
          <Box
            className="DesktopModelCard-thumbnail"
            component="img"
            src={displayThumbnailUrl}
            alt={title}
            draggable={false}
            loading="lazy"
            decoding="async"
            sx={{
              position: 'absolute',
              top: '-75%',
              left: '-75%',
              width: '250%',
              height: '250%',
              objectFit: 'contain',
              backgroundColor: 'transparent',
              transform: 'translateZ(0) scale(1.05)',
              transformOrigin: 'center center',
              transition: 'transform 220ms cubic-bezier(0.22,0.61,0.36,1), filter 220ms ease',
              willChange: 'transform',
              imageRendering: 'high-quality',
              filter: 'drop-shadow(5px 10px 14px rgba(0,0,0,0.6))',
            }}
          />
        ) : (
          <Box
            className="DesktopModelCard-thumbnail"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: 'rgb(var(--slate-ink-rgb) / 0.9)',
              backgroundColor: 'var(--brand-surface)',
              flexDirection: 'column',
              p: 2,
              textAlign: 'center'
            }}
          >
            <InsertDriveFileRoundedIcon sx={{ fontSize: 32, mb: 1, color: 'rgb(var(--slate-ink-rgb) / 0.6)' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{title}</Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1 }}>{resolvedModel.format || resolvedModel.type}</Typography>
          </Box>
        )}

        {/* Top-Left Details Container */}
        <Box
          className="DssModelCard-details"
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.8,
            maxWidth: '86%',
          }}
        >
          {/* Format Pills Row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
            {/* Visibility badge — layout items only */}
            {resolvedModel.appScope === '3dsl' && resolvedModel.visibility && (
              <Chip
                size="small"
                icon={resolvedModel.visibility === 'private'
                  ? <LockRoundedIcon sx={{ fontSize: '11px !important', color: 'light-dark(#aa7c03, #fbbf24) !important' }} />
                  : <PublicRoundedIcon sx={{ fontSize: '11px !important', color: '#34d399 !important' }} />
                }
                label={resolvedModel.visibility === 'private' ? '非公開' : '公開中'}
                sx={{
                  height: 22,
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.01em',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.22), 0 0 0 1px rgb(var(--slate-panel-rgb) / 0.6)',
                  ...(resolvedModel.visibility === 'private' ? {
                    color: 'var(--brand-fg)',
                    background: 'linear-gradient(135deg, rgba(120,53,15,0.95), rgba(180,83,9,0.9))',
                    border: '1px solid rgba(251,191,36,0.5)',
                  } : {
                    color: 'var(--brand-fg)',
                    background: 'linear-gradient(135deg, rgba(6,78,59,0.95), rgba(4,120,87,0.9))',
                    border: '1px solid rgba(52,211,153,0.5)',
                  }),
                }}
              />
            )}
            {formats.has3dm && <Chip size="small" label={p3dm} sx={getFormatChipSx('3dm')} />}
            {formats.hasGlb && <Chip size="small" label={pglb} sx={getFormatChipSx('glb')} />}
            {formats.hasBlend && <Chip size="small" label={pblend} sx={getFormatChipSx('blend')} />}
            
            {/* Fallback: derive format from modelUrl extension rather than showing 'ITEM' */}
            {!formats.has3dm && !formats.hasGlb && !formats.hasBlend && (() => {
              const url = resolvedModel.modelUrl || resolvedModel.metadata?.modelUrl || '';
              const ext = url.split('.').pop()?.toLowerCase().replace(/\?.*$/, '');
              const chipKey = ext === 'glb' ? 'glb' : ext === '3dm' ? '3dm' : ext === 'blend' ? 'blend' : 'unknown';
              const baseLabel = ext === 'glb' ? 'GLB' : ext === '3dm' ? '3DM' : ext === 'blend' ? 'BLEND'
                : (resolvedModel.format || resolvedModel.metadata?.format || resolvedModel.metadata?.ext || resolvedModel.type)?.toUpperCase() || null;
              if (!baseLabel) return null;
              // Include file size label to match regular model card format (e.g. "GLB 2.3MB")
              const sizeLabel = getSizeLabelForModel(resolvedModel, ext || '');
              const label = sizeLabel ? `${baseLabel} ${sizeLabel}` : baseLabel;
              return <Chip size="small" label={label} sx={getFormatChipSx(chipKey)} />;
            })()}

            {/* クラウド保存ステータス（Local Models のみ） */}
            {localUploadRec && (
              <Chip
                size="small"
                icon={localUploadRec.visibility === 'private'
                  ? <LockRoundedIcon sx={{ fontSize: '11px !important', color: '#fff !important' }} />
                  : <PublicRoundedIcon sx={{ fontSize: '11px !important', color: '#fff !important' }} />}
                label={localUploadRec.visibility === 'private' ? 'クラウド · 非公開' : 'クラウド · 公開'}
                sx={{
                  height: 22, borderRadius: 999, fontSize: 10.5, fontWeight: 800, color: 'var(--brand-fg)',
                  bgcolor: localUploadRec.visibility === 'private' ? 'rgba(251,146,60,0.85)' : 'rgba(167,139,250,0.85)',
                  '& .MuiChip-label': { px: 0.8 },
                }}
              />
            )}
          </Box>

          {/* Dimensions Overlay — hidden for layout items */}
          {dimensionsStr && resolvedModel.appScope !== '3dsl' && (
            <Chip 
              size="small" 
              label={dimensionsStr} 
              sx={{
                height: 20,
                fontSize: 10,
                fontWeight: 600,
                bgcolor: 'rgb(var(--slate-panel-rgb) / 0.6)',
                color: 'var(--brand-fg)',
                border: isSelected ? '2px solid #3b82f6' : '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              }}
            />
          )}
          
        </Box>

        {/* Action Bar was here, moved out */}

      </CardActionArea>

      {/* Action Menu (Top Right) — 3DSS models only */}
      {resolvedModel.appScope !== '3dsl' && <Box className="DssModelCard-details" sx={{ position: 'absolute', top: 4, right: 4, zIndex: 13 }}>
        <Tooltip title={isBusy ? "" : "外部アプリで開く"}>
          <span>
            <IconButton
              size="small"
              sx={{
                backgroundColor: 'rgb(var(--slate-panel-rgb) / 0.8)',
                '&:hover': {
                  backgroundColor: isBusy ? 'rgb(var(--slate-panel-rgb) / 0.8)' : 'rgb(var(--slate-panel-rgb) / 1)',
                },
              }}
              onClick={isBusy ? undefined : handleOpenMenu}
              disabled={isBusy}
            >
              <OpenInNewRoundedIcon sx={{ fontSize: 18, color: 'var(--brand-fg)' }} />
            </IconButton>
          </span>
        </Tooltip>

        <Menu
          anchorEl={menuAnchorEl}
          open={menuOpen && !isBusy}
          onClose={handleCloseMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          disableAutoFocus
          disableEnforceFocus
          disableRestoreFocus
          disableScrollLock
          disableAutoFocusItem
          MenuListProps={{
            onMouseEnter: cancelCloseMenuTimer,
            onMouseLeave: scheduleCloseMenu,
            autoFocusItem: false,
          }}
          PaperProps={{
            sx: {
              bgcolor: 'rgb(var(--slate-panel-rgb) / 0.95)', /* slate-900 translucent */
              backdropFilter: 'blur(10px)',
              color: 'var(--brand-fg)', /* slate-50 */
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              mt: 1,
              borderRadius: 2,
              minWidth: 200,
              overflow: 'hidden',
              '& .MuiList-root': { py: 0.5 },
            }
          }}
        >
          <MenuItem
            sx={{ py: 1, px: 2, minHeight: 32, gap: 1 }}
            onClick={(e) => {
              handleCloseMenu();
              
              if (rhinoStatus !== 'connected') {
                openSetupModal('rhino');
                return;
              }

              if (onDragStart) {
                onDragStart(e as unknown as React.DragEvent<HTMLDivElement>, model);
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 'auto !important' }}>
              {rhinoStatus === 'connected' ? (
                 <SendRoundedIcon sx={{ fontSize: 18, color: 'var(--brand-fg)' }} />
              ) : (
                 <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: 'light-dark(#aa7c03, #fbbf24)' }} />
              )}
            </ListItemIcon>
            <ListItemText
              primary={rhinoStatus === 'connected' ? "開いているRhinoへ送る" : "Rhino連携をセットアップ"}
              primaryTypographyProps={{ fontSize: 12, color: rhinoStatus === 'connected' ? 'var(--brand-fg)' : 'light-dark(#ab8303, #fcd34d)', fontWeight: 600 }}
            />
          </MenuItem>
          {openTargets.length > 0 && <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', my: 0.5 }} />}
          {openTargets.map((t) => (
            <MenuItem 
              key={t.id} 
              onClick={() => handleSelectTarget(t)}
              sx={{ py: 1, px: 2, minHeight: 32, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 'auto !important', color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>
                {t.app === "rhino" ? (
                  <AutoAwesomeMotionRoundedIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ThreeDRotationRoundedIcon sx={{ fontSize: 16 }} />
                )}
              </ListItemIcon>
              <ListItemText 
                primary={t.label} 
                primaryTypographyProps={{ fontSize: 12, fontWeight: 500, color: 'var(--brand-fg)' }}
              />
            </MenuItem>
          ))}

          {openTargets.length === 0 && (
            <MenuItem disabled sx={{ py: 1, px: 2, minHeight: 32 }}>
              <ListItemText
                primary="対応ファイルがありません"
                primaryTypographyProps={{ fontSize: 12, color: '#64748b' }}
              />
            </MenuItem>
          )}

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', my: 0.5 }} />
          <MenuItem
            sx={{ py: 1, px: 2, minHeight: 32, gap: 1 }}
            onClick={async () => {
              handleCloseMenu();
              if (!currentUid) return;
              try {
                const { matchCategoryKey } = await import('../../features/dsl/layout/constants/furnitureCategoryDefaults');
                const rawCat = model?.subCategory || model?.category || model?.mainCategory || '';
                const key = matchCategoryKey(rawCat) ?? matchCategoryKey(model?.title ?? '');
                if (!key) {
                  setDefaultSetSnack('カテゴリを特定できませんでした');
                if (snackTimerRef.current) clearTimeout(snackTimerRef.current);
                snackTimerRef.current = setTimeout(() => setDefaultSetSnack(null), 2500);
                  return;
                }
                const { useFurnitureDefaultsStore } = await import('../../features/dsl/layout/store/useFurnitureDefaultsStore');
                const thumb = model?.thumbnailUrl || model?.metadata?.thumbnailUrl || model?.thumbUrl || '';
                await useFurnitureDefaultsStore.getState().set(currentUid, {
                  categoryKey: key,
                  entityId: model?.id || model?.entityId,
                  title: model?.title || model?.name || 'Untitled',
                  thumbnailUrl: thumb || undefined,
                });
                const msg = `「${model?.title || 'このモデル'}」をデフォルト家具に設定しました`;
                setDefaultSetSnack(msg);
                if (snackTimerRef.current) clearTimeout(snackTimerRef.current);
                snackTimerRef.current = setTimeout(() => setDefaultSetSnack(null), 2500);
              } catch (e) {
                console.error('[DssModelCard] set default failed', e);
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 'auto !important' }}>
              <BookmarkAddRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#2f07a6, #a78bfa)' }} />
            </ListItemIcon>
            <ListItemText
              primary="レイアウトのデフォルトに設定"
              primaryTypographyProps={{ fontSize: 12, color: 'light-dark(#2f07a6, #a78bfa)', fontWeight: 600 }}
            />
          </MenuItem>
        </Menu>
      </Box>}

      {/* デフォルト設定確認スナック */}
      {defaultSetSnack && (
        <Box
          sx={{
            position: 'absolute', bottom: 44, left: 0, right: 0, mx: 1,
            bgcolor: 'rgba(124,58,237,0.9)', backdropFilter: 'blur(8px)',
            borderRadius: 1.5, px: 1.25, py: 0.75, zIndex: 20,
            border: '1px solid rgba(167,139,250,0.4)',
          }}
          onClick={() => setDefaultSetSnack(null)}
        >
          <Typography sx={{ fontSize: 10.5, color: 'var(--brand-fg)', lineHeight: 1.4 }}>{defaultSetSnack}</Typography>
        </Box>
      )}

      {/* Custom Action Bar */}
      <Box className="DssModelCard-details" sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <DssModelCardActionBar
          model={model}
          cardContext={cardContext}
          isBusy={isBusy}
          onSave={onSave}
          onShare={onShare}
          onDelete={onDelete}
          onAuthorClick={onAuthorClick}
        />
      </Box>

      </Card>
      </motion.div>
    </Box>
  );
};
