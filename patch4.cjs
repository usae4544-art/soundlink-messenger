const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the Users import
code = code.replace(`import { Users, auth, db } from './lib/firebase';`, `import { auth, db } from './lib/firebase';`);
code = code.replace(`import {\n  Mic,`, `import {\n  Users,\n  Mic,`);

fs.writeFileSync('src/App.tsx', code);
console.log('Fixed Users icon import');
