import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2yMHElqc0aQ39lzkEc0xQS8BdTT7520w",
  authDomain: "school-ai-scheduler.firebaseapp.com",
  projectId: "school-ai-scheduler",
  storageBucket: "school-ai-scheduler.firebasestorage.app",
  messagingSenderId: "875465863832",
  appId: "1:875465863832:web:0fe2d636840739a17a16ed"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);