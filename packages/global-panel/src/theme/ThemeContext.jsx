import React, { createContext, useContext } from 'react';

// Default theme matching the existing BRAND object structure
const defaultTheme = {
  bg: '#1e1e1e',
  text: '#ffffff',
  line: 'rgba(255, 255, 255, 0.12)',
  primary: '#2196f3',
  secondary: '#f50057',
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
  success: '#4caf50',
  // Add other necessary theme variables
};

const GlobalPanelThemeContext = createContext(defaultTheme);

export const usePanelTheme = () => {
  return useContext(GlobalPanelThemeContext);
};

export const GlobalPanelThemeProvider = ({ children, theme }) => {
  const mergedTheme = theme || defaultTheme;
  return (
    <GlobalPanelThemeContext.Provider value={mergedTheme}>
      {children}
    </GlobalPanelThemeContext.Provider>
  );
};
