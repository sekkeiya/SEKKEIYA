import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { getDocs, query, collection, where, limit, and, or } from 'firebase/firestore';
import { db, auth } from '@desktop/lib/firebase/client';
import { useAutoLayoutStore } from '@desktop/features/dsl/layout/store/useAutoLayoutStore';
import { projectAssetsApi } from '@desktop/features/projects/api/projectAssetsApi';

import type { BuildingType } from '../types/layoutRules';

interface AutoLayoutConfigDialogProps {
  projectId: string | null;
}

const PURPOSE_OPTIONS: Record<BuildingType, { value: string, label: string }[]> = {
  residential: [
    { value: 'general', label: '汎用 (General)' },
    { value: 'living', label: 'リビング (Living)' },
    { value: 'bedroom', label: '寝室 (Bedroom)' },
    { value: 'study', label: '書斎 (Study)' },
  ],
  office: [
    { value: 'general', label: '汎用 (General)' },
    { value: 'desk', label: '執務室 (Desk)' },
    { value: 'meeting', label: '会議室 (Meeting)' },
  ],
  cafe: [
    { value: 'general', label: '汎用 (General)' },
    { value: 'seating', label: '客席 (Seating)' },
  ],
  hotel: [{ value: 'general', label: '汎用 (General)' }],
  custom: [{ value: 'general', label: '汎用 (General)' }],
};

