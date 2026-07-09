// チームプロジェクト共同チャットの「チャット」一覧（1プロジェクトに複数チャット。Claude Code 風）。
// 「メインチャット」(topicId 未指定 = /projects/{id}/chatMessages) ＋ 追加チャット(chatTopics) を切り替える。

import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, TextField, CircularProgress, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { useAuthStore } from '../../store/useAuthStore';
import { subscribeToProjectTopics, createProjectTopic, type ProjectChatTopic } from './api/teamChatApi';

const ProjectChatTopics: React.FC<{ projectId: string; activeTopicId?: string; onSelect: (topicId?: string) => void }> = ({ projectId, activeTopicId, onSelect }) => {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const [topics, setTopics] = useState<ProjectChatTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToProjectTopics(projectId, (t) => { setTopics(t); setLoading(false); }, () => setLoading(false));
    return unsub;
  }, [projectId]);

  const create = async () => {
    const name = newName.trim();
    if (!name || !uid || creating) return;
    setCreating(true);
    try {
      const id = await createProjectTopic(projectId, name, uid);
      setNewName('');
      setAdding(false);
      onSelect(id);
    } catch (e) {
      console.error('[ProjectChatTopics] create failed:', e);
    } finally {
      setCreating(false);
    }
  };

  const renderRow = (id: string | undefined, label: string, last?: string) => {
    const active = (activeTopicId ?? undefined) === id;
    return (
      <Box
        key={id ?? '__general__'}
        onClick={() => onSelect(id)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6, mx: 0.5, borderRadius: 1, cursor: 'pointer',
          color: active ? '#fff' : 'rgba(255,255,255,0.75)',
          bgcolor: active ? 'rgba(138,180,248,0.16)' : 'transparent',
          '&:hover': { bgcolor: active ? 'rgba(138,180,248,0.2)' : 'rgba(255,255,255,0.06)' },
        }}
      >
        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: '0.9rem', color: active ? '#8ab4f8' : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: active ? 600 : 400 }}>{label}</Typography>
          {last && <Typography noWrap sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{last}</Typography>}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1.25, pb: 0.5 }}>
        <Typography sx={{ flex: 1, fontSize: '0.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          チャット
        </Typography>
        <Tooltip title="新規チャット">
          <IconButton size="small" onClick={() => setAdding(a => !a)} sx={{ color: 'rgba(255,255,255,0.45)', p: 0.25, '&:hover': { color: '#8ab4f8' } }}>
            <AddRoundedIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {adding && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, pb: 0.75 }}>
          <TextField
            size="small"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) create(); }}
            placeholder="チャット名（例: 設計の相談）"
            sx={{
              flex: 1,
              '& .MuiInputBase-root': { color: '#fff', fontSize: 12, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' },
            }}
          />
          <IconButton size="small" onClick={create} disabled={creating || !newName.trim()} sx={{ color: '#8ab4f8' }}>
            {creating ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AddRoundedIcon sx={{ fontSize: '1.05rem' }} />}
          </IconButton>
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pb: 1 }}>
        {renderRow(undefined, 'メインチャット')}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}><CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.3)' }} /></Box>
        ) : (
          topics.map(t => renderRow(t.id, t.name, t.lastMessage))
        )}
      </Box>
    </Box>
  );
};

export default ProjectChatTopics;
