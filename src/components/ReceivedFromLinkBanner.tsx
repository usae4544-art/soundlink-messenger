import React, { useState } from 'react';
import { RadioReceiver, Volume2, CheckCircle2, X, Sparkles, RefreshCw, ClipboardPaste, ArrowDown } from 'lucide-react';
import { PayloadType, DecodedPayload } from '../types';

interface ReceivedFromLinkBannerProps {
  payload: DecodedPayload;
  onPlaySound: () => void;
  isPlayingSound: boolean;
  soundProgress: number;
  onDismiss: () => void;
  onScrollToItem: () => void;
}

export const ReceivedFromLinkBanner: React.FC<ReceivedFromLinkBannerProps> = ({
  payload,
  onPlaySound,
  isPlayingSound,
  soundProgress,
  onDismiss,
  onScrollToItem,
}) => {
  const typeLabel =
    payload.type === 'video'
      ? 'Video'
      : payload.type === 'audio'
      ? 'Song / Audio'
      : payload.type === 'image'
      ? 'Photo'
      : 'Text Message';

  return (
    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-zinc-950 to-zinc-900/90 border-2 border-emerald-500/50 shadow-[0_4px_25px_rgba(16,185,129,0.25)] relative overflow-hidden flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Top green glow bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <RadioReceiver className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Sound Wave Pasted from Link!
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/40">
                #{payload.token || 'LINK'}
              </span>
            </div>
            <p className="text-xs text-emerald-300/80 font-medium">
              Direct SoundLink decoded: <strong>{typeLabel}</strong> is now ready and viewable below!
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sound playback and view controls */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={onPlaySound}
          disabled={isPlayingSound}
          className={`flex-1 min-w-[200px] py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
            isPlayingSound
              ? 'bg-emerald-500 text-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          {isPlayingSound ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-950" />
              <span>Playing Acoustic Sound Wave ({Math.round(soundProgress)}%)...</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Play Received Acoustic Sound Wave</span>
            </>
          )}
        </button>

        <button
          onClick={onScrollToItem}
          className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
        >
          <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
          <span>View Decoded {typeLabel}</span>
        </button>
      </div>

      {/* Progress bar during sound playback */}
      {isPlayingSound && (
        <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-emerald-500/30">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-75 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            style={{ width: `${soundProgress}%` }}
          />
        </div>
      )}
    </div>
  );
};

interface ManualPasteBarProps {
  onPasteAndDecode: (input: string) => Promise<void>;
  isLoading: boolean;
}

export const ManualPasteBar: React.FC<ManualPasteBarProps> = ({ onPasteAndDecode, isLoading }) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setError('');
    try {
      await onPasteAndDecode(inputVal.trim());
      setInputVal('');
    } catch (err: any) {
      setError(err.message || 'Could not find or decode this payload');
    }
  };

  const handleClipboardRead = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputVal(text);
        onPasteAndDecode(text.trim()).catch((err) => {
          setError(err.message || 'Could not decode from clipboard');
        });
      }
    } catch (e) {
      setError('Please paste the URL or Token into the box');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
      <div className="flex items-center justify-between px-1">
        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
          <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
          <span>Paste SoundLink URL or Acoustic Token:</span>
        </label>
        <button
          type="button"
          onClick={handleClipboardRead}
          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
        >
          Paste from Clipboard
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="e.g. SL-9F4A2C or https://.../?listenToken=SL-9F4A2C"
          className="flex-1 bg-zinc-900 text-zinc-200 text-xs px-3.5 py-2.5 rounded-xl border border-zinc-700 focus:outline-none focus:border-emerald-500 placeholder:text-zinc-600 font-mono"
        />
        <button
          type="submit"
          disabled={isLoading || !inputVal.trim()}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-emerald-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shrink-0"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Decoding...</span>
            </>
          ) : (
            <>
              <RadioReceiver className="w-3.5 h-3.5" />
              <span>Paste & Decode</span>
            </>
          )}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400 px-1">{error}</p>}
    </form>
  );
};
