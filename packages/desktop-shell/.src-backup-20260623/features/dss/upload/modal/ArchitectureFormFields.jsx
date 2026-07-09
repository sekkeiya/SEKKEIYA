import React from 'react';
import { TextField, MenuItem, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { furnitureFormStyles } from '@desktop/shared/styles/RightSidebar/Edit/FurnitureFormFieldsEditStyles';

const ArchitectureFormFields = ({
    title, setTitle,
  subType, setSubType,
  mainCategory, setMainCategory,
  subCategory, setSubCategory,
  detailCategory, setDetailCategory,
  categoryOptionsArchitecture,
  categoryOptionsArchitectureParts,
  categoryOptionsArchitectureOutside,
}) => {
  return (
    <>

      {/* サブタイプ */}
      <RadioGroup
        row
        value={subType}
        onChange={(e) => setSubType(e.target.value)}
        sx={furnitureFormStyles.radioGroup}
        >
        <FormControlLabel value="パーツ" control={<Radio size='small' />} label="パーツ" />
        <FormControlLabel value="全体" control={<Radio size='small' />} label="全体" />
        <FormControlLabel value="外構" control={<Radio size='small' />} label="外構" />
      </RadioGroup>

      {/* パーツ */}
      {subType === 'パーツ' && (
          <>
            {/* タイトル */}
            <TextField
                fullWidth
                label="タイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={furnitureFormStyles.textField}
            />

            {/* カテゴリ */}
            <TextField
                select
                fullWidth
                label="建築カテゴリ"
                value={mainCategory}
                onChange={(e) => {
                    setMainCategory(e.target.value);
                    setSubCategory('');
                    setDetailCategory('');
                }}
                sx={furnitureFormStyles.textField}
                >
                {Object.keys(categoryOptionsArchitectureParts).map(cat => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
            </TextField>

            {/* サブカテゴリ */}
            {mainCategory && categoryOptionsArchitectureParts[mainCategory]?.sub && (
                <TextField
                select
                fullWidth
                label="サブカテゴリ"
                value={subCategory}
                onChange={(e) => {
                    setSubCategory(e.target.value);
                    setDetailCategory('');
                }}
                sx={furnitureFormStyles.textField}
                >
                {Object.keys(categoryOptionsArchitectureParts[mainCategory].sub).map(sub => (
                    <MenuItem key={sub} value={sub}>{sub}</MenuItem>
                ))}
                </TextField>
            )}

            {/* 詳細カテゴリ */}
            {subCategory && categoryOptionsArchitectureParts[mainCategory]?.sub?.[subCategory] && (
                <TextField
                select
                fullWidth
                label="詳細分類"
                value={detailCategory}
                onChange={(e) => setDetailCategory(e.target.value)}
                sx={furnitureFormStyles.textField}
                >
                {categoryOptionsArchitectureParts[mainCategory].sub[subCategory].map(detail => (
                    <MenuItem key={detail} value={detail}>{detail}</MenuItem>
                ))}
                </TextField>
            )}
            </>
        )}

      {/* 全体 */}
      {subType === '全体' && (
        <>
            {/* タイトル */}
            <TextField
                fullWidth
                label="タイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={furnitureFormStyles.textField}
            />

            {/* カテゴリ */}
            <TextField
                select
                fullWidth
                label="建築カテゴリ"
                value={mainCategory}
                onChange={(e) => {
                setMainCategory(e.target.value);
                setSubCategory('');
                setDetailCategory('');
                }}
                sx={furnitureFormStyles.textField}
            >
                {Object.keys(categoryOptionsArchitecture).map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
            </TextField>
            
            {/* サブカテゴリ */}
            {mainCategory && categoryOptionsArchitecture[mainCategory]?.sub && (
                <TextField
                select
                fullWidth
                label="サブカテゴリ"
                value={subCategory}
                onChange={(e) => {
                    setSubCategory(e.target.value);
                    setDetailCategory('');
                }}
                sx={furnitureFormStyles.textField}
                >
                {Object.keys(categoryOptionsArchitecture[mainCategory].sub).map(sub => (
                    <MenuItem key={sub} value={sub}>{sub}</MenuItem>
                ))}
                </TextField>
            )}

            {/* 詳細カテゴリ */}
            {subCategory && categoryOptionsArchitecture[mainCategory]?.sub?.[subCategory] && (
                <TextField
                select
                fullWidth
                label="詳細分類"
                value={detailCategory}
                onChange={(e) => setDetailCategory(e.target.value)}
                sx={furnitureFormStyles.textField}
                >
                {categoryOptionsArchitecture[mainCategory].sub[subCategory].map(detail => (
                    <MenuItem key={detail} value={detail}>{detail}</MenuItem>
                ))}
                </TextField>
            )}
            </>
        )}

        {/* 外構 */}
        {subType === '外構' && (
            <>
            {/* タイトル */}
            <TextField
                fullWidth
                label="タイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                sx={furnitureFormStyles.textField}
            />

            {/* カテゴリ */}
            <TextField
                select
                fullWidth
                label="建築カテゴリ"
                value={mainCategory}
                onChange={(e) => {
                setMainCategory(e.target.value);
                setSubCategory('');
                setDetailCategory('');
                }}
                sx={furnitureFormStyles.textField}
            >
                {Object.keys(categoryOptionsArchitectureOutside).map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
            </TextField>

            {/* サブカテゴリ */}
            {mainCategory && categoryOptionsArchitectureOutside[mainCategory]?.sub && (
                <TextField
                select
                fullWidth
                label="サブカテゴリ"
                value={subCategory}
                onChange={(e) => {
                    setSubCategory(e.target.value);
                    setDetailCategory('');
                }}
                sx={furnitureFormStyles.textField}
                >
                {Object.keys(categoryOptionsArchitectureOutside[mainCategory].sub).map(sub => (
                    <MenuItem key={sub} value={sub}>{sub}</MenuItem>
                ))}
                </TextField>
            )}

            {/* 詳細カテゴリ */}
            {subCategory && categoryOptionsArchitectureOutside[mainCategory]?.sub?.[subCategory] && (
                <TextField
                select
                fullWidth
                label="詳細分類"
                value={detailCategory}
                onChange={(e) => setDetailCategory(e.target.value)}
                sx={furnitureFormStyles.textField}
                >
                {categoryOptionsArchitectureOutside[mainCategory].sub[subCategory].map(detail => (
                    <MenuItem key={detail} value={detail}>{detail}</MenuItem>
                ))}
                </TextField>
            )}
            </>
        )}
    </>
  );
};

export default ArchitectureFormFields;
