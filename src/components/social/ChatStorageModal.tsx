import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Trash2,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  ExternalLink,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FolderArchive,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { clearChatMessages } from '../../lib/social';

interface Props {
  chatId: string;
  currentUser: any;
  otherUser: any;
  messages?: any[];
  onClose: () => void;
}

export function ChatStorageModal({ chatId, currentUser, otherUser, messages: initialMessages, onClose }: Props) {
  const [messages, setMessages] = useState<any[]>(initialMessages || []);
  const [clearing, setClearing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'photos' | 'videos' | 'audio'>('all');
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Subscribe to messages if not provided or to stay reactive
  useEffect(() => {
    let unsub: (() => void) | undefined;
    import('../../lib/social').then(({ subscribeToMessages }) => {
      unsub = subscribeToMessages(chatId, (msgs) => {
        setMessages(msgs);
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, [chatId]);

  // Extract all media items from chat messages
  const mediaItems = messages.filter(m => m.fileUrl || m.soundUrl);

  const myMediaItems = mediaItems.filter(m => m.senderId === currentUser.uid);
  const otherMediaItems = mediaItems.filter(m => m.senderId !== currentUser.uid);

  const getMediaCategory = (msg: any) => {
    if (msg.soundUrl) return 'audio';
    const type = msg.fileType || '';
    const url = (msg.fileUrl || '').toLowerCase();
    if (type.startsWith('image/') || url.match(/\.(png|jpe?g|webp|gif)$/)) return 'photos';
    if (type.startsWith('video/') || url.match(/\.(mp4|webm|mov|mkv)$/)) return 'videos';
    if (type.startsWith('audio/') || url.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio';
    return 'docs';
  };

  const filteredItems = mediaItems.filter(m => {
    if (activeTab === 'all') return true;
    if (activeTab === 'mine') return m.senderId === currentUser.uid;
    return getMediaCategory(m) === activeTab;
  });

  const getFilenameFromUrl = (url: string) => {
    if (!url) return 'file';
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1] || 'file');
  };

  const handleClearChat = async (onlyMedia = false, onlyMine = false) => {
    const actionLabel = onlyMine
      ? 'Delete all YOUR sent media in this chat'
      : onlyMedia
      ? 'Delete ALL shared media (photos, videos, voice) in this chat'
      : 'Clear entire chat history and files for this conversation';

    if (!confirm(`${actionLabel}? This will free storage immediately.`)) {
      return;
    }

    setClearing(true);
    try {
      const res = await clearChatMessages(chatId, {
        onlyMedia,
        senderId: onlyMine ? currentUser.uid : undefined
      });
      setFeedback(`Successfully cleaned ${res.deletedCount} messages & ${res.deletedFilesCount} files!`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (e: any) {
      setFeedback(e?.message || 'Failed to clear chat storage.');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteSingle = async (msg: any) => {
    if (!confirm('Delete this file from chat and free storage?')) return;
    setDeletingMsgId(msg.id);
    try {
      // 1. Delete message from firestore
      const { deleteMessage } = await import('../../lib/social');
      await deleteMessage(chatId, msg.id);

      // 2. If it is stored on server /uploads, delete file
      const targetUrl = msg.fileUrl || msg.soundUrl;
      if (targetUrl && targetUrl.startsWith('/uploads/')) {
        const fname = targetUrl.replace('/uploads/', '');
        await fetch(`/api/storage-file/${encodeURIComponent(fname)}`, { method: 'DELETE' });
      }
      setFeedback('File deleted.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      setFeedback('Error deleting file.');
    } finally {
      setDeletingMsgId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-zinc-800 bg-zinc-950/90 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all shrink-0 border border-zinc-700/80 active:scale-95 shadow-sm"
              title="Back to chat"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FolderArchive className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Chat Storage: @{otherUser?.username || 'contact'}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate">
                Manage photos, audio notes & media for this chat
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block font-medium">Total Messages</span>
              <span className="text-base font-bold text-white block mt-0.5">{messages.length}</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block font-medium">Shared Media</span>
              <span className="text-base font-bold text-emerald-400 block mt-0.5">{mediaItems.length}</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block font-medium">Your Uploads</span>
              <span className="text-base font-bold text-blue-400 block mt-0.5">{myMediaItems.length}</span>
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Action Clean Buttons for this Chat */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2.5">
            <span className="text-xs font-semibold text-zinc-200 block">Clean Up This Chat Storage</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleClearChat(true, true)}
                disabled={clearing || myMediaItems.length === 0}
                className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete My Sent Media ({myMediaItems.length})</span>
              </button>

              <button
                onClick={() => handleClearChat(true, false)}
                disabled={clearing || mediaItems.length === 0}
                className="px-3 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Media ({mediaItems.length})</span>
              </button>
            </div>
            <button
              onClick={() => handleClearChat(false, false)}
              disabled={clearing || messages.length === 0}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-800 text-zinc-400 hover:text-red-300 text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Entire Conversation History ({messages.length} msgs)</span>
            </button>
          </div>

          {/* Media Filter Tabs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Chat Attachments ({filteredItems.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                All ({mediaItems.length})
              </button>
              <button
                onClick={() => setActiveTab('mine')}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'mine'
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Sent By Me ({myMediaItems.length})
              </button>
              <button
                onClick={() => setActiveTab('photos')}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'photos'
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Photos
              </button>
              <button
                onClick={() => setActiveTab('videos')}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'videos'
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Videos
              </button>
              <button
                onClick={() => setActiveTab('audio')}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  activeTab === 'audio'
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Audio Notes
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-xs bg-zinc-950/50 rounded-2xl border border-zinc-800">
                No media files in this category.
              </div>
            ) : (
              filteredItems.map(msg => {
                const url = msg.fileUrl || msg.soundUrl;
                const cat = getMediaCategory(msg);
                const isMine = msg.senderId === currentUser.uid;
                const isDel = deletingMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        {cat === 'photos' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                        {cat === 'videos' && <Film className="w-4 h-4 text-blue-400" />}
                        {cat === 'audio' && <Music className="w-4 h-4 text-purple-400" />}
                        {cat === 'docs' && <FileText className="w-4 h-4 text-zinc-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-zinc-200 font-medium truncate block max-w-[180px] sm:max-w-xs" title={getFilenameFromUrl(url)}>
                          {getFilenameFromUrl(url)}
                        </span>
                        <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span className={isMine ? 'text-blue-400 font-medium' : 'text-zinc-400'}>
                            {isMine ? 'You sent' : `@${otherUser?.username || 'contact'} sent`}
                          </span>
                          <span>•</span>
                          <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : 'recent'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                        title="View file"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteSingle(msg)}
                        disabled={isDel}
                        className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title="Delete file to free storage"
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
            Tap outside or press ESC to return to chat
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 ml-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
