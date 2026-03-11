import { alpha } from "@mui/material/styles";

const glassBorder = "rgba(255,255,255,0.12)";
const textPrimary = "rgba(255,255,255,0.92)";
const textSecondary = "rgba(255,255,255,0.6)";

export const furnitureSearchStyles = {
    radioGroup: {
        display: "flex", width: "100%", mb: 3,
        p: 0.5, bgcolor: "rgba(0,0,0,0.3)", borderRadius: 2, border: `1px solid ${glassBorder}`,
        "& .MuiFormControlLabel-root": { m: 0, flex: 1, display: "flex", justifyContent: "center" },
        "& .MuiRadio-root": { display: "none" }, // Hide actual radio button for segmented look
        "& .MuiTypography-root": {
            width: "100%", textAlign: "center",
            color: "rgba(255,255,255,0.5)", textTransform: "none", py: 0.75,
            fontSize: "0.8rem", fontWeight: 600,
            transition: "all 0.2s ease",
            borderRadius: "6px",
        },
        "& .Mui-checked + .MuiTypography-root": {
            bgcolor: "rgba(255,255,255,0.12)", color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        },
        "& .MuiFormControlLabel-root:hover:not(:has(.Mui-checked)) .MuiTypography-root": {
            bgcolor: "rgba(255,255,255,0.05)",
        }
    },

    wrapper: {
        mb: 2,
    },

    card: {
        width: 80,
        height: 60, // Fixed height and width as requested by user
        borderRadius: "8px",
        backgroundColor: "rgba(255,255,255,0.02)",
        color: textSecondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        border: `1px solid ${glassBorder}`,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
            backgroundColor: "rgba(255,255,255,0.06)",
            borderColor: "rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.8)",
            "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.9)" }
        },
    },
    cardSelected: {
        backgroundColor: "rgba(96, 165, 250, 0.1)",
        color: "#60a5fa",
        border: "1px solid rgba(96, 165, 250, 0.4)",
        boxShadow: "0 0 16px rgba(96, 165, 250, 0.15)",
        "&:hover": {
            backgroundColor: "rgba(96, 165, 250, 0.15)",
        }
    },
    cardActionArea: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 0.5,
        textAlign: "center",
        padding: 0.5,
        overflow: "hidden",
        "& .MuiCardActionArea-focusHighlight": {
            background: "transparent"
        }
    },
    categoryIcon: {
        fontSize: "22px",
        color: "rgba(255,255,255,0.5)",
        flexShrink: 0,
        transition: "color 0.2s ease"
    },
    categoryIconSelected: {
        fontSize: "22px",
        color: "#60a5fa",
        flexShrink: 0,
    },
    typography: {
        fontSize: "0.6rem", // Slightly smaller to fit tight grid
        fontWeight: 600,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "100%",
        width: "100%",
        display: "block",
    },

    textField: {
        mt: 1.5,
        "& .MuiFilledInput-root": {
            bgcolor: "rgba(0,0,0,0.25)",
            color: textPrimary,
            borderRadius: 2,
            fontSize: "0.85rem",
            border: `1px solid ${glassBorder}`,
            transition: "border-color 0.2s",
            "&:hover": {
                bgcolor: "rgba(0,0,0,0.3)",
                borderColor: "rgba(255,255,255,0.3)",
            },
            "&.Mui-focused": {
                bgcolor: "rgba(0,0,0,0.4)",
                borderColor: "#60a5fa",
            },
            "&::before, &::after": {
                display: "none" // Remove the default underline entirely
            }
        },
        "& .MuiInputLabel-root": {
            color: textSecondary,
            fontSize: "0.85rem",
            "&.Mui-focused": {
                color: "#60a5fa"
            }
        },
        "& .MuiSelect-select": {
            paddingTop: "16px", // Adjust padding for filled variant
            paddingBottom: "8px",
        }
    },

    menuItem: {
        fontSize: "0.85rem",
        color: textPrimary,
        "&.Mui-selected": {
            bgcolor: "rgba(96, 165, 250, 0.15) !important",
            color: "#60a5fa",
        },
        "&:hover": {
            bgcolor: "rgba(255,255,255,0.08)",
        }
    }
};