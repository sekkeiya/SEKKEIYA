export const searchChecklistStyles = {
    container: {

    },

    wrapper: {
        mt: 2,
    },

    tab: {
        fontSize: "0.75rem",
    },

    radioGroup: {
        display: "flex",
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
};
