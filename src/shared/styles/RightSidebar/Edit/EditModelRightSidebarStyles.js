export const editModelSidebarStyles = {
    container: {
        // backgroundColor: "#1c1e24",
        // color: "#E2E8F0",
        // padding: 2,
        // height: "100%",
        // boxSizing: "border-box",
    },

    wrapper: {
        mt: 2,
    },

    sectionTitle: {
        display: "flex",
        alignItems: "center",
        gap: 1,
        color: "#94A3B8",
        fontSize: "0.85rem",
        fontWeight: 600,
        mb: 0.5,
    },

    valueText: {
        color: "#E2E8F0",
        fontSize: "0.85rem",
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

    textField: {
        mt: 1.5,
        borderRadius: "8px",
        "& label": {
            color: "rgba(255,255,255,0.4)",
            fontSize: "0.8rem",
            transform: "translate(14px, 12px) scale(1)",
            "&.MuiInputLabel-shrink": {
                transform: "translate(14px, -6px) scale(0.75)",
                color: "#00BFFF",
                fontWeight: 600,
                letterSpacing: "0.5px",
            },
        },
        "& .MuiFilledInput-root, & .MuiOutlinedInput-root": {
            backgroundColor: "rgba(0,0,0,0.25)", // Deep sleek input background
            color: "#E2E8F0",
            fontSize: "0.85rem",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.08)",
            transition: "all 0.3s ease",
            "&:hover": {
                backgroundColor: "rgba(0,0,0,0.4)",
                borderColor: "rgba(255,255,255,0.2)",
            },
            "&.Mui-focused": {
                backgroundColor: "rgba(0,0,0,0.6)",
                borderColor: "#00BFFF",
                boxShadow: "0 4px 16px rgba(0, 191, 255, 0.15)",
            },
        },
        "& input": {
            color: "#E2E8F0",
            fontSize: "0.85rem",
            padding: "8px 12px",
        },
        // Hide default Material UI underlines for a cleaner look
        "& .MuiFilledInput-underline:before": { borderBottom: "none !important" },
        "& .MuiFilledInput-underline:after": { borderBottom: "none !important" },
        "& .MuiOutlinedInput-notchedOutline": { border: "none" },
    },

    chip: {
        borderRadius: "6px", // sleeker modern pill/box
        backgroundColor: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(8px)",
        color: "#E2E8F0",
        border: "1px solid rgba(255,255,255,0.1)",
        fontSize: "0.75rem",
        fontWeight: 500,
        paddingX: 1,
        marginRight: 1,
        marginBottom: 1,
        transition: "all 0.2s ease",
        "&:hover": {
            backgroundColor: "rgba(255,255,255,0.1)",
            borderColor: "rgba(255,255,255,0.25)",
        }
    },

    thumbnailContainer: {
        width: "100%",
        aspectRatio: "4/3",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
        mb: 2.5,
        mt: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        "& img": {
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "transform 0.4s ease",
        },
        "&:hover img": {
            transform: "scale(1.03)",
        }
    },

    typography: {
        color: "rgba(255,255,255,0.5)",
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.2px",
    },

    //EditBoardRightSidebar.jsx専用 
    inviteInputBox: {
        mt: 1,
        display: "flex",
        gap: 1,
        alignItems: "center",
    },

    inviteButton: {
        minWidth: "60px",
        fontSize: "0.75rem",
        height: "36px",
        bgcolor: "#00BFFF",
        color: "#fff",
        "&:hover": {
            bgcolor: "#009ACD",
        },
        "&.Mui-disabled": {
            bgcolor: "#334155",
            color: "#94A3B8",
        },
    },

    inviteListChip: {
        borderRadius: "16px",
        backgroundColor: "#1e293b",
        color: "#E2E8F0",
        border: "1px solid #475569",
        fontSize: "0.75rem",
        paddingX: 1,
        marginRight: 1,
        marginBottom: 1,
    },
};