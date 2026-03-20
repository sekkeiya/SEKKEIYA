import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyB1q5bTAaBIJb1Ug0Tqqb_hSNH7Vo2B2CY",
    authDomain: "shapeshare3d.firebaseapp.com",
    projectId: "shapeshare3d",
    storageBucket: "shapeshare3d.firebasestorage.app",
    messagingSenderId: "1064599680534",
    appId: "1:1064599680534:web:671460066e66a01e64a737",
    measurementId: "G-PG93WX1R56"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// ローカル開発時のみ Emulator に接続
if (
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}