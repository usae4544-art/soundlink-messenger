const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace imports
code = code.replace(
  `import { GoogleLogin, googleLogout } from '@react-oauth/google';\nimport { jwtDecode } from 'jwt-decode';`,
  `import { auth, db } from './lib/firebase';\nimport { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';\nimport { doc, setDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';`
);

// Add auth state listener
code = code.replace(
  `const [user, setUser] = useState<any>(null);`,
  `const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          picture: firebaseUser.photoURL
        });
        
        // Real-time sync of sent history
        const unsubDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists() && docSnap.data().history) {
            setSentHistory(docSnap.data().history);
          }
        });
        return () => unsubDoc();
      } else {
        setUser(null);
        setSentHistory([]); // clear history on logout
      }
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      await setDoc(doc(db, 'users', u.uid), {
        name: u.displayName,
        email: u.email,
        picture: u.photoURL,
        lastLogin: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };
`
);

// Update addToSentHistory to also save to Firestore
const addToSentHistoryRegex = /const addToSentHistory = \(\) => \{[\s\S]*?setSentHistory\(prev => \[newItem, \.\.\.prev\]\);\n  \};/;
const addToSentHistoryReplacement = `const addToSentHistory = () => {
    let name = '';
    let previewUrl = '';
    if (sendMode === 'text') name = message.substring(0, 30) + (message.length > 30 ? '...' : '');
    if (sendMode === 'image') { name = realImageMeta?.name || 'Image'; previewUrl = realImageDataUrl || ''; }
    if (sendMode === 'video') { name = realVideoMeta?.name || 'Video'; previewUrl = realVideoDataUrl || ''; }
    if (sendMode === 'audio') { name = realAudioMeta?.name || 'Audio'; previewUrl = realAudioDataUrl || ''; }

    const newItem: SentHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      type: sendMode,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      name,
      previewUrl
    };
    
    setSentHistory(prev => [newItem, ...prev]);
    
    // Sync to Firestore if user is logged in
    if (auth.currentUser) {
      setDoc(doc(db, 'users', auth.currentUser.uid), {
        history: [newItem, ...sentHistory]
      }, { merge: true }).catch(console.error);
    }
  };`;
code = code.replace(addToSentHistoryRegex, addToSentHistoryReplacement);

// Update JSX for Google Sign-In
const googleLoginJsxRegex = /<GoogleLogin[\s\S]*?theme="filled_black"\n\s*\/>/;
const googleLoginJsxReplacement = `<button
                  onClick={loginWithGoogle}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-100 text-black text-xs font-semibold rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in
                </button>`;
code = code.replace(googleLoginJsxRegex, googleLoginJsxReplacement);

const googleLogoutJsxRegex = /googleLogout\(\);\n\s*setUser\(null\);/;
const googleLogoutJsxReplacement = `handleLogout();`;
code = code.replace(googleLogoutJsxRegex, googleLogoutJsxReplacement);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated.');
