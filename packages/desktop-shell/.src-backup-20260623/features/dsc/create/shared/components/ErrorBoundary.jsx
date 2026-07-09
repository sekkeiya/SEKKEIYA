import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box 
          sx={{ 
            height: '100%', 
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            bgcolor: '#0a0a0a', 
            color: 'error.main',
            p: 4,
            textAlign: 'center'
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom color="text.primary">
            Something went wrong.
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mb: 3 }}>
            {this.state.error?.toString()}
          </Typography>
          
          <Box sx={{ bgcolor: 'rgba(255,0,0,0.1)', p: 2, borderRadius: 1, maxWidth: '100%', overflowX: 'auto', mb: 4, textAlign: 'left' }}>
            <Typography variant="caption" component="pre" sx={{ color: 'error.light', margin: 0 }}>
              {this.state.errorInfo?.componentStack}
            </Typography>
          </Box>

          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
