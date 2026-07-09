import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Select, MenuItem, Button, TextField, IconButton } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useWorkspaceSync } from '../../../features/dsl/layout/hooks/useWorkspaceSync';
import { useOptionRealtime } from '../../../features/dsl/layout/hooks/useOptionRealtime';
import { useOptionDoc } from '../../../features/dsl/layout/hooks/useOptionDoc';
import { db } from '../../../lib/firebase/client';
import { doc, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useAuthStore } from '../../../store/useAuthStore';

interface OverviewSpaceProgramProps {
  project: any;
}

export const OverviewSpaceProgram: React.FC<OverviewSpaceProgramProps> = ({ project }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const projectId = project?.id;
  const workspaceId = "layout"; // ID utilized for the Layout workspace in Desktop

  const [localBaseId, setLocalBaseId] = useState<string | null>(null);
  const [localPlanId, setLocalPlanId] = useState<string | null>(null);

  const { bases, plansOfSelectedBase, onSelectBase, onSelectPlan, isWorkspaceLoading } = useWorkspaceSync({
    uid: currentUser?.uid,
    projectId,
    workspaceId,
    initialBaseId: localBaseId,
    initialPlanId: localPlanId,
  });

  const { options, optionsLoading, selectedOptionId, setSelectedOptionId } = useOptionRealtime({
    uid: currentUser?.uid,
    projectId,
    workspaceId,
    baseId: localBaseId,
    planId: localPlanId,
  });

  const { data: optionData, loading: docLoading } = useOptionDoc({
    projectId,
    workspaceId,
    planId: selectedOptionId, // Option is a document in plans collection
    baseId: localBaseId
  });

  // Auto-select Base & Plan
  useEffect(() => {
    if (!isWorkspaceLoading && bases.length > 0 && !localBaseId) {
      setLocalBaseId(bases[0].id);
      onSelectBase(bases[0].id);
    }
  }, [bases, isWorkspaceLoading, localBaseId, onSelectBase]);

  useEffect(() => {
    if (!isWorkspaceLoading && plansOfSelectedBase.length > 0 && !localPlanId && localBaseId) {
      setLocalPlanId(plansOfSelectedBase[0].id);
      onSelectPlan(localBaseId, plansOfSelectedBase[0].id);
    }
  }, [plansOfSelectedBase, isWorkspaceLoading, localPlanId, localBaseId, onSelectPlan]);

  // Auto-select Option
  useEffect(() => {
    if (!optionsLoading && options.length > 0 && !selectedOptionId) {
      setSelectedOptionId(options[0].id);
    }
  }, [options, optionsLoading, selectedOptionId, setSelectedOptionId]);

  const handleUpdateZone = async (zoneId: string, field: string, value: any) => {
    if (!selectedOptionId) return;
    const optionDocRef = doc(db, 'projects', projectId, 'workspaces', workspaceId, 'plans', selectedOptionId);
    
    const currentZones = optionData?.spaceProgram?.zones || [];
    const updatedZones = currentZones.map((z: any) => 
      z.id === zoneId ? { ...z, [field]: value } : z
    );

    try {
      await setDoc(optionDocRef, {
        spaceProgram: { zones: updatedZones },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to update zone", err);
    }
  };

  const handleAddZone = async () => {
    if (!selectedOptionId) return;
    const optionDocRef = doc(db, 'projects', projectId, 'workspaces', workspaceId, 'plans', selectedOptionId);
    
    // Fallback snap fetch to ensure we don't overwrite blindly
    const snap = await getDoc(optionDocRef);
    const data = snap.exists() ? snap.data() : {};
    const currentZones = data?.spaceProgram?.zones || [];

    const newZone = {
      id: `zone-${Date.now()}`,
      name: `新規 Zone ${currentZones.length + 1}`,
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
      targetSeats: 0,
      targetArea: 0,
      priority: '',
      remarks: ''
    };

    try {
      await setDoc(optionDocRef, {
        spaceProgram: { zones: [...currentZones, newZone] },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to add zone", err);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!selectedOptionId) return;
    const optionDocRef = doc(db, 'projects', projectId, 'workspaces', workspaceId, 'plans', selectedOptionId);
    
    const currentZones = optionData?.spaceProgram?.zones || [];
    const updatedZones = currentZones.filter((z: any) => z.id !== zoneId);

    try {
      await setDoc(optionDocRef, {
        spaceProgram: { zones: updatedZones },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to delete zone", err);
    }
  };

  const isLoading = isWorkspaceLoading || optionsLoading || docLoading;

  const handleBaseChange = (baseId: string) => {
    setLocalBaseId(baseId);
    setLocalPlanId(null);
    onSelectBase(baseId);
  };

  const handlePlanChange = (planId: string) => {
    setLocalPlanId(planId);
    if (localBaseId) onSelectPlan(localBaseId, planId);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 }, flex: 1, width: "100%", maxWidth: 1600, mx: "auto", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      
      {/* Header & Scope Selector */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ color: "var(--brand-fg)", fontWeight: 800, mb: 1 }}>Space Program (空間要件定義)</Typography>
          <Typography variant="body2" sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)" }}>
            各Optionに対する空間要件（Zone, 目標席数, 面積）を管理します。ここで定義した要件はS.Layoutと連動します。
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', p: 1.5, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', display: 'block', mb: 0.5, px: 1 }}>Base</Typography>
            <Select
              size="small"
              value={localBaseId || ''}
              onChange={(e) => handleBaseChange(e.target.value)}
              sx={{ color: 'var(--brand-fg)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, width: 140, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }}
            >
              {bases.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </Select>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', display: 'block', mb: 0.5, px: 1 }}>Plan</Typography>
            <Select
              size="small"
              value={localPlanId || ''}
              onChange={(e) => handlePlanChange(e.target.value)}
              disabled={!localBaseId || plansOfSelectedBase.length === 0}
              sx={{ color: 'var(--brand-fg)', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, width: 140, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }}
            >
              <MenuItem value=""><em>選択してください</em></MenuItem>
              {plansOfSelectedBase.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </Select>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#00BFFF', fontWeight: 700, display: 'block', mb: 0.5, px: 1 }}>Target Option</Typography>
            <Select
              size="small"
              value={selectedOptionId || ''}
              onChange={(e) => setSelectedOptionId(e.target.value)}
              disabled={!localPlanId || options.length === 0}
              sx={{ color: 'var(--brand-fg)', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#00BFFF' }, width: 140, bgcolor: 'rgba(0,191,255,0.1)' }}
            >
              <MenuItem value=""><em>選択してください</em></MenuItem>
              {options.map(o => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </Select>
          </Box>
        </Box>
      </Box>

      {/* Editor Main Content */}
      <Paper sx={{ flex: 1, p: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
            <CircularProgress sx={{ color: '#00BFFF' }} />
          </Box>
        ) : !selectedOptionId ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 2 }}>Target Option が選択されていません</Typography>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>上部セレクターから定義対象の Option を選択してください。</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="subtitle1" sx={{ color: 'var(--brand-fg)', fontWeight: 700 }}>
                {optionData?.name || selectedOptionId} の Zone定義
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={handleAddZone}
                sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#4facfe' }, textTransform: 'none', borderRadius: 2 }}
              >
                Zoneを追加
              </Button>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '40px 100px 2fr 1fr 1fr 1fr auto', gap: 2, mb: 2, px: 2 }}>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>Color</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>Zone ID</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>Zone Name</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>目標席数</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>目標面積 (㎡)</Typography>
                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>備考</Typography>
                <Box width={40} />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(optionData?.spaceProgram?.zones || []).length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 }}>
                    <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 14 }}>
                      Zoneが一つも定義されていません。上のボタンから追加してください。
                    </Typography>
                  </Box>
                ) : (
                  (optionData.spaceProgram.zones).map((zone: any) => (
                    <Box 
                      key={zone.id} 
                      sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '40px 100px 2fr 1fr 1fr 1fr auto', 
                        gap: 2, 
                        alignItems: 'center',
                        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                        border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
                        p: 1.5,
                        borderRadius: 2,
                        transition: 'background-color 0.2s',
                        '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' }
                      }}
                    >
                      <input
                        type="color"
                        value={zone.color || '#000000'}
                        onChange={(e) => handleUpdateZone(zone.id, 'color', e.target.value)}
                        style={{ width: 32, height: 32, padding: 0, border: 'none', borderRadius: 16, cursor: 'pointer', background: 'transparent' }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontFamily: 'monospace' }}>
                        {zone.id.replace('zone-', '')}
                      </Typography>
                      <TextField
                        size="small"
                        value={zone.name || ''}
                        onChange={(e) => handleUpdateZone(zone.id, 'name', e.target.value)}
                        placeholder="Zone名称"
                        sx={{ input: { color: 'var(--brand-fg)', fontSize: '0.85rem' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        value={zone.targetSeats || 0}
                        onChange={(e) => handleUpdateZone(zone.id, 'targetSeats', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        sx={{ input: { color: 'var(--brand-fg)', fontSize: '0.85rem' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                      />
                      <TextField
                        size="small"
                        type="number"
                        value={zone.targetArea || 0}
                        onChange={(e) => handleUpdateZone(zone.id, 'targetArea', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        sx={{ input: { color: 'var(--brand-fg)', fontSize: '0.85rem' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                      />
                      <TextField
                        size="small"
                        value={zone.remarks || ''}
                        onChange={(e) => handleUpdateZone(zone.id, 'remarks', e.target.value)}
                        placeholder="メモ..."
                        sx={{ input: { color: 'var(--brand-fg)', fontSize: '0.85rem' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                      />
                      <IconButton size="small" onClick={() => handleDeleteZone(zone.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'light-dark(#a80637, #fa709a)', bgcolor: 'rgba(250,112,154,0.1)' } }}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};
