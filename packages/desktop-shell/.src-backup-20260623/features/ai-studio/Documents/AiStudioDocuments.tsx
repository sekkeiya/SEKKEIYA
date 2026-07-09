import React, { useMemo } from 'react';
import { Box, Typography, List, ListItem, ListItemButton, Chip, Paper } from '@mui/material';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import LightbulbCircleRoundedIcon from '@mui/icons-material/LightbulbCircleRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { useAiStudioStore } from '../store/useAiStudioStore';
import { BRAND } from '../../../styles/theme';

export const AiStudioDocuments: React.FC = () => {
  const { documents, selectedDocumentId, selectDocument } = useAiStudioStore();
  const selectedDoc = useMemo(() => documents.find(d => d.id === selectedDocumentId), [documents, selectedDocumentId]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Left Sidebar: Document List */}
      <Box sx={{ 
        width: 320, 
        borderRight: `1px solid ${BRAND.line}`, 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: 'rgba(0,0,0,0.2)'
      }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArticleRoundedIcon sx={{ color: '#fff' }} />
          <Typography sx={{ color: '#fff', fontWeight: 600 }}>ナレッジベース</Typography>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {documents.map(doc => (
            <ListItem key={doc.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                selected={doc.id === selectedDocumentId}
                onClick={() => selectDocument(doc.id)}
                sx={{ 
                  borderRadius: 2,
                  bgcolor: doc.id === selectedDocumentId ? BRAND.panel2 : 'transparent',
                  '&.Mui-selected': { bgcolor: BRAND.panel2 }
                }}
              >
                <Box>
                  <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 500, mb: 0.5 }}>{doc.title}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={doc.category} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(255,255,255,0.1)' }} />
                    <Chip label={`${doc.extractedCriteria.length} 件の抽出`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#90caf920', color: '#90caf9' }} />
                  </Box>
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Right Pane: Document Detail */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3, overflowY: 'auto', gap: 3 }}>
        {!selectedDoc ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: BRAND.sub }}>ドキュメントを選択して詳細を表示します。</Typography>
          </Box>
        ) : (
          <>
            <Box>
              <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 1 }}>
                {selectedDoc.title}
              </Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: 14 }}>
                アップロード日: {new Date(selectedDoc.uploadedAt).toLocaleDateString()}
              </Typography>
            </Box>

            {/* Split Views */}
            <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
              
              {/* PDF Viewer Mock */}
              <Paper sx={{ 
                flex: 1, 
                bgcolor: BRAND.panel, 
                border: `1px solid ${BRAND.line}`, 
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PictureAsPdfRoundedIcon sx={{ color: '#e74c3c' }} />
                  <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>ドキュメントビューワー</Typography>
                </Box>
                <Box sx={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: BRAND.sub,
                  p: 4,
                  textAlign: 'center'
                }}>
                  <Typography sx={{ mb: 2, fontSize: 14, lineHeight: 1.6 }}>
                    {selectedDoc.summary}
                  </Typography>
                  <Box sx={{ p: 2, border: `1px dashed ${BRAND.line2}`, borderRadius: 2 }}>
                    <Typography sx={{ fontSize: 12, opacity: 0.5 }}>PDFのモックプレビュー画面になります</Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Extracted Flow */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper sx={{ p: 2, bgcolor: `#90caf910`, border: `1px solid #90caf940`, borderRadius: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AutoAwesomeRoundedIcon sx={{ color: '#90caf9', fontSize: 18 }} />
                    <Typography sx={{ color: '#90caf9', fontSize: 13, fontWeight: 700 }}>AIによる知識抽出</Typography>
                  </Box>
                  <Typography sx={{ color: BRAND.sub, fontSize: 13, lineHeight: 1.5 }}>
                    このドキュメントから以下のルールや知識・文脈が自動抽出されました。これらはAIプロファイルの「評価基準」に組み込むことができます。
                  </Typography>
                </Paper>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                  {selectedDoc.extractedCriteria.map(criteria => (
                    <Paper key={criteria.id} sx={{ p: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {criteria.type === 'rule' ? (
                            <RuleRoundedIcon sx={{ color: '#f39c12', fontSize: 18 }} />
                          ) : (
                            <LightbulbCircleRoundedIcon sx={{ color: '#2ecc71', fontSize: 18 }} />
                          )}
                          <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                            {criteria.label}
                          </Typography>
                        </Box>
                        <Chip 
                          label={criteria.type.toUpperCase()} 
                          size="small" 
                          sx={{ 
                            height: 20, fontSize: 10, fontWeight: 700, 
                            bgcolor: criteria.type === 'rule' ? 'rgba(243, 156, 18, 0.15)' : 'rgba(46, 204, 113, 0.15)',
                            color: criteria.type === 'rule' ? '#f39c12' : '#2ecc71'
                          }} 
                        />
                      </Box>
                      <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, pl: 3.5 }}>
                        {criteria.description}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>

            </Box>
          </>
        )}
      </Box>

    </Box>
  );
};
