import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, IconButton, AppBar, Toolbar, Avatar, Button } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Public as PublicIcon,
  Favorite as FavoriteIcon,
  Payments as PaymentsIcon,
} from '@mui/icons-material';
import { useAuth } from '@/features/auth/context/AuthContext';

const DRAWER_WIDTH = 260;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 記事 / Content Strategy / Categories はデスクトップ版 S.Blog（公式ブログモード）へ集約したため
  // Web admin のメニューからは撤去。ここには決済・運営系のみを残す。
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin' },
    { text: 'Chat', icon: <ChatIcon />, path: '/admin/chat' },
    { text: '収益サマリー', icon: <PaymentsIcon />, path: '/admin/revenue' },
    { text: '寄付コメント', icon: <FavoriteIcon />, path: '/admin/donations' },
    { text: 'Media (WIP)', icon: <ImageIcon />, path: '/admin/media', disabled: true },
    { text: 'Settings (WIP)', icon: <SettingsIcon />, path: '/admin/settings', disabled: true },
  ];

  const [chatOpen, setChatOpen] = useState(false);
  const recentChats = [
    { id: 1, title: 'Firebase Deploy エラー解決' },
    { id: 2, title: '管理者UI/UX改善プラン' },
    { id: 3, title: 'モデルのバージョン管理' },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#121212', color: '#fff', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>S</Box>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>SEKKEIYA<span style={{color: '#999', fontSize: '0.8em', marginLeft: 4}}>CMS</span></Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
      <List sx={{ px: 2, pt: 2, flexGrow: 1, overflowY: 'auto' }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          const isChatNode = item.text === 'Chat';
          const isExpandable = isChatNode;

          const handleToggle = (e) => {
            e.stopPropagation();
            if (isChatNode) setChatOpen(!chatOpen);
          };

          const openState = isChatNode ? chatOpen : false;

          return (
            <React.Fragment key={item.text}>
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  disabled={item.disabled}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    bgcolor: isActive && !isExpandable ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    color: isActive ? '#38bdf8' : 'rgba(255,255,255,0.7)',
                    '&:hover': {
                      bgcolor: isActive && !isExpandable ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: isActive ? '#38bdf8' : '#fff',
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.95rem', fontWeight: isActive ? 600 : 500 }} />
                  
                  {isExpandable && (
                    <IconButton 
                      size="small" 
                      onClick={handleToggle}
                      sx={{ color: 'inherit', p: 0.5 }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>{openState ? '▼' : '▶'}</Typography>
                    </IconButton>
                  )}
                </ListItemButton>
              </ListItem>

              {/* Sub-menu array rendering for chat! */}
              {isChatNode && (
                <Box sx={{ display: chatOpen ? 'block' : 'none', pl: 6, pr: 1, pb: 1 }}>
                  <List disablePadding>
                    {recentChats.map(chat => (
                      <ListItem key={chat.id} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton 
                          onClick={() => navigate(`/admin/chat?id=${chat.id}`)}
                          sx={{ 
                            borderRadius: 1.5, 
                            py: 0.5, px: 1, 
                            color: location.search === `?id=${chat.id}` ? '#38bdf8' : 'rgba(255,255,255,0.5)',
                            bgcolor: location.search === `?id=${chat.id}` ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' } 
                          }}
                        >
                          <ListItemText 
                            primary={chat.title} 
                            primaryTypographyProps={{ fontSize: '0.8rem', noWrap: true }} 
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </React.Fragment>
          );
        })}
      </List>
      <Box sx={{ p: 2 }}>
        <Button 
          fullWidth
          variant="outlined" 
          startIcon={<PublicIcon />} 
          onClick={() => navigate('/')}
          sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: '#fff' } }}
        >
          View Live Site
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0a0a' }}>
      
      {/* Mobile AppBar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          display: { xs: 'block', md: 'none' },
          bgcolor: 'rgba(10,10,10,0.8)', 
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: 'none'
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>SEKKEIYA CMS</Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: 'none' } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content Pane */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4, lg: 6 }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, mt: { xs: 8, md: 0 } }}>
        
        {/* Top bar logic (optional based on page, but we give a generic admin wrapper) */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 4 }}>
           <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
             <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
               {user?.email}
             </Typography>
             <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark' }}>
               {user?.email?.[0]?.toUpperCase() || 'A'}
             </Avatar>
           </Box>
        </Box>

        <Outlet />
      </Box>
    </Box>
  );
}
