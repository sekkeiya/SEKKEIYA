// src/features/Dashboard/UploadModal/FurnitureFormFields.jsx
import React, { useMemo } from "react";
import {
  TextField, MenuItem, RadioGroup, FormControlLabel, Radio,
  Grid, Autocomplete, Chip, Stack, Box, Button, IconButton,
  InputAdornment, Tooltip, Divider, Avatar
} from "@mui/material";
import { furnitureFormStyles } from "@desktop/shared/styles/RightSidebar/Edit/FurnitureFormFieldsEditStyles";
import { useDebouncedInput } from "@desktop/shared/hooks/useDebouncedInput";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { COLOR_OPTIONS } from "@desktop/shared/constants/Colors"; // ★ 追加

/** タイトル専用（ここだけ再レンダー） */
const TitleField = React.memo(function TitleField({ title, onCommit }) {
  // 1秒入力が止まったらだけ onCommit を呼ぶ（trailing-only）
  const { local, onChange, onCompositionStart, onCompositionEnd, onBlur } =
    useDebouncedInput(title ?? "", onCommit, { delay: 350, flushOnBlur: true });

  return (
    <TextField
      fullWidth
      label="タイトル"
      value={local}
      onChange={onChange}
      onBlur={onBlur}
      sx={furnitureFormStyles.textField}
      inputProps={{
        onCompositionStart,
        onCompositionEnd,
        maxLength: 120,
        autoComplete: "off",
        inputMode: "text",
      }}
    />
  );
});

/** ブランド選択も分離して軽量化（任意だが効果大） */
const BrandSelector = React.memo(function BrandSelector({ brands, setBrands, brandOptions }) {
  return (
    <Autocomplete
      multiple
      freeSolo={false}
      options={brandOptions}
      value={brands}
      onChange={(event, newValue) => setBrands(newValue)}
      filterSelectedOptions
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            key={`${option}-${index}`}
            label={option}
            {...getTagProps({ index })}
            sx={furnitureFormStyles.chip}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="ブランドを検索・選択"
          placeholder="例: IKEA, 無印良品..."
          sx={furnitureFormStyles.textField}
        />
      )}
    />
  );
});


/** カラー選択 (新機能) */
const ColorSelector = React.memo(function ColorSelector({ colors = [], setColors }) {
  const valueObjects = useMemo(() => {
    return colors.map(id => COLOR_OPTIONS.find(o => o.id === id) || { id, label: id });
  }, [colors]);

  return (
    <Autocomplete
      multiple
      options={COLOR_OPTIONS}
      getOptionLabel={(option) => option.label}
      value={valueObjects}
      onChange={(event, newValue) => setColors(newValue.map(v => v.id || v))}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip
            key={`${option.id}-${index}`}
            label={option.label}
            {...getTagProps({ index })}
            sx={{ ...furnitureFormStyles.chip, backgroundColor: 'rgba(255,255,255,0.1)' }}
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="主要カラー（色）"
          placeholder="色を選択..."
          sx={furnitureFormStyles.textField}
        />
      )}
    />
  );
});

