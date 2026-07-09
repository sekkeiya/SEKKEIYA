import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Box, Typography, Button, Container } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function AdminGuard() {
  const { user, authLoading } = useAuth();
  
  if (authLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a' }}>
        <Typography sx={{ color: '#fff' }}>Loading...</Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to={`/login?return_to=${encodeURIComponent('/admin')}`} replace />;
  }

  // Check against VITE_ADMIN_UIDS or fallback to known admin emails matching firestore.rules
  const adminUidsString = import.meta.env.VITE_ADMIN_UIDS || '';
  const adminUids = adminUidsString.split(',').map(uid => uid.trim()).filter(Boolean);

  const adminEmails = [
    "hello@sekkeiya.com"
  ];

  const hasAdminUid = adminUids.length > 0 && adminUids.includes(user.uid);
  const hasAdminEmail = user.email && adminEmails.includes(user.email);
  
  const isAdmin = hasAdminUid || hasAdminEmail;

  if (!isAdmin) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDir: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#0a0a0a' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center', p: 4, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography variant="h4" sx={{ color: '#ef4444', fontWeight: 800, mb: 2 }}>
            Access Denied
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
            管理者権限がありません。<br />
            以下の情報を <code>.env</code> の <code>VITE_ADMIN_UIDS</code> に追加するか、<code>AdminGuard.jsx</code> の <code>adminEmails</code> に追加してください。
          </Typography>
          
          <Box sx={{ textAlign: 'left', bgcolor: '#000', p: 2, borderRadius: 2, mb: 4, fontFamily: 'monospace' }}>
            <Typography sx={{ color: '#38bdf8', fontSize: '0.9rem' }}>Email: {user.email}</Typography>
            <Typography sx={{ color: '#38bdf8', fontSize: '0.9rem' }}>UID: {user.uid}</Typography>
          </Box>

          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />} 
            href="/"
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: '#fff' } }}
          >
            Go Back
          </Button>
        </Container>
      </Box>
    );
  }

  return <Outlet />;
}
