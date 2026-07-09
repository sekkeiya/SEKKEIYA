import React, { useState } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemButton, Chip, Button, IconButton, Avatar } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import { BRAND } from '../../../styles/theme';

export const AiStudioTraining: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<string | null>('item_1');

  // Mock data for evaluation items
  const evaluationItems = [
    { id: 'item_1', name: '空間の安全性', weight: 40, ruleCount: 5 },
    { id: 'item_2', name: '動線の快適さ', weight: 35, ruleCount: 3 },
    { id: 'item_3', name: 'デザインの一貫性', weight: 25, ruleCount: 2 },
  ];

  // Mock data for rules
  const rules = [
    { id: 'rule_1', title: 'メイン通路の幅', condition: '>= 1200mm', points: -10, description: 'メイン通路は車椅子でもすれ違えるよう1200mm以上を確保すること' },
    { id: 'rule_2', title: '扉前のクリアランス', condition: '>= 800mm', points: -5, description: '扉の開閉時に人が待機できるスペースを確保すること' },
  ];

  const activeItem = evaluationItems.find(i => i.id === selectedItem);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* Left Column: Evaluation Items list */}
      <Box sx={{ 
        width: 320, 
        bgcolor: BRAND.panel, 
        borderRight: `1px solid ${BRAND.line}`, 
        display: 'flex', 
        flexDirection: 'column'
      }}>
        <Box sx={{ p: 2, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700 }}>評価項目 (カテゴリ)</Typography>
          <IconButton size="small" sx={{ color: 'light-dark(#095fa5, #90caf9)' }}>
            <AddRoundedIcon />
          </IconButton>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {evaluationItems.map(item => (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton 
                selected={item.id === selectedItem}
                onClick={() => setSelectedItem(item.id)}
                sx={{ 
                  borderRadius: 2,
                  bgcolor: item.id === selectedItem ? BRAND.panel2 : 'transparent',
                  '&.Mui-selected': { bgcolor: BRAND.panel2 }
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <Typography sx={{ color: 'var(--brand-fg)', fontSize: 14, fontWeight: 600, mb: 0.5 }}>{item.name}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Chip label={`重み: ${item.weight}%`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                    <Chip label={`${item.ruleCount} ルール`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: '#90caf920', color: 'light-dark(#095fa5, #90caf9)' }} />
                  </Box>
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Middle & Right Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'transparent' }}>
        
        {/* Item Header */}
        {activeItem ? (
           <Box sx={{ p: 3, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <Box>
               <Typography variant="h5" sx={{ color: 'var(--brand-fg)', fontWeight: 800, mb: 0.5 }}>
                 {activeItem.name}
               </Typography>
               <Typography sx={{ color: BRAND.sub, fontSize: 13 }}>
                 この評価項目は総合スコアの {activeItem.weight}% のウェイトを占めます。
               </Typography>
             </Box>
             <Button startIcon={<EditRoundedIcon />} size="small" variant="outlined" sx={{ color: 'light-dark(#095fa5, #90caf9)', borderColor: '#90caf940' }}>
               設定変更
             </Button>
           </Box>
        ) : (
           <Box sx={{ p: 3, borderBottom: `1px solid ${BRAND.line}` }}>
             <Typography sx={{ color: BRAND.sub }}>評価項目を選択してください</Typography>
           </Box>
        )}

        {/* Rules List */}
        <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
            <Box>
              <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 16 }}>定義されたルール</Typography>
              <Typography sx={{ color: BRAND.sub, fontSize: 13, mt: 0.5 }}>
                ナレッジベースから抽出、または手動で作成された採点基準
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddRoundedIcon />} sx={{ bgcolor: '#90caf9', color: '#000', fontWeight: 600, '&:hover': { bgcolor: '#e0e0e0' } }}>
              新規ルール作成
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rules.map(rule => (
              <Paper key={rule.id} sx={{ p: 2, bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <Avatar sx={{ bgcolor: 'rgba(243, 156, 18, 0.15)', color: '#f39c12' }}>
                    <RuleRoundedIcon />
                  </Avatar>
                  <Box>
                    <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, fontSize: 14 }}>{rule.title}</Typography>
                    <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 12 }}>{rule.description}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: BRAND.sub, fontSize: 11, textTransform: 'uppercase' }}>条件</Typography>
                    <Typography sx={{ color: 'light-dark(#095fa5, #90caf9)', fontWeight: 700, fontSize: 14 }}>{rule.condition}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: BRAND.sub, fontSize: 11, textTransform: 'uppercase' }}>ペナルティ</Typography>
                    <Typography sx={{ color: '#e74c3c', fontWeight: 700, fontSize: 14 }}>{rule.points} pt</Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>

      </Box>

    </Box>
  );
};
