import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00A0E9', // SEKKEIYA primary blue
    },
    secondary: {
      main: '#bb86fc', 
    },
    background: {
      default: 'transparent', // Let body gradient show through
      paper: tokens.background.panel,
    },
    text: {
      primary: tokens.text.primary,
      secondary: tokens.text.muted,
    },
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
          backgroundColor: tokens.background.base,
          backgroundImage: tokens.background.gradient,
          backgroundAttachment: 'fixed',
          minHeight: '100vh',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: tokens.background.panel,
          backdropFilter: 'blur(12px)',
          border: tokens.border.subtle,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.background.card,
          backdropFilter: 'blur(16px)',
          border: tokens.border.subtle,
          transition: 'all 0.2s ease-in-out',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        containedPrimary: {
          boxShadow: '0 4px 14px 0 rgba(0, 160, 233, 0.3)',
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.15)',
          color: tokens.text.primary,
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          }
        }
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.06)',
        }
      }
    }
  },
});

export default theme;
