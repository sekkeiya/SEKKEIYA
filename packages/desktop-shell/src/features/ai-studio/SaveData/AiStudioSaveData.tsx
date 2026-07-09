import React from 'react';
import { Box, Typography, Paper, Button, Chip, Stack, LinearProgress } from '@mui/material';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import { BRAND } from '../../../styles/theme';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';

const ACTION_LABEL: Record<string, string> = {
  PROPOSAL_ACCEPTED: '提案を採用',
  PROPOSAL_REJECTED: '提案を棄却',
  MODEL_ATTACHED: 'モデル配置',
  MODEL_REMOVED: 'モデル削除',
  LAYOUT_ITEM_MOVED: 'レイアウト移動',
  LAYOUT_ITEM_REPLACED: 'レイアウト置換',
  MATERIAL_CHANGED: 'マテリアル変更',
  METADATA_CORRECTED: 'メタデータ修正',
  UNDO_PERFORMED: '操作を取り消し',
};

export const AiStudioSaveData: React.FC = () => {
  const { saveDataEvents, saveDataMemories, synthesizeEventsToMemory } = useAiProfileStore();
  const unsummarized = saveDataEvents.filter((e) => !e.isSummarized);
  const recent = [...saveDataEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  const memories = [...saveDataMemories].sort((a, b) => b.lastUpdated - a.lastUpdated);

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, color: '#fff', maxWidth: 1100, margin: '0 auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, letterSpacing: -0.5 }}>セーブデータ（学習）</Typography>
      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)', mb: 4, maxWidth: 720 }}>
        あなたの操作（採用・修正・配置など）から AI が抽出した傾向・好みです。ここで蓄積された記憶は、AIモデルの「セーブデータ参照」をONにすると推論コンテキストに注入されます。
      </Typography>

      {/* Synthesis bar */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <PsychologyRoundedIcon sx={{ color: '#c4a3f7', fontSize: 28 }} />
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>記憶の合成（Memory Synthesis）</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              未要約の操作記録 <b style={{ color: '#c4a3f7' }}>{unsummarized.length}</b> 件 / 生成済みメモリ <b style={{ color: '#c4a3f7' }}>{memories.length}</b> 件
            </Typography>
          </Box>
          <Button
            variant="contained" startIcon={<AutoFixHighRoundedIcon />}
            disabled={unsummarized.length === 0}
            onClick={() => synthesizeEventsToMemory({})}
            sx={{ bgcolor: '#a855f7', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#9333ea' }, '&.Mui-disabled': { bgcolor: 'rgba(168,85,247,0.25)', color: 'rgba(255,255,255,0.4)' } }}
          >
            記憶を合成する
          </Button>
        </Box>
      </Paper>

      {/* Memories */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PsychologyRoundedIcon sx={{ color: '#c4a3f7' }} /> 学習されたメモリ
      </Typography>
      {memories.length === 0 ? (
        <Paper sx={{ p: 3, mb: 4, bgcolor: BRAND.panel, border: `1px dashed ${BRAND.line2}`, borderRadius: 3, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <InfoRoundedIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, lineHeight: 1.6 }}>
            まだ学習メモリがありません。プロジェクトで操作を重ね、上の「記憶を合成する」を実行すると、好み・傾向が要約されてここに蓄積されます。
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 4 }}>
          {memories.map((m) => (
            <Paper key={m.id} sx={{ p: 2.5, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Chip label={m.topic} size="small" sx={{ bgcolor: 'rgba(168,85,247,0.15)', color: '#e9d5ff', fontWeight: 600 }} />
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>元イベント {m.sourceEventIds.length} 件</Typography>
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, lineHeight: 1.6, mb: 1.5 }}>{m.summary}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>確信度</Typography>
                <LinearProgress variant="determinate" value={m.confidenceScore * 100} sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: '#a855f7' } }} />
                <Typography sx={{ fontSize: 11, color: '#c4a3f7', fontWeight: 600 }}>{(m.confidenceScore * 100).toFixed(0)}%</Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* Recent events */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryRoundedIcon sx={{ color: 'rgba(255,255,255,0.6)' }} /> 最近の操作記録
      </Typography>
      {recent.length === 0 ? (
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>まだ操作記録はありません。</Typography>
      ) : (
        <Stack spacing={1}>
          {recent.map((e) => (
            <Paper key={e.id} sx={{ px: 2, py: 1.25, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: e.isSummarized ? 'rgba(255,255,255,0.25)' : '#a855f7', flexShrink: 0 }} />
              <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 500, flex: 1 }}>
                {ACTION_LABEL[e.actionType] || e.actionType}
                {e.context?.targetType && <Typography component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, ml: 1 }}>{e.context.targetType}</Typography>}
              </Typography>
              {!e.isSummarized && <Chip label="未要約" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(168,85,247,0.15)', color: '#c4a3f7' }} />}
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{new Date(e.timestamp).toLocaleString()}</Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};
