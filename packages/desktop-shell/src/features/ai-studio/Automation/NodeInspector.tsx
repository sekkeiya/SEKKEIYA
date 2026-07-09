import React, { useState } from 'react';
import { Box, Typography, Stack, IconButton, TextField, Switch, Chip, Button, Tooltip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VerticalSplitRoundedIcon from '@mui/icons-material/VerticalSplitRounded';
import HorizontalSplitRoundedIcon from '@mui/icons-material/HorizontalSplitRounded';
import type { WorkflowDef, WorkflowStep } from './workflowTypes';

const ACCENT = '#c4a3f7';

interface Props {
  nodeId: string;
  draft: WorkflowDef;
  setDraft: React.Dispatch<React.SetStateAction<WorkflowDef>>;
  onClose: () => void;
  /** 閲覧のみ（公式アカウント以外）。編集コントロールを無効化し、辞書として表示する。 */
  readOnly?: boolean;
  /** 表示位置（右サイドバー / ボトムバー）。 */
  dock?: 'right' | 'bottom';
  onDockChange?: (dock: 'right' | 'bottom') => void;
}

/** 右インスペクタ：キャンバスで選択したノードの設定を編集（閲覧のみ時は表示）する。 */
export const NodeInspector: React.FC<Props> = ({ nodeId, draft, setDraft, onClose, readOnly = false, dock = 'right', onDockChange }) => {
  const kind: 'trigger' | 'step' | 'end' =
    nodeId === 'trigger' ? 'trigger' : nodeId === 'end' ? 'end' : 'step';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#12161e' }}>
      <Box sx={{ px: 2, py: 1.5, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#fff' }}>
          {kind === 'trigger' ? (readOnly ? '話しかけ' : '話しかけの設定') : kind === 'end' ? '完了' : (readOnly ? '手順の詳細' : '手順の設定')}
        </Typography>
        {onDockChange && (
          <>
            <Tooltip title="右サイドバーに表示">
              <IconButton size="small" onClick={() => onDockChange('right')}
                sx={{ color: dock === 'right' ? '#c4a3f7' : 'rgba(255,255,255,0.35)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                <VerticalSplitRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="ボトムバーに表示">
              <IconButton size="small" onClick={() => onDockChange('bottom')}
                sx={{ color: dock === 'bottom' ? '#c4a3f7' : 'rgba(255,255,255,0.35)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                <HorizontalSplitRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
        {kind === 'trigger' && <TriggerInspector draft={draft} setDraft={setDraft} readOnly={readOnly} />}
        {kind === 'step' && <StepInspector nodeId={nodeId} draft={draft} setDraft={setDraft} readOnly={readOnly} />}
        {kind === 'end' && <EndInspector />}
      </Box>
    </Box>
  );
};

// ── 話しかけ（トリガー） ──────────────────────────
const TriggerInspector: React.FC<{ draft: WorkflowDef; setDraft: Props['setDraft']; readOnly?: boolean }> = ({ draft, setDraft, readOnly }) => {
  const [text, setText] = useState('');
  const add = () => { const t = text.trim(); if (t && !draft.triggers.includes(t)) setDraft((d) => ({ ...d, triggers: [...d.triggers, t] })); setText(''); };
  const remove = (t: string) => setDraft((d) => ({ ...d, triggers: d.triggers.filter((x) => x !== t) }));
  return (
    <>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16, color: '#4fc3f7' }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>起動する言い回し</Typography>
      </Stack>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 1.25 }}>
        チャットでこう話しかけると、この作業が走ります。AIは言い回しが違っても意図を汲んで対応します。
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
        {draft.triggers.map((t) => (
          <Chip key={t} label={t} onDelete={readOnly ? undefined : () => remove(t)} deleteIcon={<CloseRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{ color: '#fff', bgcolor: 'rgba(79,195,247,0.12)', border: '1px solid rgba(79,195,247,0.25)', fontSize: 12, '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff' } } }}
          />
        ))}
        {draft.triggers.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>まだ登録がありません。</Typography>}
      </Stack>
      {!readOnly && (
        <Stack direction="row" spacing={1}>
          <TextField
            size="small" fullWidth placeholder="例: この間取りを一覧して" value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }}
            sx={fieldSx}
          />
          <Button size="small" onClick={add} startIcon={<AddRoundedIcon />} sx={{ color: '#4fc3f7', textTransform: 'none', flexShrink: 0 }}>追加</Button>
        </Stack>
      )}
    </>
  );
};

// ── 手順 ────────────────────────────────────────
const StepInspector: React.FC<{ nodeId: string; draft: WorkflowDef; setDraft: Props['setDraft']; readOnly?: boolean }> = ({ nodeId, draft, setDraft, readOnly }) => {
  const idx = draft.steps.findIndex((s) => s.id === nodeId);
  if (idx < 0) return <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>手順が見つかりません。</Typography>;
  const step = draft.steps[idx];
  const on = step.enabled;

  const patchStep = (p: Partial<WorkflowStep>) => setDraft((d) => ({ ...d, steps: d.steps.map((s, i) => (i === idx ? { ...s, ...p } : s)) }));
  const moveStep = (dir: -1 | 1) => setDraft((d) => { const to = idx + dir; if (to < 0 || to >= d.steps.length) return d; const steps = [...d.steps]; [steps[idx], steps[to]] = [steps[to], steps[idx]]; return { ...d, steps }; });
  const patchBranch = (bi: number, label: string) => patchStep({ branches: step.branches?.map((b, j) => (j === bi ? { ...b, label } : b)) });
  const addBranch = () => patchStep({ branches: [...(step.branches ?? []), { id: `opt_${step.branches?.length ?? 0}_${idx}`, label: '新しい選択肢' }] });
  const removeBranch = (bi: number) => patchStep({ branches: step.branches?.filter((_, j) => j !== bi) });

  return (
    <>
      {/* ステップ番号＋並べ替え */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#1a1030', bgcolor: ACCENT }}>{idx + 1}</Box>
        <Typography sx={{ flex: 1, fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{idx + 1} / {draft.steps.length} 番目に実行</Typography>
        {!readOnly && (
          <>
            <Tooltip title="上へ"><span><IconButton size="small" onClick={() => moveStep(-1)} disabled={idx === 0} sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}><KeyboardArrowUpRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="下へ"><span><IconButton size="small" onClick={() => moveStep(1)} disabled={idx === draft.steps.length - 1} sx={{ color: 'rgba(255,255,255,0.5)', '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' } }}><KeyboardArrowDownRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
          </>
        )}
      </Stack>

      {/* 名前 */}
      <Label>手順の名前</Label>
      <TextField size="small" fullWidth value={step.label} disabled={readOnly} onChange={(e) => patchStep({ label: e.target.value })}
        sx={{ ...fieldSx, mb: 2, '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'rgba(255,255,255,0.75)' } }} />

      {/* 使う / スキップ */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.25, mb: 2, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>この手順を使う</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>OFFにするとスキップされます。</Typography>
        </Box>
        <Switch checked={on} disabled={readOnly} onChange={(e) => patchStep({ enabled: e.target.checked })}
          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: ACCENT } }} />
      </Box>

      {/* 分岐 */}
      {step.branches && (
        <>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
            <CallSplitRoundedIcon sx={{ fontSize: 15, color: ACCENT }} />
            <Label noMargin>分かれ道（AIが選択肢を提示）</Label>
          </Stack>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mb: 1 }}>この手順でユーザーに提示する選択肢です。</Typography>
          <Stack spacing={0.75} sx={{ mb: 1 }}>
            {step.branches.map((b, bi) => (
              <Stack key={b.id} direction="row" alignItems="center" spacing={0.75}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(196,163,247,0.6)', flexShrink: 0 }} />
                <TextField size="small" fullWidth value={b.label} disabled={readOnly} onChange={(e) => patchBranch(bi, e.target.value)}
                  sx={{ ...fieldSx, '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: 'rgba(255,255,255,0.75)' } }} />
                {!readOnly && (
                  <IconButton size="small" onClick={() => removeBranch(bi)} sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: '#ff8a80' } }}><CloseRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                )}
              </Stack>
            ))}
          </Stack>
          {!readOnly && (
            <Button size="small" onClick={addBranch} startIcon={<AddRoundedIcon />} sx={{ color: ACCENT, textTransform: 'none' }}>選択肢を追加</Button>
          )}
        </>
      )}
    </>
  );
};

const EndInspector: React.FC = () => (
  <Stack alignItems="center" spacing={1.5} sx={{ py: 4, textAlign: 'center' }}>
    <CheckCircleRoundedIcon sx={{ fontSize: 40, color: '#6ee7a8' }} />
    <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>完了・成果物</Typography>
    <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', maxWidth: 220 }}>
      すべての手順が終わると、AIが結果を報告し、成果物（Web等）に反映します。
    </Typography>
  </Stack>
);

const fieldSx = {
  '& .MuiOutlinedInput-root': { color: '#fff', fontSize: 12.5, bgcolor: 'rgba(255,255,255,0.04)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)' },
};

const Label: React.FC<{ children: React.ReactNode; noMargin?: boolean }> = ({ children, noMargin }) => (
  <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.3, mb: noMargin ? 0 : 0.75 }}>{children}</Typography>
);
