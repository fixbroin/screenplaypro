// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Load full service account JSON from environment
const serviceAccountJson = process.env.FIREBASE_ADMIN_SDK_CONFIG;

let adminDbInstance: any = null;
let adminAuthInstance: any = null;

try {
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key ? serviceAccount.private_key.replace(/\\n/g, "\n") : undefined,
        }),
      });
    }
  } else if (!getApps().length) {
    console.warn("FIREBASE_ADMIN_SDK_CONFIG is missing in environment variables.");
  }

  if (getApps().length > 0) {
    adminDbInstance = getFirestore();
    adminAuthInstance = getAuth();
  }
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
}

export const adminDb = adminDbInstance;
export const adminAuth = adminAuthInstance;
