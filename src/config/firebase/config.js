import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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