import React, { useState, useEffect, useRef } from 'react';
import { sendMessage, uploadSoundFile, subscribeToMessages } from '../../lib/social';
import { ArrowLeft, Send, Mic, Play, Volume2 } from 'lucide-react';
import { generateWavBlob } from '../../lib/audioProtocol'; // Need this to generate payload sounds if they want

interface Props {
  onDecodeRequest?: (url: string) => void;
  chatId: string;
  currentUser: any;
  otherUser: any;
  onBack: () => void;
}

export function ChatView({ chatId, currentUser, otherUser, onBack, onDecodeRequest }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });
    return unsub;
  }, [chatId]);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const msgText = text.trim();
    if (!msgText || isSending) return;
    
    // Optimistic Update for instant feel
    setText('');
    setMessages(prev => [...prev, {
      id: 'temp-' + Date.now(),
      senderId: currentUser.uid,
      text: msgText,
      timestamp: Date.now()
    }]);
    
    // setIsSending(true); // Don't block UI while sending text for instant feel
    try {
      await sendMessage(chatId, currentUser.uid, msgText);
    } catch (err) {
      console.error(err);
      alert("Failed to send message.");
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendSoundLink = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 150 * 1024 * 1024) {
        alert('File is too large! Please select a file smaller than 150MB.');
        return;
      }
      setIsSending(true);
      try {
        // Read file and make a WAV payload
        const arrayBuf = await file.arrayBuffer();
        const payload = new Uint8Array(arrayBuf);
        
        let sendType: 'image' | 'video' | 'audio' = 'image';
        if (file.type.startsWith('video/')) sendType = 'video';
        else if (file.type.startsWith('audio/')) sendType = 'audio';

        const wavBlob = await generateWavBlob(
          sendType, 
          new Uint8Array(0), 
          { dataUrl: '', meta: { name: file.name, size: file.size, mimeType: file.type }, file }
        );

        // Upload WAV to Storage
        const url = await uploadSoundFile(chatId, wavBlob);

        // Send Message
        await sendMessage(chatId, currentUser.uid, '', url);
      } catch (err) {
        console.error("Failed to send SoundLink", err);
        alert("Failed to send SoundLink. Maybe the file was too large or network failed.");
      } finally {
        setIsSending(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 rounded-xl overflow-hidden border border-zinc-800/50 relative">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/80 backdrop-blur-sm z-10">
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username || 'user'}`} alt="" className="w-9 h-9 rounded-full bg-zinc-800" />
        <div>
          <div className="text-sm font-medium text-white">{otherUser?.displayName || "Unknown"}</div>
          <div className="text-[10px] text-zinc-400">@{otherUser?.username || "unknown"}</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-zinc-950/20">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.uid;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                {msg.text && <div className="text-sm break-words">{msg.text}</div>}
                {msg.soundUrl && (
                  <div className="mt-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold bg-black/20 p-2 rounded-lg">
                      <Volume2 className="w-4 h-4" /> SoundLink Payload
                    </div>
                    <audio src={msg.soundUrl} controls className="w-full max-w-[200px] h-8" />
                    <button 
                      onClick={() => onDecodeRequest && onDecodeRequest(msg.soundUrl)}
                      className="text-[10px] bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors mt-1"
                    >
                      <Play className="w-3 h-3" />
                      Translate in Listen Mode
                    </button>
                  </div>
                )}
                <div className={`text-[9px] mt-1 ${isMe ? 'text-emerald-200/70' : 'text-zinc-500'} text-right`}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'now'}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-10">
            Say hi to @{otherUser?.username || "unknown"}!
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendText} className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleSendSoundLink} 
          accept="image/*,video/*,audio/*" 
          className="hidden" 
        />
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 text-zinc-400 hover:text-emerald-400 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors shrink-0"
          title="Send SoundLink"
        >
          <Volume2 className="w-5 h-5" />
        </button>
        <input 
          type="text" 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none"
        />
        <button 
          type="submit"
          disabled={(!text.trim() && !isSending) || isSending}
          className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl disabled:opacity-50 transition-colors shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
