import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { db } from '../../lib/firebase/client';
import { doc, setDoc } from 'firebase/firestore';
import { useUserSettingsStore } from '../../store/useUserSettingsStore';

export const SystemCategoryAdminPanel: React.FC = () => {
  const { systemCategories } = useUserSettingsStore();
  const [categories, setCategories] = useState<Record<string, Record<string, string[]>>>(systemCategories);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedMain, setExpandedMain] = useState<string | null>(null);

  useEffect(() => {
    // If the global store updates from Firestore, sync local state
    setCategories(systemCategories);
  }, [systemCategories]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'appGlobalConfig', 'systemCategories');
      await setDoc(docRef, { categories, updatedAt: new Date().toISOString() }, { merge: true });
      alert('システムカテゴリを更新しました。全ユーザーに自動で同期されます。');
    } catch (e) {
      console.error(e);
      alert('システムカテゴリの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const addMainCategory = () => {
    const name = window.prompt("新しい大カテゴリ(Main Category)名を入力してください:");
    if (name && !categories[name]) {
      setCategories({ ...categories, [name]: {} });
      setExpandedMain(name);
    }
  };

  const removeMainCategory = (main: string) => {
    if (!window.confirm(`大カテゴリ [${main}] を削除してもよろしいですか？`)) return;
    const nextLocal = { ...categories };
    delete nextLocal[main];
    setCategories(nextLocal);
  };

  const addSubCategory = (main: string) => {
    const name = window.prompt(`[${main}] に追加する中カテゴリ(Sub Category)名を入力してください:`);
    if (name && !categories[main][name]) {
      setCategories({
        ...categories,
        [main]: {
          ...categories[main],
          [name]: []
        }
      });
    }
  };

  const removeSubCategory = (main: string, sub: string) => {
    if (!window.confirm(`中カテゴリ [${sub}] を削除してもよろしいですか？`)) return;
    const nextLocal = { ...categories };
    const nextSub = { ...nextLocal[main] };
    delete nextSub[sub];
    nextLocal[main] = nextSub;
    setCategories(nextLocal);
  };

  const addDetailCategory = (main: string, sub: string) => {
    const name = window.prompt(`[${sub}] に追加する小カテゴリ(Detail Category)名を入力してください:`);
    if (name && !categories[main][sub].includes(name)) {
      setCategories({
        ...categories,
        [main]: {
          ...categories[main],
          [sub]: [...categories[main][sub], name]
        }
      });
    }
  };

  const removeDetailCategory = (main: string, sub: string, detail: string) => {
    if (!window.confirm(`小カテゴリ [${detail}] を削除してもよろしいですか？`)) return;
    setCategories({
      ...categories,
      [main]: {
        ...categories[main],
        [sub]: categories[main][sub].filter(d => d !== detail)
      }
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          ※これは管理者（sekkeiyanosagyoubeya@gmail.com）専用の画面です。<br />
          ここで変更を行うと、全てのユーザーのシステムカテゴリが同期されます。
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleSave} 
          disabled={isSaving}
          sx={{ minWidth: 120 }}
        >
          {isSaving ? <CircularProgress size={20} color="inherit" /> : 'Firestoreへ保存'}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.keys(categories).map(main => (
          <Box key={main} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: 'rgba(255,255,255,0.05)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' }
              }}
              onClick={() => setExpandedMain(expandedMain === main ? null : main)}
            >
              <Typography variant="subtitle1" fontWeight={700}>{main}</Typography>
              <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); removeMainCategory(main); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            
            {expandedMain === main && (
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Object.keys(categories[main]).map(sub => (
                  <Box key={sub} sx={{ pl: 2, borderLeft: '2px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ flex: 1, color: 'primary.light' }}>{sub}</Typography>
                      <IconButton size="small" onClick={(e) => { removeSubCategory(main, sub); }}>
                        <DeleteIcon fontSize="small" sx={{ color: 'rgba(255,255,255,0.3)' }} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, pl: 2 }}>
                      {categories[main][sub].map(detail => (
                        <Box key={detail} sx={{ display: 'flex', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, pl: 1 }}>
                          <Typography variant="caption">{detail}</Typography>
                          <IconButton size="small" onClick={() => removeDetailCategory(main, sub, detail)} sx={{ p: '2px', ml: 1 }}>
                            <DeleteIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
                          </IconButton>
                        </Box>
                      ))}
                      <Button 
                        size="small" 
                        startIcon={<AddIcon fontSize="small" />} 
                        onClick={() => addDetailCategory(main, sub)}
                        sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', minWidth: 0, textTransform: 'none' }}
                      >
                        小カテゴリ追加
                      </Button>
                    </Box>
                  </Box>
                ))}
                <Button 
                  startIcon={<AddIcon fontSize="small" />} 
                  onClick={() => addSubCategory(main)}
                  size="small"
                  sx={{ alignSelf: 'flex-start', ml: 2, mt: 1, color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}
                >
                  中カテゴリ（Sub Category）を追加
                </Button>
              </Box>
            )}
          </Box>
        ))}

        <Button 
          variant="outlined" 
          startIcon={<AddIcon />} 
          onClick={addMainCategory}
          sx={{ alignSelf: 'flex-start', mt: 2 }}
        >
          新しい大カテゴリ（Main Category）を追加
        </Button>
      </Box>
    </Box>
  );
};
