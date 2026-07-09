import React, { useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import { findCapabilityById } from '../../global-settings/automationCatalog';
import { AutomationTaskList } from './AutomationTaskList';
import { WorkflowEditor } from './WorkflowEditor';

/**
 * 自動化スタジオ（3ペイン）:
 *   左 = 作業一覧 / 中央 = ノードでワークフロー設計 / 右 = ノード選択時の設定インスペクタ。
 */
export const AiStudioAutomation: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cap = selectedId ? findCapabilityById(selectedId) : undefined;

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0, width: '100%' }}>
      {/* 左：作業一覧 */}
      <AutomationTaskList selectedId={selectedId} onSelect={setSelectedId} />

      {/* 中央＋右：ワークフロー設計 */}
      {cap ? (
        <WorkflowEditor key={cap.id} cap={cap} />
      ) : (
        <Box sx={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#141821' }}>
          <Stack alignItems="center" spacing={2} sx={{ textAlign: 'center', maxWidth: 380, px: 3 }}>
            <AccountTreeRoundedIcon sx={{ fontSize: 52, color: 'rgba(196,163,247,0.5)' }} />
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>AIの受け答えガイド</Typography>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
              左の一覧から作業を選ぶと、「話しかけ → 手順 → 完了」のノードフローが表示されます。
              これは厳密なルールではなく、AIが意図を汲んで最適なツールを選ぶための参照ガイドです。
            </Typography>
          </Stack>
        </Box>
      )}
    </Box>
  );
};
