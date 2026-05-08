import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBfe3_LKlD5_lf2mFEGpS4RaxYvmp7tnPw",
  authDomain: "mailgaurd-2d6dc.firebaseapp.com",
  projectId: "mailgaurd-2d6dc",
  storageBucket: "mailgaurd-2d6dc.firebasestorage.app",
  messagingSenderId: "456296209786",
  appId: "1:456296209786:web:498c60fe753eb9fd4b8ac3",
  measurementId: "G-PB7VWCC5ZH"
};
const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export default app


 