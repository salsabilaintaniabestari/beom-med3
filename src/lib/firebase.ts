import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Replace with your Firebase config
  apiKey: 'AIzaSyBitEyfk94YWrBEpldyf_ru74dTmq9AOmI',
  authDomain: 'beom-med3.firebaseapp.com',
  projectId: 'beom-med3',
  storageBucket: 'beom-med3.firebasestorage.app',
  messagingSenderId: '897489638423',
  appId: '1:897489638423:web:42ff3eaab2e7216a637852',
  measurementId: 'G-Q49GHL0NEB',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const analytics = getAnalytics(app);
// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
