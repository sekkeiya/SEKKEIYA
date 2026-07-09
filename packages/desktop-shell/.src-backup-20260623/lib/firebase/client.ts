// Web build: re-export the single Firebase instance owned by the web app so that
// the embedded desktop shell shares ONE app / auth / firestore / storage with the
// host. This eliminates the initializeFirestore-vs-getFirestore ordering race and
// guarantees auth state is observed identically by the web AuthProvider (Context)
// and the shell's useAuthStore (Zustand).
//
// The original Tauri client (with persistentLocalCache / iOS inMemory persistence)
// lives in the desktop project and is not used in the web build.
// @ts-ignore — resolved via the web "@" alias to sekkeiya/src/shared/config/firebase.js
export { auth, db, storage, functions } from '@/shared/config/firebase';
