const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Insert the Social Tab view rendering
const sendTabRegex = /\{activeTab === 'send' \? \(/;
const replacement = `
          {activeTab === 'social' && user && userProfile ? (
            <div className="h-[600px] animate-in fade-in duration-200">
              <SocialTab user={user} userProfile={userProfile} />
            </div>
          ) : activeTab === 'send' ? (`;

code = code.replace(sendTabRegex, replacement);

// Also need to add ProfileSetup render
const contentBodyRegex = /\{"\/\* Content Body \*\/"\}/;
const profileSetupRender = `
        {showProfileSetup && user && (
          <ProfileSetup 
            user={user} 
            existingProfile={userProfile} 
            onComplete={() => setShowProfileSetup(false)} 
            onClose={userProfile?.username ? () => setShowProfileSetup(false) : undefined}
          />
        )}
        
        {/* Content Body */}`;
        
code = code.replace(/\{\/\* Content Body \*\/\}/, profileSetupRender);

// Let's also add a Profile Edit button in the header near logout
const headerUserRegex = /<img src=\{user\.picture\} alt="Profile" className="w-6 h-6 rounded-full" \/>\s*<span className="text-xs text-zinc-300 hidden sm:block font-medium">\{user\.name\}<\/span>\s*<button/;

const headerUserReplacement = `<img 
                  src={userProfile?.photoURL || user.picture} 
                  alt="Profile" 
                  className="w-6 h-6 rounded-full cursor-pointer hover:opacity-80" 
                  onClick={() => setShowProfileSetup(true)}
                  title="Edit Profile"
                />
                <span 
                  className="text-xs text-zinc-300 hidden sm:block font-medium cursor-pointer hover:text-white"
                  onClick={() => setShowProfileSetup(true)}
                  title="Edit Profile"
                >
                  {userProfile?.username ? '@'+userProfile.username : user.name}
                </span>
                <button`;

code = code.replace(headerUserRegex, headerUserReplacement);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx patched for social views');
