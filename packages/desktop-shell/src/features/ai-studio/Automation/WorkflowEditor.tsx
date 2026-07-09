import React, { useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Chip, Stack, IconButton, Tooltip, Button, Popover, TextField, Switch, Select, MenuItem, CircularProgress,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import type { AutomationCapability, CapabilityStatus } from '../../global-settings/automationCatalog';
import { OFFICIAL_EMAILS } from '../constants/ai-model-plans';
import { useAuthStore } from '../../../store/useAuthStore';
import type { WorkflowDef, WorkflowParam } from './workflowTypes';
import { buildDefaultWorkflow, cloneWorkflow } from './workflowDefaults';
import { useWorkflowConfigStore } from '../../../store/useWorkflowConfigStore';
import { useAppStore } from '../../../store/useAppStore';
import { useChatComposerStore } from '../../../store/useChatComposerStore';
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodeInspector } from './NodeInspector';
import { composeWorkflowWithAI } from './workflowAiComposer';

const ACCENT = '#c4a3f7';

const STATUS_META: Record<CapabilityStatus, { label: string; color: string; bg: string }> = {
  available: { label: '稼働中', color: '#6ee7a8', bg: 'rgba(110,231,168,0.14)' },
  beta:      { label: 'ベータ', color: '#ffd166', bg: 'rgba(255,209,102,0.14)' },
  planned:   { label: '予定',   color: '#9aa3b2', bg: 'rgba(154,163,178,0.14)' },
};

interface Props { cap: AutomationCapability; }

