import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPA8rcW0HdupKUkcL1n05R8KuRtisn3Zc",
  authDomain: "staffattendance-bf0ea.firebaseapp.com",
  projectId: "staffattendance-bf0ea",
  storageBucket: "staffattendance-bf0ea.firebasestorage.app",
  messagingSenderId: "710624610550",
  appId: "1:710624610550:web:0b13e49bea794f5fa1c4d7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
