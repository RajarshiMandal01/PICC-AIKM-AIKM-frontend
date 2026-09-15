import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider as AppThemeProvider, useTheme } from "./contexts/theme.context";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const DynamicMuiTheme = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();
  const muiTheme = useMemo(() => createTheme({ palette: { mode: theme } }), [theme]);
  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <DynamicMuiTheme>
        <App />
      </DynamicMuiTheme>
    </AppThemeProvider>
  </StrictMode>,
)
