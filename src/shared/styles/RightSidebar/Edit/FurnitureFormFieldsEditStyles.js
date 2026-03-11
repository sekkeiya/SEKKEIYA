export const furnitureFormStyles = {
    container: {
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        mt: 1,
    },
    textField: {
        flex: 1,
        mt: 1.5,
        minWidth: "120px",
        "& label": {
            color: "#94A3B8",
            fontSize: "0.7rem",
            transform: "translate(14px, -6px) scale(0.75)", // ✅ ここ修正
            transformOrigin: "top left",
        },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(0,0,0,0.25)", // Glass input
            color: "#E2E8F0",
            fontSize: "0.75rem",
            borderRadius: "10px",
            minHeight: "44px",
            transition: "all 0.3s ease",
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.08)",
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.2)",
                backgroundColor: "rgba(0,0,0,0.4)",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#00BFFF",
                borderWidth: "1px",
                backgroundColor: "rgba(0,0,0,0.6)",
                boxShadow: "0 4px 16px rgba(0, 191, 255, 0.15)",
            },
        },
        "& input, & .MuiSelect-select": {
            padding: "6px 10px",
            fontSize: "0.75rem",
            color: "#E2E8F0",
        },
        "& .MuiSelect-icon": {
            color: "#94A3B8",
        },
    },


    radioGroup: {
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        mt: 1.5,
        mb: 1,
        paddingX: 0.8,
        "& .MuiFormControlLabel-label": {
            fontSize: "0.7rem",
            color: "#CBD5E1",
        },
        "& .MuiRadio-root": {
            color: "#64748B",
            padding: "2px",
        },
        "& .Mui-checked": {
            color: "#00BFFF",
        },
    },

    sizeWrapper: {
        mt: 1.5,
    },

    sizeRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 1.2,
    },

    sizeTextField: {
        flex: 1,
        minWidth: "90px",
        mt: 1.5,
        "& label": {
            color: "#94A3B8",
            fontSize: "0.7rem",
        },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(0,0,0,0.25)",
            color: "#E2E8F0",
            fontSize: "0.75rem",
            borderRadius: "10px",
            minHeight: "44px",
            transition: "all 0.3s ease",
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.08)",
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.2)",
                backgroundColor: "rgba(0,0,0,0.4)",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#00BFFF",
                borderWidth: "1px",
                backgroundColor: "rgba(0,0,0,0.6)",
                boxShadow: "0 4px 16px rgba(0, 191, 255, 0.15)",
            },
        },
        "& input": {
            padding: "6px 10px",
            fontSize: "0.75rem",
        },
    },

    priceTextField: {
        flex: 1,
        minWidth: "120px",
        mt: 3,
        "& label": {
            color: "#94A3B8",
            fontSize: "0.7rem",
        },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(0,0,0,0.25)",
            color: "#E2E8F0",
            fontSize: "0.75rem",
            borderRadius: "10px",
            minHeight: "44px",
            transition: "all 0.3s ease",
            "& fieldset": {
                borderColor: "rgba(255,255,255,0.08)",
            },
            "&:hover fieldset": {
                borderColor: "rgba(255,255,255,0.2)",
                backgroundColor: "rgba(0,0,0,0.4)",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#00BFFF",
                borderWidth: "1px",
                backgroundColor: "rgba(0,0,0,0.6)",
                boxShadow: "0 4px 16px rgba(0, 191, 255, 0.15)",
            },
        },
        "& input": {
            padding: "6px 10px",
            fontSize: "0.75rem",
        },
    },

    chip: {
        borderRadius: "14px",
        backgroundColor: "#334155",
        color: "#E2E8F0",
        border: "1px solid #475569",
        fontSize: "0.7rem",
        paddingX: 0.8,
        marginRight: 1,
        marginBottom: 1,
        "& .MuiChip-deleteIcon": {
            color: "#94A3B8",
            "&:hover": {
                color: "#00BFFF",
            },
        },
        "&:focus": {
            outline: "2px solid #00BFFF",
            outlineOffset: "2px",
        },
    },

    selectMenuPaper: {
        backgroundColor: "rgba(20,24,32,0.9)", // slightly stronger to remain readable on top
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        color: "#E2E8F0",
        "& li": {
            fontSize: "0.75rem",
            color: "#E2E8F0",
            paddingY: "6px",
            transition: "background 0.2s ease",
        },
        "& li.Mui-selected": {
            backgroundColor: "rgba(0, 191, 255, 0.15)",
        },
        "& li:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.08)",
        },
    },

    typography: {
        color: "#94A3B8",
        fontSize: "0.75rem",
    },

    menuItem: {
        fontSize: "0.75rem",
        color: "#E2E8F0",
    },
};
