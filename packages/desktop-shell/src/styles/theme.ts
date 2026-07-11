import { createTheme, type Theme } from '@mui/material/styles';

/** ダーク配色のリテラル値。MUIパレット構築用（CSS変数はMUI内部の色計算で使えないため）。 */
export const BRAND_DARK = {
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

/** ライト配色のリテラル値。BRAND_DARKと同じキー構成。 */
export const BRAND_LIGHT = {
  bg: "#f4f5f7",
  panel: "#ffffff",
  panel2: "#eef0f3",
  line: "rgba(15,23,42,0.12)",
  line2: "rgba(15,23,42,0.20)",
  text: "rgba(15,23,42,0.92)",
  sub: "rgba(15,23,42,0.64)",
  sub2: "rgba(15,23,42,0.48)",
  glow: "rgba(15,23,42,0.10)",
};

/**
 * ブランドトークン（テーマ追従版）。値は index.css で定義したCSS変数で、
 * <html data-theme> の切り替えに応じてダーク/ライトが自動で反転する。
 * sx / style / テンプレート文字列（`1px solid ${BRAND.line}` 等）でそのまま使える。
 * ※ alpha() 等の色計算や three.js / canvas にはリテラルの BRAND_DARK / BRAND_LIGHT を使うこと。
 */
export const BRAND = {
  bg: "var(--brand-bg)",
  panel: "var(--brand-panel)",
  panel2: "var(--brand-panel2)",
  line: "var(--brand-line)",
  line2: "var(--brand-line2)",
  text: "var(--brand-text)",
  sub: "var(--brand-sub)",
  sub2: "var(--brand-sub2)",
  glow: "var(--brand-glow)",
  /** メニュー/ポップオーバー用の不透明寄りガラス面（backdropFilter: blur と併用） */
  glass: "var(--brand-glass)",
  /** 不透明の持ち上がりサーフェス（チャットパネル等の側板） */
  surface: "var(--brand-surface)",
  surface2: "var(--brand-surface2)",
};

const buildDesktopTheme = (mode: 'dark' | 'light'): Theme => {
  const brand = mode === 'dark' ? BRAND_DARK : BRAND_LIGHT;
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#90caf9' : '#1976d2',
      },
      background: {
        default: brand.bg,
        paper: brand.panel,
      },
      text: {
        primary: brand.text,
        secondary: brand.sub,
      },
      divider: brand.line,
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
            backgroundColor: brand.bg,
            minHeight: '100%',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: brand.panel,
            border: `1px solid ${brand.line}`,
            borderRadius: 8,
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: brand.panel2,
              borderColor: brand.line2,
              boxShadow: `0 4px 12px ${brand.glow}`,
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
              backgroundColor: brand.panel2,
              '&:hover': {
                backgroundColor: brand.panel2,
              },
            },
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
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
      // Select / Menu のドロップダウンは不透明面に（既定の background.paper は半透明で
      // 背後が透けて選びにくいため）。--brand-glass はテーマ連動の不透明メニュー面。
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--brand-glass)',
            backgroundImage: 'none', // dark モードの elevation オーバーレイ（半透明）を無効化
            border: `1px solid ${brand.line}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            // ダイアログも不透明面に（背景が透けないように）。
            backgroundColor: 'var(--brand-glass)',
            backgroundImage: 'none',
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
            borderColor: brand.line,
          },
        },
      },
    },
  });
};

export const darkDesktopTheme = buildDesktopTheme('dark');
export const lightDesktopTheme = buildDesktopTheme('light');
