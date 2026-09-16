import React, { useState } from 'react';
import { Sparkles, Maximize2, X, Music, Waves, Zap } from 'lucide-react';
import { AudioAnalysis, ImageMetadata, MotionMode } from '../types';

interface Props {
  src: string;
  metadata?: ImageMetadata;
  isPlayingSound: boolean;
  audioAnalysis?: AudioAnalysis;
  onClear?: () => void;
  motionMode: MotionMode;
  onMotionModeChange: (mode: MotionMode) => void;
  onTestSound?: () => void;
  isTestingSound?: boolean;
}

export const AudioReactiveImage: React.FC<Props> = ({
  src,
  metadata,
  isPlayingSound,
  audioAnalysis = { overall: 0, bass: 0, mid: 0, treble: 0 },
  onClear,
  motionMode,
  onMotionModeChange,
  onTestSound,
  isTestingSound = false,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isActive = isPlayingSound || isTestingSound;
  const level = isActive ? Math.max(0.1, audioAnalysis.overall) : 0;
  const bass = isActive ? audioAnalysis.bass : 0;

  // Calculate dynamic transform based on motionMode
  let transformStyle = '';
  let ringScale = 1;
  let ringOpacity = 0;

  if (isActive && motionMode !== 'dance') {
    if (motionMode === 'pulse') {
      const scaleVal = 1 + level * 0.12 + bass * 0.08;
      transformStyle = `scale(${scaleVal})`;
      ringScale = 1 + level * 0.5;
      ringOpacity = Math.min(1, level * 1.5);
    } else if (motionMode === 'ripple') {
      const scaleVal = 1 + level * 0.06;
      transformStyle = `scale(${scaleVal})`;
      ringScale = 1 + level * 0.7;
      ringOpacity = Math.min(1, level * 1.8);
    } else if (motionMode === 'equalizer') {
      const tilt = Math.sin(Date.now() / 150) * (level * 6);
      transformStyle = `rotate(${tilt}deg) scale(${1 + level * 0.08})`;
      ringScale = 1 + level * 0.4;
      ringOpacity = level;
    }
  } else if (isActive && motionMode === 'dance') {
    const tiltX = Math.sin(Date.now() / 120) * (level * 8);
    const scaleVal = 1 + level * 0.15;
    transformStyle = `rotate(${tiltX}deg) scale(${scaleVal})`;
    ringScale = 1 + level * 0.6;
    ringOpacity = Math.min(1, level * 1.6);
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Visualizer Display Area */}
      <div className="relative w-full min-h-[260px] max-h-[380px] bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center overflow-hidden group">
        
        {/* Ambient Glow synced to sound */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            background: isActive
              ? `radial-gradient(circle, rgba(16, 185, 129, ${0.15 + level * 0.35}) 0%, rgba(5, 150, 105, 0.05) 50%, transparent 80%)`
              : 'none',
          }}
        />

        {/* Outer Acoustic Ripple Rings (animates when sound is active) */}
        {isActive && (
          <>
            <div
              className="absolute pointer-events-none rounded-2xl border-2 border-emerald-400/40 transition-all duration-75"
              style={{
                width: '68%',
                height: '78%',
                transform: `scale(${ringScale})`,
                opacity: ringOpacity,
              }}
            />
            <div
              className="absolute pointer-events-none rounded-2xl border border-emerald-500/20 transition-all duration-100"
              style={{
                width: '74%',
                height: '84%',
                transform: `scale(${ringScale * 1.15})`,
                opacity: ringOpacity * 0.6,
              }}
            />
          </>
        )}

        {/* Real Photo Card */}
        <div
          className="relative z-10 max-w-[85%] max-h-[220px] rounded-xl overflow-hidden shadow-2xl transition-transform duration-75 ease-out border border-zinc-700/60 bg-zinc-900"
          style={{
            transform: transformStyle,
            boxShadow: isActive
              ? `0 0 ${20 + level * 40}px rgba(16, 185, 129, ${0.3 + level * 0.5})`
              : '0 10px 30px -10px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src={src}
            alt="Real Uploaded Photo"
            className="w-full h-full object-contain max-h-[220px] select-none block"
            style={{ imageRendering: 'auto' }}
          />

          {/* Equalizer overlay when sound is playing */}
          {isActive && (
            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center gap-1 px-3 pb-1">
              {Array.from({ length: 16 }).map((_, i) => {
                const h = Math.max(3, (level * 24) * (0.4 + 0.6 * Math.sin((i / 16) * Math.PI + Date.now() / 100)));
                return (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                    style={{ height: `${h}px` }}
                  />
                );
              })}
            </div>
          )}

          {/* Quick Action Overlay Buttons */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 bg-black/60 hover:bg-black/80 text-zinc-200 rounded-lg backdrop-blur-sm transition-colors"
              title="Full View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            {onClear && (
              <button
                onClick={onClear}
                className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-sm transition-colors"
                title="Remove Photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Real image info badge */}
        <div className="relative z-10 mt-3 flex items-center gap-2 flex-wrap justify-center text-[11px] text-zinc-400">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Real Original Photo
          </span>
          {metadata?.width && metadata?.height && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
              {metadata.width} × {metadata.height}px
            </span>
          )}
          {metadata?.size && (
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
              {formatFileSize(metadata.size)}
            </span>
          )}
          {isActive && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-medium flex items-center gap-1 animate-pulse">
              <Zap className="w-3 h-3 text-emerald-400" />
              Sound Active (Moving)
            </span>
          )}
        </div>
      </div>

      {/* Motion Controls Bar ("aur chale bhi agar uska sound ka use kare") */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-medium flex items-center gap-1 text-[11px]">
            <Waves className="w-3.5 h-3.5 text-emerald-400" /> Photo Sound Motion:
          </span>
          <div className="flex gap-1">
            {(['pulse', 'ripple', 'dance'] as MotionMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onMotionModeChange(mode)}
                className={`px-2 py-1 rounded-md text-[11px] capitalize font-medium transition-colors ${
                  motionMode === mode
                    ? 'bg-emerald-500 text-emerald-950 font-semibold'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode === 'pulse' ? 'Beat Pulse' : mode === 'ripple' ? 'Sonic Ripple' : 'Wave Dance'}
              </button>
            ))}
          </div>
        </div>

        {onTestSound && (
          <button
            onClick={onTestSound}
            disabled={isActive}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              isTestingSound
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-emerald-400" />
            {isTestingSound ? 'Playing Test...' : 'Test Sound Motion'}
          </button>
        )}
      </div>

      {/* Modal for Fullscreen View */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute -top-10 right-0 p-2 bg-zinc-800 text-zinc-200 hover:text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={src}
              alt="Full View"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-zinc-800"
            />
            <div className="mt-3 text-zinc-400 text-xs flex items-center gap-3">
              <span>{metadata?.name || 'Photo'}</span>
              <span>•</span>
              <span>{metadata?.width} × {metadata?.height}px</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
