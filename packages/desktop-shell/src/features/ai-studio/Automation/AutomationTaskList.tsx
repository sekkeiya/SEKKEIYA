import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, Tooltip, Collapse } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import { AUTOMATION_CATALOG, type CapabilityStatus } from '../../global-settings/automationCatalog';
import { useWorkflowConfigStore } from '../../../store/useWorkflowConfigStore';

const ACCENT = '#c4a3f7';
const STORAGE_KEY = 'sekkeiya-wf-list-collapsed';

const STATUS_DOT: Record<CapabilityStatus, string> = {
  available: '#6ee7a8',
  beta: '#ffd166',
  planned: '#9aa3b2',
};

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 左サイドバー：自動化作業の一覧（カテゴリ別・開閉可能）。選ぶと中央にワークフローが出る。 */
export const AutomationTaskList: React.FC<Props> = ({ selectedId, onSelect }) => {
  const saved = useWorkflowConfigStore((s) => s.saved);

  // 折りたたみ済みカテゴリ（true = 閉じている）。localStorage に保存。
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const allCollapsed = AUTOMATION_CATALOG.every((cat) => collapsed[cat.id]);
  const setAll = (v: boolean) => setCollapsed(Object.fromEntries(AUTOMATION_CATALOG.map((cat) => [cat.id, v])));

  // 選択中の項目があるカテゴリは、閉じていても中身が見えるよう自動展開する。
  const selectedCatId = selectedId
    ? AUTOMATION_CATALOG.find((cat) => cat.capabilities.some((c) => c.id === selectedId))?.id
    : undefined;

  return (
    <Box sx={{ width: 292, flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)', bgcolor: '#0e1118' }}>
      {/* ヘッダー */}
      <Box sx={{ px: 2, py: 1.75, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeRoundedIcon sx={{ color: ACCENT, fontSize: 20 }} />
          <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 800, color: '#fff' }}>自動化作業リスト</Typography>
          <Tooltip title={allCollapsed ? 'すべて開く' : 'すべて閉じる'}>
            <Box onClick={() => setAll(!allCollapsed)} sx={{ display: 'flex', p: 0.5, borderRadius: 1, cursor: 'pointer', color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              {allCollapsed ? <UnfoldMoreRoundedIcon sx={{ fontSize: 16 }} /> : <UnfoldLessRoundedIcon sx={{ fontSize: 16 }} />}
            </Box>
          </Tooltip>
        </Stack>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
          SEKKEIYA Chat の受け答えガイド。AIはこれを参考に、状況に応じて最適な手順を選びます。
        </Typography>
      </Box>

      {/* 一覧 */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 0.5 }}>
        {AUTOMATION_CATALOG.map((cat) => {
          const open = !collapsed[cat.id] || cat.id === selectedCatId;
          return (
            <Box key={cat.id} sx={{ mb: 0.25 }}>
              {/* カテゴリ見出し（クリックで開閉） */}
              <Box
                onClick={() => toggle(cat.id)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 1, px: 1, py: 0.6, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
              >
                <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
                  {cat.title}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{cat.capabilities.length}</Typography>
              </Box>

              <Collapse in={open} timeout="auto" unmountOnExit>
                {cat.capabilities.map((cap) => {
                  const isSel = cap.id === selectedId;
                  const isCustom = !!saved[cap.id];
                  return (
                    <Box
                      key={cap.id}
                      onClick={() => onSelect(cap.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, mx: 1, pl: 2.5, pr: 1.25, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
                        bgcolor: isSel ? 'rgba(196,163,247,0.14)' : 'transparent',
                        borderLeft: `2px solid ${isSel ? ACCENT : 'transparent'}`,
                        '&:hover': { bgcolor: isSel ? 'rgba(196,163,247,0.18)' : 'rgba(255,255,255,0.05)' },
                      }}
                    >
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS_DOT[cap.status], flexShrink: 0 }} />
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: isSel ? 700 : 500, color: isSel ? '#fff' : 'rgba(255,255,255,0.82)' }}>
                        {cap.title}
                      </Typography>
                      {cap.sceneBound && (
                        <Tooltip title="3Dシーンが必要"><ViewInArRoundedIcon sx={{ fontSize: 13, color: '#c0a3ff', flexShrink: 0 }} /></Tooltip>
                      )}
                      {isCustom && (
                        <Tooltip title="カスタム設定あり"><TuneRoundedIcon sx={{ fontSize: 13, color: ACCENT, flexShrink: 0 }} /></Tooltip>
                      )}
                    </Box>
                  );
                })}
              </Collapse>
            </Box>
          );
        })}
        <Box sx={{ height: 16 }} />
      </Box>
    </Box>
  );
};
