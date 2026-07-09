import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, List, ListItem, ListItemButton, Chip, Paper, Button, IconButton,
  CircularProgress, Switch, Tooltip, Alert, Snackbar,
} from '@mui/material';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { BRAND } from '../../../styles/theme';
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { extractPdfTextWithMeta, renderPdfPagesForOcr } from '../../dsf/lib/pdf';

export const AiStudioDocuments: React.FC = () => {
  const {
    knowledgeSources, aiProfiles, knowledgeBusy,
    loadKnowledgeSources, ingestKnowledgeSource, removeKnowledgeSource, toggleKnowledgeOnProfile,
  } = useAiProfileStore();
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const uid = currentUser?.uid as string | undefined;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uid) loadKnowledgeSources(uid);
  }, [uid, loadKnowledgeSources]);

  const selected = useMemo(() => knowledgeSources.find((d) => d.id === selectedId), [knowledgeSources, selectedId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !uid) {
      if (!uid) setToast({ msg: 'ログインが必要です', sev: 'error' });
      return;
    }
    for (const file of Array.from(files)) {
      try {
        let text = '';
        let images: { data: string; mimeType: string }[] | undefined;
        if (file.name.toLowerCase().endsWith('.pdf')) {
          const buf = await file.arrayBuffer();
          const meta = await extractPdfTextWithMeta(buf);
          text = meta.text;
          // テキスト層が乏しい(図面/スキャン)PDFはページ画像も渡してサーバ側でOCRする
          const sparse = text.trim().length < Math.max(300, 250 * meta.pageCount);
          if (sparse) {
            setToast({ msg: `${file.name}: 図面とみてOCRで読み取り中…`, sev: 'info' });
            try { images = await renderPdfPagesForOcr(buf); } catch { /* OCR画像化失敗はテキストのみで続行 */ }
          }
        } else {
          text = await file.text();
        }
        if (text.trim().length < 20 && (!images || images.length === 0)) {
          setToast({ msg: `${file.name}: テキストを抽出できませんでした`, sev: 'error' });
          continue;
        }
        setToast({ msg: `${file.name} を取り込み中…（埋め込み生成）`, sev: 'info' });
        await ingestKnowledgeSource({ uid, title: file.name.replace(/\.[^.]+$/, ''), text, sourceFile: file.name, images });
        setToast({ msg: `${file.name} を取り込みました`, sev: 'success' });
      } catch (err: any) {
        setToast({ msg: `${file.name} の取り込みに失敗: ${err?.message || ''}`, sev: 'error' });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusChip = (s?: string) => {
    if (s === 'ingesting') return <Chip size="small" icon={<CircularProgress size={10} sx={{ color: '#90caf9 !important' }} />} label="取込中" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(144,202,249,0.15)', color: '#90caf9' }} />;
    if (s === 'error') return <Chip size="small" icon={<ErrorOutlineRoundedIcon sx={{ fontSize: 12 }} />} label="エラー" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(239,68,68,0.15)', color: '#f87171' }} />;
    return <Chip size="small" label="完了" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(34,197,94,0.15)', color: '#4ade80' }} />;
  };

  const connectedProfiles = (kid: string) => aiProfiles.filter((p) => (p.equippedKnowledge || []).includes(kid));

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />

      {/* Left: source list */}
      <Box sx={{ width: 340, borderRight: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(0,0,0,0.2)' }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <AutoStoriesRoundedIcon sx={{ color: '#60a5fa' }} />
            <Typography sx={{ color: '#fff', fontWeight: 700, flex: 1 }}>ナレッジ (RAG)</Typography>
            <Chip label={`${knowledgeSources.length}`} size="small" sx={{ height: 20, bgcolor: 'rgba(255,255,255,0.08)', color: '#fff' }} />
          </Box>
          <Button
            fullWidth variant="contained" startIcon={<UploadFileRoundedIcon />}
            disabled={knowledgeBusy || !uid}
            onClick={() => fileInputRef.current?.click()}
            sx={{ bgcolor: '#a855f7', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#9333ea' } }}
          >
            PDF / テキストを追加
          </Button>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {knowledgeSources.length === 0 && (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12.5, textAlign: 'center', mt: 4, px: 2 }}>
              まだナレッジがありません。設計資料やルール集（PDF）を追加すると、AI がそれを根拠に判断・採点します。
            </Typography>
          )}
          {knowledgeSources.map((doc) => (
            <ListItem key={doc.id} disablePadding sx={{ mb: 0.75 }}
              secondaryAction={
                <IconButton edge="end" size="small" onClick={() => { removeKnowledgeSource(uid!, doc.id); if (selectedId === doc.id) setSelectedId(null); }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#f87171' } }}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={doc.id === selectedId}
                onClick={() => setSelectedId(doc.id)}
                sx={{ borderRadius: 2, pr: 5, bgcolor: doc.id === selectedId ? 'rgba(168,85,247,0.12)' : 'transparent', border: `1px solid ${doc.id === selectedId ? 'rgba(168,85,247,0.4)' : 'transparent'}`, '&.Mui-selected': { bgcolor: 'rgba(168,85,247,0.12)' }, '&.Mui-selected:hover': { bgcolor: 'rgba(168,85,247,0.18)' } }}
              >
                <Box sx={{ minWidth: 0, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                    <PictureAsPdfRoundedIcon sx={{ color: '#e74c3c', fontSize: 16, flexShrink: 0 }} />
                    <Typography sx={{ color: '#fff', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {statusChip(doc.status)}
                    {doc.status === 'ready' && <Chip label={`${doc.chunkCount ?? 0} チャンク`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }} />}
                    {connectedProfiles(doc.id).length > 0 && <Chip icon={<HubRoundedIcon sx={{ fontSize: 11 }} />} label={`${connectedProfiles(doc.id).length} AI`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(168,85,247,0.15)', color: '#c4a3f7' }} />}
                  </Box>
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Right: detail + connect to AI */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflowY: 'auto', gap: 3 }}>
        {!selected ? (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, textAlign: 'center' }}>
            <AutoStoriesRoundedIcon sx={{ color: 'rgba(255,255,255,0.15)', fontSize: 56 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600 }}>ナレッジを選択してください</Typography>
            <Typography sx={{ color: BRAND.sub, fontSize: 13, maxWidth: 420 }}>
              取り込んだ資料はチャンク化＋ベクトル化され、AIの判断根拠（RAG）になります。
              左の「PDF / テキストを追加」から取り込めます。
            </Typography>
          </Box>
        ) : (
          <>
            <Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 0.5 }}>{selected.title}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {statusChip(selected.status)}
                {selected.sourceFile && <Typography sx={{ color: BRAND.sub, fontSize: 12.5 }}>{selected.sourceFile}</Typography>}
                {selected.createdAt && <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{new Date(selected.createdAt).toLocaleDateString()}</Typography>}
              </Box>
            </Box>

            {selected.status === 'error' && (
              <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                取り込みに失敗しました。{selected.errorMessage || 'もう一度お試しください。'}
              </Alert>
            )}

            {/* AI Summary */}
            <Paper sx={{ p: 2.5, bgcolor: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <AutoAwesomeRoundedIcon sx={{ color: '#60a5fa', fontSize: 18 }} />
                <Typography sx={{ color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>AIによる要約</Typography>
                <Box sx={{ flex: 1 }} />
                {selected.usedOcr && <Chip label="OCR" size="small" sx={{ height: 20, fontSize: 10.5, mr: 0.5, bgcolor: 'rgba(245,158,11,0.18)', color: '#fbbf24' }} />}
                {!!selected.textLength && <Chip label={`${selected.textLength.toLocaleString()} 文字`} size="small" sx={{ height: 20, fontSize: 10.5, mr: 0.5, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }} />}
                <Chip label={`${selected.chunkCount ?? 0} チャンクをベクトル化`} size="small" sx={{ height: 20, fontSize: 10.5, bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }} />
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 13.5, lineHeight: 1.7 }}>
                {selected.status === 'ingesting' ? '取り込み・要約を生成しています…' : (selected.summary || '要約はありません。')}
              </Typography>
            </Paper>

            {/* Connect to AI */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <HubRoundedIcon sx={{ color: '#c4a3f7' }} />
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>このナレッジを使うAI</Typography>
              </Box>
              <Typography sx={{ color: BRAND.sub, fontSize: 13, mb: 2 }}>
                接続したAIは、推論時にこの資料を検索（RAG）して判断・回答の根拠に使います。
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                {aiProfiles.map((p) => {
                  const on = (p.equippedKnowledge || []).includes(selected.id);
                  const disabled = selected.status !== 'ready';
                  return (
                    <Paper key={p.id} sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: BRAND.panel, border: `1px solid ${on ? 'rgba(168,85,247,0.4)' : BRAND.line}`, borderRadius: 2.5, opacity: disabled ? 0.5 : 1 }}>
                      <SmartToyRoundedIcon sx={{ color: on ? '#c4a3f7' : 'rgba(255,255,255,0.4)' }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{p.baseModelId}</Typography>
                      </Box>
                      <Tooltip title={disabled ? '取り込み完了後に接続できます' : (on ? '接続を解除' : 'このAIに接続')}>
                        <span>
                          <Switch
                            checked={on}
                            disabled={disabled}
                            onChange={() => toggleKnowledgeOnProfile(p.id, selected.id)}
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#a855f7' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#a855f7' } }}
                          />
                        </span>
                      </Tooltip>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
          </>
        )}
      </Box>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? (
          <Alert severity={toast.sev} onClose={() => setToast(null)} sx={{ bgcolor: '#1a1f2c', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};
