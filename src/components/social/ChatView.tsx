import React, { useState, useEffect, useRef } from 'react';
import {
  sendMessage,
  uploadGeneralFile,
  subscribeToMessages,
  deleteMessage,
  updateChatTheme,
  isDeveloperUser
} from '../../lib/social';
import {
  ArrowLeft,
  Send,
  Play,
  Volume2,
  Clock,
  Trash2,
  Phone,
  Video as VideoIcon,
  Palette,
  Shield,
  Crown,
  Paperclip,
  Check,
  HardDrive,
  Lock,
  Sparkles
} from 'lucide-react';
import { CHAT_THEMES } from './ChatThemes';
import { ChatStorageModal } from './ChatStorageModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
  onDecodeRequest?: (url: string) => void;
  chatId: string;
  currentUser: any;
  otherUser: any;
  onBack: () => void;
  onStartCall?: (type: 'voice' | 'video') => void;
}

export function ChatView({
  chatId,
  currentUser,
  otherUser,
  onBack,
  onDecodeRequest,
  onStartCall
}: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expiryMs, setExpiryMs] = useState<number>(0);
  const [activeThemeId, setActiveThemeId] = useState<string>('emerald');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [themeNotice, setThemeNotice] = useState<string | null>(null);
  const [showChatStorage, setShowChatStorage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOtherDeveloper = isDeveloperUser(otherUser?.email);
  const isCurrentDeveloper = isDeveloperUser(currentUser?.email);
  const isUserSuspended = !!currentUser?.suspended;

  // Listen to chat document to sync theme in real-time for both participants
  useEffect(() => {
    const unsubChat = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.theme && CHAT_THEMES[data.theme]) {
          setActiveThemeId(data.theme);
        }
      }
    });

    const unsubMsgs = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });

    return () => {
      unsubChat();
      unsubMsgs();
    };
  }, [chatId]);

  const currentTheme = CHAT_THEMES[activeThemeId] || CHAT_THEMES.emerald;

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = text.trim();
    if (!msgText || isSending || isUserSuspended) return;

    // Optimistic Update for instant feel
    setText('');
    setMessages((prev) => [
      ...prev,
      {
        id: 'temp-' + Date.now(),
        senderId: currentUser.uid,
        text: msgText,
        timestamp: Date.now()
      }
    ]);

    try {
      await sendMessage(chatId, currentUser.uid, msgText, undefined, expiryMs > 0 ? expiryMs : undefined);
    } catch (err) {
      console.error(err);
      alert("Failed to send message.");
    }
  };

  const handleSendFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUserSuspended) {
      alert("Your account is suspended. You cannot upload files.");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 150 * 1024 * 1024) {
        alert('File is too large! Please select a file smaller than 150MB.');
        return;
      }
      setIsSending(true);
      try {
        const url = await uploadGeneralFile(chatId, file, (p) => setUploadProgress(p));
        await sendMessage(chatId, currentUser.uid, '', undefined, expiryMs > 0 ? expiryMs : undefined, url, file.type);
      } catch (err) {
        console.error("Failed to send File", err);
        alert("Failed to send File.");
      } finally {
        setIsSending(false);
        setUploadProgress(0);
      }
    }
  };

  const handleSelectTheme = async (themeKey: string) => {
    const selected = CHAT_THEMES[themeKey];
    if (!selected) return;

    if (selected.isPremium && !isCurrentDeveloper) {
      setThemeNotice(`👑 "${selected.name}" is a Premium Theme unlocked exclusively for the Developer. You can select any of the Free themes.`);
      setTimeout(() => setThemeNotice(null), 4500);
      return;
    }

    setActiveThemeId(themeKey);
    setShowThemePicker(false);
    setThemeNotice(null);
    try {
      await updateChatTheme(chatId, themeKey);
    } catch (e) {
      console.error("Failed to update chat theme", e);
    }
  };

  return (
    <div className={`flex flex-col h-full ${currentTheme.containerBg} rounded-3xl overflow-hidden border border-zinc-800/80 shadow-2xl relative transition-colors duration-300`}>
      {/* Header */}
      <div className={`p-2.5 sm:p-4 ${currentTheme.headerBg} backdrop-blur-md flex items-center justify-between gap-2 z-10 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button onClick={onBack} className="p-1.5 sm:p-2 -ml-1 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800/60 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative shrink-0">
            <img
              src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username || 'user'}`}
              alt=""
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 object-cover border border-zinc-700"
            />
            {isOtherDeveloper && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md">
                <Crown className="w-2.5 h-2.5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-white truncate" title={otherUser?.displayName || "Unknown User"}>
                {otherUser?.displayName || "Unknown User"}
              </span>
              {isOtherDeveloper && (
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-[9px] sm:text-[10px] font-bold text-amber-400 flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap">
                  <Shield className="w-2.5 h-2.5" /> DEVELOPER
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate" title={`@${otherUser?.username || "unknown"}`}>
              @{otherUser?.username || "unknown"}
            </div>
          </div>
        </div>

        {/* Action Controls: Voice Call, Video Call, Theme Picker */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Voice Call Button */}
          <button
            onClick={() => onStartCall && onStartCall('voice')}
            disabled={isUserSuspended}
            className="p-2 sm:p-2.5 rounded-xl bg-zinc-800/80 hover:bg-emerald-600/20 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 hover:border-emerald-500/40 transition-all active:scale-95 disabled:opacity-40"
            title="Start HD Voice Call"
          >
            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Video Call Button */}
          <button
            onClick={() => onStartCall && onStartCall('video')}
            disabled={isUserSuspended}
            className="p-2 sm:p-2.5 rounded-xl bg-zinc-800/80 hover:bg-emerald-600/20 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 hover:border-emerald-500/40 transition-all active:scale-95 disabled:opacity-40"
            title="Start HD Video Call"
          >
            <VideoIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="p-2 sm:p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all active:scale-95"
            title="Change Chat Theme"
          >
            <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Manage This Chat's Storage */}
          <button
            onClick={() => setShowChatStorage(true)}
            className="p-2 sm:p-2.5 rounded-xl bg-zinc-800/80 hover:bg-emerald-600/20 text-zinc-300 hover:text-emerald-400 border border-zinc-700/60 hover:border-emerald-500/40 transition-all active:scale-95"
            title="Manage Chat Storage & Shared Files"
          >
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Per-Chat Storage Modal */}
      {showChatStorage && (
        <ChatStorageModal
          chatId={chatId}
          currentUser={currentUser}
          otherUser={otherUser}
          messages={messages}
          onClose={() => setShowChatStorage(false)}
        />
      )}

      {/* Theme Picker Dropdown Modal */}
      {showThemePicker && (
        <div className="absolute top-16 right-4 z-40 bg-zinc-900/98 border border-zinc-700/80 p-4 rounded-3xl shadow-2xl backdrop-blur-xl w-72 max-h-[80vh] overflow-y-auto animate-fade-in space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">Chat Themes</span>
              <span className="text-[10px] text-zinc-400">
                {isCurrentDeveloper ? '👑 Developer VIP (All Unlocked Forever)' : 'Free & Premium Themes'}
              </span>
            </div>
            <button
              onClick={() => setShowThemePicker(false)}
              className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>

          {themeNotice && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-start gap-2 animate-fade-in">
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>{themeNotice}</span>
            </div>
          )}

          {/* Free Themes Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Free Themes
              </span>
              <span className="text-[9px] text-zinc-500 font-medium">All Users</span>
            </div>
            {Object.values(CHAT_THEMES).filter((th) => !th.isPremium).map((th) => (
              <button
                key={th.id}
                onClick={() => handleSelectTheme(th.id)}
                className={`w-full p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                  activeThemeId === th.id
                    ? 'bg-emerald-950/40 border border-emerald-500/60 text-white font-semibold shadow-sm'
                    : 'bg-zinc-950/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3.5 h-3.5 rounded-full ${th.id === 'slate' ? 'bg-zinc-400' : th.id === 'ocean' ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                  <span>{th.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">FREE</span>
                  {activeThemeId === th.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </button>
            ))}
          </div>

          {/* Premium Themes Section */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-amber-400" /> Premium Themes
              </span>
              <span className="text-[9px] text-amber-400/80 font-semibold">
                {isCurrentDeveloper ? '👑 UNLOCKED' : '🔒 Developer Only'}
              </span>
            </div>
            {Object.values(CHAT_THEMES).filter((th) => th.isPremium).map((th) => {
              const isLocked = !isCurrentDeveloper;
              return (
                <button
                  key={th.id}
                  onClick={() => handleSelectTheme(th.id)}
                  className={`w-full p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                    activeThemeId === th.id
                      ? 'bg-amber-950/40 border border-amber-500/60 text-amber-100 font-semibold shadow-sm shadow-amber-500/10'
                      : isLocked
                      ? 'bg-zinc-950/30 hover:bg-zinc-900 text-zinc-400 border border-zinc-800/50 hover:border-amber-500/30'
                      : 'bg-zinc-950/50 hover:bg-zinc-800 text-zinc-200 border border-zinc-800/80 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3.5 h-3.5 rounded-full ${th.id === 'gold' ? 'bg-amber-400 shadow-sm shadow-amber-400' : th.id === 'neon' ? 'bg-cyan-400' : th.id === 'amethyst' ? 'bg-purple-400' : 'bg-rose-400'}`} />
                    <span className={activeThemeId === th.id ? 'text-amber-200 font-medium' : ''}>{th.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isCurrentDeveloper ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 text-[10px] font-bold flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5 text-amber-400" /> VIP
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-medium flex items-center gap-1 border border-zinc-700/60">
                        <Lock className="w-2.5 h-2.5 text-amber-400" /> Locked
                      </span>
                    )}
                    {activeThemeId === th.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Account Suspended Alert */}
      {isUserSuspended && (
        <div className="p-3 bg-red-950/80 border-b border-red-800 text-red-300 text-xs flex items-center justify-center gap-2 font-medium">
          ⚠️ Your account has been restricted by Developer. You cannot send messages or make calls.
        </div>
      )}

      {/* Upload Progress Modal */}
      {isSending && uploadProgress > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/95 text-zinc-200 px-6 py-5 rounded-3xl shadow-2xl flex flex-col items-center gap-3 border border-zinc-700 z-50 min-w-[220px] backdrop-blur-xl">
          <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm font-semibold text-white">Sending File... {Math.round(uploadProgress)}%</div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-1 shadow-inner">
            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group items-center gap-2`}>
              {isMe && (
                <button
                  onClick={() => deleteMessage(chatId, msg.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 transition-opacity"
                  title="Delete Message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-md ${
                  isMe ? currentTheme.myBubble : currentTheme.theirBubble
                }`}
              >
                {msg.text && <div className="text-sm break-words leading-relaxed">{msg.text}</div>}

                {msg.fileUrl && (
                  <div className="mt-2 flex flex-col gap-2">
                    {msg.fileType?.startsWith('image/') ? (
                      <img src={msg.fileUrl} alt="Attached image" className="max-w-full rounded-xl max-h-64 object-contain shadow" />
                    ) : msg.fileType?.startsWith('video/') ? (
                      <video src={msg.fileUrl} controls className="max-w-full rounded-xl max-h-64 shadow" />
                    ) : msg.fileType?.startsWith('audio/') ? (
                      <div className="flex flex-col gap-2">
                        <audio src={msg.fileUrl} controls className="w-full max-w-[220px] h-8 mt-1" />
                        <button
                          onClick={() => onDecodeRequest && onDecodeRequest(msg.fileUrl!)}
                          className="text-[10px] bg-black/20 hover:bg-black/40 text-white font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors mt-1"
                        >
                          <Play className="w-3 h-3" />
                          Translate in Listen Mode
                        </button>
                      </div>
                    ) : (
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 underline font-medium">
                        View Attached Document
                      </a>
                    )}
                  </div>
                )}

                {msg.soundUrl && (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold bg-black/20 p-2 rounded-lg">
                      <Volume2 className="w-4 h-4" /> SoundLink Payload
                    </div>
                    <audio src={msg.soundUrl} controls className="w-full max-w-[220px] h-8" />
                    <button
                      onClick={() => onDecodeRequest && onDecodeRequest(msg.soundUrl)}
                      className="text-[10px] bg-black/20 hover:bg-black/40 text-white font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors mt-1"
                    >
                      <Play className="w-3 h-3" />
                      Translate in Listen Mode
                    </button>
                  </div>
                )}

                {msg.expiresAt && (
                  <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-80 font-medium">
                    <Clock className="w-3 h-3" /> Auto-deletes
                  </div>
                )}

                <div className={`text-[9px] mt-1 opacity-70 text-right`}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                </div>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-12">
            No messages yet. Say hello to @{otherUser?.username || "contact"}!
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSendText}
        className={`p-3 ${currentTheme.inputBg} backdrop-blur-md flex items-center gap-2 flex-wrap sm:flex-nowrap transition-colors duration-300`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleSendFile}
          accept="image/*,video/*,audio/*"
          className="hidden"
          disabled={isUserSuspended}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUserSuspended}
          className="p-2.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors shrink-0 disabled:opacity-40"
          title="Attach Image/Video/Audio"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <select
          value={expiryMs}
          onChange={(e) => setExpiryMs(Number(e.target.value))}
          disabled={isUserSuspended}
          className="bg-zinc-800 text-zinc-300 text-xs rounded-xl px-2.5 py-2.5 border border-zinc-700 outline-none focus:border-emerald-500/50 disabled:opacity-40"
          title="Auto-delete timer"
        >
          <option value={0}>Keep</option>
          <option value={60000}>1 Min</option>
          <option value={3600000}>1 Hour</option>
          <option value={86400000}>24 Hours</option>
        </select>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isUserSuspended}
          placeholder={isUserSuspended ? "Account suspended..." : "Type a message..."}
          className="flex-1 min-w-0 bg-zinc-900/80 border border-zinc-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/70 focus:outline-none transition-all disabled:opacity-40 shadow-inner"
        />

        <button
          type="submit"
          disabled={(!text.trim() && !isSending) || isSending || isUserSuspended}
          className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all shrink-0 shadow-md active:scale-95"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
