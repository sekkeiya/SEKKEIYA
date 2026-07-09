import React from 'react';
import { Box, Button, Container, Typography, Stack, Grid, Card, CardContent } from '@mui/material';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import WebIcon from '@mui/icons-material/Web';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useSharedAuthState } from '../shared/hooks/useSharedAuthState';

const PresentsLandingPage = () => {
  const navigate = useNavigate();
  const { isAuthed, isLoading } = useSharedAuthState();

  const location = useLocation();

  if (isLoading) return null;
  if (isAuthed) return <Navigate to={`/`} replace />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'text.primary', pb: 10 }}>
      {/* Hero Section */}
      <Box sx={{ pt: 15, pb: 10, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h2" fontWeight="bold" gutterBottom>
            S.Presentations
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 6 }}>
            AI Drive の資産から、提案資料とプレゼン体験をつくる
          </Typography>

          {isAuthed ? (
            <Button 
              variant="contained" 
              size="large" 
              onClick={() => window.location.assign('/')}
              sx={{ px: 6, py: 2, fontSize: '1.2rem', borderRadius: 8 }}
            >
              プロジェクトから開く
            </Button>
          ) : (
            <Stack direction="row" spacing={3} justifyContent="center">
              <Button 
                variant="contained" 
                size="large" 
                onClick={() => { window.location.assign('/login?return_to=/app/presents/dashboard'); }}
                sx={{ px: 6, py: 2, fontSize: '1.2rem', borderRadius: 8 }}
              >
                ログイン
              </Button>
              <Button 
                variant="outlined" 
                size="large" 
                onClick={() => { window.location.assign('/signup?return_to=/app/presents/dashboard'); }}
                sx={{ px: 6, py: 2, fontSize: '1.2rem', borderRadius: 8 }}
              >
                アカウント作成
              </Button>
            </Stack>
          )}
        </Container>
      </Box>

      <Container maxWidth="lg">
        {/* Features Section */}
        <Box sx={{ my: 10 }}>
          <Typography variant="h4" fontWeight="bold" align="center" gutterBottom>
            Features
          </Typography>
          <Grid container spacing={4} sx={{ mt: 2 }}>
            {[
              { title: 'AI Drive の資産を活用', icon: <AutoAwesomeIcon color="primary" fontSize="large"/>, desc: 'Drive上のモデルや図面を直接参照します。' },
              { title: '3D / 図面 / 画像 / テキスト統合', icon: <ViewInArIcon color="primary" fontSize="large"/>, desc: '様々なフォーマットを一つのページに構成します。' },
              { title: 'Webで共有できるプレゼン', icon: <WebIcon color="primary" fontSize="large"/>, desc: '専用URLを発行してクライアントにその場で共有。' },
              { title: '将来的な自動生成に対応', icon: <AutoFixHighIcon color="primary" fontSize="large"/>, desc: 'AIによる自動レイアウト・コンテンツ生成。' },
            ].map((feature, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card sx={{ height: '100%', textAlign: 'center', p: 2 }}>
                  <CardContent>
                    <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h6" gutterBottom>{feature.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{feature.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Workflow Section */}
        <Box sx={{ my: 10, textAlign: 'center' }}>
           <Typography variant="h4" fontWeight="bold" gutterBottom>
            想定フロー
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="center" sx={{ mt: 4 }}>
            <Card sx={{ p: 3, width: 250 }}><Typography fontWeight="bold">AI Drive / Board / Layouts</Typography></Card>
            <Typography variant="h5" color="text.secondary">→</Typography>
            <Card sx={{ p: 3, width: 250, borderColor: 'primary.main', borderWidth: 2, borderStyle: 'solid' }}>
              <Typography fontWeight="bold" color="primary">Presents (提案構成)</Typography>
            </Card>
            <Typography variant="h5" color="text.secondary">→</Typography>
            <Card sx={{ p: 3, width: 250 }}><Typography fontWeight="bold">提案URL / プレゼン表示</Typography></Card>
          </Stack>
        </Box>

      </Container>
    </Box>
  );
};

export default PresentsLandingPage;
