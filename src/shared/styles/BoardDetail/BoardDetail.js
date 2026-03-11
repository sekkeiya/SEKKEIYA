export const boardDetailStyles = {
    container: {
        color: "#e2e8f0",
        pt: 2,
        pb: 6,
    },

    section: {
        mb: 2,
        px: 1,
    },

    title: {
        mt: 2,
        fontWeight: 600,
        fontSize: "1.05rem", // 小さめで一画面に情報を収めやすく
        color: "#f8fafc",
    },

    subTitle: {
        mb: 1.5,
        fontWeight: 500,
        fontSize: "0.75rem",
        color: "#94a3b8",
    },

    chip: {
        backgroundColor: "#334155",
        color: "#f1f5f9",
        fontSize: "0.675rem",
        height: "22px",
        borderRadius: "4px",
        px: 0.75,
    },

    divider: {
        mt: 1,
        mb: 1.5,
        borderColor: "rgba(148, 163, 184, 0.15)",
    },

    textField: {
        mb: 1.2,
        bgcolor: "#1f2937", // dark neutral
        borderRadius: "6px",
        minWidth: "200px",
        "& .MuiInputBase-root": {
            color: "#e2e8f0",
            fontSize: "0.775rem",
            height: "36px",
        },
        "& .MuiInputLabel-root": {
            color: "#64748b",
            fontSize: "0.675rem",
        },
        "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#3b4252",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#64748b",
        },
        "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#38bdf8",
        },
    },

    saveButton: {
        mt: 1,
        px: 3,
        py: 1,
        fontWeight: 600,
        fontSize: "0.775rem",
        backgroundColor: "#38bdf8",
        color: "#0f172a",
        textTransform: "none",
        borderRadius: "6px",
        "&:hover": {
            backgroundColor: "#0ea5e9",
        },
    },

    card: {
        bgcolor: "rgba(13, 31, 26, 0.1)",
        borderRadius: "12px",
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.3)",
        p: 2,
        mb: 3,
        border: "1px solid rgba(255,255,255,0.06)", // かなり控えめ（透明感）
    }
};
