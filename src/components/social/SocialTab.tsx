import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/apiHelper';
import {
  searchUsers,
  sendFriendRequest,
  respondToRequest,
  subscribeToIncomingRequests,
  subscribeToChats,
  isDeveloperUser
} from '../../lib/social';
import {
  Search,
  UserPlus,
  Check,
  X,
  MessageSquare,
  Crown,
  HardDrive,
  AlertTriangle,
  Shield,
  Loader2,
  Sparkles
} from 'lucide-react';
import { ChatView } from './ChatView';
import { CallModal } from './CallModal';
import { DeveloperPanel } from './DeveloperPanel';
import { StorageManagerModal } from '../StorageManagerModal';
import { ChatStorageModal } from './ChatStorageModal';
import { CallPermissionModal } from './CallPermissionModal';
import { WebRTCCallService, CallSession, subscribeToIncomingCalls } from '../../lib/webrtcCall';

interface Props {
  onDecodeRequest?: (url: string) => void;
  user: any;
  userProfile: any;
}

export function SocialTab({ user, userProfile, onDecodeRequest }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<any>(null);

  // Calling state
  const callServiceRef = useRef<WebRTCCallService>(new WebRTCCallService());
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callNotification, setCallNotification] = useState<string | null>(null);
  const [pendingCallPermission, setPendingCallPermission] = useState<{
    type: 'voice' | 'video';
    contact: {
      name: string;
      username?: string;
      photoURL?: string;
    };
  } | null>(null);

  // Developer Panel state
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [chatStorageTarget, setChatStorageTarget] = useState<any | null>(null);
  const isDev = isDeveloperUser(user?.email);

  // Storage metrics state
  const [storageMetrics, setStorageMetrics] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/storage-status')
      .then((r) => r.json())
      .then((data) => setStorageMetrics(data))
      .catch(() => {});
  }, []);

  // Request notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((e) => console.log(e));
    }
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!user?.uid) return;
    const unsubCall = subscribeToIncomingCalls(user.uid, (call) => {
      setActiveCallSession(call);
      setIsIncomingCall(true);
    });
    return unsubCall;
  }, [user?.uid]);

  // Fetch incoming requests and chats
  useEffect(() => {
    if (!user?.uid) return;
    const unsubReqs = subscribeToIncomingRequests(user.uid, (reqs) => {
      setIncomingRequests(reqs);
    });

    const unsubChats = subscribeToChats(user.uid, (chatsList) => {
      setFriends(
        chatsList.map((c) => ({
          chatId: c.id,
          user: c.user,
          lastMessage: c.lastMessage,
          updatedAt: c.updatedAt
        }))
      );
      setIsLoadingChats(false);
    });

    return () => {
      unsubReqs();
      unsubChats();
    };
  }, [user?.uid]);

  // Handle Search
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchTerm.length >= 3) {
        setIsSearching(true);
        const results = await searchUsers(searchTerm);
        setSearchResults(results.filter((r) => r.uid !== user.uid));
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [searchTerm, user?.uid]);

  const handleRequest = async (toUid: string) => {
    await sendFriendRequest(user.uid, toUid);
    alert('Friend request sent!');
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    if (!activeChatUser || !activeChatId) return;
    setPendingCallPermission({
      type,
      contact: {
        name: activeChatUser.displayName || 'User',
        username: activeChatUser.username || 'user',
        photoURL: activeChatUser.photoURL || ''
      }
    });
  };

  const executeStartCall = async (type: 'voice' | 'video') => {
    setPendingCallPermission(null);
    if (!activeChatUser || !activeChatId) return;
    const callerPeer = {
      uid: user.uid,
      name: userProfile?.displayName || user.name || 'User',
      photoURL: userProfile?.photoURL || user.picture || '',
      username: userProfile?.username || 'user'
    };
    const receiverPeer = {
      uid: activeChatUser.uid,
      name: activeChatUser.displayName || 'User',
      photoURL: activeChatUser.photoURL || '',
      username: activeChatUser.username || 'user'
    };

    try {
      const callId = await callServiceRef.current.initiateCall(
        activeChatId,
        callerPeer,
        receiverPeer,
        type,
        undefined,
        (status) => {
          if (status === 'ended' || status === 'declined') {
            setActiveCallSession(null);
          } else if (status === 'accepted') {
            setActiveCallSession((prev) => prev ? { ...prev, status: 'accepted' } : null);
          }
        }
      );

      setActiveCallSession({
        id: callId,
        chatId: activeChatId,
        caller: callerPeer,
        receiver: receiverPeer,
        type,
        status: 'ringing',
        createdAt: Date.now()
      });
      setIsIncomingCall(false);
    } catch (err: any) {
      console.warn("Call start notice:", err?.message || err);
      setCallNotification("Microphone or camera permission was not granted. Please allow access in your browser or open in a new tab for hardware media.");
      setTimeout(() => setCallNotification(null), 6000);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-zinc-900/40 backdrop-blur-md rounded-3xl overflow-hidden border border-zinc-800/80 shadow-2xl">
      {/* Call Permission Modal */}
      {pendingCallPermission && (
        <CallPermissionModal
          isOpen={!!pendingCallPermission}
          type={pendingCallPermission.type}
          contact={pendingCallPermission.contact}
          onGranted={() => executeStartCall(pendingCallPermission.type)}
          onFallback={() => executeStartCall(pendingCallPermission.type)}
          onClose={() => setPendingCallPermission(null)}
        />
      )}

      {/* Call Notification Toast */}
      {callNotification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-11/12 bg-amber-500/90 text-zinc-950 font-medium px-4 py-2.5 rounded-2xl shadow-xl border border-amber-400 text-xs flex items-center justify-between animate-fade-in">
          <span>{callNotification}</span>
          <button
            onClick={() => setCallNotification(null)}
            className="ml-2 font-bold hover:opacity-80 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active or Incoming Call Modal */}
      {activeCallSession && (
        <CallModal
          callSession={activeCallSession}
          callService={callServiceRef.current}
          isIncoming={isIncomingCall}
          currentUser={user}
          onClose={() => {
            setActiveCallSession(null);
            setIsIncomingCall(false);
          }}
        />
      )}

      {/* Developer Master Panel Modal */}
      {showDevPanel && <DeveloperPanel onClose={() => setShowDevPanel(false)} />}

      {/* Storage Manager Modal */}
      {showStorageModal && <StorageManagerModal onClose={() => setShowStorageModal(false)} />}

      {/* Individual Chat Storage Modal from list */}
      {chatStorageTarget && (
        <ChatStorageModal
          chatId={chatStorageTarget.chatId}
          currentUser={{ ...user, suspended: userProfile?.suspended, role: userProfile?.role, isDeveloper: isDev }}
          otherUser={chatStorageTarget.user}
          messages={chatStorageTarget.messages || []}
          onClose={() => setChatStorageTarget(null)}
        />
      )}

      {/* If Chat View is active */}
      {activeChatId && activeChatUser ? (
        <ChatView
          chatId={activeChatId}
          currentUser={{ ...user, suspended: userProfile?.suspended, role: userProfile?.role, isDeveloper: isDev }}
          otherUser={activeChatUser}
          onBack={() => setActiveChatId(null)}
          onDecodeRequest={onDecodeRequest}
          onStartCall={handleStartCall}
        />
      ) : (
        /* Conversations List View */
        <div className="flex flex-col h-full">
          {/* Header Banner & Developer Action */}
          <div className="p-3 sm:p-4 border-b border-zinc-800/80 bg-zinc-950/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>SoundLink Messenger</span>
                  {isDev && (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-400 flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap">
                      <Crown className="w-3 h-3" /> DEVELOPER
                    </span>
                  )}
                </h2>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">Real-time chats, files & encrypted HD calls</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  onClick={() => setShowStorageModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                  title="Storage details & file management"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Storage</span>
                </button>

                {/* If user is Developer, show Master Panel Button */}
                {isDev && (
                  <button
                    onClick={() => setShowDevPanel(true)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Developer Dashboard</span>
                  </button>
                )}
              </div>
            </div>

            {/* Storage Quota Warning (>= 60% Capacity) */}
            {storageMetrics && storageMetrics.usagePercent >= 60 && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="leading-relaxed">
                    <b className="text-amber-200">Storage Warning ({storageMetrics.usagePercent}%):</b> Uploaded chat files older than 2 days are subject to space cleanup. Google profile pictures and account data are always protected.
                  </div>
                </div>
                <span className="shrink-0 font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] self-end sm:self-auto border border-amber-500/30">
                  {storageMetrics.usagePercent}% Full
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search people by @username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/60 focus:outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
            {/* Search Results */}
            {searchTerm.length >= 3 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">Search Results</h3>
                {isSearching ? (
                  <div className="text-zinc-500 text-xs text-center py-4 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Searching users...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((r) => {
                      const isDevAccount = isDeveloperUser(r.email);
                      return (
                        <div
                          key={r.uid}
                          className="flex items-center justify-between gap-2.5 bg-zinc-950/40 hover:bg-zinc-800/60 p-3 rounded-2xl border border-zinc-800/60 transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <img
                              src={r.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.username}`}
                              alt=""
                              className="w-10 h-10 rounded-full bg-zinc-800 object-cover shrink-0 border border-zinc-700/60"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold text-white truncate" title={r.displayName}>
                                  {r.displayName}
                                </span>
                                {isDevAccount && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/40 whitespace-nowrap">
                                    DEVELOPER
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-400 truncate" title={`@${r.username}`}>
                                @{r.username}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRequest(r.uid)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-colors shrink-0"
                            title="Send Friend Request"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-zinc-500 text-xs text-center py-4">No users found matching "@{searchTerm}"</div>
                )}
              </div>
            )}

            {/* Friend Requests */}
            {!searchTerm && incomingRequests.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Friend Requests ({incomingRequests.length})
                </h3>
                <div className="space-y-2">
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-2.5 bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800 border-l-3 border-l-emerald-500 shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={req.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user?.username || 'user'}`}
                          alt=""
                          className="w-10 h-10 rounded-full bg-zinc-800 object-cover shrink-0 border border-zinc-700/60"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white truncate" title={req.user?.displayName}>
                            {req.user?.displayName || "Unknown User"}
                          </div>
                          <div className="text-xs text-zinc-400 truncate" title={`@${req.user?.username}`}>
                            @{req.user?.username || "unknown"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => respondToRequest(req.id, 'accepted')}
                          className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl transition-colors"
                          title="Accept"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => respondToRequest(req.id, 'rejected')}
                          className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors"
                          title="Decline"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chats List */}
            {!searchTerm && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
                  Direct Messages
                </h3>

                {isLoadingChats ? (
                  <div className="p-8 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    Loading conversations...
                  </div>
                ) : friends.length > 0 ? (
                  <div className="space-y-2">
                    {friends.map((friend) => {
                      const isOtherDev = isDeveloperUser(friend.user?.email);
                      return (
                        <div
                          key={friend.chatId}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setActiveChatId(friend.chatId);
                            setActiveChatUser(friend.user);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActiveChatId(friend.chatId);
                              setActiveChatUser(friend.user);
                            }
                          }}
                          className="w-full flex items-center gap-3 bg-zinc-950/40 hover:bg-zinc-800/70 p-3 sm:p-3.5 rounded-2xl border border-zinc-800/60 transition-all text-left shadow-sm group hover:border-zinc-700 active:scale-[0.99] cursor-pointer"
                        >
                          <div className="relative shrink-0">
                            <img
                              src={friend.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.user?.username || 'user'}`}
                              alt=""
                              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-zinc-800 object-cover shadow border border-zinc-700/60"
                            />
                            {isOtherDev && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black flex items-center justify-center shadow">
                                <Crown className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5 gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-semibold text-white truncate" title={friend.user?.displayName || "Contact"}>
                                  {friend.user?.displayName || "Contact"}
                                </span>
                                {isOtherDev && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/40 whitespace-nowrap shrink-0 flex items-center gap-1">
                                    <Crown className="w-2.5 h-2.5 text-amber-400" /> DEVELOPER
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 shrink-0 whitespace-nowrap">
                                {friend.updatedAt
                                  ? new Date(friend.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-zinc-400 truncate flex-1 leading-relaxed" title={friend.lastMessage || ''}>
                                {friend.lastMessage || 'Tap to open chat'}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChatStorageTarget(friend);
                                }}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 border border-zinc-800 transition-all opacity-80 hover:opacity-100 shrink-0"
                                title="Manage this chat's storage & files"
                              >
                                <HardDrive className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-zinc-500 text-sm text-center py-12 bg-zinc-950/30 rounded-2xl border border-zinc-800/60 border-dashed">
                    <MessageSquare className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
                    No active chats yet.
                    <p className="text-xs text-zinc-600 mt-1">Search for an @username above to connect and start chatting!</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
