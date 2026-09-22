import React, { useState, useRef } from 'react';
import { checkUsernameUnique, updateUserProfile, uploadProfilePicture, isDeveloperUser } from '../../lib/social';
import { Camera, Check, Loader2, AlertCircle, Crown, Shield } from 'lucide-react';

interface Props {
  user: any;
  onComplete: (data?: any) => void;
  existingProfile?: any;
  onClose?: () => void;
}

export function ProfileSetup({ user, onComplete, existingProfile, onClose }: Props) {
  const [username, setUsername] = useState(existingProfile?.username || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(existingProfile?.photoURL || user?.picture || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDev = isDeveloperUser(user?.email, user?.username || username || existingProfile?.username);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    
    setLoading(true);
    setError('');
    try {
      if (cleanUsername !== existingProfile?.username) {
        const isUnique = await checkUsernameUnique(cleanUsername);
        if (!isUnique) {
          setError('Username is already taken.');
          setLoading(false);
          return;
        }
      }

      let newPhotoUrl = existingProfile?.photoURL || user.picture;
      if (photoFile) {
        newPhotoUrl = await uploadProfilePicture(user.uid, photoFile);
      }

      const updatedData: any = {
        username: cleanUsername,
        displayName: existingProfile?.displayName || user.name,
        photoURL: newPhotoUrl,
        searchName: cleanUsername,
      };

      if (isDev) {
        updatedData.role = 'developer';
        updatedData.isDeveloper = true;
      }

      await updateUserProfile(user.uid, updatedData);

      setSuccess(true);
      setTimeout(() => {
        onComplete(updatedData);
        if (onClose) onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-zinc-900 border ${isDev ? 'border-amber-500/50 shadow-amber-500/10' : 'border-zinc-800'} rounded-3xl p-6 w-full max-w-sm flex flex-col items-center shadow-2xl animate-fade-in-up`}>
        {onClose && (
           <button onClick={onClose} className="self-end text-zinc-500 hover:text-white">✕</button>
        )}

        {isDev && (
          <div className="mb-4 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-sm">
            <Crown className="w-4 h-4 text-amber-400" />
            DEVELOPER PROFILE (ROOT ADMIN)
          </div>
        )}

        <h2 className="text-xl font-bold text-white mb-1">{existingProfile ? 'Edit Profile' : 'Complete Your Profile'}</h2>
        <p className="text-sm text-zinc-400 mb-6 text-center">
          {existingProfile ? 'Update your display details' : 'Choose a unique username so friends can find you.'}
        </p>

        <div className="relative mb-6">
          <div className={`w-24 h-24 rounded-full overflow-hidden border-2 ${isDev ? 'border-amber-500 shadow-amber-500/30' : 'border-emerald-500/30'} bg-zinc-800 shadow-xl`}>
            {previewUrl ? (
              <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Camera className="w-8 h-8" />
              </div>
            )}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`absolute bottom-0 right-0 w-8 h-8 ${isDev ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-white'} rounded-full flex items-center justify-center hover:opacity-90 border-2 border-zinc-900 transition-colors shadow`}
          >
            <Camera className="w-4 h-4" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoSelect} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="w-full mb-4">
          <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-8 pr-3 text-white placeholder-zinc-600 focus:border-emerald-500/50 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="w-full flex items-center gap-2 text-red-400 text-xs mb-4 bg-red-400/10 p-2.5 rounded-lg border border-red-400/20">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button 
          onClick={handleSave}
          disabled={loading || success}
          className={`w-full py-2.5 ${isDev ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-extrabold' : 'bg-emerald-500 text-zinc-950 font-bold'} hover:opacity-95 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : success ? (
            <>
              <Check className="w-4 h-4" /> Saved!
            </>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  );
}