/** 中央：ワークフローのノードキャンバス＋上部ツールバー。右：ノード選択時のインスペクタ。 */
export const WorkflowEditor: React.FC<Props> = ({ cap }) => {
  const saved = useWorkflowConfigStore((s) => s.saved[cap.id]);
  const save = useWorkflowConfigStore((s) => s.save);
  const reset = useWorkflowConfigStore((s) => s.reset);

  // ワークフローは「AIの受け答えガイド」＝SEKKEIYA の超根幹。
  // 編集は公式アカウントのみ。その他のユーザーは辞書として閲覧できる（試すはOK）。
  const email = useAuthStore((s) => s.currentUser?.email);
  const readOnly = !OFFICIAL_EMAILS.has(email || '');

  const base = useMemo(() => saved ?? buildDefaultWorkflow(cap), [saved, cap]);
  const [draft, setDraft] = useState<WorkflowDef>(() => cloneWorkflow(base));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [paramAnchor, setParamAnchor] = useState<null | HTMLElement>(null);

  // ── AIでワークフローを組む（基本はAI・手動は微調整） ──
  const [aiAnchor, setAiAnchor] = useState<null | HTMLElement>(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const runAiCompose = async () => {
    if (aiBusy) return;
    setAiBusy(true); setAiError(null);
    try {
      const def = await composeWorkflowWithAI(cap, draft, aiText);
      setDraft(def);
      setSelectedNodeId(null);
      setAiAnchor(null);
      setAiText('');
    } catch (e: any) {
      setAiError(e?.message || '生成に失敗しました。');
    } finally {
      setAiBusy(false);
    }
  };

  // ── インスペクタのドック位置（右 / 下）。好みを localStorage に保存 ──
  const [dock, setDock] = useState<'right' | 'bottom'>(() => {
    try { return (localStorage.getItem('sekkeiya-wf-inspector-dock') as 'right' | 'bottom') || 'right'; } catch { return 'right'; }
  });
  const changeDock = (d: 'right' | 'bottom') => {
    setDock(d);
    try { localStorage.setItem('sekkeiya-wf-inspector-dock', d); } catch { /* noop */ }
  };

  const sm = STATUS_META[cap.status];
  const insertable = cap.status !== 'planned';

  const onSave = () => save(cloneWorkflow(draft));
  const onReset = () => { reset(cap.id); setDraft(cloneWorkflow(buildDefaultWorkflow(cap))); setSelectedNodeId(null); };
  const patchParam = (idx: number, value: string) => setDraft((d) => ({ ...d, params: d.params.map((p, i) => (i === idx ? { ...p, value } : p)) }));
  const sendToChat = () => {
    const s = useAppStore.getState();
    s.setAIChatDetached(true); s.setAIChatOpen(true);
    useChatComposerStore.getState().insertIntoChat(cap.example);
  };

  // インスペクタの幅（右ドック・左ドラッグで可変）／高さ（下ドック・上ドラッグで可変）。
  const [inspW, setInspW] = useState(360);
  const inspWRef = useRef(inspW); inspWRef.current = inspW;
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX; const startW = inspWRef.current;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => setInspW(Math.min(Math.max(startW + (startX - ev.clientX), 280), Math.max(320, window.innerWidth * 0.6)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };
  const [inspH, setInspH] = useState(280);
  const inspHRef = useRef(inspH); inspHRef.current = inspH;
  const startResizeH = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY; const startH = inspHRef.current;
    document.body.style.cursor = 'row-resize'; document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => setInspH(Math.min(Math.max(startH + (startY - ev.clientY), 180), Math.max(220, window.innerHeight * 0.6)));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  };

  return (
    <Box sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 上段：ツールバー（全幅）＋ 中段：キャンバス行 */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* ツールバー */}
        <Box sx={{ px: 2.5, py: 1.5, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
              <Chip size="small" label={sm.label} sx={{ height: 18, fontSize: 10, fontWeight: 700, color: sm.color, bgcolor: sm.bg }} />
              {cap.sceneBound && <ViewInArRoundedIcon sx={{ fontSize: 14, color: '#c0a3ff' }} />}
              {saved && <Chip size="small" icon={<TuneRoundedIcon sx={{ fontSize: 11, color: `${ACCENT} !important` }} />} label="カスタム" sx={{ height: 18, fontSize: 9.5, fontWeight: 700, color: ACCENT, bgcolor: 'rgba(196,163,247,0.16)' }} />}
              {readOnly && (
                <Tooltip title="AIの受け答えガイドは SEKKEIYA 公式が管理しています。辞書として閲覧できます。">
                  <Chip size="small" icon={<LockRoundedIcon sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6) !important' }} />} label="公式ガイド・閲覧のみ" sx={{ height: 18, fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.65)', bgcolor: 'rgba(255,255,255,0.08)' }} />
                </Tooltip>
              )}
            </Stack>
            <Typography noWrap sx={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{cap.title}</Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Tooltip title={insertable ? 'この例をチャットで試す' : '準備中'}>
            <span>
              <Button size="small" onClick={sendToChat} disabled={!insertable} startIcon={<NorthEastRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{ textTransform: 'none', fontSize: 12, color: '#4fc3f7', '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' } }}>試す</Button>
            </span>
          </Tooltip>
          {draft.params.length > 0 && (
            <Button size="small" onClick={(e) => setParamAnchor(e.currentTarget)} startIcon={<TuneRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', fontSize: 12, color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
              こまかい設定
            </Button>
          )}
          {!readOnly && (
            <>
              <Button size="small" onClick={(e) => { setAiError(null); setAiAnchor(e.currentTarget); }} startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />}
                sx={{ textTransform: 'none', fontSize: 12, fontWeight: 700, color: ACCENT, border: '1px solid rgba(196,163,247,0.45)', borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(196,163,247,0.1)', borderColor: ACCENT } }}>
                AIで組む
              </Button>
              <Tooltip title="既定に戻す">
                <span>
                  <IconButton size="small" onClick={onReset} disabled={!saved && !dirty} sx={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5, '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.06)' }, '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                    <RestartAltRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                variant="contained" size="small" onClick={onSave} disabled={!dirty} startIcon={<SaveRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: 'none', fontWeight: 800, bgcolor: ACCENT, color: '#1a1030', '&:hover': { bgcolor: '#d3bafa' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' } }}>
                {dirty ? '保存' : '保存済み'}
              </Button>
            </>
          )}
        </Box>

        {/* 中段：キャンバス（右ドック時はインスペクタを横に並べる） */}
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <WorkflowCanvas draft={draft} setDraft={setDraft} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} readOnly={readOnly} />
          <Box sx={{ position: 'absolute', top: 8, left: 10, zIndex: 5, px: 1, py: 0.4, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.45)', pointerEvents: 'none' }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
              {readOnly
                ? 'AIはこのガイドを参考に、状況に応じて最適な手順を選びます ・ ノードをクリックで詳細'
                : 'ノードをクリックで設定 ・ ドラッグで移動 ・ 背景ドラッグ/ホイールで移動・拡大'}
            </Typography>
          </Box>
        </Box>

        {/* 右ドック：ノードインスペクタ */}
        {selectedNodeId && dock === 'right' && (
          <>
            <Box onMouseDown={startResize} sx={{ width: 7, flexShrink: 0, cursor: 'col-resize', position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(196,163,247,0.3)' }, '&::after': { content: '""', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 26, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.22)' } }} />
            <Box sx={{ width: inspW, flexShrink: 0, height: '100%' }}>
              <NodeInspector nodeId={selectedNodeId} draft={draft} setDraft={setDraft} onClose={() => setSelectedNodeId(null)} readOnly={readOnly} dock={dock} onDockChange={changeDock} />
            </Box>
          </>
        )}
        </Box>
      </Box>

      {/* 下ドック（ボトムバー）：ノードインスペクタ */}
      {selectedNodeId && dock === 'bottom' && (
        <>
          <Box onMouseDown={startResizeH} sx={{ height: 7, flexShrink: 0, cursor: 'row-resize', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(196,163,247,0.3)' }, '&::after': { content: '""', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 26, height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.22)' } }} />
          <Box sx={{ height: inspH, flexShrink: 0 }}>
            <NodeInspector nodeId={selectedNodeId} draft={draft} setDraft={setDraft} onClose={() => setSelectedNodeId(null)} readOnly={readOnly} dock={dock} onDockChange={changeDock} />
          </Box>
        </>
      )}

      {/* こまかい設定ポップオーバー */}
      <Popover
        open={Boolean(paramAnchor)} anchorEl={paramAnchor} onClose={() => setParamAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: '#1a1f2b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, width: 300, mt: 0.5 } }}
      >
        <Box sx={{ p: 1.75 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.25 }}>
            <TuneRoundedIcon sx={{ fontSize: 15, color: ACCENT }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 800 }}>こまかい設定</Typography>
          </Stack>
          <Stack spacing={1}>
            {draft.params.map((param, idx) => (
              <Box key={param.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{param.label}</Typography>
                <ParamControl param={param} onChange={(v) => patchParam(idx, v)} disabled={readOnly} />
              </Box>
            ))}
          </Stack>
        </Box>
      </Popover>

      {/* AIでワークフローを組むポップオーバー */}
      <Popover
        open={Boolean(aiAnchor)} anchorEl={aiAnchor} onClose={() => { if (!aiBusy) setAiAnchor(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: '#1a1f2b', color: '#fff', border: '1px solid rgba(196,163,247,0.35)', borderRadius: 2, width: 380, mt: 0.5 } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: ACCENT }} />
            <Typography sx={{ fontSize: 13, fontWeight: 800 }}>AIでワークフローを組む</Typography>
          </Stack>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', mb: 1.25 }}>
            どう動いてほしいかを書くと、AIがワークフロー案を組み立てます。生成後に微調整して保存してください。
          </Typography>
          <TextField
            multiline minRows={3} maxRows={6} fullWidth autoFocus
            placeholder="例: 家具が未登録なら先にS.Modelsへ誘導して、配置後は必ずレンダーまで実行して（空欄ならAIにおまかせ）"
            value={aiText} disabled={aiBusy}
            onChange={(e) => setAiText(e.target.value)}
            sx={{ mb: 1.25, '& .MuiOutlinedInput-root': { color: '#fff', fontSize: 12.5, bgcolor: 'rgba(255,255,255,0.04)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}
          />
          {aiError && (
            <Typography sx={{ fontSize: 11.5, color: '#ff8a80', mb: 1 }}>{aiError}</Typography>
          )}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button size="small" disabled={aiBusy} onClick={() => setAiAnchor(null)} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.6)' }}>キャンセル</Button>
            <Button
              size="small" variant="contained" onClick={runAiCompose} disabled={aiBusy}
              startIcon={aiBusy ? <CircularProgress size={13} sx={{ color: 'inherit' }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', fontWeight: 800, bgcolor: ACCENT, color: '#1a1030', '&:hover': { bgcolor: '#d3bafa' }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' } }}
            >
              {aiBusy ? '生成中…' : '生成'}
            </Button>
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
};

const ParamControl: React.FC<{ param: WorkflowParam; onChange: (v: string) => void; disabled?: boolean }> = ({ param, onChange, disabled }) => {
  if (param.type === 'toggle') {
    const on = param.value === 'on';
    return (
      <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: on ? ACCENT : 'rgba(255,255,255,0.35)' }}>{on ? 'ON' : 'OFF'}</Typography>
        <Switch size="small" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked ? 'on' : 'off')}
          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />
      </Stack>
    );
  }
  if (param.type === 'select') {
    return (
      <Select size="small" value={param.value} disabled={disabled} onChange={(e) => onChange(String(e.target.value))}
        sx={{ minWidth: 130, color: '#fff', fontSize: 12, bgcolor: 'rgba(255,255,255,0.04)', flexShrink: 0, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)' } }}
        MenuProps={{ PaperProps: { sx: { bgcolor: '#20242e', color: '#fff' } } }}
      >
        {(param.options ?? []).map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
      </Select>
    );
  }
  return (
    <TextField size="small" type={param.type === 'number' ? 'number' : 'text'} value={param.value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
      sx={{ width: 130, flexShrink: 0, '& .MuiOutlinedInput-root': { color: '#fff', fontSize: 12, bgcolor: 'rgba(255,255,255,0.04)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' } }}
    />
  );
};