export function AutoLayoutConfigDialog({ projectId }: AutoLayoutConfigDialogProps) {
  const theme = useTheme();
  
  const configDialogOpen = useAutoLayoutStore((s) => s.configDialogOpen);
  const closeConfigDialog = useAutoLayoutStore((s) => s.closeConfigDialog);
  const autoLayoutMode = useAutoLayoutStore((s) => s.autoLayoutMode);
  const setAutoLayoutMode = useAutoLayoutStore((s) => s.setAutoLayoutMode);
  
  const furnitureSource = useAutoLayoutStore((s) => s.furnitureSource);
  const setFurnitureSource = useAutoLayoutStore((s) => s.setFurnitureSource);
  
  const selectedZoneIdsForConfig = useAutoLayoutStore((s) => s.selectedZoneIdsForConfig);
  const requestAutoLayout = useAutoLayoutStore((s) => s.requestAutoLayout);

  const buildingType = useAutoLayoutStore((s) => s.buildingType);
  const setBuildingType = useAutoLayoutStore((s) => s.setBuildingType);
  const zonePurpose = useAutoLayoutStore((s) => s.zonePurpose);
  const setZonePurpose = useAutoLayoutStore((s) => s.setZonePurpose);

  const [counts, setCounts] = useState<{ project: number | null, following: number | null, public: number | null }>({ project: null, following: null, public: null });

  // When dialog opens, fetch counts and set defaults
  useEffect(() => {
    if (configDialogOpen) {
      // Reset counts on open
      setCounts({ project: null, following: null, public: null });

      const fetchCounts = async () => {
        try {
          let projectCount = 0;
          let followingCount = 0;
          let publicCount = 0;

          // 1. Fetch Project Assets Count
          if (projectId) {
            const assets = await projectAssetsApi.getAssets(projectId);
            projectCount = assets.length;
          }

          // 2. Fetch Following Models Count
          const uid = auth.currentUser?.uid;
          if (uid) {
            const followingRef = collection(db, `users/${uid}/following`);
            const followingSnap = await getDocs(query(followingRef, limit(30)));
            const followIds = followingSnap.docs.map(d => d.id);
            if (followIds.length > 0) {
              const assetsCol = collection(db, "assets");
              const followingQuery = query(assetsCol, 
                and(
                  where('type', '==', '3d-model'), 
                  or(where('visibility', '==', 'public'), where('isPublic', '==', true)),
                  where('ownerId', 'in', followIds)
                ),
                limit(50)
              );
              const fSnap = await getDocs(followingQuery);
              followingCount = fSnap.docs.length;
            }
          }

          // 3. Fetch Public Models Count
          const assetsCol = collection(db, "assets");
          const publicQuery = query(assetsCol, 
            and(
              where('type', '==', '3d-model'), 
              or(where('visibility', '==', 'public'), where('isPublic', '==', true))
            ),
            limit(50)
          );
          const pSnap = await getDocs(publicQuery);
          publicCount = pSnap.docs.length;

          setCounts({ project: projectCount, following: followingCount, public: publicCount });

          // Determine default selection
          if (projectCount > 0) {
            setFurnitureSource('project');
          } else {
            setFurnitureSource('following');
          }
        } catch (e) {
          console.error("Failed to fetch asset counts:", e);
          setCounts({ project: 0, following: 0, public: 0 });
          setFurnitureSource('following');
        }
      };
      
      fetchCounts();
    }
  }, [configDialogOpen, projectId, setFurnitureSource]);

  const handleExecute = () => {
    // This will trigger the actual auto layout pipeline in LayoutShell
    requestAutoLayout(selectedZoneIdsForConfig);
  };

  const line = alpha(theme.palette.common.white, 0.15);

  return (
    <Dialog
      open={configDialogOpen}
      onClose={closeConfigDialog}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "#1c1c24",
          border: `1px solid ${line}`,
          color: "#fff",
          minWidth: 380,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 900, fontSize: 18, borderBottom: `1px solid ${line}`, pb: 2 }}>
        Auto Layout の設定
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <FormControl>
            <FormLabel sx={{ color: alpha("#fff", 0.7), fontSize: 14, mb: 1, '&.Mui-focused': { color: alpha("#fff", 0.7) } }}>
              生成モード
            </FormLabel>
            <RadioGroup
              value={autoLayoutMode}
              onChange={(e) => setAutoLayoutMode(e.target.value as 'ai' | 'rules-only')}
            >
              <FormControlLabel 
                value="rules-only" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>ルールベースのみ（高速）</Typography>} 
              />
              <FormControlLabel 
                value="ai" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>AI レイアウト</Typography>} 
              />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ color: alpha("#fff", 0.7), fontSize: 14, mb: 1, '&.Mui-focused': { color: alpha("#fff", 0.7) } }}>
              使用する家具の範囲
            </FormLabel>
            <RadioGroup
              value={furnitureSource}
              onChange={(e) => setFurnitureSource(e.target.value as 'project' | 'following' | 'public')}
            >
              <FormControlLabel 
                value="project" 
                disabled={counts.project === 0}
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={
                  <Typography sx={{ fontSize: 15, color: counts.project === 0 ? alpha("#fff", 0.3) : '#fff' }}>
                    プロジェクト内のみ {counts.project === null ? '(取得中...)' : `(${counts.project}件)`}
                  </Typography>
                } 
              />
              <FormControlLabel 
                value="following" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={
                  <Typography sx={{ fontSize: 15, color: '#fff' }}>
                    プロジェクト＋Following <Typography component="span" sx={{ fontSize: 13, color: alpha('#fff', 0.6) }}>(+Following公開モデル {counts.following === null ? '取得中...' : `${counts.following}件`})</Typography>
                  </Typography>
                } 
              />
              <FormControlLabel 
                value="public" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={
                  <Typography sx={{ fontSize: 15, color: '#fff' }}>
                    すべての公開モデル <Typography component="span" sx={{ fontSize: 13, color: alpha('#fff', 0.6) }}>(+Explore公開モデル {counts.public === null ? '取得中...' : (counts.public >= 50 ? '50件以上' : `${counts.public}件`)})</Typography>
                  </Typography>
                } 
              />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ color: alpha("#fff", 0.7), fontSize: 14, mb: 1, '&.Mui-focused': { color: alpha("#fff", 0.7) } }}>
              建物タイプ（配置ルールの基準）
            </FormLabel>
            <RadioGroup
              value={buildingType}
              onChange={(e) => {
                setBuildingType(e.target.value as any);
                setZonePurpose('general'); // Reset purpose when building type changes
              }}
              row
              sx={{ gap: 2 }}
            >
              <FormControlLabel 
                value="residential" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>住宅 (Residential)</Typography>} 
              />
              <FormControlLabel 
                value="office" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>オフィス (Office)</Typography>} 
              />
              <FormControlLabel 
                value="cafe" 
                control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />} 
                label={<Typography sx={{ fontSize: 15 }}>カフェ (Cafe)</Typography>} 
              />
            </RadioGroup>
          </FormControl>

          <FormControl>
            <FormLabel sx={{ color: alpha("#fff", 0.7), fontSize: 14, mb: 1, '&.Mui-focused': { color: alpha("#fff", 0.7) } }}>
              ゾーン用途（配置ルールの基準）
            </FormLabel>
            <RadioGroup
              value={zonePurpose}
              onChange={(e) => setZonePurpose(e.target.value as any)}
              row
              sx={{ gap: 2, flexWrap: 'wrap' }}
            >
              {PURPOSE_OPTIONS[buildingType]?.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" sx={{ color: line, '&.Mui-checked': { color: '#a78bfa' } }} />}
                  label={<Typography sx={{ fontSize: 15 }}>{opt.label}</Typography>}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, borderTop: `1px solid ${line}`, mt: 'auto', gap: 1 }}>
        <Button
          onClick={closeConfigDialog}
          sx={{
            color: alpha("#fff", 0.8),
            "&:hover": { background: alpha("#fff", 0.05) },
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={handleExecute}
          variant="contained"
          disabled={counts.project === null || counts.following === null || counts.public === null || (furnitureSource === 'project' && counts.project === 0)}
          sx={{
            borderRadius: 1,
            fontWeight: 800,
            background: "#7c3aed",
            "&:hover": { background: "#6d28d9" },
            "&.Mui-disabled": { background: alpha("#7c3aed", 0.3), color: alpha("#fff", 0.3) }
          }}
        >
          実行
        </Button>
      </DialogActions>
    </Dialog>
  );
}
