import React from 'react';
import { Box, Typography, Button, Container, Grid, Paper, Stack } from '@mui/material';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { AppShell } from '../../shared/layout/AppShell';
import { tokens } from '../../shared/theme/tokens';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import ChairIcon from '@mui/icons-material/Chair';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useSharedAuthState } from '../../shared/hooks/useSharedAuthState';
import { toSekkeiyaLoginUrl, toSekkeiyaSignupUrl } from '@sekkeiya/global-panel';

export default function CreateLandingPage() {
  const navigate = useNavigate();
  const { isAuthed, isLoading } = useSharedAuthState();

  const location = useLocation();

  if (isLoading) return null;
  if (isAuthed) return <Navigate to={`/dashboard${location.search}${location.hash}`} replace />;

  return (
    <AppShell>
      <Box sx={{ minHeight: '100vh', pt: 8, pb: 12, overflowY: 'auto' }}>
        <Container maxWidth="lg">
        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h2" component="h1" fontWeight="bold" gutterBottom>
            S.Create
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 4, maxWidth: 800, mx: 'auto' }}>
            画像から3Dモデルを生成し、S.Models に保存し、S.Layout ですぐ活用
          </Typography>
          {isAuthed ? (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<AutoFixHighIcon />}
                onClick={() => navigate('/dashboard')}
              >
                3D生成を始める
              </Button>
              <Button 
                variant="outlined" 
                size="large" 
                startIcon={<DashboardIcon />}
                onClick={() => navigate('/dashboard')}
              >
                ダッシュボードへ
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button 
                variant="contained" 
                size="large" 
                onClick={() => { window.location.assign(toSekkeiyaLoginUrl('/app/create/dashboard')); }}
                sx={{ px: 4 }}
              >
                ログイン
              </Button>
              <Button 
                variant="outlined" 
                size="large" 
                onClick={() => { window.location.assign(toSekkeiyaSignupUrl('/app/create/dashboard')); }}
                sx={{ px: 4 }}
              >
                アカウント作成
              </Button>
            </Stack>
          )}
        </Box>

        {/* Features Section */}
        <Grid container spacing={4} sx={{ mb: 8 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 4, textAlign: 'center', height: '100%', bgcolor: 'rgba(10, 12, 16, 0.45)', backdropFilter: 'blur(12px)', border: `1px solid ${tokens.border.subtle}` }}>
              <AutoFixHighIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h5" gutterBottom>作る (Create)</Typography>
              <Typography color="text.secondary">
                1枚の画像から高品質な3Dモデルを高速に自動生成。最新のAIエンジンで思い通りの形状を作成します。
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 4, textAlign: 'center', height: '100%', bgcolor: 'rgba(10, 12, 16, 0.45)', backdropFilter: 'blur(12px)', border: `1px solid ${tokens.border.subtle}` }}>
              <CloudUploadIcon color="secondary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h5" gutterBottom>貯める (Share)</Typography>
              <Typography color="text.secondary">
                生成したモデルは S.Models にシームレスに保存。あなたのプロジェクト資産として管理できます。
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 4, textAlign: 'center', height: '100%', bgcolor: 'rgba(10, 12, 16, 0.45)', backdropFilter: 'blur(12px)', border: `1px solid ${tokens.border.subtle}` }}>
              <ViewInArIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h5" gutterBottom>使う (Layout)</Typography>
              <Typography color="text.secondary">
                S.Layout と連携し、生成したばかりの家具や建築パーツを空間に直接配置して確認できます。
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Use Cases Section */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
            想定ユースケース
          </Typography>
          <Grid container spacing={4}>
             <Grid item xs={12} sm={4}>
                <Box sx={{ p: 3 }}>
                  <ChairIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6">家具</Typography>
                  <Typography variant="body2" color="text.secondary">椅子や机などインテリアの生成</Typography>
                </Box>
             </Grid>
             <Grid item xs={12} sm={4}>
                <Box sx={{ p: 3 }}>
                  <ArchitectureIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6">建築部品</Typography>
                  <Typography variant="body2" color="text.secondary">ドアや窓、装飾部材の生成</Typography>
                </Box>
             </Grid>
             <Grid item xs={12} sm={4}>
                <Box sx={{ p: 3 }}>
                  <ViewInArIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6">レイアウト用たたき台生成</Typography>
                  <Typography variant="body2" color="text.secondary">空間デザインに合わせた特注品の検証</Typography>
                </Box>
             </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  </AppShell>
  );
}
