import React, { useState } from 'react';
import { Box, Typography, Divider, Button, Switch, TextField, Select, MenuItem, IconButton, Chip, Tabs, Tab } from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useUserSettingsStore, DEFAULT_CATEGORY_MAP, MACRO_CATEGORY_ORDER } from '../../../store/useUserSettingsStore';

export const DssSettingsPanel = () => {
  const { 
    hiddenSystemDetailedCategories, 
    customCategories, 
    customTags, 
    toggleSystemCategoryVisibility, 
    addCustomCategory, 
    removeCustomCategory,
    addCustomTag,
    removeCustomTag,
    customOptions,
    addCustomOption,
    removeCustomOption
  } = useUserSettingsStore();

  const [newOptionsInput, setNewOptionsInput] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState(0);

  const [newCustomCatName, setNewCustomCatName] = useState('');
  const [newCustomCatBaseMain, setNewCustomCatBaseMain] = useState('家具');
  const [newCustomCatBaseSub, setNewCustomCatBaseSub] = useState('ソファ');

  const [newTag, setNewTag] = useState('');

  const handleAddCustomCategory = () => {
    if (!newCustomCatName.trim()) return;
    addCustomCategory({
      name: newCustomCatName.trim(),
      baseMainCategory: newCustomCatBaseMain,
      baseSubCategory: newCustomCatBaseSub
    });
    setNewCustomCatName('');
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    addCustomTag(newTag.trim());
    setNewTag('');
  };

  const handleAddOption = (field: any) => {
    const val = newOptionsInput[field];
    if (!val || !val.trim()) return;
    addCustomOption(field, val.trim());
    setNewOptionsInput({ ...newOptionsInput, [field]: '' });
  };

  const optionsConfig = [
    { key: 'materials', label: 'MATERIALS (マテリアルの管理)', color: '#fca5a5' },
    { key: 'buildingTypes', label: 'BUILDING TYPES (建物タイプの管理)', color: '#6ee7b7' },
    { key: 'rooms', label: 'ROOMS (部屋タイプの管理)', color: '#93c5fd' },
    { key: 'zones', label: 'ZONES (ゾーンの管理)', color: '#fcd34d' },
    { key: 'companionClasses', label: 'COMPANION CLASSES (セット家具タグの管理)', color: '#c4b5fd' }
  ];

  const spatialKeys = ['buildingTypes', 'rooms', 'zones'];
  const assetKeys = ['materials', 'companionClasses'];

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ p: 4, pb: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>S.Models Settings</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
          S.Modelsでのモデル登録や検索、およびSEKKEIYA全体で使用する共通リストやカテゴリの設定を行います。
        </Typography>

        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)} 
          sx={{ 
            minHeight: 36,
            mb: 2,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', minHeight: 40, py: 1, px: 3, textTransform: 'none', fontSize: 13, fontWeight: 600 },
            '& .Mui-selected': { color: '#fff !important' },
            '& .MuiTabs-indicator': { backgroundColor: '#4fc3f7' }
          }}
        >
          <Tab label="カテゴリ (Categories)" />
          <Tab label="アセット特性 (Tags & Materials)" />
          <Tab label="空間コンテキスト (Space Contexts)" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, p: 4, pt: 2, overflowY: 'auto' }}>
        {activeTab === 0 && (
          <>
            <Box sx={{ mb: 6 }}>

              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 16, color: '#4fc3f7' }}>
                システムカテゴリの表示設定
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
                使用しないデフォルトのカテゴリを非表示（Hide）にできます。
              </Typography>

              {MACRO_CATEGORY_ORDER.filter(c => Object.keys(DEFAULT_CATEGORY_MAP).includes(c)).map((mainCat) => {
                const subObj = DEFAULT_CATEGORY_MAP[mainCat as keyof typeof DEFAULT_CATEGORY_MAP];
                return (
                <Box key={mainCat} sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.02)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ fontWeight: 700, mb: 2, color: '#fff' }}>{mainCat}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
                    {Object.entries(subObj).map(([subCat, details]) => (
                      <Box key={subCat} sx={{ bgcolor: 'rgba(0,0,0,0.2)', p: 1.5, borderRadius: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 1, color: 'rgba(255,255,255,0.8)' }}>{subCat}</Typography>
                        {details.map(detail => {
                          const key = `${mainCat}::${subCat}::${detail}`;
                          const isHidden = hiddenSystemDetailedCategories.includes(key);
                          return (
                            <Box key={detail} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.03)', '&:last-child': { borderBottom: 'none' } }}>
                              <Typography sx={{ fontSize: 12, color: isHidden ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.9)', textDecoration: isHidden ? 'line-through' : 'none' }}>
                                {detail}
                              </Typography>
                              <Switch 
                                size="small" 
                                checked={!isHidden} 
                                onChange={() => toggleSystemCategoryVisibility(mainCat, subCat, detail)}
                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4fc3f7' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4fc3f7' } }}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>
              ); })}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 6 }} />

            <Box sx={{ mb: 6 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 16, color: '#facc15' }}>
                独自カテゴリの追加
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
                独自のカテゴリを追加できます。裏側のデータとしてはSEKKEIYAの基本カテゴリに紐付けられ、他のユーザーの環境でも検索可能になります。
              </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>ベース システムカテゴリ</Typography>
            <Select 
              size="small" 
              fullWidth 
              value={newCustomCatBaseMain} 
              onChange={(e) => {
                setNewCustomCatBaseMain(e.target.value);
                setNewCustomCatBaseSub(Object.keys(DEFAULT_CATEGORY_MAP[e.target.value as keyof typeof DEFAULT_CATEGORY_MAP] || {})[0] || '');
              }}
              sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
              MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1f2b', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.1)' } } }}
            >
              {['建築・空間', '設備・備品', '家具 (既製品)', '家具 (造作)', 'インテリア小物', 'グリーン'].filter(c => Object.keys(DEFAULT_CATEGORY_MAP).includes(c)).map(cat => (
                <MenuItem key={cat} value={cat} sx={{ fontSize: 13 }}>{cat}</MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>ベース サブカテゴリ</Typography>
            <Select 
              size="small" 
              fullWidth 
              value={newCustomCatBaseSub} 
              onChange={(e) => setNewCustomCatBaseSub(e.target.value)}
              sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
              MenuProps={{ PaperProps: { sx: { bgcolor: '#1a1f2b', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.1)' } } }}
            >
              {Object.keys(DEFAULT_CATEGORY_MAP[newCustomCatBaseMain as keyof typeof DEFAULT_CATEGORY_MAP] || {}).map(sub => (
                <MenuItem key={sub} value={sub} sx={{ fontSize: 13 }}>{sub}</MenuItem>
              ))}
            </Select>
          </Box>
                <Box sx={{ flex: 2 }}>
                  <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mb: 0.5 }}>独自カテゴリ名</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField 
                      size="small" 
                      fullWidth 
                      placeholder="例: 北欧風ソファ" 
                      value={newCustomCatName}
                      onChange={(e) => setNewCustomCatName(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } } }}
                    />
                    <Button 
                      variant="contained" 
                      onClick={handleAddCustomCategory}
                      disabled={!newCustomCatName.trim() || !newCustomCatBaseSub}
                      sx={{ bgcolor: '#facc15', color: '#000', '&:hover': { bgcolor: '#eab308' }, minWidth: 80 }}
                    >
                      追加
                    </Button>
                  </Box>
                </Box>
              </Box>

              {customCategories.length > 0 && (
                <Box sx={{ bgcolor: 'rgba(0,0,0,0.2)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 2, color: 'rgba(255,255,255,0.8)' }}>登録済みの独自カテゴリ</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {customCategories.map(cat => (
                      <Box key={cat.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.03)', p: 1, px: 2, borderRadius: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{cat.name}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>ベース: {cat.baseMainCategory} &gt; {cat.baseSubCategory}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => removeCustomCategory(cat.id)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ff4d4f' } }}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </>
        )}

        {activeTab === 1 && (
          <>
            <Box sx={{ mb: 6 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 16, color: '#a78bfa' }}>
                よく使うタグの管理
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                <TextField 
                  size="small" 
                  placeholder="新規タグを追加..." 
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  sx={{ width: 240, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } } }}
                />
                <IconButton onClick={handleAddTag} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#a78bfa', '&:hover': { bgcolor: 'rgba(167, 139, 250, 0.1)' } }}>
                  <AddRoundedIcon />
                </IconButton>
              </Box>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {customTags.map(tag => (
                  <Chip 
                    key={tag} 
                    label={tag} 
                    onDelete={() => removeCustomTag(tag)}
                    sx={{ bgcolor: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', '& .MuiChip-deleteIcon': { color: 'rgba(167, 139, 250, 0.5)', '&:hover': { color: '#a78bfa' } } }} 
                  />
                ))}
                {customTags.length === 0 && (
                  <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>登録されたタグはありません</Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 6 }} />

            <Box sx={{ mb: 6 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: 16, color: '#f472b6' }}>
                アセットプロパティ管理
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
                マテリアルやセット家具ラベルなど、オブジェクトそのものに紐づく特性リストを追加管理します。
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 4 }}>
                {optionsConfig.filter(o => assetKeys.includes(o.key)).map(({ key, label, color }) => (
                  <Box key={key} sx={{ bgcolor: 'rgba(255,255,255,0.02)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography sx={{ fontWeight: 600, mb: 2, color: color, fontSize: 14 }}>{label}</Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <TextField 
                        size="small" 
                        placeholder="追加する項目..." 
                        value={newOptionsInput[key] || ''}
                        onChange={(e) => setNewOptionsInput({ ...newOptionsInput, [key]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddOption(key)}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } } }}
                      />
                      <IconButton onClick={() => handleAddOption(key)} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: color, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                        <AddRoundedIcon />
                      </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {(customOptions[key as keyof typeof customOptions] || []).map(item => (
                        <Chip 
                          key={item} 
                          label={item} 
                          onDelete={() => removeCustomOption(key as any, item)}
                          sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ff4d4f' } } }} 
                        />
                      ))}
                      {(customOptions[key as keyof typeof customOptions] || []).length === 0 && (
                        <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>追加された項目はありません</Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}

        {activeTab === 2 && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, fontSize: 16, color: '#fcd34d' }}>
              空間情報の共通マスターデータ
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
              ここで設定した部屋や建物タイプのリストは、S.Modelsのモデル分類だけでなく、SEKKEIYAのプロジェクト管理やS.Layoutのレイアウト構成などエコシステム全体で共通して使用されます。
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 4 }}>
              {optionsConfig.filter(o => spatialKeys.includes(o.key)).map(({ key, label, color }) => (
                <Box key={key} sx={{ bgcolor: 'rgba(255,255,255,0.02)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography sx={{ fontWeight: 600, mb: 2, color: color, fontSize: 14 }}>{label}</Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField 
                      size="small" 
                      placeholder="追加する項目..." 
                      value={newOptionsInput[key] || ''}
                      onChange={(e) => setNewOptionsInput({ ...newOptionsInput, [key]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOption(key)}
                      sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' } } }}
                    />
                    <IconButton onClick={() => handleAddOption(key)} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: color, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                      <AddRoundedIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {(customOptions[key as keyof typeof customOptions] || []).map(item => (
                      <Chip 
                        key={item} 
                        label={item} 
                        onDelete={() => removeCustomOption(key as any, item)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#fff', '& .MuiChip-deleteIcon': { color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ff4d4f' } } }} 
                      />
                    ))}
                    {(customOptions[key as keyof typeof customOptions] || []).length === 0 && (
                      <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>追加された項目はありません</Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};
