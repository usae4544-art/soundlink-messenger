const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Combine imports
code = code.replace(
  `import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';`,
  `import { doc, getDoc, setDoc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';`
);
code = code.replace(`import { doc, getDoc, onSnapshot } from 'firebase/firestore';`, ``);

fs.writeFileSync('src/App.tsx', code);
console.log('Fixed imports');
