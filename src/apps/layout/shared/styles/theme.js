import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        mode: "dark",
        background: {
            default: "#0b1020",
            paper: "#0f1630",
        },
    },
    shape: { borderRadius: 14 },
    typography: {
        fontFamily: ["Inter", "system-ui", "Segoe UI", "sans-serif"].join(","),
    },
});
