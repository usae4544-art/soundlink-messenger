import React, { useState, useEffect } from 'react';
import { subscribeToAllUsers, setUserSuspendedStatus, DEVELOPER_EMAIL } from '../../lib/social';
import {
  Shield,
  ShieldAlert,
  UserX,
  UserCheck,
  HardDrive,
  Trash2,
  RefreshCw,
  Crown,
  AlertTriangle,
  Copy,
  Check,
  Search,
  X,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Film,
  Music
} from 'lucide-react';

interface Props {
  onClose: () => void;
  currentUser?: any;
  onActivateDeveloper?: () => void;
}

export function DeveloperPanel({ onClose, currentUser, onActivateDeveloper }: Props) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<any>(null);
  const [cleaning, setCleaning] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [storageTab, setStorageTab] = useState<'overview' | 'files'>('overview');
  const [fileFilter, setFileFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');

  useEffect(() => {
    const unsub = subscribeToAllUsers((userList) => {
      setUsers(userList);
      setLoading(false);
    });

    fetchStorageStats();

    return unsub;
  }, []);

  const fetchStorageStats = async () => {
    try {
      const res = await fetch('/api/storage-status');
      if (res.ok) {
        const data = await res.json();
        setStorageStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch storage stats", e);
    }
  };

  const handleToggleSuspend = async (uid: string, currentSuspended: boolean) => {
    try {
      await setUserSuspendedStatus(uid, !currentSuspended);
    } catch (e) {
      console.error("Failed to toggle user suspension", e);
      alert("Failed to update user suspension status.");
    }
  };

  const handleForceCleanup = async () => {
    setCleaning(true);
    try {
      const res = await fetch('/api/cleanup-storage', { method: 'POST' });
      const data = await res.json();
      alert(`Cleanup Complete: Purged ${data.cleanedCount || 0} expired files. Freed ${((data.freedBytes || 0) / 1024 / 1024).toFixed(2)} MB.`);
      await fetchStorageStats();
    } catch (e) {
      alert("Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Permanently delete file "${filename}"?`)) return;
    setDeletingFile(filename);
    try {
      const res = await fetch(`/api/storage-file/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchStorageStats();
      } else {
        alert("Failed to delete file.");
      }
    } catch (e) {
      alert("Error deleting file.");
    } finally {
      setDeletingFile(null);
    }
  };

  const getFileCategory = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')) return 'image';
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv')) return 'video';
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a')) return 'audio';
    return 'other';
  };

  const copyToClipboard = (text: string, uid: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      (u.displayName && u.displayName.toLowerCase().includes(term)) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.uid && u.uid.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-zinc-800 bg-zinc-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 mt-0.5 sm:mt-0">
              <Crown className="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Developer Master Dashboard
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold tracking-wider uppercase shrink-0">
                  Root Admin
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 break-all">
                Root Email:{' '}
                <span className="text-amber-400 font-mono font-medium">{DEVELOPER_EMAIL}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
              title="Close Dashboard"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-6">
          {/* Quick Root Activation Banner if not current dev */}
          {(!currentUser || currentUser.email !== DEVELOPER_EMAIL) && onActivateDeveloper && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-start gap-2.5 min-w-0">
                <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200 leading-relaxed">
                  <span className="font-bold text-white block mb-0.5">Activate Root Developer Permissions</span>
                  Log in as <b className="text-amber-300">{DEVELOPER_EMAIL}</b> to manage all users, delete files, and access root VIP tools on any mobile or desktop device.
                </div>
              </div>
              <button
                onClick={onActivateDeveloper}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all shrink-0 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Activate Developer Account</span>
              </button>
            </div>
          )}
          {/* Storage & Quota Monitor */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 shadow-inner space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                <h3 className="text-sm font-bold text-white">Cloud Storage & Quota Monitor</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={fetchStorageStats}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleForceCleanup}
                  disabled={cleaning}
                  className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{cleaning ? 'Cleaning...' : 'Purge Expired (>2 Days)'}</span>
                </button>
              </div>
            </div>

            {storageStats && (
              <div className="space-y-3">
                {/* Storage Sub-Tabs */}
                <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2 flex-wrap">
                  <button
                    onClick={() => setStorageTab('overview')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      storageTab === 'overview'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Storage Overview
                  </button>
                  <button
                    onClick={() => setStorageTab('files')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      storageTab === 'files'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Browse & Delete Files</span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-300 font-mono">
                      {storageStats.files?.length || storageStats.fileCount || 0}
                    </span>
                  </button>
                </div>

                {storageTab === 'overview' ? (
                  <>
                    {/* Visual Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80">
                        <span className="text-zinc-500 block text-[11px]">Storage Used</span>
                        <span className="text-white font-bold text-sm">
                          {((storageStats.usedBytes || 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                        <span className="text-zinc-500 text-[10px] block">of 500 MB quota</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80">
                        <span className="text-zinc-500 block text-[11px]">Stored Files</span>
                        <span className="text-white font-bold text-sm">
                          {storageStats.fileCount || 0}
                        </span>
                        <span className="text-zinc-500 text-[10px] block">chat attachments</span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80">
                        <span className="text-zinc-500 block text-[11px]">Capacity Status</span>
                        <span
                          className={`font-bold text-sm block ${
                            storageStats.isWarning ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {storageStats.usagePercent}% Used
                        </span>
                        <span className="text-zinc-500 text-[10px] block">
                          {storageStats.isWarning ? '⚠️ Warning threshold' : '✓ Normal range'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          storageStats.usagePercent >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, storageStats.usagePercent)}%` }}
                      ></div>
                    </div>

                    {storageStats.isWarning && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">Storage Alert (&ge; 60% Capacity)</p>
                          <p className="text-zinc-300 text-[11px] leading-relaxed">
                            Automated cleanup policy is active. Non-premium chat upload attachments older than 2 days are eligible for cleanup. User Google photos and core accounts are protected permanently.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* File Manager View */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <button
                        onClick={() => setFileFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          fileFilter === 'all'
                            ? 'bg-amber-500 text-black font-semibold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setFileFilter('image')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          fileFilter === 'image'
                            ? 'bg-amber-500 text-black font-semibold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Photos
                      </button>
                      <button
                        onClick={() => setFileFilter('video')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          fileFilter === 'video'
                            ? 'bg-amber-500 text-black font-semibold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Videos
                      </button>
                      <button
                        onClick={() => setFileFilter('audio')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          fileFilter === 'audio'
                            ? 'bg-amber-500 text-black font-semibold'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Audios
                      </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {(!storageStats.files || storageStats.files.length === 0) ? (
                        <div className="p-6 text-center text-zinc-500 text-xs bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                          No files found in storage uploads directory.
                        </div>
                      ) : (
                        storageStats.files
                          .filter((f: any) => {
                            if (fileFilter === 'all') return true;
                            return getFileCategory(f.name) === fileFilter;
                          })
                          .map((f: any) => {
                            const cat = getFileCategory(f.name);
                            const isDeleting = deletingFile === f.name;
                            return (
                              <div
                                key={f.name}
                                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                                    {cat === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
                                    {cat === 'video' && <Film className="w-3.5 h-3.5 text-blue-400" />}
                                    {cat === 'audio' && <Music className="w-3.5 h-3.5 text-purple-400" />}
                                    {cat === 'other' && <FileText className="w-3.5 h-3.5 text-zinc-400" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs text-zinc-200 font-medium truncate block" title={f.name}>
                                      {f.name}
                                    </span>
                                    <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                                      <span>{((f.size || 0) / 1024 / 1024).toFixed(2)} MB</span>
                                      <span>•</span>
                                      <span>{f.mtime ? new Date(f.mtime).toLocaleDateString() : ''}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                    title="Open file"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                  <button
                                    onClick={() => handleDeleteFile(f.name)}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                                    title="Delete file"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Management */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                <h3 className="text-sm font-bold text-white">
                  Registered Users & Logins ({users.length})
                </h3>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, email, UID..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                Loading user registry...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950/40 rounded-2xl border border-zinc-800">
                No users found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredUsers.map((u) => {
                  const isDev = u.email === DEVELOPER_EMAIL || u.role === 'developer';
                  const isSuspended = !!u.suspended;

                  return (
                    <div
                      key={u.uid}
                      className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isSuspended
                          ? 'bg-red-950/20 border-red-800/50'
                          : isDev
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <img
                          src={
                            u.photoURL ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username || 'user'}`
                          }
                          alt=""
                          className="w-10 h-10 rounded-full bg-zinc-800 object-cover shrink-0 border border-zinc-700/60 mt-0.5 sm:mt-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white break-words">
                              {u.displayName || 'Unnamed User'}
                            </span>
                            {isDev && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-400">
                                DEVELOPER
                              </span>
                            )}
                            {isSuspended && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-bold text-red-400">
                                SUSPENDED
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
                            <span className="text-emerald-400 font-medium">
                              @{u.username || 'unknown'}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-300 font-mono break-all text-[11px]">
                              {u.email || 'No email registered'}
                            </span>
                          </div>

                          <div className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-zinc-400 break-all">
                              UID: {u.uid}
                            </span>
                            <button
                              onClick={() => copyToClipboard(u.uid, u.uid)}
                              className="text-zinc-400 hover:text-amber-400 p-0.5 rounded transition-colors inline-flex items-center gap-1 text-[10px]"
                              title="Copy UID"
                            >
                              {copiedUid === u.uid ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            <span className="text-zinc-600">•</span>
                            <span>
                              Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {!isDev && (
                        <div className="flex items-center justify-end sm:justify-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                          {isSuspended ? (
                            <button
                              onClick={() => handleToggleSuspend(u.uid, true)}
                              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Unsuspend User</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleSuspend(u.uid, false)}
                              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Suspend User</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
