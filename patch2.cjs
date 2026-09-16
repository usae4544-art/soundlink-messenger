const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Import social components
const imports = `import { ProfileSetup } from './components/social/ProfileSetup';
import { SocialTab } from './components/social/SocialTab';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';\n`;

code = code.replace(`import { AudioReactiveImage } from './components/AudioReactiveImage';`, imports + `import { AudioReactiveImage } from './components/AudioReactiveImage';`);

// Add User Profile state
code = code.replace(`const [user, setUser] = useState<any>(null);`, `const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);`);

// Update the useEffect for auth
const authEffectRegex = /useEffect\(\(\) => \{\s*const unsubscribe = onAuthStateChanged\(auth, \(firebaseUser\) => \{[\s\S]*?\}\);\s*return \(\) => unsubscribe\(\);\s*\}, \[\]\);/;
const newAuthEffect = `useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          picture: firebaseUser.photoURL
        });
        
        // Fetch User Profile
        const profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            if (!data.username) {
              setShowProfileSetup(true);
            }
          } else {
             setShowProfileSetup(true);
          }
        });

        return () => {
          profileUnsub();
        };
      } else {
        setUser(null);
        setUserProfile(null);
        setSentHistory([]);
      }
    });
    return () => unsubscribe();
  }, []);`;

code = code.replace(authEffectRegex, newAuthEffect);

// Add Social to Tabs Type
code = code.replace(`useState<'send' | 'receive'>('send');`, `useState<'send' | 'receive' | 'social'>('send');`);

// Update JSX Tabs
const tabRegex = /<button\s*onClick=\{\(\) => setActiveTab\('receive'\)\}[\s\S]*?<RadioReceiver className="w-4 h-4" \/> Listen \(Receive\)\s*<\/button>\s*<\/div>/;
const newTabs = `<button
            onClick={() => setActiveTab('receive')}
            className={\`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 \${
              activeTab === 'receive'
                ? 'bg-zinc-800 text-emerald-400 shadow-lg border border-zinc-700/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent'
            }\`}
          >
            <RadioReceiver className="w-4 h-4" /> Listen
          </button>
          {user && (
            <button
              onClick={() => setActiveTab('social')}
              className={\`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 \${
                activeTab === 'social'
                  ? 'bg-zinc-800 text-emerald-400 shadow-lg border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent'
              }\`}
            >
              <Users className="w-4 h-4" /> Chat
            </button>
          )}
        </div>`;
code = code.replace(tabRegex, newTabs);
code = code.replace(`import {`, `import { Users,`); // Ensure Users icon is imported

// Add Social tab content rendering
const mainContentRegex = /\{activeTab === 'send' \? \([\s\S]*?\) : \([\s\S]*?\{!isListening \? \([\s\S]*?\) : \([\s\S]*?\) \}\s*<\/div>\s*\)\}/;
const newMainContent = `{activeTab === 'send' ? (
          /* SEND TAB CONTENT REPLACED BY PATTERN, WILL KEEP EXISTING */
          <div className="flex flex-col md:flex-row h-full min-h-[500px]">
          {/* We will just wrap the existing condition */}
`;
// Wait, replacing this way is brittle. Let's do it safely.
fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated auth and tabs');
