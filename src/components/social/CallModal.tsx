import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Maximize2, Minimize2, Shield, Camera } from 'lucide-react';
import { WebRTCCallService, CallSession, stopRingtone } from '../../lib/webrtcCall';

interface Props {
  callSession: CallSession | null;
  callService: WebRTCCallService;
  isIncoming: boolean;
  currentUser: any;
  onClose: () => void;
}

export function CallModal({ callSession, callService, isIncoming, currentUser, onClose }: Props) {
  const [callStatus, setCallStatus] = useState<string>(callSession?.status || 'ringing');
  const [localStream, setLocalStream] = useState<MediaStream | null>(callService.localStream);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(callService.remoteStream);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const otherUser = isIncoming ? callSession?.caller : callSession?.receiver;
  const isVideo = callSession?.type === 'video';

  // Duration timer
  useEffect(() => {
    let timer: any = null;
    if (callStatus === 'accepted') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus]);

  // Subscribe to callService events for real-time stream and status updates
  useEffect(() => {
    const unsub = callService.addListener({
      onStatusChange: (status) => {
        setCallStatus(status);
        if (status === 'ended' || status === 'declined') {
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      },
      onLocalStream: (stream) => {
        setLocalStream(stream);
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
      },
    });

    // If streams are already present on service, initialize state
    if (callService.localStream) setLocalStream(callService.localStream);
    if (callService.remoteStream) setRemoteStream(callService.remoteStream);
    if (callService.currentStatus && callService.currentStatus !== 'idle') {
      setCallStatus(callService.currentStatus);
    }

    return unsub;
  }, [callService, onClose]);

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch((e) => {
        console.warn("Local video autoplay prevented:", e?.message);
      });
    }
  }, [localStream, callStatus, isVideo]);

  // Bind remote stream to remote video and audio elements
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch((e) => {
        console.warn("Remote video autoplay prevented:", e?.message);
      });
    }

    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.play().catch((e) => {
        console.warn("Remote audio autoplay prevented:", e?.message);
      });
    }
  }, [remoteStream, callStatus, isVideo]);

  const handleAccept = async () => {
    if (!callSession) return;
    try {
      setCallStatus('connecting');
      await callService.answerCall(callSession);
    } catch (err: any) {
      console.warn("Notice while answering call:", err?.message || err);
      handleClose();
    }
  };

  const handleDecline = async () => {
    if (callSession) {
      await callService.declineCall(callSession.id);
    }
    handleClose();
  };

  const handleEnd = async () => {
    await callService.endCall();
    handleClose();
  };

  const handleToggleMute = () => {
    const muted = callService.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleVideo = () => {
    const videoOff = callService.toggleVideo();
    setIsVideoOff(videoOff);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleClose = () => {
    stopRingtone();
    callService.cleanup();
    onClose();
  };

  // Ensure cleanup on component unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      callService.cleanup();
    };
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!callSession) return null;

  // Incoming Call Ringing Overlay
  if (isIncoming && callStatus === 'ringing') {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
        <div className="bg-zinc-900/95 border border-emerald-500/40 shadow-2xl rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center animate-bounce-subtle">
          <div className="relative mb-6">
            <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping"></div>
            <div className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-pulse"></div>
            <img
              src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username || 'user'}`}
              alt={otherUser?.name || 'Caller'}
              className="w-24 h-24 rounded-full object-cover border-4 border-emerald-500 relative z-10 shadow-lg"
            />
          </div>

          <h3 className="text-xl font-bold text-white mb-1">{otherUser?.name || 'Incoming Caller'}</h3>
          <p className="text-sm text-zinc-400 mb-2">@{otherUser?.username || 'contact'}</p>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-8">
            {isVideo ? <VideoIcon className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
            Incoming HD {isVideo ? 'Video' : 'Voice'} Call
          </div>

          <div className="flex items-center justify-center gap-8 w-full">
            <button
              onClick={handleDecline}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all group-hover:scale-110 active:scale-95">
                <PhoneOff className="w-6 h-6" />
              </div>
              <span className="text-xs text-zinc-400 group-hover:text-red-400 font-medium">Decline</span>
            </button>

            <button
              onClick={handleAccept}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all group-hover:scale-110 active:scale-95 animate-pulse">
                {isVideo ? <VideoIcon className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </div>
              <span className="text-xs text-emerald-400 font-semibold">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active or Outgoing Call Screen
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden select-none"
    >
      {/* Audio element for remote sound in both voice and video calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${callStatus === 'accepted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></div>
          <div>
            <h2 className="text-white font-semibold text-base sm:text-lg flex items-center gap-2">
              {otherUser?.name || 'Contact'}
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-normal border border-zinc-700">
                {isVideo ? 'HD Video' : 'HD Voice'}
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              {callStatus === 'ringing'
                ? 'Ringing...'
                : callStatus === 'connecting'
                ? 'Establishing secure link...'
                : callStatus === 'accepted'
                ? `Connected • ${formatDuration(callDuration)}`
                : callStatus === 'declined'
                ? 'Call Declined'
                : callStatus === 'ended'
                ? 'Call Ended'
                : callStatus}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            P2P Encrypted WebRTC
          </div>
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {callService.isSimulatedMedia && (
        <div className="w-full max-w-4xl mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 z-20 flex-wrap">
          <span>Camera/Microphone permission was restricted in this browser frame. Virtual media stream is active.</span>
          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] border border-amber-500/40 transition-colors inline-flex items-center gap-1 shrink-0"
          >
            Open in New Tab for Hardware
          </button>
        </div>
      )}

      {/* Main Video / Voice View Stage */}
      <div className="relative w-full max-w-4xl flex-1 my-3 flex items-center justify-center rounded-3xl overflow-hidden bg-zinc-900/90 border border-zinc-800 shadow-2xl">
        {isVideo ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            {/* Remote Peer Video Stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-zinc-950"
            />

            {/* Outgoing Ringing / Connecting State Overlay (disappears immediately upon 'accepted') */}
            {(callStatus === 'ringing' || callStatus === 'connecting') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md z-10 p-6">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                  <img
                    src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username || 'user'}`}
                    alt={otherUser?.name || 'Contact'}
                    className="w-16 h-16 rounded-full object-cover absolute top-4 left-4 border-2 border-emerald-500 shadow-lg"
                  />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{otherUser?.name}</h3>
                <p className="text-sm text-zinc-400 mb-3">@{otherUser?.username || 'contact'}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                  {callStatus === 'ringing' ? 'Calling (Ringing phone...)' : 'Connecting encrypted stream...'}
                </div>
              </div>
            )}

            {/* Call Ended / Declined Banner */}
            {(callStatus === 'ended' || callStatus === 'declined') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md z-30 p-6">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mb-4">
                  <PhoneOff className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {callStatus === 'declined' ? 'Call Declined' : 'Call Ended'}
                </h3>
                <p className="text-sm text-zinc-400">Disconnecting session...</p>
              </div>
            )}

            {/* Local Video Picture-in-Picture (PiP) */}
            <div className="absolute bottom-4 right-4 w-32 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-zinc-700/80 shadow-2xl bg-zinc-900 z-20 group">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-medium text-zinc-300 backdrop-blur-sm pointer-events-none">
                You
              </div>
              {isVideoOff && (
                <div className="absolute inset-0 bg-zinc-900/95 flex flex-col items-center justify-center text-zinc-400 text-xs gap-1 font-medium">
                  <VideoOff className="w-5 h-5 text-zinc-500" />
                  <span>Camera Off</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Voice Call Audio Visualizer Graphic */
          <div className="flex flex-col items-center justify-center gap-6 p-6">
            <div className="relative">
              <div className="absolute -inset-6 rounded-full bg-emerald-500/10 animate-ping"></div>
              <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-pulse"></div>
              <img
                src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.username || 'user'}`}
                alt={otherUser?.name || 'Caller'}
                className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500 relative z-10 shadow-2xl"
              />
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-1">{otherUser?.name}</h3>
              <p className="text-zinc-400 text-sm">@{otherUser?.username || 'contact'}</p>
            </div>

            <div className="flex items-center gap-1.5 h-12">
              {[...Array(14)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-emerald-500 rounded-full transition-all duration-150"
                  style={{
                    height: `${callStatus === 'accepted' ? 14 + ((i * 11 + callDuration * 7) % 32) : 8}px`,
                    opacity: callStatus === 'accepted' ? 0.9 : 0.4
                  }}
                ></div>
              ))}
            </div>

            <div className="text-emerald-400 font-mono text-base sm:text-lg font-semibold tracking-wider">
              {callStatus === 'accepted'
                ? `In Call • ${formatDuration(callDuration)}`
                : callStatus === 'ringing'
                ? 'Ringing...'
                : callStatus === 'connecting'
                ? 'Connecting HD audio...'
                : callStatus}
            </div>
          </div>
        )}
      </div>

      {/* In-Call Controls Bar */}
      <div className="w-full max-w-md flex items-center justify-center gap-4 bg-zinc-900/90 border border-zinc-800 p-4 rounded-3xl shadow-2xl z-20 backdrop-blur-md">
        <button
          onClick={handleToggleMute}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {isVideo && (
          <button
            onClick={handleToggleVideo}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isVideoOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={handleEnd}
          className="px-6 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>End Call</span>
        </button>
      </div>
    </div>
  );
}
