
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage"; // Import Firebase Storage

// Your web app's Firebase configuration
// IMPORTANT: Make sure these are correct and your Firebase project is set up.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, // Read from environment variable
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: FirebaseApp;

const globalForFirebase = globalThis as unknown as {
  _firebaseApp?: FirebaseApp;
  _firestoreDb?: Firestore;
};

if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key from process.env.NEXT_PUBLIC_FIREBASE_API_KEY is undefined or empty.");
  throw new Error("Firebase API key is not set. Please check your environment variables NEXT_PUBLIC_FIREBASE_API_KEY.");
}

if (!globalForFirebase._firebaseApp) {
  if (!getApps().length) {
    globalForFirebase._firebaseApp = initializeApp(firebaseConfig);
  } else {
    globalForFirebase._firebaseApp = getApps()[0];
  }
}
app = globalForFirebase._firebaseApp;

let db: Firestore;

if (globalForFirebase._firestoreDb) {
  db = globalForFirebase._firestoreDb;
} else {
  if (typeof window !== "undefined") {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      console.log("[Firestore] Persistent browser cache enabled successfully.");
    } catch (error) {
      console.warn("[Firestore] Failed to initialize persistent browser cache, falling back to standard:", error);
      db = getFirestore(app);
    }
  } else {
    db = getFirestore(app);
  }
  globalForFirebase._firestoreDb = db;
}

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app); // Initialize Firebase Storage

export { app, db, auth, storage }; // Export storage
