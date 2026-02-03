import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 개인 서버 (Firebase) 연결 설정
const myFirebaseConfig = {
  apiKey: "AIzaSyD958WbuVTIul9NkgfMT50PCd3qpjo91xk",
  authDomain: "kingdog-1.firebaseapp.com",
  projectId: "kingdog-1",
  storageBucket: "kingdog-1.firebasestorage.app",
  messagingSenderId: "682395914721",
  appId: "1:682395914721:web:66697cf82e4964f47ec2a0"
};

const app = initializeApp(myFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const appId = 'kingdog-management-system';
export const ADMIN_EMAIL = "fa146612@gmail.com";
export const ADMIN_PW = "aass1122##";
export const GOOGLE_MAPS_API_KEY = "AIzaSyAp8iRy0GVyRdS-jYx9h4m1QuIO_AKwOUM";

export const DEFAULT_PRODUCTS = [
  { category: '호텔', name: 'V1', price: 90000 },
  { category: '호텔', name: 'V2', price: 70000 },
  { category: '호텔', name: 'V3', price: 70000 },
  { category: '호텔', name: 'A', price: 50000 },
  { category: '호텔', name: 'B', price: 50000 },
  { category: '호텔', name: 'C', price: 50000 },
  { category: '호텔', name: 'D', price: 50000 },
  { category: '호텔', name: 'E', price: 50000 },
  { category: '호텔', name: '마리추가', price: 10000 },
  { category: '유치원', name: '야간유치원', price: 700000 },
  { category: '유치원', name: '소12회', price: 425000 },
  { category: '유치원', name: '소8회', price: 288000 },
  { category: '유치원', name: '소20회(산책)', price: 608000 },
  { category: '유치원', name: '소12회(산책)', price: 485000 },
  { category: '유치원', name: '소8회(산책)', price: 328000 },
  { category: '유치원', name: '중20회', price: 720000 },
  { category: '유치원', name: '중12회', price: 505000 },
  { category: '유치원', name: '중8회', price: 341600 },
  { category: '유치원', name: '중20회(산책)', price: 720010 },
  { category: '유치원', name: '중12회(산책)', price: 555000 },
  { category: '유치원', name: '중8회(산책)', price: 421600 },
  { category: '유치원', name: '소 일일권', price: 38000 },
  { category: '유치원', name: '중 일일권', price: 45000 },
  { category: '놀이방', name: '놀이방(소형)', price: 4000 },
  { category: '놀이방', name: '놀이방(중형)', price: 5000 },
  { category: '놀이방', name: '매너벨트', price: 1000 },
  { category: '놀이방', name: '산책', price: 15000 },
  { category: '미용', name: '미용', price: 0 },
];