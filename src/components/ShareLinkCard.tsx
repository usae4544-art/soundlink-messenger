import React, { useState } from 'react';
import { Share2, Copy, Check, ExternalLink, MessageCircle, Sparkles, RadioReceiver, Volume2 } from 'lucide-react';
import { PayloadType } from '../types';

interface ShareLinkCardProps {
  type: PayloadType;
  token: string;
  shareUrl: string;
  itemName?: string;
  isGenerating?: boolean;
  onPlaySound?: () => void;
  isPlayingSound?: boolean;
}

export const ShareLinkCard: React.FC<ShareLinkCardProps> = ({
  type,
  token,
  shareUrl,
  itemName,
  isGenerating = false,
  onPlaySound,
  isPlayingSound = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    const mediaLabel = type === 'video' ? 'video' : type === 'audio' ? 'song' : type === 'image' ? 'photo' : 'message';
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SoundLink: Received ${mediaLabel} (${token})`,
          text: `🎵 Here is the sound wave & ${mediaLabel} I created for you on SoundLink! Click the link to open Listen and decode:`,
          url: shareUrl,
        });
      } catch (e) {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  const mediaTitle =
    type === 'video' ? 'Video' : type === 'audio' ? 'Song / Audio' : type === 'image' ? 'Photo' : 'Text';

  const whatsappMessage = encodeURIComponent(
    `🎵 *SoundLink Acoustic File*: I created a sound wave & ${mediaTitle.toLowerCase()} for you! Open this link to automatically paste the sound and view the ${mediaTitle.toLowerCase()}:\n${shareUrl}`
  );

  return (
    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.1)] relative overflow-hidden flex flex-col gap-3.5 transition-all">
      {/* Subtle emerald top glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/40 via-teal-400 to-emerald-500/40" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                SoundLink Share Link
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-medium border border-emerald-500/30">
                #{token}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Recipient clicks link → opens Listen tab → sound pastes & {mediaTitle.toLowerCase()} displays!
            </p>
          </div>
        </div>

        {onPlaySound && (
          <button
            onClick={onPlaySound}
            disabled={isPlayingSound}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
            title="Play acoustic sound wave for this payload"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isPlayingSound ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isPlayingSound ? 'Playing...' : 'Test Sound'}</span>
          </button>
        )}
      </div>

      {/* Share URL Input & Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 flex items-center">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full bg-zinc-900/90 text-zinc-300 text-xs font-mono px-3 py-2.5 rounded-xl border border-zinc-700/80 focus:outline-none focus:border-emerald-500 pr-10 select-all"
          />
          <button
            onClick={handleCopy}
            className="absolute right-2 p-1.5 text-zinc-400 hover:text-emerald-400 transition-colors"
            title="Copy share link"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
              copied
                ? 'bg-emerald-500 text-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <a
            href={`https://api.whatsapp.com/send?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Share via WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Share via system dialog"
            >
              <Share2 className="w-4 h-4 text-zinc-300" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 rounded-xl transition-all"
            title="Open in Listen Tab (Test Link)"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/60">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          Cross-device & cross-platform: Anyone opening this link will see the sound wave pasted in Listen, and their {mediaTitle.toLowerCase()} decoded immediately!
        </span>
      </div>
    </div>
  );
};
