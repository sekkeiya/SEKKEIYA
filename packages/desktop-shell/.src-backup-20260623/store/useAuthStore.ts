import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase/client';

export interface AuthState {
  currentUser: User | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  initializeAuth: () => () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  authLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ currentUser: user, isAuthenticated: !!user, authLoading: false }),
  initializeAuth: () => {
    return onAuthStateChanged(auth, (user) => {
      set({ currentUser: user, isAuthenticated: !!user, authLoading: false });
    });
  },
  logout: async () => {
    try {
      await signOut(auth);
      set({ currentUser: null, isAuthenticated: false });
    } catch (e) {
      console.error("Logout failed", e);
    }
  }
}));
