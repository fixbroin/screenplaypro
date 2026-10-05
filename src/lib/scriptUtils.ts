import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import { Script, ScriptElement, ScriptElementType } from "../types/script";
import { nanoid } from "nanoid";

const SCRIPTS_COLLECTION = "scripts";

export const INDIAN_LANGUAGES = [
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'hi', name: 'Hindi (हिंदी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'or', name: 'Odia (ଓଡ଼ିଆ)' },
  { code: 'ur', name: 'Urdu (اردو)' },
  { code: 'en', name: 'English' },
];

export const createScript = async (userId: string, userEmail: string, title: string, writtenBy: string = "", description: string = ""): Promise<string> => {
  const scriptId = nanoid(20);
  const initialContent: ScriptElement[] = [
    { id: nanoid(), type: 'scene-heading', text: 'EXT. LOCATION - DAY' },
    { id: nanoid(), type: 'action', text: 'Start writing your script here...' }
  ];

  const scriptData = {
    id: scriptId,
    title,
    description,
    writtenBy: writtenBy || userEmail.split('@')[0],
    content: initialContent,
    ownerId: userId,
    ownerEmail: userEmail,
    collaborators: [],
    isPublic: false,
    publicPermission: 'view',
    shareId: nanoid(10),
    settings: {
      fontFamily: 'noto',
      showLabelsInPdf: true
    },
  };

  // 1. Save to Hostinger MySQL Database
  try {
    await fetch('/api/db/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scriptData)
    });
  } catch (err) {
    console.error("Error saving script to MySQL:", err);
  }

  // 2. Sync to Firestore for real-time backup
  try {
    await setDoc(doc(db, SCRIPTS_COLLECTION, scriptId), {
      ...scriptData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore sync backup notice:", err);
  }

  return scriptId;
};

export const updateScript = async (scriptId: string, data: Partial<Script>) => {
  // 1. Update in Hostinger MySQL Database
  try {
    const existing = await getScript(scriptId);
    if (existing) {
      const updatedScript = { ...existing, ...data, id: scriptId };
      await fetch('/api/db/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedScript)
      });
    }
  } catch (err) {
    console.error("Error updating script in MySQL:", err);
  }

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, SCRIPTS_COLLECTION, scriptId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Firestore update backup notice:", err);
  }
};

export const deleteScript = async (scriptId: string) => {
  // 1. Delete from Hostinger MySQL Database
  try {
    await fetch(`/api/db/scripts?scriptId=${scriptId}`, { method: 'DELETE' });
  } catch (err) {
    console.error("Error deleting script from MySQL:", err);
  }

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, SCRIPTS_COLLECTION, scriptId));
  } catch (err) {
    console.warn("Firestore delete backup notice:", err);
  }
};

export const getScript = async (scriptId: string): Promise<Script | null> => {
  try {
    const res = await fetch(`/api/db/scripts?scriptId=${scriptId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.script) {
        return data.script as Script;
      }
    }
  } catch (err) {
    console.error("Error fetching script from MySQL:", err);
  }

  // Fallback to Firestore
  const docRef = doc(db, SCRIPTS_COLLECTION, scriptId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Script;
  }
  return null;
};

export const getUserScripts = async (userId: string): Promise<Script[]> => {
  try {
    const res = await fetch(`/api/db/scripts?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.scripts)) {
        return data.scripts as Script[];
      }
    }
  } catch (err) {
    console.error("Error fetching user scripts from MySQL:", err);
  }

  // Fallback to Firestore
  const q = query(
    collection(db, SCRIPTS_COLLECTION), 
    where("ownerId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Script));
};

export const getScriptByShareId = async (shareId: string): Promise<Script | null> => {
  try {
    const res = await fetch(`/api/db/scripts?shareId=${shareId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.script) {
        return data.script as Script;
      }
    }
  } catch (err) {
    console.error("Error fetching script by shareId from MySQL:", err);
  }

  // Fallback to Firestore
  const q = query(collection(db, SCRIPTS_COLLECTION), where("shareId", "==", shareId));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Script;
  }
  return null;
};

export const subscribeToScript = (scriptId: string, callback: (script: Script | null) => void) => {
  return onSnapshot(doc(db, SCRIPTS_COLLECTION, scriptId), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Script);
    } else {
      callback(null);
    }
  });
};

export const exportToPDF = async (script: Script) => {
  try {
    const response = await fetch('/api/scripts/export-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(script),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};

export const getNextElementType = (currentType: ScriptElementType): ScriptElementType => {
  switch (currentType) {
    case 'scene-heading': return 'action';
    case 'character': return 'dialogue';
    case 'dialogue': return 'character';
    case 'parenthetical': return 'dialogue';
    case 'transition': return 'scene-heading';
    default: return 'action';
  }
};

export const translateScriptApi = async (elements: ScriptElement[], targetLanguage: string, scriptTitle?: string) => {
  const response = await fetch('/api/scripts/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ elements, targetLanguage, scriptTitle }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to translate script');
  }

  return await response.json();
};
