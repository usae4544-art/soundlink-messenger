import React, { useState, useEffect } from 'react';
import { searchUsers, sendFriendRequest, respondToRequest, sendMessage, subscribeToIncomingRequests, subscribeToChats } from '../../lib/social';
import { Search, UserPlus, Check, X, MessageSquare, Clock, ArrowLeft, Send, Mic, Image as ImageIcon } from 'lucide-react';
import { ChatView } from './ChatView';

interface Props {
  onDecodeRequest?: (url: string) => void;
  user: any;
  userProfile: any;
}

export function SocialTab({ user, userProfile, onDecodeRequest }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<any>(null);

  // Fetch incoming requests and chats
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(e => console.log(e));
    }
  }, []);
  
  useEffect(() => {
    if (!user?.uid) return;
    const unsubReqs = subscribeToIncomingRequests(user.uid, (reqs) => {
      setIncomingRequests(reqs);
    });
    const unsubChats = subscribeToChats(user.uid, (chatsList) => {
      setFriends(prev => {
        chatsList.forEach(chat => {
          const oldChat = prev.find(p => p.chatId === chat.id);
          if (oldChat && chat.updatedAt > oldChat.updatedAt) {
            if ('Notification' in window && Notification.permission === 'granted' && chat.lastMessage) {
              try {
                new Notification('New message from ' + (chat.user?.displayName || 'Unknown User'), {
                  body: chat.lastMessage,
                  icon: (chat.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.user?.username || 'user'}`)
                });
              } catch (e) {
                console.log('Notification failed', e);
              }
            }
          }
        });
        return chatsList.map(c => ({
          chatId: c.id,
          user: c.user,
          lastMessage: c.lastMessage,
          updatedAt: c.updatedAt
        }));
      });
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
        setSearchResults(results.filter(r => r.uid !== user.uid));
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delay);
  }, [searchTerm, user?.uid]);

  const handleRequest = async (toUid: string) => {
    await sendFriendRequest(user.uid, toUid);
    alert('Request sent!');
  };

  if (activeChatId && activeChatUser) {
    return (
      <ChatView 
        chatId={activeChatId} 
        currentUser={user} 
        otherUser={activeChatUser} 
        onBack={() => setActiveChatId(null)} 
        onDecodeRequest={onDecodeRequest}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900/30 backdrop-blur-md rounded-2xl overflow-hidden border border-zinc-800/60 shadow-lg">
      <div className="p-4 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search users by @username..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {/* Search Results */}
        {searchTerm.length >= 3 && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Search Results</h3>
            {isSearching ? (
              <div className="text-zinc-500 text-sm text-center py-4">Searching...</div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div key={r.uid} className="flex items-center justify-between bg-zinc-900/40 hover:bg-zinc-800/60 p-3.5 rounded-xl border border-zinc-800/50 transition-all duration-200 cursor-pointer shadow-sm">
                    <div className="flex items-center gap-3">
                      <img src={r.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.username}`} alt="" className="w-10 h-10 rounded-full bg-zinc-800" />
                      <div>
                        <div className="text-sm font-medium text-white">{r.displayName}</div>
                        <div className="text-xs text-zinc-400">@{r.username}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRequest(r.uid)}
                      className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 text-sm text-center py-4">No users found.</div>
            )}
          </div>
        )}

        {/* Incoming Requests */}
        {!searchTerm && incomingRequests.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Friend Requests ({incomingRequests.length})
            </h3>
            <div className="space-y-2">
              {incomingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 border-l-2 border-l-emerald-500">
                  <div className="flex items-center gap-3">
                    <img src={req.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user?.username || 'user'}`} alt="" className="w-10 h-10 rounded-full bg-zinc-800" />
                    <div>
                      <div className="text-sm font-medium text-white">{req.user?.displayName || "Unknown User"}</div>
                      <div className="text-xs text-zinc-400">@{req.user?.username || "unknown"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => respondToRequest(req.id, 'accepted')}
                      className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => respondToRequest(req.id, 'rejected')}
                      className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends / Chats */}
        {!searchTerm && (
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Messages</h3>
            {friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <button 
                    key={friend.chatId} 
                    onClick={() => { setActiveChatId(friend.chatId); setActiveChatUser(friend.user); }}
                    className="w-full flex items-center gap-3 bg-zinc-900/40 hover:bg-zinc-800/80 p-3.5 rounded-xl border border-zinc-800/50 transition-all duration-200 text-left shadow-sm group"
                  >
                    <img src={friend.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.user?.username || 'user'}`} alt="" className="w-12 h-12 rounded-full bg-zinc-800 shadow-md ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all duration-300" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-medium text-white truncate">{friend.user?.displayName || "Unknown User"}</span>
                        <span className="text-[10px] text-zinc-500">
                          {friend.updatedAt ? new Date(friend.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate">
                        {friend.lastMessage || 'Say hi!'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 text-sm text-center py-10 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
                No messages yet.<br/>Search for a friend to start chatting!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
