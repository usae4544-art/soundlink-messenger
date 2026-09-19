import React, { useState } from 'react';
import { Mic, Video as VideoIcon, Shield, ExternalLink, CheckCircle2, AlertCircle, Phone, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  type: 'voice' | 'video';
  contact: {
    name: string;
    username?: string;
    photoURL?: string;
  };
  onGranted: () => void;
  onFallback: () => void;
  onClose: () => void;
}

export function CallPermissionModal({
  isOpen,
  type,
  contact,
  onGranted,
  onFallback,
  onClose
}: Props) {
  const [requesting, setRequesting] = useState(false);
  const [status, setStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isVideo = type === 'video';

  const handleRequestPermission = async () => {
    setRequesting(true);
    setErrorMessage(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser does not support media device capture.");
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: isVideo
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Immediately stop preview tracks once permission is verified
      stream.getTracks().forEach((track) => track.stop());

      setStatus('granted');
      setRequesting(false);
      setTimeout(() => {
        onGranted();
      }, 400);
    } catch (err: any) {
      console.warn("Permission grant attempt:", err);
      setRequesting(false);
      setStatus('denied');
      setErrorMessage(
        err?.message ||
          "Browser blocked camera or microphone access. Please allow permissions in your URL bar or click below."
      );
    }
  };

  const handleOpenNewWindow = () => {
    window.open(window.location.href, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-emerald-500/40 rounded-3xl w-full max-w-md shadow-2xl p-5 sm:p-6 text-center space-y-5 animate-scale-up">
        {/* Contact avatar and call header */}
        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <img
              src={
                contact.photoURL ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.username || 'user'}`
              }
              alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md">
              {isVideo ? <VideoIcon className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            </div>
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight">
            Start {isVideo ? 'HD Video Call' : 'HD Voice Call'}
          </h3>
          <p className="text-xs text-zinc-400">with {contact.name} (@{contact.username || 'contact'})</p>
        </div>

        {/* Permission Information Cards */}
        <div className="space-y-2.5 text-left">
          <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <Mic className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Microphone Access</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                  Required
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Transmits your voice peer-to-peer with noise cancellation and echo reduction.
              </p>
            </div>
          </div>

          {isVideo && (
            <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <VideoIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Camera Access</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                    Required
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Streams crystal-clear real-time encrypted video directly to your contact.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Security / Privacy badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-950/40 py-1.5 px-3 rounded-full border border-zinc-800">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>End-to-End Encrypted WebRTC • No Recordings</span>
        </div>

        {/* Status / Error Message */}
        {status === 'denied' && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Browser Permission Restricted</span>
                <span className="text-[11px] text-zinc-300 block mt-0.5">
                  {errorMessage || 'Hardware microphone/camera permission could not be accessed directly.'}
                </span>
              </div>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={handleOpenNewWindow}
                className="flex-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </button>
              <button
                onClick={onFallback}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
              >
                Simulate Call
              </button>
            </div>
          </div>
        )}

        {status === 'granted' && (
          <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">Permission Verified! Connecting call...</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {status !== 'granted' && (
            <button
              onClick={handleRequestPermission}
              disabled={requesting}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {requesting ? (
                <span>Requesting Permissions...</span>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  <span>Allow Permissions & Start Call</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
