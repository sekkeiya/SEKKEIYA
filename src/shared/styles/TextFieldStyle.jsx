// components/common/TextFieldStyle.jsx

const textFieldStyle = {
  mt: 2,
  input: { color: "#fff" },
  label: { color: "#bbb" },
  '& .MuiOutlinedInput-root': {
    color: "#fff",
    '& fieldset': { borderColor: "#555" },
    '&:hover fieldset': { borderColor: "#888" },
    '&.Mui-focused fieldset': { borderColor: "#1e90ff" },
  },
  '& .MuiInputLabel-root': {
    color: "#bbb",
  },
  '& .MuiAutocomplete-inputRoot': {
    color: '#fff',
  },
  '& .MuiChip-root': {
    color: '#fff',
    backgroundColor: '#444',
  },
};

export default textFieldStyle;
