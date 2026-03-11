import {
    TextField,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
} from "@mui/material";
import { boardDetailStyles } from "@/shared/styles/BoardDetail/BoardDetail";

/**
 * MUI Select ラッパー（単一・複数選択対応）
 */
export const renderSelect = ({
  label,
  value,
  onChange,
  options,
  multiple = false,
  id,
  sx = {}, // ← 任意で上書き可能にする
}) => {
  const normalizedOptions = options.map(String);
  const normalizedValue = multiple
    ? Array.isArray(value) ? value.map(String) : []
    : value != null ? String(value) : "";

  const isValid = multiple
    ? Array.isArray(normalizedValue) && normalizedValue.every(v => normalizedOptions.includes(v))
    : normalizedOptions.includes(normalizedValue);

  return (
    <FormControl fullWidth sx={{ ...boardDetailStyles.textField, ...sx }}>
      <InputLabel id={`${id}-label`} sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>
        {label}
      </InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        value={isValid ? normalizedValue : (multiple ? [] : "")}
        onChange={onChange}
        label={label}
        multiple={multiple}
        renderValue={multiple ? (selected) => selected.join(", ") : undefined}
        sx={{ fontSize: "0.775rem", color: "#e2e8f0" }}
      >
        {normalizedOptions.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {opt}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};




/**
 * テキストフィールドを共通レンダリング
 */
export const renderTextField = (
  label,
  value,
  onChange,
  props = {},
  sx = {}
) => (
  <TextField
    label={label}
    value={value}
    onChange={onChange}
    fullWidth
    sx={{ ...boardDetailStyles.textField, ...sx }}
    InputLabelProps={{
      shrink: true,
      sx: { fontSize: "0.7rem", color: "#94a3b8" },
    }}
    inputProps={{
      style: { fontSize: "0.775rem", color: "#e2e8f0" },
    }}
    {...props}
  />
);