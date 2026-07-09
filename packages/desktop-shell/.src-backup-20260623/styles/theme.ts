import { createTheme } from '@mui/material/styles';

export const BRAND = {
  bg: "#0b0f16",
  panel: "rgba(255,255,255,0.07)",
  panel2: "rgba(255,255,255,0.09)",
  line: "rgba(255,255,255,0.12)",
  line2: "rgba(255,255,255,0.18)",
  text: "rgba(255,255,255,0.92)",
  sub: "rgba(255,255,255,0.68)",
  sub2: "rgba(255,255,255,0.52)",
  glow: "rgba(255,255,255,0.14)",
};

export const darkDesktopTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    background: {
      default: BRAND.bg,
      paper: BRAND.panel,
    },
    text: {
      primary: BRAND.text,
      secondary: BRAND.sub,
    },
    divider: BRAND.line,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: BRAND.bg,
          minHeight: '100%',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: BRAND.panel,
          border: `1px solid ${BRAND.line}`,
          borderRadius: 8,
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: BRAND.panel2,
            borderColor: BRAND.line2,
            boxShadow: `0 4px 12px ${BRAND.glow}`,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '2px 8px',
          padding: '8px 16px',
          transition: 'all 0.15s ease',
          '&.Mui-selected': {
            backgroundColor: BRAND.panel2,
            '&:hover': {
              backgroundColor: BRAND.panel2,
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
          // Touch-friendly row height on mobile
          '@media (max-width:768px)': {
            minHeight: 44,
          },
        },
      },
    },
    // --- Cross-cutting mobile / touch defaults (apply only below 768px) ---
    MuiIconButton: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            minWidth: 44,
            minHeight: 44,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            minHeight: 44,
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '@media (max-width:768px)': {
            minHeight: 44,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          // Keep dialogs within the viewport on small screens (avoid horizontal overflow
          // from fixed widths) without forcing tiny confirm dialogs to full screen.
          '@media (max-width:768px)': {
            margin: 16,
            maxWidth: 'calc(100% - 32px)',
            maxHeight: 'calc(100% - 32px)',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: BRAND.line,
        },
      },
    },
  },
});
