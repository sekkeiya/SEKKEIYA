export const uploadModalStyles = {
    container: {
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        mt: 2,
    },

    textField: {
        flex: 1,
        mt: 1.5,
        minWidth: "140px",
        "& label": {
            color: "#94A3B8",
            fontSize: "0.75rem",
        },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "#1f2125",
            color: "#E2E8F0",
            fontSize: "0.75rem",
            borderRadius: "6px",
            minHeight: "44px",
            paddingRight: "8px",
            "& fieldset": {
                borderColor: "#334155",
            },
            "&:hover fieldset": {
                borderColor: "#475569",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#00BFFF",
            },
        },
        "& input, & .MuiSelect-select": {
            padding: "6px 10px",
            color: "#E2E8F0",
            fontSize: "0.75rem",
        },
        "& .MuiSelect-icon": {
            color: "#94A3B8",
        },
    },

    radioGroup: {
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        mt: 1,
        "& .MuiFormControlLabel-label": {
            fontSize: "0.75rem",
            color: "#CBD5E1",
        },
        "& .MuiRadio-root": {
            color: "#64748B",
            padding: "4px",
        },
        "& .Mui-checked": {
            color: "#00BFFF",
        },
    },

    sizeWrapper: {
        mt: 2,
    },

    sizeRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        mt: 1,
    },

    sizeTextField: {
        flex: 1,
        minWidth: "100px",
        mt: 1.5,
        "& label": {
            color: "#94A3B8",
            fontSize: "0.75rem",
        },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "#1f2125",
            color: "#E2E8F0",
            fontSize: "0.75rem",
            borderRadius: "6px",
            minHeight: "44px",
            "& fieldset": {
                borderColor: "#334155",
            },
            "&:hover fieldset": {
                borderColor: "#475569",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#00BFFF",
            },
        },
        "& input": {
            padding: "6px 10px",
            color: "#E2E8F0",
        },
    },

    priceTextField: {
        flex: 1,
        minWidth: "140px",
        mt: 1.5,
        "& label": {
            color: "#94A3B8",
            fontSize: "0.75rem",
        },
        "& .MuiOutlinedInput-root": {
            backgroundColor: "#1f2125",
            color: "#E2E8F0",
            fontSize: "0.75rem",
            borderRadius: "6px",
            minHeight: "44px",
            "& fieldset": {
                borderColor: "#334155",
            },
            "&:hover fieldset": {
                borderColor: "#475569",
            },
            "&.Mui-focused fieldset": {
                borderColor: "#00BFFF",
            },
        },
        "& input": {
            padding: "6px 10px",
            color: "#E2E8F0",
        },
    },

    chip: {
        borderRadius: "14px",
        backgroundColor: "#334155",
        color: "#E2E8F0",
        border: "1px solid #475569",
        fontSize: "0.7rem",
        paddingX: 1,
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
        backgroundColor: "#1f2125",
        color: "#E2E8F0",
        "& li": {
            fontSize: "0.75rem",
            color: "#E2E8F0",
        },
        "& li.Mui-selected": {
            backgroundColor: "#334155",
        },
        "& li:hover": {
            backgroundColor: "#334155",
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
