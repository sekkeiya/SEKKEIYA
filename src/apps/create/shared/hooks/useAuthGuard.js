import { useState, useEffect } from 'react';
// import { auth } from '../../services/firebase/firebaseApp';
// import { onAuthStateChanged } from 'firebase/auth';

/**
 * Custom hook to handle authentication state.
 * Currently uses a mock value. Swap the comments below to use Firebase Auth.
 */
export function useAuthGuard() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState({ uid: 'dummy-user-123', email: 'test@example.com' }); // Mock User

  /* --- Firebase Auth Integration ---
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthenticated(true);
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);
  */

  return { isAuthenticated, isLoading, user };
}
