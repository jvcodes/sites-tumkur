import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

// These should be replaced by the real values from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAvCXxxDD1UFJVq5WuXbaFvBfAIsEGcyTg",
  authDomain: "tumkuru-sites.firebaseapp.com",
  projectId: "tumkuru-sites",
  storageBucket: "tumkuru-sites.firebasestorage.app",
  messagingSenderId: "974580685297",
  appId: "1:974580685297:web:30ecadd033898674214c50",
  measurementId: "G-4BEX7PMRGQ"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth };
