import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button, Select, MenuItem, FormControl, IconButton, CircularProgress, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Chip, List, ListItem, ListItemText } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import type { BuildingType, FurniturePlacementRule, ZonePurpose, LayoutRuleSetVersion } from '../../dsl/layout/types/layoutRules';
import { layoutRulesApi } from '../../dsl/layout/services/layoutRulesApi';
import { auth } from '../../../lib/firebase/client';

const PURPOSE_OPTIONS: Record<string, { value: string, label: string }[]> = {
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

export const PlacementRulesEditor: React.FC = () => {
  const [buildingType, setBuildingType] = useState<BuildingType>('residential');
  const [zonePurpose, setZonePurpose] = useState<ZonePurpose>('general');
  const [rules, setRules] = useState<FurniturePlacementRule[]>([]);
  const [versions, setVersions] = useState<LayoutRuleSetVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('current');
  const [loading, setLoading] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  useEffect(() => {
    loadRules();
    loadVersions();
  }, [buildingType, zonePurpose]);

  const getRuleKey = () => zonePurpose === 'general' ? buildingType : `${buildingType}:${zonePurpose}`;

  const loadRules = async () => {
    setLoading(true);
    try {
      const ruleSet = await layoutRulesApi.getLayoutRuleSet(buildingType, zonePurpose);
      if (ruleSet && ruleSet.rules) {
        setRules(ruleSet.rules);
      } else {
        setRules([]);
      }
      setSelectedVersion('current');
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const vList = await layoutRulesApi.getVersions(getRuleKey());
      setVersions(vList);
    } catch (error) {
      console.error('Failed to load versions', error);
    }
  };

  const handleApplyVersion = async (versionId: string) => {
    if (versionId === 'current') {
      loadRules();
      return;
    }
    setLoading(true);
    try {
      const versionData = versions.find(v => v.versionId === versionId);
      if (versionData && versionData.rules) {
        setRules(versionData.rules.rules);
        setSelectedVersion(versionId);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await layoutRulesApi.saveLayoutRuleSet(getRuleKey(), { rules });
      setSelectedVersion('current');
    } catch (error) {
      console.error('Failed to save rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsVersion = async () => {
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid || 'system';
      await layoutRulesApi.createVersion(getRuleKey(), { rules }, uid);
      await loadVersions();
      alert('新バージョンとして保存しました');
    } catch (error) {
      console.error('Failed to save as version:', error);
      alert('バージョンの保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = () => {
    const newRule: FurniturePlacementRule = {
      id: `rule_${Date.now()}`,
      buildingType: buildingType,
      furnitureCategory: 'new_category',
      placement: {
        relation: 'center',
        marginFromWall: 500,
        minPassageWidth: 800,
        spacingBetweenItems: 0,
        priority: 1
      }
    };
    setRules([...rules, newRule]);
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleChange = (id: string, field: string, value: any) => {
    setRules(rules.map(r => {
      if (r.id === id) {
        if (field === 'furnitureCategory') {
          return { ...r, furnitureCategory: value };
        } else {
          return { ...r, placement: { ...r.placement, [field]: value } };
        }
      }
      return r;
    }));
  };

  const handleReset = async () => {
    if (window.confirm('デフォルト設定にリセットしますか？')) {
      setLoading(true);
      try {
        await layoutRulesApi.resetToDefault(getRuleKey());
        await loadRules();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (window.confirm('このバージョンを削除しますか？\n削除後は復元できません。')) {
      setLoading(true);
      try {
        await layoutRulesApi.deleteVersion(getRuleKey(), versionId);
        if (selectedVersion === versionId) {
          setSelectedVersion('current');
          await loadRules();
        }
        await loadVersions();
      } catch (e) {
        console.error(e);
        alert('バージョンの削除に失敗しました。権限がない可能性があります。');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>配置ルール (物理制約)</Typography>
        <Button variant="outlined" onClick={handleReset} size="small" sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}>
          デフォルトに戻す
        </Button>
      </Box>

      {/* Building Type Tabs (Main Tabs) */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
        <Tabs 
          value={buildingType} 
          onChange={(_, newValue) => {
            setBuildingType(newValue as BuildingType);
            setZonePurpose('general');
          }} 
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: '#a855f7', height: 3 } }}
          sx={{ 
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.6)', minWidth: 100, fontWeight: 500, fontSize: 15 }, 
            '& .Mui-selected': { color: '#fff', fontWeight: 700 } 
          }}
        >
          <Tab value="residential" label="住宅" />
          <Tab value="cafe" label="カフェ" />
          <Tab value="office" label="オフィス" />
        </Tabs>
      </Box>

      {/* Zone Purpose Sub-Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Tabs 
          value={zonePurpose} 
          onChange={(_, newValue) => setZonePurpose(newValue as ZonePurpose)}
          textColor="inherit"
          TabIndicatorProps={{ style: { backgroundColor: '#a855f7' } }}
          sx={{ 
            minHeight: 48, 
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', minHeight: 48, py: 0, px: 3, fontSize: 13, textTransform: 'none' }, 
            '& .Mui-selected': { color: '#fff' } 
          }}
        >
          {PURPOSE_OPTIONS[buildingType]?.map((opt) => (
            <Tab key={opt.value} value={opt.value} label={opt.label.split(' ')[0]} />
          ))}
        </Tabs>
      </Box>

      {/* Content Area (Nested Card) */}
      <Box sx={{ flex: 1, p: 4, bgcolor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderTop: 'none', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
        
        {/* Version Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, whiteSpace: 'nowrap' }}>バージョン：</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedVersion}
              onChange={(e) => handleApplyVersion(e.target.value as string)}
              sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, fontSize: 14 }}
            >
              <MenuItem value="current">Current (現在の設定)</MenuItem>
              {versions.map((v) => (
                <MenuItem key={v.versionId} value={v.versionId}>
                  {v.label} ({new Date(v.createdAt).toLocaleDateString()})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={handleSaveAsVersion} disabled={loading} size="small" sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', height: 40 }}>
            新バージョン作成
          </Button>
          <Button variant="outlined" onClick={() => setVersionModalOpen(true)} disabled={loading} size="small" sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', height: 40 }}>
            バージョン一覧
          </Button>
        </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#a855f7' }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
              <TableRow>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>カテゴリ</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>配置(Relation)</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>壁マージン(mm)</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>通路幅(mm)</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>優先度</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, width: 60 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <TextField 
                      size="small" 
                      value={rule.furnitureCategory} 
                      onChange={(e) => handleChange(rule.id, 'furnitureCategory', e.target.value)}
                      sx={{ input: { color: '#fff', fontSize: 13 }, minWidth: 120 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={rule.placement.relation}
                      onChange={(e) => handleChange(rule.id, 'relation', e.target.value)}
                      sx={{ color: '#fff', fontSize: 13, minWidth: 120 }}
                    >
                      <MenuItem value="center">Center</MenuItem>
                      <MenuItem value="against_wall">Wall</MenuItem>
                      <MenuItem value="corner">Corner</MenuItem>
                      <MenuItem value="around">Around</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField 
                      size="small" 
                      type="number"
                      value={rule.placement.marginFromWall} 
                      onChange={(e) => handleChange(rule.id, 'marginFromWall', Number(e.target.value))}
                      sx={{ input: { color: '#fff', fontSize: 13 }, width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                      size="small" 
                      type="number"
                      value={rule.placement.minPassageWidth} 
                      onChange={(e) => handleChange(rule.id, 'minPassageWidth', Number(e.target.value))}
                      sx={{ input: { color: '#fff', fontSize: 13 }, width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField 
                      size="small" 
                      type="number"
                      value={rule.placement.priority} 
                      onChange={(e) => handleChange(rule.id, 'priority', Number(e.target.value))}
                      sx={{ input: { color: '#fff', fontSize: 13 }, width: 60 }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleDeleteRule(rule.id)} sx={{ color: '#ef4444' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ borderBottom: 'none', py: 2 }}>
                  <Button startIcon={<AddIcon />} onClick={handleAddRule} sx={{ color: '#a855f7' }}>
                    ルールを追加
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      </Box>

      {/* Footer Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, mb: 1 }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={loading} sx={{ bgcolor: '#a855f7', '&:hover': { bgcolor: '#8b2ee6' }, px: 4, height: 40 }}>
          保存
        </Button>
      </Box>

      {/* Version History Modal */}
      <Dialog 
        open={versionModalOpen} 
        onClose={() => setVersionModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.1)', pb: 2 }}>
          バージョン履歴 - {buildingType} / {zonePurpose}
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 0 }}>
          <List>
            {versions.length === 0 ? (
              <ListItem>
                <ListItemText primary="保存されたバージョンはありません" primaryTypographyProps={{ color: 'rgba(255,255,255,0.5)', align: 'center' }} />
              </ListItem>
            ) : (
              versions.map((v) => {
                const isApplied = selectedVersion === v.versionId;
                const d = v.createdAt && typeof v.createdAt === 'object' && 'toDate' in v.createdAt 
                          ? (v.createdAt as any).toDate() 
                          : new Date(v.createdAt);
                
                return (
                  <ListItem 
                    key={v.versionId}
                    sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', py: 2 }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          variant={isApplied ? "contained" : "outlined"}
                          size="small"
                          disabled={isApplied}
                          onClick={() => {
                            handleApplyVersion(v.versionId);
                            setVersionModalOpen(false);
                          }}
                          sx={{ 
                            bgcolor: isApplied ? '#a855f7' : 'transparent', 
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: '#fff',
                            '&:hover': { bgcolor: isApplied ? '#a855f7' : 'rgba(255,255,255,0.1)' }
                          }}
                        >
                          {isApplied ? '適用中' : '適用'}
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          color="error"
                          onClick={() => handleDeleteVersion(v.versionId)}
                          sx={{ borderColor: 'rgba(239,68,68,0.5)' }}
                        >
                          削除
                        </Button>
                      </Box>
                    }
                  >
                    <ListItemText 
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography sx={{ fontWeight: 600 }}>{v.label}</Typography>
                          {isApplied && (
                            <Chip label="現在適用中" size="small" sx={{ bgcolor: 'rgba(168,85,247,0.2)', color: '#c084fc', height: 20, fontSize: 11 }} />
                          )}
                        </Box>
                      }
                      secondary={d instanceof Date ? d.toLocaleString() : String(v.createdAt)}
                      secondaryTypographyProps={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, mt: 0.5 }}
                    />
                  </ListItem>
                );
              })
            )}
          </List>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.1)', p: 2 }}>
          <Button onClick={() => setVersionModalOpen(false)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
