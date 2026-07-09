import React, { useState, useEffect } from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemText, Divider, Paper, Slider, TextField, Button, Chip, Stack, Switch, FormControlLabel, MenuItem, Select, FormControl, InputLabel, Menu, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import type { AiProfile, AiUsageScope, KnowledgeSource } from '../../../store/useAiProfileStore';
import { AI_MODEL_METADATA } from './aiModelMetadata';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { PLAN_ALLOWED_MODELS, MODEL_DISPLAY_NAMES, MODEL_PLAN_REQUIRED, type UserPlan } from '../constants/ai-model-plans';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { PlacementRulesEditor } from './PlacementRulesEditor';

const AVAILABLE_SCOPES: AiUsageScope[] = ['dashboard_chat', 'sidebar_chat', 'evaluation', 'layout', 'presentation'];

export const AiStudioModels: React.FC<{ initialProfileId?: string | null }> = ({ initialProfileId }) => {
  const { aiProfiles, baseModels, knowledgeSources, updateAiProfile, saveDataEvents, saveDataMemories, synthesizeEventsToMemory } = useAiProfileStore();
  const [selectedId, setSelectedId] = useState<string>(
    (initialProfileId && aiProfiles.some(p => p.id === initialProfileId) ? initialProfileId : aiProfiles[0]?.id) || ''
  );

  // ダッシュボード等から特定モデルを開いた場合に選択を同期
  useEffect(() => {
    if (initialProfileId && aiProfiles.some(p => p.id === initialProfileId)) {
      setSelectedId(initialProfileId);
    }
  }, [initialProfileId]);
  
  const selectedModel = aiProfiles.find(m => m.id === selectedId) || aiProfiles[0];
  
  // Local state for edits
  const [tempTemperature, setTempTemperature] = useState<number>(selectedModel?.temperature || 0.7);
  const [tempPrompt, setTempPrompt] = useState<string>(selectedModel?.systemPrompt || '');
  const [tempUseSaveData, setTempUseSaveData] = useState<boolean>(selectedModel?.useSaveDataMemories || false);
  const [tempBaseModelId, setTempBaseModelId] = useState<string>(selectedModel?.baseModelId || '');
  const [tempUsageScopes, setTempUsageScopes] = useState<AiUsageScope[]>(selectedModel?.usageScopes || []);
  
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const [userPlan, setUserPlan] = useState<UserPlan>('free');

  useEffect(() => {
    if (currentUser?.uid) {
      let mounted = true;
      getDoc(doc(db, 'users', currentUser.uid))
        .then(snap => {
          if (mounted && snap.exists() && snap.data().plan) {
            setUserPlan(snap.data().plan as UserPlan);
          }
        })
        .catch(err => console.error('Failed to fetch plan:', err));
      return () => { mounted = false; };
    }
  }, [currentUser?.uid]);
  
  const [saveToast, setSaveToast] = useState(false);
  const [knowledgeMenuAnchor, setKnowledgeMenuAnchor] = useState<null | HTMLElement>(null);

  const [trainingDataOpen, setTrainingDataOpen] = useState(false);

  const [activeTab, setActiveTab] = useState(0);

  // Reset tab if switching models
  useEffect(() => {
    setActiveTab(0);
  }, [selectedId]);

  // Derived state
  const isDirty = tempTemperature !== selectedModel?.temperature ||
                  tempPrompt !== selectedModel?.systemPrompt ||
                  tempUseSaveData !== selectedModel?.useSaveDataMemories ||
                  tempBaseModelId !== selectedModel?.baseModelId ||
                  JSON.stringify(tempUsageScopes) !== JSON.stringify(selectedModel?.usageScopes);

  const currentKnowledge = (selectedModel?.equippedKnowledge || []).map(id => knowledgeSources.find(ks => ks.id === id)).filter(Boolean) as KnowledgeSource[];
  const ruleCount = currentKnowledge.filter(k => k.type === 'extracted_rule').length;
  const documentCount = currentKnowledge.filter(k => k.type === 'document').length;

  const unsummarizedEvents = saveDataEvents.filter(e => !e.isSummarized);
  const myMemories = saveDataMemories.filter(m => m.profileId === selectedModel?.id || !m.profileId);
  const correctionEvents = saveDataEvents.filter(e => e.actionType === 'METADATA_CORRECTED').sort((a,b) => b.timestamp - a.timestamp);

  // Sync state when selection changes
  useEffect(() => {
    if (selectedModel) {
      setTempTemperature(selectedModel.temperature);
      setTempPrompt(selectedModel.systemPrompt);
      setTempUseSaveData(selectedModel.useSaveDataMemories);
      setTempBaseModelId(selectedModel.baseModelId);
      setTempUsageScopes(selectedModel.usageScopes || []);
    }
  }, [selectedModel]);

  const handleSave = () => {
    updateAiProfile(selectedId, {
      temperature: tempTemperature,
      systemPrompt: tempPrompt,
      useSaveDataMemories: tempUseSaveData,
      baseModelId: tempBaseModelId,
      usageScopes: tempUsageScopes
    });
    setSaveToast(true);
  };

  const handleDiscard = () => {
    if (selectedModel) {
      setTempTemperature(selectedModel.temperature);
      setTempPrompt(selectedModel.systemPrompt);
      setTempUseSaveData(selectedModel.useSaveDataMemories);
      setTempBaseModelId(selectedModel.baseModelId);
      setTempUsageScopes(selectedModel.usageScopes || []);
    }
  };

  const toggleScope = (scope: AiUsageScope) => {
    setTempUsageScopes(prev => 
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  const renderCategoryList = (category: AiProfile['category'], title: string, icon: React.ReactNode) => {
    const models = aiProfiles.filter(m => m.category === category);
    if (models.length === 0) return null;

    return (
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, fontWeight: 700, px: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon} {title}
        </Typography>
        <List disablePadding>
          {models.map(model => (
             <ListItem key={model.id} disablePadding sx={{ mb: 0.5 }}>
               <ListItemButton
                 onClick={() => setSelectedId(model.id)}
                 sx={{
                   mx: 1,
                   borderRadius: 2,
                   bgcolor: selectedId === model.id ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                   border: selectedId === model.id 
                      ? (model.category === 'Orchestrator' ? `1px solid ${'#a855f7'}` : '1px solid rgb(var(--brand-fg-rgb) / 0.2)') 
                      : '1px solid transparent',
                   '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                 }}
               >
                 <ListItemText 
                   primary={model.name}
                   secondary={model.id}
                   primaryTypographyProps={{ 
                     fontSize: 13, 
                     fontWeight: selectedId === model.id ? 600 : 500,
                     color: selectedId === model.id 
                        ? (model.category === 'Orchestrator' ? '#a855f7' : '#fff') 
                        : 'rgb(var(--brand-fg-rgb) / 0.7)'
                   }}
                   secondaryTypographyProps={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}
                 />
                 {model.status === 'Active' && (
                   <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4ade80' }} />
                 )}
               </ListItemButton>
             </ListItem>
          ))}
        </List>
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      
      {/* Left Column: Model List */}
      <Box sx={{ 
        width: 280, 
        borderRight: `1px solid rgb(var(--brand-fg-rgb) / 0.05)`, 
        bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
        overflowY: 'auto',
        pt: 3, pb: 4
      }}>
        <Typography variant="h6" sx={{ color: 'var(--brand-fg)', px: 2, mb: 3, fontWeight: 700 }}>AI モデル管理</Typography>
        
        {renderCategoryList('Orchestrator', 'CORE ENGINE', <PrecisionManufacturingIcon fontSize="inherit" />)}
        
        {(() => {
          const models = aiProfiles.filter(m => m.category !== 'Orchestrator');
          if (models.length === 0) return null;
          return (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 11, fontWeight: 700, px: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountTreeRoundedIcon fontSize="inherit" /> 統合アプリケーション AI
              </Typography>
              <List disablePadding>
                {models.map(model => (
                   <ListItem key={model.id} disablePadding sx={{ mb: 0.5 }}>
                     <ListItemButton
                       onClick={() => setSelectedId(model.id)}
                       sx={{
                         mx: 1,
                         borderRadius: 2,
                         bgcolor: selectedId === model.id ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                         border: selectedId === model.id ? '1px solid rgb(var(--brand-fg-rgb) / 0.2)' : '1px solid transparent',
                         '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }
                       }}
                     >
                       <ListItemText 
                         primary={model.name}
                         secondary={model.id}
                         primaryTypographyProps={{ fontSize: 13, fontWeight: selectedId === model.id ? 600 : 500, color: selectedId === model.id ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' }}
                         secondaryTypographyProps={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}
                       />
                       {model.status === 'Active' && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4ade80' }} />}
                     </ListItemButton>
                   </ListItem>
                ))}
              </List>
            </Box>
          );
        })()}
      </Box>

      {/* Right Column: Model Detail & Configuration */}
      <Box sx={{ flex: 1, p: { xs: 2, md: 3, lg: 4 }, overflowY: 'auto', position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedModel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ maxWidth: '100%', margin: '0 auto' }}
          >
          
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 2 }}>
              <Typography variant="h4" sx={{ color: 'var(--brand-fg)', fontWeight: 700 }}>
                {selectedModel.name}
              </Typography>
              {selectedModel.category === 'Orchestrator' && (
                 <Chip label="CORE" size="small" sx={{ bgcolor: '#a855f7', color: 'var(--brand-fg)', fontWeight: 'bold' }} />
              )}
            </Box>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', mb: 2 }}>
              {selectedModel.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
               <Typography variant="caption" sx={{ color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: 1, px: 1, py: 0.5 }}>
                 {selectedModel.id}
               </Typography>
               <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', px: 1, py: 0.5, borderRadius: 1 }}>
                 Role: {selectedModel.role}
               </Typography>
               {selectedModel.usageScopes.map(scope => (
                 <Typography key={scope} variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', px: 1, py: 0.5, borderRadius: 1 }}>
                   Scope: {scope}
                 </Typography>
               ))}
               {selectedModel.status === 'Active' && (
                 <Typography variant="caption" sx={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                   <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4ade80' }} />
                   現在使用中
                 </Typography>
               )}
            </Box>
          </Box>

          {(() => {
            const meta = AI_MODEL_METADATA[selectedModel.id];
            return (
              <Tabs 
                value={activeTab} 
                onChange={(_, v) => setActiveTab(v)} 
                variant="scrollable"
                scrollButtons="auto"
                sx={{ 
                  mb: 3, 
                  borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
                  '& .MuiTab-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', minWidth: 100, fontWeight: 600 },
                  '& .Mui-selected': { color: 'light-dark(#5908a6, #a855f7)' },
                  '& .MuiTabs-indicator': { backgroundColor: '#a855f7' }
                }}
              >
                {meta ? [
                  <Tab key="tab0" label="概要" value={0} />,
                  <Tab key="tab1" label="推論エンジン" value={1} />,
                  <Tab key="tab2" label="コスト・使用量" value={2} />,
                  <Tab key="tab3" label="データ学習" value={3} />,
                  <Tab key="tab4" label="発火タイミング" value={4} />,
                  selectedModel.id.includes('ai-layout-coordinator') && <Tab key="tab5" label="配置ルール" value={5} />
                ] : [
                  <Tab key="tab0" label="ベース設定" value={0} />,
                  !['hybrid-rule-engine'].includes(tempBaseModelId) && !selectedModel.id.includes('gemini') && <Tab key="tab1" label="ナレッジ設定" value={1} />,
                  <Tab key="tab2" label="推論ロジック" value={2} />,
                  selectedModel.id.includes('ai-layout-coordinator') && <Tab key="tab5" label="配置ルール" value={5} />
                ]}
              </Tabs>
            );
          })()}

          <Paper sx={{ p: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', mb: 4, minHeight: 400 }}>
            {(() => {
              const meta = AI_MODEL_METADATA[selectedModel.id];
              return (
                <>
                  {/* === NEW TABS === */}

                  {/* TAB 0: 概要 */}
                  {meta && activeTab === 0 && (
                    <Box>
                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1, fontSize: 16 }}>モデルの役割と目的</Typography>
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 14, mb: 4, lineHeight: 1.6 }}>
                        {meta.overview.purpose}
                      </Typography>

                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>このモデルが解決する主な問い</Typography>
                      <List sx={{ mb: 4 }}>
                        {meta.overview.questions.map((q, i) => (
                          <ListItem key={i} sx={{ px: 0, py: 0.5 }}>
                            <Box sx={{ mr: 1.5, fontSize: 18 }}>{q.icon}</Box>
                            <ListItemText primary={q.text} primaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontSize: 14 }} />
                          </ListItem>
                        ))}
                      </List>

                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>入出力フロー概要</Typography>
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, mb: 3 }}>
                        {meta.overview.flow}
                      </Typography>

                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>期待される出力形式 (JSON Schema 等)</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2 }}>
                        <Typography sx={{ color: 'light-dark(#5908a6, #a855f7)', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {meta.overview.outputFormat}
                        </Typography>
                      </Paper>
                    </Box>
                  )}

                  {/* TAB 2: コスト・使用量 */}
                  {meta && activeTab === 2 && (
                    <Box>
                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 3 }}>コストと使用状況のモニタリング</Typography>
                      <Stack direction="row" spacing={3} sx={{ mb: 4 }}>
                        <Paper sx={{ flex: 1, p: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 1 }}>今月の呼び出し回数</Typography>
                          <Typography sx={{ color: 'var(--brand-fg)', fontSize: 28, fontWeight: 700 }}>
                            {meta.cost.currentUsage.toLocaleString()} <Typography component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 14 }}>/ {meta.cost.monthlyLimit > 0 ? meta.cost.monthlyLimit.toLocaleString() : '∞'}</Typography>
                          </Typography>
                        </Paper>
                        <Paper sx={{ flex: 1, p: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 1 }}>今月の推計コスト</Typography>
                          <Typography sx={{ color: 'light-dark(#5908a6, #a855f7)', fontSize: 28, fontWeight: 700 }}>
                            ${meta.cost.estimatedCost.toFixed(2)}
                          </Typography>
                        </Paper>
                      </Stack>

                      {meta.cost.monthlyLimit > 0 && (
                        <Box sx={{ mb: 4 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 13 }}>月間リミットへの到達率</Typography>
                            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 13 }}>{((meta.cost.currentUsage / meta.cost.monthlyLimit) * 100).toFixed(1)}%</Typography>
                          </Box>
                          <Box sx={{ width: '100%', height: 6, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(100, (meta.cost.currentUsage / meta.cost.monthlyLimit) * 100)}%`, height: '100%', bgcolor: '#a855f7' }} />
                          </Box>
                        </Box>
                      )}

                      <Alert icon={false} sx={{ bgcolor: 'rgba(59,130,246,0.1)', color: 'light-dark(#054ea8, #60a5fa)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>課金タイミングについて</Typography>
                        <Typography variant="caption">{meta.cost.billingTiming}</Typography>
                      </Alert>
                    </Box>
                  )}

                  {/* TAB 3: データ・学習 */}
                  {meta && activeTab === 3 && (
                    <Box>
                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2 }}>学習ベースとデータの扱い</Typography>
                      <Paper sx={{ p: 0, bgcolor: 'transparent', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2, overflow: 'hidden', mb: 4 }}>
                        <List disablePadding>
                          <ListItem sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', py: 2 }}>
                            <ListItemText primary="システム基礎データ" secondary={meta.data.baseData} primaryTypographyProps={{ color: 'var(--brand-fg)', fontSize: 14 }} secondaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5 }} />
                          </ListItem>
                          <ListItem sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', py: 2 }}>
                            <ListItemText primary="継続的な Fine-tuning" secondary={meta.data.finetuning ? '本環境で自動実行される' : '実施しない'} primaryTypographyProps={{ color: 'var(--brand-fg)', fontSize: 14 }} secondaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5 }} />
                            {!meta.data.finetuning && <Chip label="なし" size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />}
                          </ListItem>
                          <ListItem sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', py: 2 }}>
                            <ListItemText primary="チャット・操作履歴の学習" secondary={meta.data.learnsFromHistory ? '会話文脈およびメタデータを学習用コーパスへマージ' : '会話からの自動学習は行わない'} primaryTypographyProps={{ color: 'var(--brand-fg)', fontSize: 14 }} secondaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5 }} />
                          </ListItem>
                          <ListItem sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', py: 2 }}>
                            <ListItemText primary="プロジェクト参照スコープ" secondary={meta.data.projectDataScope} primaryTypographyProps={{ color: 'var(--brand-fg)', fontSize: 14 }} secondaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5 }} />
                          </ListItem>
                          <ListItem sx={{ py: 2 }}>
                            <ListItemText primary="データの外部送信先" secondary={meta.data.externalDestination} primaryTypographyProps={{ color: 'var(--brand-fg)', fontSize: 14 }} secondaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mt: 0.5 }} />
                          </ListItem>
                        </List>
                      </Paper>
                      
                      {!meta.data.learnsFromHistory && (
                        <Alert severity="info" align="left" sx={{ bgcolor: 'rgba(168,85,247,0.1)', color: 'light-dark(#5402ab, #d8b4fe)', border: '1px solid rgba(168,85,247,0.2)' }}>
                          このAIは使うたびに自動的に賢くなる（学習する）仕組みではありません。<br/>
                          推論の精度やトーンを調整したい場合は「推論ロジック」タブから System Prompt を微調整してください。
                        </Alert>
                      )}
                    </Box>
                  )}

                  {/* TAB 4: 発火タイミング */}
                  {meta && activeTab === 4 && (
                    <Box>
                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>このAIはいつ呼び出されるか？</Typography>
                      <List sx={{ mb: 3 }}>
                        {meta.trigger.calledCases.map((c, i) => (
                           <ListItem key={i} sx={{ px: 0, py: 1 }}>
                             <Box sx={{ mr: 1.5, fontSize: 18 }}>{c.icon}</Box>
                             <ListItemText 
                               primary={c.text} 
                               secondary={<Box component="span" sx={{ fontFamily: 'monospace', display: 'inline-block', mt: 0.5, px: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 1 }}>{c.codePath}</Box>} 
                               primaryTypographyProps={{ color: 'var(--brand-fg)', fontSize: 14 }} 
                               secondaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 12 }} 
                             />
                           </ListItem>
                        ))}
                      </List>

                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>呼び出されないケース</Typography>
                      <List sx={{ mb: 3 }}>
                        {meta.trigger.notCalledCases.map((txt, i) => (
                           <ListItem key={i} sx={{ px: 1, py: 0.5 }}>
                             <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.3)', mr: 2 }} />
                             <ListItemText primary={txt} primaryTypographyProps={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13 }} />
                           </ListItem>
                        ))}
                      </List>

                      <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>データフロー (Data Flow)</Typography>
                      <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2 }}>
                        <Typography sx={{ color: '#3b82f6', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {meta.trigger.dataFlow}
                        </Typography>
                      </Paper>
                    </Box>
                  )}

                  {/* === OVERLAPPING / FALLBACK TABS === */}

                  {/* 拡張時の Tab 1 / フォールバック時の Tab 0 (推論エンジン / ベース設定) */}
                  {((meta && activeTab === 1) || (!meta && activeTab === 0)) && (
                    <Box>
                      {/* Core Engine Selector */}
                      <Box sx={{ mb: 5 }}>
                        <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>推論エンジン (Base Model)</Typography>
                        {meta ? (
                           <Box sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', mt: 1 }}>
                             <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                               {meta.engine.switchable ? (
                                 <FormControl size="small" sx={{ minWidth: 240 }}>
                                   <Select
                                     value={tempBaseModelId || meta.engine.baseModel}
                                     onChange={(e) => setTempBaseModelId(e.target.value)}
                                     MenuProps={{
                                       PaperProps: {
                                         sx: {
                                           bgcolor: 'var(--brand-surface2)',
                                           border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)'
                                         }
                                       }
                                     }}
                                     sx={{ color: 'light-dark(#5908a6, #a855f7)', fontWeight: 'bold', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
                                   >
                                     {Object.entries(MODEL_DISPLAY_NAMES).map(([val, label]) => {
                                       const isAllowed = PLAN_ALLOWED_MODELS[userPlan]?.includes(val);
                                       const requiredPlan = MODEL_PLAN_REQUIRED[val];
                                       return (
                                         <MenuItem key={val} value={val} disabled={!isAllowed}>
                                           <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', gap: 2 }}>
                                             <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
                                             {!isAllowed && (
                                               <Chip 
                                                 icon={<LockRoundedIcon style={{ fontSize: 12, marginLeft: 6 }} />} 
                                                 label={requiredPlan.toUpperCase()} 
                                                 size="small" 
                                                 sx={{ height: 20, fontSize: 10, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.5)', pl: 0.5 }} 
                                               />
                                             )}
                                           </Box>
                                         </MenuItem>
                                       );
                                     })}
                                   </Select>
                                 </FormControl>
                               ) : (
                                 <Typography sx={{ color: 'light-dark(#5908a6, #a855f7)', fontWeight: 'bold' }}>{meta.engine.baseModel}</Typography>
                               )}
                               {!meta.engine.switchable && <Chip label="変更不可" size="small" sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontWeight: 600 }} />}
                             </Box>
                             <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)', mb: 1.5 }} />
                             <Stack spacing={1}>
                               <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}><strong>呼び出し方式:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--brand-fg)', marginLeft: 8 }}>{meta.engine.callMethod}</span></Typography>
                               <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}><strong>レスポンス形式:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--brand-fg)', marginLeft: 8 }}>{meta.engine.responseFormat}</span></Typography>
                               <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}><strong>プロンプト管理:</strong> <span style={{ marginLeft: 8 }}>{meta.engine.promptLocation}</span></Typography>
                               <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}><strong>平均アクセス:</strong> <span style={{ marginLeft: 8 }}>{meta.engine.avgResponseTime}</span></Typography>
                             </Stack>
                           </Box>
                        ) : (
                          <>
                            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 2 }}>
                              {tempBaseModelId === 'hybrid-rule-engine' 
                                ? 'このモデルは、ルールベースの解析とローカルアルゴリズムを組み合わせた専用パイプラインとして機能します。' 
                                : selectedModel.id.includes('gemini')
                                ? 'このモデルはサーバーサイドで固定のAPI（Gemini）を使用するため、ベースモデルの変更はできません。'
                                : 'このプロファイルがテキストやロジックの推論に使用する基盤モデルを選択します。'}
                            </Typography>
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                              <Select
                                value={tempBaseModelId}
                                onChange={(e) => setTempBaseModelId(e.target.value)}
                                disabled={tempBaseModelId === 'hybrid-rule-engine' || selectedModel.role === 'specialized' || selectedModel.id.includes('gemini')}
                                MenuProps={{
                                  PaperProps: {
                                    sx: {
                                      bgcolor: 'var(--brand-surface2)',
                                      border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)'
                                    }
                                  }
                                }}
                                sx={{ 
                                  bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', color: tempBaseModelId === 'hybrid-rule-engine' ? 'rgb(var(--brand-fg-rgb) / 0.5)' : 'var(--brand-fg)',
                                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
                                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#a855f7' }
                                }}
                              >
                                {baseModels.map(model => (
                                  <MenuItem key={model.id} value={model.id}>
                                    {model.id} <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>({model.type})</Typography>
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </>
                        )}
                      </Box>

                      {/* Usage Scopes Editor */}
                      <Box sx={{ mb: 5 }}>
                        <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>利用スコープ (Usage Scopes)</Typography>
                        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 2 }}>
                          このAIプロファイルがどの画面や機能（チャット、評価、レイアウト支援など）で利用可能かを設定します。
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {AVAILABLE_SCOPES.map(scope => (
                            <Chip
                              key={scope}
                              label={scope}
                              clickable
                              onClick={() => toggleScope(scope)}
                              sx={{
                                bgcolor: tempUsageScopes.includes(scope) ? 'rgba(168,85,247,0.3)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                                color: tempUsageScopes.includes(scope) ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)',
                                border: `1px solid ${tempUsageScopes.includes(scope) ? '#a855f7' : 'transparent'}`,
                                '&:hover': { bgcolor: tempUsageScopes.includes(scope) ? 'rgba(168,85,247,0.4)' : 'rgb(var(--brand-fg-rgb) / 0.1)' }
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  {/* フォールバック時のみ表示: Tab 1 (ナレッジ＆メモリ) */}
                  {!meta && activeTab === 1 && !['hybrid-rule-engine'].includes(tempBaseModelId) && !selectedModel.id.includes('gemini') && (
                    <Box>
                      {/* Context & Knowledge Dashboard (Mock) */}
                      <Box sx={{ mb: 5 }}>
                        <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>接続中の Knowledge & RAG</Typography>
                        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 2 }}>
                          このAIモデルが参照している評価基準やプロジェクト資料の一覧です。（クリックで該当画面へ遷移可）
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                           <Chip 
                             icon={<AccountTreeRoundedIcon fontSize="small" />} 
                             label={`設定済みルール: ${ruleCount}件`} 
                             sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
                             onClick={(e) => setKnowledgeMenuAnchor(e.currentTarget)}
                           />
                           <Chip 
                             icon={<LibraryBooksIcon fontSize="small" />} 
                             label={`読み込み済みPDF: ${documentCount}件`} 
                             sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'var(--brand-fg)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)' } }}
                             onClick={(e) => setKnowledgeMenuAnchor(e.currentTarget)}
                           />
                        </Stack>
                        <Menu
                          anchorEl={knowledgeMenuAnchor}
                          open={Boolean(knowledgeMenuAnchor)}
                          onClose={() => setKnowledgeMenuAnchor(null)}
                          PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)', minWidth: 280 } }}
                        >
                          {currentKnowledge.length === 0 ? (
                            <MenuItem disabled sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>データソースがありません</MenuItem>
                          ) : (
                            currentKnowledge.map(ks => (
                              <MenuItem key={ks.id} onClick={() => setKnowledgeMenuAnchor(null)}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{ks.title}</Typography>
                                  <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                                    {ks.type} {ks.metadata?.sourceFile ? `(${ks.metadata.sourceFile})` : ''}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            ))
                          )}
                        </Menu>
                        <Button size="small" variant="outlined" sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', textTransform: 'none' }}>
                          ＋ データソースを追加
                        </Button>
                      </Box>

                      {/* Save Data (Memory) Config */}
                      <Box sx={{ mb: 5, p: 2, borderRadius: 2, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600 }}>Save Data (Derived Memory) の参照</Typography>
                            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mt: 0.5 }}>
                              ユーザーの操作履歴（Target Events）からLLMが要約した「学習傾向・好み」をコンテキストに含めます。
                            </Typography>
                          </Box>
                          <Switch 
                            checked={tempUseSaveData} 
                            onChange={(e) => setTempUseSaveData(e.target.checked)} 
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: 'light-dark(#5908a6, #a855f7)' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#a855f7' } }} 
                          />
                        </Box>

                        {tempUseSaveData && (
                          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                            <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 2 }}>Memory Synthesis Pipeline</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                              <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
                                未要約の操作記録 (Raw Events): <span style={{ color: 'light-dark(#5908a6, #a855f7)', fontWeight: 'bold' }}>{unsummarizedEvents.length}</span> 件
                              </Typography>
                              <Button 
                                variant="outlined" 
                                size="small" 
                                onClick={() => synthesizeEventsToMemory({ profileId: selectedModel.id })}
                                disabled={unsummarizedEvents.length === 0}
                                sx={{ color: 'light-dark(#5908a6, #a855f7)', borderColor: 'rgba(168,85,247,0.5)', textTransform: 'none', '&:hover': { borderColor: '#a855f7', bgcolor: 'rgba(168,85,247,0.1)' } }}
                              >
                                Synthesize Memories (要約実行)
                              </Button>
                            </Box>
                            
                            {myMemories.length > 0 ? (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 1, display: 'block' }}>生成済みの Memory Fragments</Typography>
                                <Stack spacing={1}>
                                  {myMemories.map(m => (
                                    <Paper key={m.id} sx={{ p: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 }}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                         <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--brand-fg)' }}>[{m.topic}]</Typography>
                                         <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', px: 0.5, borderRadius: 1 }}>
                                           スコア: {m.confidenceScore.toFixed(2)} | 元Event: {m.sourceEventIds.length}件
                                         </Typography>
                                      </Box>
                                      <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mt: 1 }}>
                                         {m.summary}
                                      </Typography>
                                    </Paper>
                                  ))}
                                </Stack>
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>Memoriesはまだありません。イベントが溜まったら要約を実行してください。</Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* フォールバック時の Tab 2 (推論ロジック) */}
                  {(!meta && activeTab === 2) && (
                    <Box>
                      {/* Parameter Config */}
                      {!['hybrid-rule-engine'].includes(tempBaseModelId) && !selectedModel.id.includes('gemini') && (
                        <Box sx={{ mb: 5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600 }}>Temperature (創造性 / ランダム性)</Typography>
                            <Typography sx={{ color: 'light-dark(#5908a6, #a855f7)', fontWeight: 700 }}>{tempTemperature.toFixed(1)}</Typography>
                          </Box>
                          <Slider
                            min={0}
                            max={1.5}
                            step={0.1}
                            value={tempTemperature}
                            onChange={(_, v) => setTempTemperature(v as number)}
                            sx={{ 
                              color: 'light-dark(#5908a6, #a855f7)',
                              '& .MuiSlider-thumb': { '&:hover, &.Mui-focusVisible': { boxShadow: `0px 0px 0px 8px ${'#a855f7'}33` } } 
                            }}
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 12 }}>0.0 (厳密・正確)</Typography>
                            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 12 }}>1.5 (独創的)</Typography>
                          </Box>
                        </Box>
                      )}

                      {/* System Prompt / Pipeline Config */}
                      {!selectedModel.id.includes('gemini') ? (
                        <Box>
                           <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>
                             {tempBaseModelId === 'hybrid-rule-engine' ? 'パイプライン処理概要 (Pipeline Logic)' : 'システムプロンプト (System Prompt)'}
                           </Typography>
                           <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 2 }}>
                             {tempBaseModelId === 'hybrid-rule-engine' 
                               ? 'このモデルが内部で実行する処理ステップの定義です（読み取り専用）。' 
                               : 'AIの根本的な役割と行動指針を定義します。保存すると、このプロンプトがベースとして適用されます。'}
                           </Typography>
                           <TextField
                             fullWidth
                             multiline
                             rows={tempBaseModelId === 'hybrid-rule-engine' ? 4 : 8}
                             value={tempPrompt}
                             onChange={(e) => setTempPrompt(e.target.value)}
                             disabled={tempBaseModelId === 'hybrid-rule-engine'}
                             InputProps={{ sx: { color: tempBaseModelId === 'hybrid-rule-engine' ? 'rgb(var(--brand-fg-rgb) / 0.6)' : 'var(--brand-fg)', fontFamily: 'monospace', fontSize: 14 } }}
                             sx={{ 
                               bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))',
                               borderRadius: 2,
                               '& .MuiOutlinedInput-root': {
                                 '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
                                 '&:hover fieldset': { borderColor: tempBaseModelId === 'hybrid-rule-engine' ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'rgb(var(--brand-fg-rgb) / 0.2)' },
                                 '&.Mui-focused fieldset': { borderColor: tempBaseModelId === 'hybrid-rule-engine' ? 'rgb(var(--brand-fg-rgb) / 0.1)' : '#a855f7' },
                               }
                             }}
                           />
                        </Box>
                      ) : (
                        <Box sx={{ p: 3, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                           <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                             ☁️ サーバーサイド連携 API (Cloud Functions)
                           </Typography>
                           <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, mb: 2 }}>
                             この AI プロファイルは SEKKEIYA Firebase バックエンド上で稼働する **Gemini API 連携専用のパイプライン** です。ローカル環境からの温度設定（Temperature）やRAGの動的書き換えは行えません。<br/><br/>
                             内部的には以下のシステムプロンプトに従ってクラウド上で処理が実行されます。
                           </Typography>
                           <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1 }}>
                             <Typography sx={{ color: 'light-dark(#5908a6, #a855f7)', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                               {selectedModel.systemPrompt}
                             </Typography>
                           </Paper>
                        </Box>
                      )}

                      {/* 推論ロジック末尾等に表示するデータ (hybrid-rule-engine 用) */}
                      {tempBaseModelId === 'hybrid-rule-engine' && (
                        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
                          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, mb: 1 }}>
                            学習元データ (Training Source Data)
                          </Typography>
                          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: 13, mb: 2 }}>
                            ユーザーがS.Model上でメタデータ（サイズ、カテゴリ等）を修正した履歴です。<br/>
                            これらのデータは、自動分類AIがルールベースと組み合わせて学習するための教師データとして蓄積されます。
                          </Typography>
                          
                          <Paper sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                              <Typography sx={{ color: 'var(--brand-fg)', fontSize: 14 }}>
                                蓄積されたフィードバック件数
                              </Typography>
                              <Typography sx={{ color: 'light-dark(#5908a6, #a855f7)', fontSize: 24, fontWeight: 700 }}>
                                {correctionEvents.length} <Typography component="span" sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>件</Typography>
                              </Typography>
                            </Box>
                            <Button 
                              variant="contained" 
                              onClick={() => setTrainingDataOpen(true)}
                              disabled={correctionEvents.length === 0}
                              sx={{ bgcolor: 'rgba(168, 85, 247, 0.2)', color: 'light-dark(#5402ab, #d8b4fe)', '&:hover': { bgcolor: 'rgba(168, 85, 247, 0.3)' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
                            >
                              データを確認
                            </Button>
                          </Paper>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* TAB 5: 配置ルール (ai-layout-coordinatorのみ) */}
                  {activeTab === 5 && selectedModel.id.includes('ai-layout-coordinator') && (
                    <Box>
                      <PlacementRulesEditor />
                    </Box>
                  )}
                </>
              );
            })()}
          </Paper>

           <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              {isDirty && (
                <Button 
                  variant="outlined" 
                  onClick={handleDiscard}
                  sx={{ 
                    borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', 
                    color: 'rgb(var(--brand-fg-rgb) / 0.7)', 
                    px: 3, py: 1.5, 
                    borderRadius: 2,
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' }
                  }}
                >
                  変更を破棄
                </Button>
              )}
              <Button 
                variant="contained" 
                onClick={handleSave}
                disabled={!isDirty}
                sx={{ 
                  bgcolor: '#a855f7', 
                  color: 'var(--brand-fg)', 
                  px: 4, py: 1.5, 
                  borderRadius: 2,
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#8b2ee6' },
                  '&.Mui-disabled': { bgcolor: 'rgba(168,85,247,0.3)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }
                }}
              >
                {isDirty ? 'モデルを更新して保存' : 'すべて保存済み'}
              </Button>
           </Box>
          
          </motion.div>
        </AnimatePresence>
      </Box>

      <Snackbar 
        open={saveToast} 
        autoHideDuration={3000} 
        onClose={() => setSaveToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSaveToast(false)} severity="success" sx={{ width: '100%', bgcolor: 'var(--brand-surface2)', color: '#4ade80', border: '1px solid #4ade80' }}>
          プロファイルを保存しました
        </Alert>
      </Snackbar>

      <Dialog 
        open={trainingDataOpen} 
        onClose={() => setTrainingDataOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', width: 600, maxWidth: '100%', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', pb: 2, fontWeight: 600 }}>
          学習元データ (ユーザーフィードバック)
        </DialogTitle>
        <DialogContent sx={{ mt: 2, p: 3 }}>
          {correctionEvents.length === 0 ? (
             <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textAlign: 'center', py: 4 }}>
               まだフィードバックデータがありません。S.Modelでメタデータを修正すると記録されます。
             </Typography>
          ) : (
            <List disablePadding>
              {correctionEvents.map((ev, index) => (
                <Paper key={ev.id} sx={{ mb: 2, p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 2 }}>
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                     <Typography sx={{ fontSize: 13, color: 'light-dark(#5908a6, #a855f7)', fontWeight: 600 }}>
                       ID: {ev.id.split('-').slice(0, 2).join('-')}
                     </Typography>
                     <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                       {new Date(ev.timestamp).toLocaleString()}
                     </Typography>
                   </Box>
                   <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 1.5 }} />
                   <Typography sx={{ color: 'var(--brand-fg)', fontSize: 14 }}>
                     {ev.content || 'メタデータが修正されました。'}
                   </Typography>
                </Paper>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', p: 2 }}>
          <Button onClick={() => setTrainingDataOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', textTransform: 'none', fontWeight: 600 }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
