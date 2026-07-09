import React, { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '../../store/useAuthStore';
import { useUserSettingsStore } from '../../store/useUserSettingsStore';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import Login from '../../pages/Login';
import { Navigate } from 'react-router-dom';
import { isTauri } from '../../lib/platform';

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, authLoading, initializeAuth } = useAuthStore();

  useEffect(() => {
    const unsub = initializeAuth();
    return () => unsub();
  }, [initializeAuth]);

  useEffect(() => {
    if (currentUser) {
      useUserSettingsStore.getState().startSystemCategoriesSync();

      const initUser = async () => {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // Create user document
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || 'New User',
              createdAt: serverTimestamp(),
            });

            // Auto-follow SEKKEIYA Official Account
            const sekkeiyaId = 'K67Fm1A2fZdAWWAXda83i974XOE3';
            const followingRef = doc(db, `users/${currentUser.uid}/following`, sekkeiyaId);
            await setDoc(followingRef, {
              followedAt: serverTimestamp()
            });
            console.log('[AuthGuard] User initialized and auto-followed SEKKEIYA official account.');
          }
        } catch (error) {
          console.error("[AuthGuard] Failed to initialize user document:", error);
        }
      };

      initUser();
    }
  }, [currentUser]);

  if (authLoading) {
    return (
      <Box display="flex" height="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (!currentUser) {
    // Web build uses the host app's login page; desktop uses the native Login (Tauri OAuth).
    return isTauri() ? <Login /> : <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
