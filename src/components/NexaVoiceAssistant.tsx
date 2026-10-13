import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Mic, Send, Bot, User, ArrowLeft, X, Smile, Zap, Shield } from 'lucide-react';
import { apiFetch } from '../lib/apiHelper';

interface NexaVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type PersonalityMode = 'friendly' | 'anime' | 'supportive' | 'fun' | 'professional';

export function NexaVoiceAssistant({ isOpen, onClose }: NexaVoiceAssistantProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([
    { role: 'assistant', text: 'Namaste! Main Nexa Voice hoon, aapki AI companion aur developer assistant. Bataiye aaj kya help karu?', time: 'Just now' }
  ]);
  const [input, setInput] = useState('');
  const [personality, setPersonality] = useState<PersonalityMode>('friendly');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Escape key and clean closing without affecting app state
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role: 'user', text: userText, time: timeStr }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', text: userText }],
          personality: personality,
          language: 'hi-IN'
        })
      });

      if (!res.ok) {
        throw new Error('Chat API failed');
      }

      const data = await res.json();
      const replyText = data.text || data.reply || getFallbackReply(userText, personality);

      setMessages(prev => [...prev, { role: 'assistant', text: replyText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (err) {
      console.warn('Chat API error fallback:', err);
      const fallback = getFallbackReply(userText, personality);
      setMessages(prev => [...prev, { role: 'assistant', text: fallback, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
    }
  };

  const getFallbackReply = (prompt: string, mode: PersonalityMode) => {
    const lower = prompt.toLowerCase();
    if (mode === 'anime') {
      if (lower.includes('hello') || lower.includes('hi')) return 'Konnichiwa Senpai! Sugoi to see you here! Dattebayo! ✨';
      return 'Sugoi! Main samajh gayi senpai, ispar milkar kaam karte hain! Baka nahi hu main! 🌸';
    }
    if (mode === 'supportive') {
      return 'Aap bilkul sahi direction me ja rahe hain. Thoda sa focus aur effort se aap ise aur bhi behtareen bana sakte hain. Main hamesha aapke sath hu! 🌟';
    }
    if (mode === 'fun') {
      return 'Arre wah! Yeh toh ekdum solid idea hai. Chalo milkar isme thoda twist aur coding ka tadka lagate hain! 😎🚀';
    }
    if (mode === 'professional') {
      return 'Understood. Executing request with optimized architecture and clean implementation standards.';
    }
    return 'Bataiye dost, main isme aapki kaise madad kar sakti hu? App build karna ho ya kuch discuss karna ho, main taiyar hu! 😊';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl h-[90vh] sm:h-[85vh] liquid-glass rounded-3xl border border-white/20 shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse [animation-delay:1s]"></div>

        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-900/70 backdrop-blur-2xl relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 text-xs font-medium active:scale-95"
              title="Back to App"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/30 shrink-0">
                <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Nexa Voice AI</h2>
                  <span className="px-2 py-0.5 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                    {personality}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Intelligent Multi-Personality Companion & Dev Assistant</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors border border-transparent hover:border-white/10"
            title="Close Assistant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Personality Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-zinc-900/40 border-b border-white/10 flex items-center gap-2 overflow-x-auto relative z-10 scrollbar-none shrink-0">
          <span className="text-[11px] font-semibold text-zinc-400 shrink-0">Mode:</span>
          {(['friendly', 'anime', 'supportive', 'fun', 'professional'] as PersonalityMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setPersonality(mode)}
              className={`px-3 py-1 rounded-xl text-xs font-medium capitalize transition-all shrink-0 ${
                personality === mode
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/40 scale-105'
                  : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 border border-white/5 hover:border-white/15'
              }`}
            >
              {mode === 'anime' ? '🌸 Anime' : mode === 'friendly' ? '🤗 Friendly' : mode === 'supportive' ? '🌟 Supportive' : mode === 'fun' ? '😎 Fun' : '⚡ Professional'}
            </button>
          ))}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative z-10">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 animate-message-pop ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1 shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed backdrop-blur-2xl shadow-xl ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none border border-emerald-500/40 shadow-emerald-600/20'
                    : 'liquid-glass text-zinc-100 rounded-tl-none border border-white/15 shadow-black/40'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div className={`text-[10px] mt-1.5 flex items-center gap-1 ${msg.role === 'user' ? 'text-emerald-200 justify-end' : 'text-zinc-500'}`}>
                  <span>{msg.time}</span>
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-1 shadow-md">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 items-center text-zinc-400 text-xs animate-pulse">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
                <Bot className="w-4 h-4" />
              </div>
              <div className="liquid-glass border border-white/15 px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-2 text-zinc-300 font-medium">Nexa is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-zinc-900/80 backdrop-blur-2xl border-t border-white/10 relative z-10 shrink-0">
          <form onSubmit={handleSend} className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nexa anything in Hinglish, Hindi, or English..."
              className="flex-1 liquid-glass-input rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center active:scale-95 shrink-0"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
