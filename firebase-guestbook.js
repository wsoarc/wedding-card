import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { addDoc, collection, getFirestore, limit, onSnapshot, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
export const isFirebaseConfigured = requiredKeys.every(key => {
  const value = firebaseConfig?.[key];
  return typeof value === 'string' && value && !value.startsWith('YOUR_');
});

let db;
let auth;

function services() {
  if (!isFirebaseConfigured) throw new Error('Firebase 설정이 비어 있습니다.');
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
  return { db, auth };
}

async function currentUser() {
  const { auth: firebaseAuth } = services();
  return firebaseAuth.currentUser || (await signInAnonymously(firebaseAuth)).user;
}

export async function addGuestbookEntry({ name, message }) {
  const { db: firestore } = services();
  const user = await currentUser();
  return addDoc(collection(firestore, 'guestbook'), { name, message, authorId: user.uid, createdAt: serverTimestamp() });
}

export function subscribeGuestbook(onEntries, onError) {
  const { db: firestore } = services();
  const entries = query(collection(firestore, 'guestbook'), orderBy('createdAt', 'desc'), limit(21));
  return onSnapshot(entries, snapshot => onEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))), onError);
}
