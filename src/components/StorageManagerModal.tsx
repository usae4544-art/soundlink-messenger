import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiHelper';
import {
  HardDrive,
  Trash2,
  RefreshCw,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';

interface StorageFile {
  name: string;
  size: number;
  mtime: number;
  url: string;
}

interface StorageStatus {
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
  fileCount: number;
  isWarning: boolean;
  warningThreshold: number;
  retentionDays: number;
  policy: string;
  files?: StorageFile[];
}

interface Props {
  isOpen?: boolean;
  onClose: () => void;
}

export function StorageManagerModal({ isOpen = true, onClose }: Props) {
  const [stats, setStats] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/storage-status');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Storage fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePurgeExpired = async () => {
    setPurging(true);
    try {
      const res = await apiFetch('/api/cleanup-storage', { method: 'POST' });
      const data = await res.json();
      setFeedback(`Purge complete: Removed ${data.cleanedCount || 0} old files. Freed ${((data.freedBytes || 0) / 1024 / 1024).toFixed(2)} MB.`);
      await fetchStats();
      setTimeout(() => setFeedback(null), 5000);
    } catch (e) {
      setFeedback('Failed to execute storage purge.');
    } finally {
      setPurging(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setDeletingFile(filename);
    try {
      const res = await fetch(`/api/storage-file/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setFeedback(`File "${filename}" deleted successfully.`);
        await fetchStats();
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (e) {
      setFeedback('Failed to delete file.');
    } finally {
      setDeletingFile(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileCategory = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')) return 'image';
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv')) return 'video';
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a')) return 'audio';
    return 'other';
  };

  const filteredFiles = (stats?.files || []).filter(f => {
    const cat = getFileCategory(f.name);
    if (filterType !== 'all' && cat !== filterType) return false;
    if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-zinc-800 bg-zinc-950/90 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all shrink-0 border border-zinc-700/80 active:scale-95 shadow-sm"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-lg font-bold text-white truncate">
                Storage & Quota Manager
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                Manage cloud & local storage usage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all shrink-0 border border-zinc-700/80 active:scale-95 shadow-sm"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-zinc-300 hover:text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Quota Overview Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[11px] text-zinc-400 block font-medium">Used Space</span>
              <span className="text-base sm:text-lg font-bold text-white block mt-0.5">
                {stats ? formatBytes(stats.usedBytes) : '0 MB'}
              </span>
              <span className="text-[10px] text-zinc-500 block">Quota: 500 MB</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[11px] text-zinc-400 block font-medium">File Count</span>
              <span className="text-base sm:text-lg font-bold text-white block mt-0.5">
                {stats?.fileCount || 0}
              </span>
              <span className="text-[10px] text-zinc-500 block">attachments</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800">
              <span className="text-[11px] text-zinc-400 block font-medium">Quota Usage</span>
              <span
                className={`text-base sm:text-lg font-bold block mt-0.5 ${
                  stats && stats.usagePercent >= 60 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {stats?.usagePercent || 0}%
              </span>
              <span className="text-[10px] text-zinc-500 block">
                {stats && stats.usagePercent >= 60 ? 'Warning (>=60%)' : 'Healthy'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Cloud Storage Usage</span>
              <span>{stats?.usagePercent || 0}% used</span>
            </div>
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  stats && stats.usagePercent >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, stats?.usagePercent || 0)}%` }}
              />
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Policy & Auto Cleanup Note */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <span className="text-zinc-200 font-semibold block">Automatic Protection Policy</span>
              <p className="text-[11px]">
                User authentication profiles, Google contact pictures, and essential chat logs are permanently preserved. Non-critical media files over 48 hours old can be cleaned up to protect your free quota.
              </p>
            </div>
          </div>

          {/* Firebase Free Limits Breakdown */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
            <div className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Firebase Free Tier Quotas</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Active</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Cloud Firestore</span>
                <span className="text-zinc-200 font-bold">1 GiB</span>
                <span className="text-zinc-500 block text-[9px]">Text & Profiles</span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Cloud Storage</span>
                <span className="text-zinc-200 font-bold">5 GB</span>
                <span className="text-zinc-500 block text-[9px]">Media & Uploads</span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Firebase Hosting</span>
                <span className="text-zinc-200 font-bold">10 GB</span>
                <span className="text-zinc-500 block text-[9px]">Web App Hosting</span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-500 block text-[10px]">Auth Users</span>
                <span className="text-zinc-200 font-bold">Unlimited</span>
                <span className="text-zinc-500 block text-[9px]">Free Logins</span>
              </div>
            </div>
          </div>

          {/* File Management Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Files In Storage ({filteredFiles.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchStats}
                disabled={loading}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handlePurgeExpired}
                disabled={purging}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{purging ? 'Purging...' : 'Purge Old Files (>2 Days)'}</span>
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              All Files
            </button>
            <button
              onClick={() => setFilterType('image')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                filterType === 'image'
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setFilterType('video')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                filterType === 'video'
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Videos
            </button>
            <button
              onClick={() => setFilterType('audio')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                filterType === 'audio'
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Audios
            </button>
          </div>

          {/* Search Box */}
          <div>
            <input
              type="text"
              placeholder="Search file name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Files List */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs bg-zinc-950/50 rounded-2xl border border-zinc-800/80">
                No storage files found.
              </div>
            ) : (
              filteredFiles.map((file) => {
                const cat = getFileCategory(file.name);
                const isDel = deletingFile === file.name;
                return (
                  <div
                    key={file.name}
                    className="p-2.5 sm:p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        {cat === 'image' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                        {cat === 'video' && <Film className="w-4 h-4 text-blue-400" />}
                        {cat === 'audio' && <Music className="w-4 h-4 text-purple-400" />}
                        {cat === 'other' && <FileText className="w-4 h-4 text-zinc-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-zinc-200 font-medium truncate block max-w-[200px] sm:max-w-xs" title={file.name}>
                          {file.name}
                        </span>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span>{formatBytes(file.size)}</span>
                          <span>•</span>
                          <span>{new Date(file.mtime).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                        title="Open/Preview file"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.name)}
                        disabled={isDel}
                        className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950/95 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-zinc-500 hidden sm:inline">
            Tap outside or press ESC to return
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ml-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