/** 類似商品エディタ（色は既存に合わせ、崩れだけ対策） */
const SimilarProductsEditor = React.memo(function SimilarProductsEditor({
  items = [],
  onChange = () => {},
  max = 5,
}) {
  // レイアウト崩れ防止（flex子の既定 min-width:auto を 0 に）
  const tfSx = { minWidth: 0 };

  const addItem = () => {
    if ((items?.length ?? 0) >= max) return;
    const id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    onChange([
      ...(items || []),
      {
        id,
        name: "",
        url: "",
        brand: "",
        price: "",
        priceCurrency: "JPY",
        image: "",
        size: { width: "", depth: "", height: "", sh: "" },
      },
    ]);
  };

  const updateItem = (id, patch) => {
    const next = (items || []).map((it) => (it.id === id ? { ...it, ...patch } : it));
    onChange(next);
  };

  const updateSize = (id, dim, val) => {
    const next = (items || []).map((it) =>
      it.id === id ? { ...it, size: { ...(it.size || {}), [dim]: val } } : it
    );
    onChange(next);
  };

  const removeItem = (id) => onChange((items || []).filter((it) => it.id !== id));

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1.25,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 1.5,
        background: "rgba(255,255,255,0.04)",
        position: 'relative',
      }}
    >
      {/* 見出し行（Gridで幅管理） */}
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Grid item sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LinkRoundedIcon fontSize="small" />
            <Box component="span" sx={{ fontWeight: 700 }}>
              実在する類似商品リンク（任意）
            </Box>
          </Stack>
        </Grid>
        <Grid item>
          <Button
            onClick={addItem}
            startIcon={<AddRoundedIcon />}
            disabled={(items?.length ?? 0) >= max}
            size="small"
            variant="outlined"
          >
            追加
          </Button>
        </Grid>
      </Grid>

      {(!items || items.length === 0) && (
        <Box sx={{ opacity: 0.9, fontSize: 13, mb: 0.5 }}>
          必須ではありません。メーカー公式やECの商品ページを登録できます。<br/>
          <b>名前</b>と<b>URL</b>は必須、<b>寸法</b>・<b>価格</b>・<b>画像URL</b>は任意です。
        </Box>
      )}

      <Stack spacing={1.25}>
        {(items || []).map((it, idx) => {
          const w = it.size?.width ?? "";
          const d = it.size?.depth ?? "";
          const h = it.size?.height ?? "";
          const sh = it.size?.sh ?? "";
          const imageUrl = (it.image || "").trim();

          return (
            <Box
              key={it.id}
              sx={{
                p: 1,
                borderRadius: 1.25,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              {/* 1行目：アバター / 商品名 / ブランド / 削除 */}
              <Stack direction="row" alignItems="center" spacing={1} mb={1} sx={{ minWidth: 0 }}>
                <Avatar
                  variant="rounded"
                  src={imageUrl || undefined}
                  alt={it.name || `similar-${idx}`}
                  sx={{ width: 40, height: 40, flex: '0 0 auto' }}
                >
                  <ImageRoundedIcon fontSize="small" />
                </Avatar>

                <TextField
                  size="small"
                  label="商品名 *"
                  value={it.name}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                  sx={{ flex: 1, mr: 1, ...tfSx }}
                />

                <TextField
                  size="small"
                  label="ブランド（任意）"
                  value={it.brand || ""}
                  onChange={(e) => updateItem(it.id, { brand: e.target.value })}
                  sx={{ width: { xs: 160, sm: 180 }, ...tfSx }}
                />

                <IconButton
                  onClick={() => removeItem(it.id)}
                  size="small"
                  sx={{ ml: 0.5 }}
                  aria-label="remove similar product"
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>

              {/* 2行目以降 */}
              <Grid container spacing={1.25}>
                <Grid item xs={12} md={7} sx={{ minWidth: 0 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="商品ページURL *"
                    value={it.url}
                    onChange={(e) => updateItem(it.id, { url: e.target.value })}
                    placeholder="https://example.com/product/..."
                    sx={{ mb: 1, ...tfSx }}
                  />

                  <TextField
                    fullWidth
                    size="small"
                    label="サムネ画像URL（任意）"
                    value={it.image || ""}
                    onChange={(e) => updateItem(it.id, { image: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    sx={{ ...tfSx }}
                  />
                </Grid>

                <Grid item xs={12} md={5} sx={{ minWidth: 0 }}>
                  <Grid container spacing={1}>
                    {/* 寸法（mm） */}
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="W (mm)"
                        value={w}
                        onChange={(e) => updateSize(it.id, "width", e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={tfSx}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="D (mm)"
                        value={d}
                        onChange={(e) => updateSize(it.id, "depth", e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={tfSx}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="H (mm)"
                        value={h}
                        onChange={(e) => updateSize(it.id, "height", e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={tfSx}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="SH (mm)"
                        value={sh}
                        onChange={(e) => updateSize(it.id, "sh", e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={tfSx}
                      />
                    </Grid>

                    {/* 価格 */}
                    <Grid item xs={8}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="価格"
                        value={it.price ?? ""}
                        onChange={(e) => updateItem(it.id, { price: e.target.value })}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                          inputProps: { min: 0 },
                        }}
                        sx={tfSx}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="通貨"
                        value={it.priceCurrency || "JPY"}
                        onChange={(e) => updateItem(it.id, { priceCurrency: e.target.value })}
                        sx={tfSx}
                      >
                        <MenuItem value="JPY">JPY</MenuItem>
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                      </TextField>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          );
        })}
      </Stack>

      {items?.length > 0 && (
        <Box sx={{ mt: 1, fontSize: 12 }}>
          * 必須: 商品名・URL。外部リンクには <code>https://</code> を入力してください。
        </Box>
      )}
    </Box>
  );
});


const FurnitureFormFields = React.memo((props) => {
  const {
    subType = "",
    setSubType = () => {},
    mainCategory = "",
    setMainCategory = () => {},
    subCategory = "",
    setSubCategory = () => {},
    detailCategory = "",
    setDetailCategory = () => {},
    size = { width: "", depth: "", height: "", sh: "" },
    setSize = () => {},
    price = "",
    setPrice = () => {},
    brands = [],
    setBrands = () => {},
    categoryOptions = {},
    brandOptions = [],
    title = "",
    /** ここは「タイトル確定のコミット関数」を渡してください（中でFirestore保存をやる） */
    setTitle = () => {},
    /** ▼ 追加：類似商品（任意） */
    similarProducts = [],
    setSimilarProducts = () => {},
    /** ▼ 追加：Colors（任意） */
    colors = [],
    setColors = () => {},
  } = props;

  const mainCats = useMemo(() => Object.keys(categoryOptions || {}), [categoryOptions]);
  const subCats = useMemo(
    () =>
      mainCategory && categoryOptions?.[mainCategory]?.sub
        ? Object.keys(categoryOptions[mainCategory].sub)
        : [],
    [categoryOptions, mainCategory]
  );
  const details = useMemo(
    () =>
      (subCategory && categoryOptions?.[mainCategory]?.sub?.[subCategory]) || [],
    [categoryOptions, mainCategory, subCategory]
  );
  const sizeDims = useMemo(
    () => [
      "width",
      "depth",
      "height",
      ...((mainCategory === "椅子" || mainCategory === "ソファ") ? ["sh"] : []),
    ],
    [mainCategory]
  );

  return (
    <>
      {/* サブタイプ */}
      <RadioGroup
        row
        value={subType}
        onChange={(e) => setSubType(e.target.value)}
        sx={furnitureFormStyles.radioGroup}
      >
        <FormControlLabel value="既製品家具" control={<Radio size="small" />} label="既製品家具" />
        <FormControlLabel value="造作家具" control={<Radio size="small" />} label="造作家具" />
      </RadioGroup>

      {/* タイトル：1秒アイドルでコミット */}
      <TitleField title={title} onCommit={setTitle} />

      {/* カテゴリ */}
      <TextField
        select
        fullWidth
        label="カテゴリ"
        value={mainCategory}
        onChange={(e) => {
          setMainCategory(e.target.value);
          setSubCategory("");
          setDetailCategory("");
        }}
        sx={furnitureFormStyles.textField}
      >
        {mainCats.map((cat) => (
          <MenuItem key={cat} value={cat}>{cat}</MenuItem>
        ))}
      </TextField>

      {/* サブカテゴリ */}
      {mainCategory && subCats.length > 0 && (
        <TextField
          select
          fullWidth
          label="サブカテゴリ"
          value={subCategory}
          onChange={(e) => {
            setSubCategory(e.target.value);
            setDetailCategory("");
          }}
          sx={furnitureFormStyles.textField}
        >
          {subCats.map((sub) => (
            <MenuItem key={sub} value={sub}>{sub}</MenuItem>
          ))}
        </TextField>
      )}

      {/* 詳細分類 */}
      {subCategory && details.length > 0 && (
        <TextField
          select
          fullWidth
          label="詳細分類"
          value={detailCategory}
          onChange={(e) => setDetailCategory(e.target.value)}
          sx={furnitureFormStyles.textField}
        >
          {details.map((detail) => (
            <MenuItem key={detail} value={detail}>{detail}</MenuItem>
          ))}
        </TextField>
      )}

      {/* サイズ（このモデル自体の寸法） */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {sizeDims.map((dim) => (
          <Grid item xs={6} key={dim}>
            <TextField
              fullWidth
              type="number"
              label={dim.toUpperCase() + " (mm)"}
              value={size?.[dim] ?? ""}
              onChange={(e) => setSize((prev) => ({ ...prev, [dim]: e.target.value }))}
              sx={furnitureFormStyles.sizeTextField}
              inputProps={{ min: 0 }}
            />
          </Grid>
        ))}
      </Grid>

      {/* 価格（このモデルの参考価格など） */}
      <TextField
        fullWidth
        type="number"
        label="価格 (円)"
        value={price ?? ""}
        onChange={(e) => setPrice(e.target.value)}
        sx={furnitureFormStyles.priceTextField}
        inputProps={{ min: 0 }}
        InputProps={{
          startAdornment: <InputAdornment position="start">¥</InputAdornment>,
        }}
      />

      {/* ブランド（分離） */}
      <BrandSelector brands={brands} setBrands={setBrands} brandOptions={brandOptions} />

      {/* カラー（分離） */}
      <Box sx={{ mt: 1.5 }}>
        <ColorSelector colors={colors} setColors={setColors} />
      </Box>

      {/* 実在する類似商品リンク（任意） */}
      <SimilarProductsEditor
        items={similarProducts}
        onChange={setSimilarProducts}
        max={5}
      />
    </>
  );
});

export default FurnitureFormFields;
