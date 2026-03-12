import React, { createContext, useContext } from 'react';

// Default theme matching SEKKEIYA's BRAND structure
const defaultTheme = {
  bg: "#0b0f16",
  panel: "rgba(255,255,255,0.07)",
  panel2: "rgba(255,255,255,0.09)",
  line: "rgba(255,255,255,0.12)",
  line2: "rgba(255,255,255,0.18)",
  text: "rgba(255,255,255,0.92)",
  sub: "rgba(255,255,255,0.68)",
  sub2: "rgba(255,255,255,0.52)",
  glow: "rgba(255,255,255,0.14)"
};

const GlobalPanelThemeContext = createContext(defaultTheme);

export const GlobalPanelThemeProvider = ({ theme, children }) => {
  // If a theme is provided, merge or use it, otherwise fallback to default
  const mergedTheme = theme || defaultTheme;
  return (
    <GlobalPanelThemeContext.Provider value={mergedTheme}>
      {children}
    </GlobalPanelThemeContext.Provider>
  );
};

export const usePanelTheme = () => useContext(GlobalPanelThemeContext);
