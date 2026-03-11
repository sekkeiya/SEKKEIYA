export const architectureFormStyles = {
    textField: {
        mt: 1.5,
        borderRadius: "6px",
        "& label": {
            color: "#94A3B8",
            fontSize: "0.8rem",
        },
        "& .MuiFilledInput-root": {
            backgroundColor: "rgba(0,0,0,0.2)",
            color: "#E2E8F0",
            fontSize: "0.85rem",
            borderRadius: "8px",
            minHeight: "44px",
            transition: "all 0.3s ease",
            "&:hover": {
                backgroundColor: "rgba(0,0,0,0.3)",
            },
            "&.Mui-focused": {
                backgroundColor: "rgba(0,0,0,0.4)",
            },
        },
        "& input": {
            color: "#E2E8F0",
            fontSize: "0.85rem",
            padding: "8px 12px",
        },
        "& .MuiFilledInput-underline:before": {
            borderBottom: "1px solid rgba(255,255,255,0.06) !important",
        },
        "& .MuiFilledInput-underline:after": {
            borderBottom: "2px solid #00BFFF !important",
        },
    },

    menuItem: {
        fontSize: "0.85rem",
        color: "#E2E8F0",
        "&:hover": {
            backgroundColor: "#334155",
        },
    },

    radioGroup: {
        display: "flex",
        gap: 2,
        mt: 1,
        mb: 1,
        "& .MuiFormControlLabel-label": {
            fontSize: "0.8rem",
            color: "#CBD5E1",
            fontWeight: 500,
        },
        "& .MuiRadio-root": {
            color: "rgba(255,255,255,0.2)",
            transition: "color 0.2s ease",
            "&:hover": {
                color: "rgba(255,255,255,0.4)",
            }
        },
        "& .Mui-checked": {
            color: "#00BFFF",
        },
    },

    typographyLabel: {
        color: "#94A3B8",
        fontSize: "0.85rem",
    },

    typographyValue: {
        color: "#E2E8F0",
        fontSize: "0.9rem",
    },
};
