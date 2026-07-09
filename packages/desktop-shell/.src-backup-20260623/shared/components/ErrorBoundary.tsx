import React, { Component, type ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', bgcolor: '#0D0E12', color: '#fff' }}>
          <Typography variant="h5" color="error" gutterBottom>
            システムエラーが発生しました
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
            {this.state.error?.message || '不明なエラー'}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            アプリを再読み込み
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
