import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, set, update, get, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const cfg = {
  apiKey: "AIzaSyBmXlvf2ElTEiFs3-GZkF_3wh08U0V6WHY",
  authDomain: "school-website-7b39a.firebaseapp.com",
  projectId: "school-website-7b39a",
  storageBucket: "school-website-7b39a.firebasestorage.app",
  messagingSenderId: "1087380942104",
  appId: "1:1087380942104:web:ddd2f83f211cae2eb5826d",
  databaseURL: "https://school-website-7b39a-default-rtdb.firebaseio.com"
};

const app = initializeApp(cfg);
const db  = getDatabase(app);
const auth = getAuth(app);

window.FB = {
  db, ref, push, onValue, remove, set, update, get, onDisconnect, serverTimestamp,
  r: (path) => ref(db, path),
  auth,
  createUserWithEmailAndPassword: (email, pass) => createUserWithEmailAndPassword(auth, email, pass),
  signInWithEmailAndPassword:     (email, pass) => signInWithEmailAndPassword(auth, email, pass),
  signOut: () => signOut(auth)
};

// onAuthStateChanged — session restore করে, custom session ছাড়াই
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    // User লগইন আছে — DB থেকে profile আনো
    const snap = await get(ref(db, 'users/' + firebaseUser.uid));
    if (snap.exists()) {
      const data = snap.val();
      const alreadyHome = !document.getElementById('authScreen').classList.contains('active');
      window.ME = {
        uid: firebaseUser.uid,
        username: data.username,
        displayName: data.displayName,
        color: data.color
      };
      // Page reload এ authScreen active থাকে, তখন goHome() call করো
      if (!alreadyHome) {
        // goHome script load হওয়া পর্যন্ত wait করো
        const tryGo = () => window.goHome ? window.goHome() : setTimeout(tryGo, 50);
        tryGo();
      }
    }
  }
  // FB_READY signal (পুরনো whenReady()-এর জন্য)
  window.FB_READY = true;
  window.dispatchEvent(new Event('fb-ready'));
});
