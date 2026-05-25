// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3d4f9X9v9v9v9v9v9v9v9v9v9v9v9v9v",
  authDomain: "uno-game-12345.firebaseapp.com",
  databaseURL: "https://uno-game-12345-default-rtdb.firebaseio.com",
  projectId: "uno-game-12345",
  storageBucket: "uno-game-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};

// Initialize Firebase
let db = null;
let firebaseApp = null;

function initFirebase() {
  if (typeof firebase !== 'undefined' && !firebaseApp) {
    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      db = firebase.database();
      console.log('Firebase initialized successfully');
      return true;
    } catch (e) {
      console.warn('Firebase initialization failed:', e);
      return false;
    }
  }
  return !!db;
}

function getDb() {
  return db;
}

function isFirebaseReady() {
  return !!db;
}