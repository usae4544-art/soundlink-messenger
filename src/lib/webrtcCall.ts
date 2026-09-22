import { db } from '../firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';

export interface CallPeer {
  uid: string;
  name: string;
  photoURL?: string;
  username?: string;
}

export interface CallSession {
  id: string;
  chatId: string;
  caller: CallPeer;
  receiver: CallPeer;
  type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'busy';
  offer?: any;
  answer?: any;
  createdAt: number;
  endedAt?: number;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
};

export interface CallEventListener {
  onStatusChange?: (status: string) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onSimulatedChange?: (simulated: boolean) => void;
}

// Web Audio synthesizer for phone ringtone and mobile vibration
let ringtoneAudioCtx: AudioContext | null = null;
let ringtoneInterval: any = null;
let vibrationInterval: any = null;
let outgoingToneCtx: AudioContext | null = null;
let outgoingInterval: any = null;
let titleBlinkInterval: any = null;
let originalDocumentTitle = typeof document !== 'undefined' ? document.title : 'SoundLink Messenger';

// Mobile vibration support
export function startMobileVibration() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      // Standard mobile ringing cadence: 500ms buzz, 300ms pause, 500ms buzz, 300ms pause, 1000ms buzz
      navigator.vibrate([500, 300, 500, 300, 1000, 400]);
      if (!vibrationInterval) {
        vibrationInterval = setInterval(() => {
          try {
            navigator.vibrate([500, 300, 500, 300, 1000, 400]);
          } catch (e) {}
        }, 3000);
      }
    } catch (e) {}
  }
}

export function stopMobileVibration() {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(0);
    } catch (e) {}
  }
}

// Browser tab & system notification
export function triggerIncomingCallAlert(callerName: string, callType: 'voice' | 'video', photoURL?: string) {
  // 0. Capacitor Local Notifications for Android APK
  try {
    LocalNotifications.requestPermissions().then((perm) => {
      if (perm.display === 'granted') {
        LocalNotifications.schedule({
          notifications: [
            {
              title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
              body: `${callerName} is calling you on SoundLink. Tap to answer!`,
              id: 9999,
              schedule: { at: new Date(Date.now() + 50) },
              channelId: 'soundlink_calls',
            }
          ]
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {}

  // 1. Web Notification API
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(`📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`, {
          body: `${callerName} is calling you on SoundLink. Click to answer!`,
          icon: photoURL || '/icon.svg',
          badge: '/icon.svg',
          tag: 'soundlink-incoming-call',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn("Notification error", e);
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }

  // 2. Tab Title Alert Blinker
  if (typeof document !== 'undefined') {
    if (titleBlinkInterval) clearInterval(titleBlinkInterval);
    originalDocumentTitle = document.title || 'SoundLink Messenger';
    let isBlink = false;
    titleBlinkInterval = setInterval(() => {
      isBlink = !isBlink;
      document.title = isBlink ? `📞 (${callerName} Calling...)` : `🔔 INCOMING CALL! - SoundLink`;
    }, 850);
  }
}

export function stopIncomingCallAlert() {
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
    if (typeof document !== 'undefined') {
      document.title = originalDocumentTitle;
    }
  }
}

// Outgoing call dial tone (played to caller while waiting for receiver to pick up)
export function playOutgoingRingtone() {
  stopOutgoingRingtone();
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    outgoingToneCtx = new AudioCtx();

    const ring = () => {
      if (!outgoingToneCtx || outgoingToneCtx.state === 'closed') return;
      if (outgoingToneCtx.state === 'suspended') outgoingToneCtx.resume().catch(() => {});
      const now = outgoingToneCtx.currentTime;

      // Soft dual-frequency tone (440Hz + 480Hz)
      const osc1 = outgoingToneCtx.createOscillator();
      const osc2 = outgoingToneCtx.createOscillator();
      const gain = outgoingToneCtx.createGain();

      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.setValueAtTime(0.06, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(outgoingToneCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.5);
      osc2.stop(now + 1.5);
    };

    ring();
    outgoingInterval = setInterval(ring, 3500);
  } catch (e) {}
}

export function stopOutgoingRingtone() {
  if (outgoingInterval) {
    clearInterval(outgoingInterval);
    outgoingInterval = null;
  }
  if (outgoingToneCtx && outgoingToneCtx.state !== 'closed') {
    try {
      outgoingToneCtx.close();
    } catch (e) {}
    outgoingToneCtx = null;
  }
}

// Connected chime
export function playCallConnectedSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
    setTimeout(() => {
      try { ctx.close(); } catch (e) {}
    }, 400);
  } catch (e) {}
}

// Ended disconnect sound
export function playCallEndedSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(330, now + 0.15); // E4
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
    setTimeout(() => {
      try { ctx.close(); } catch (e) {}
    }, 400);
  } catch (e) {}
}

// Full Incoming Phone Ringtone (Audio melody + Mobile vibration)
export function playRingtone() {
  stopRingtone();
  startMobileVibration();

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    ringtoneAudioCtx = new AudioCtx();

    // Unlock audio context on mobile touch/click if browser suspended it
    const resumeOnInteraction = () => {
      if (ringtoneAudioCtx && ringtoneAudioCtx.state === 'suspended') {
        ringtoneAudioCtx.resume().catch(() => {});
      }
      window.removeEventListener('touchstart', resumeOnInteraction);
      window.removeEventListener('click', resumeOnInteraction);
    };
    window.addEventListener('touchstart', resumeOnInteraction, { once: true });
    window.addEventListener('click', resumeOnInteraction, { once: true });

    const ring = () => {
      if (!ringtoneAudioCtx || ringtoneAudioCtx.state === 'closed') return;
      if (ringtoneAudioCtx.state === 'suspended') {
        ringtoneAudioCtx.resume().catch(() => {});
      }

      const now = ringtoneAudioCtx.currentTime;

      // Modern harmonious smartphone ringtone melody (Marimba chime notes: C5, E5, G5, C6)
      const notes = [
        { freq: 523.25, time: 0, dur: 0.22 },      // C5
        { freq: 659.25, time: 0.18, dur: 0.22 },   // E5
        { freq: 783.99, time: 0.36, dur: 0.25 },   // G5
        { freq: 1046.50, time: 0.54, dur: 0.45 },  // C6
        { freq: 783.99, time: 1.05, dur: 0.2 },    // G5
        { freq: 1046.50, time: 1.25, dur: 0.55 },  // C6
      ];

      notes.forEach((n) => {
        if (!ringtoneAudioCtx || ringtoneAudioCtx.state === 'closed') return;
        const osc = ringtoneAudioCtx.createOscillator();
        const gain = ringtoneAudioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0.2, now + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ringtoneAudioCtx.destination);

        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      });
    };

    ring();
    ringtoneInterval = setInterval(ring, 2800);
  } catch (e) {
    console.error("Ringtone error", e);
  }
}

export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (ringtoneAudioCtx && ringtoneAudioCtx.state !== 'closed') {
    try {
      ringtoneAudioCtx.close();
    } catch (e) {}
    ringtoneAudioCtx = null;
  }
  stopMobileVibration();
  stopIncomingCallAlert();
  stopOutgoingRingtone();
}

// Synthetic fallback stream for environments where camera/mic permission is blocked or unavailable
function createSyntheticMediaStream(type: 'voice' | 'video', label: string = 'User'): MediaStream {
  const stream = new MediaStream();

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001; // virtually silent, valid audio track for WebRTC
      osc.connect(gain);
      const dest = audioCtx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }
  } catch (e) {
    console.warn("Could not create synthetic audio track", e);
  }

  if (type === 'video') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let frame = 0;
        const draw = () => {
          frame++;
          ctx.fillStyle = '#09090b';
          ctx.fillRect(0, 0, 640, 480);

          const pulse = Math.sin(frame * 0.08) * 5;
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(320, 200, 60 + pulse, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((label.slice(0, 1) || 'U').toUpperCase(), 320, 200);

          ctx.fillStyle = '#e4e4e7';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(label, 320, 290);

          ctx.fillStyle = '#10b981';
          ctx.font = '12px sans-serif';
          ctx.fillText('Encrypted WebRTC Call (Simulated Stream)', 320, 320);

          ctx.fillStyle = '#71717a';
          ctx.font = '11px sans-serif';
          ctx.fillText('Hardware camera permission not granted in browser', 320, 345);
        };
        draw();
        const animInterval = setInterval(draw, 100);

        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
        if (canvasStream) {
          const videoTrack = canvasStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.addEventListener('ended', () => clearInterval(animInterval));
            stream.addTrack(videoTrack);
          }
        }
      }
    } catch (e) {
      console.warn("Could not create synthetic video track", e);
    }
  }

  return stream;
}

export class WebRTCCallService {
  public pc: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  public callId: string | null = null;
  public isSimulatedMedia: boolean = false;
  public currentStatus: string = 'idle';
  private unsubCall: (() => void) | null = null;
  private unsubCandidates: (() => void) | null = null;
  private candidateQueue: any[] = [];
  private listeners = new Set<CallEventListener>();

  public addListener(listener: CallEventListener): () => void {
    this.listeners.add(listener);
    if (this.currentStatus && this.currentStatus !== 'idle' && listener.onStatusChange) {
      try { listener.onStatusChange(this.currentStatus); } catch (e) {}
    }
    if (this.localStream && listener.onLocalStream) {
      try { listener.onLocalStream(this.localStream); } catch (e) {}
    }
    if (this.remoteStream && listener.onRemoteStream) {
      try { listener.onRemoteStream(this.remoteStream); } catch (e) {}
    }
    if (listener.onSimulatedChange) {
      try { listener.onSimulatedChange(this.isSimulatedMedia); } catch (e) {}
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emitStatus(status: string) {
    this.currentStatus = status;
    this.listeners.forEach((l) => {
      try { l.onStatusChange?.(status); } catch (e) {}
    });
  }

  public emitRemoteStream(stream: MediaStream) {
    this.remoteStream = stream;
    this.listeners.forEach((l) => {
      try { l.onRemoteStream?.(stream); } catch (e) {}
    });
  }

  public emitLocalStream(stream: MediaStream) {
    this.localStream = stream;
    this.listeners.forEach((l) => {
      try { l.onLocalStream?.(stream); } catch (e) {}
    });
  }

  private async addCandidateSafely(candidateData: any) {
    if (!this.pc) return;
    if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      this.candidateQueue.push(candidateData);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidateData));
    } catch (err) {
      console.warn("Error adding ICE candidate:", err);
    }
  }

  private async flushCandidateQueue() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.candidateQueue.length > 0) {
      const cand = this.candidateQueue.shift();
      if (cand) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn("Error flushing queued ICE candidate:", e);
        }
      }
    }
  }

  async getMedia(type: 'voice' | 'video', userLabel?: string): Promise<MediaStream> {
    this.isSimulatedMedia = false;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: type === 'video' ? {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
          } : false,
        };

        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.emitLocalStream(this.localStream);
        return this.localStream;
      } catch (mediaErr: any) {
        // If video failed (e.g. OverconstrainedError, NotFoundError), attempt voice-only fallback
        if (type === 'video') {
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: false
            });
            this.emitLocalStream(this.localStream);
            return this.localStream;
          } catch (audioErr) {
            // Both hardware audio & video unavailable or denied
          }
        }

        console.warn("Hardware media access not available or permission denied. Using synthetic media stream:", mediaErr?.message);
        this.isSimulatedMedia = true;
        this.localStream = createSyntheticMediaStream(type, userLabel);
        this.emitLocalStream(this.localStream);
        return this.localStream;
      }
    }

    console.warn("navigator.mediaDevices not available. Using synthetic media stream.");
    this.isSimulatedMedia = true;
    this.localStream = createSyntheticMediaStream(type, userLabel);
    this.emitLocalStream(this.localStream);
    return this.localStream;
  }

  async initiateCall(
    chatId: string,
    caller: CallPeer,
    receiver: CallPeer,
    type: 'voice' | 'video',
    onRemoteStream?: (stream: MediaStream) => void,
    onStatusChange?: (status: string) => void
  ): Promise<string> {
    this.candidateQueue = [];
    this.currentStatus = 'ringing';
    this.emitStatus('ringing');
    if (onStatusChange) onStatusChange('ringing');

    const stream = await this.getMedia(type, caller.name);
    const callId = `call_${Date.now()}_${caller.uid.slice(0, 6)}`;
    this.callId = callId;

    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, stream);
    });

    // Handle remote tracks robustly
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }
      this.emitRemoteStream(this.remoteStream);
      if (onRemoteStream) onRemoteStream(this.remoteStream);
    };

    // Connection state listeners
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected') {
        this.emitStatus('accepted');
        if (onStatusChange) onStatusChange('accepted');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc?.iceConnectionState === 'connected' || this.pc?.iceConnectionState === 'completed') {
        this.emitStatus('accepted');
        if (onStatusChange) onStatusChange('accepted');
      }
    };

    // Collect ICE candidates and save to Firestore
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'calls', callId, 'callerCandidates'), event.candidate.toJSON());
      }
    };

    // Create SDP offer
    const offerDescription = await this.pc.createOffer();
    await this.pc.setLocalDescription(offerDescription);

    const callData: CallSession = {
      id: callId,
      chatId,
      caller,
      receiver,
      type,
      status: 'ringing',
      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp,
      },
      createdAt: Date.now(),
    };

    await setDoc(doc(db, 'calls', callId), callData);
    playOutgoingRingtone();

    // Trigger Push Notification to receiver if app is closed/backgrounded
    try {
      const receiverSnap = await getDoc(doc(db, 'users', receiver.uid));
      if (receiverSnap.exists()) {
        const rData = receiverSnap.data();
        if (rData.pushSubscription) {
          await fetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: rData.pushSubscription,
              title: `Incoming ${type === 'video' ? 'Video' : 'Voice'} Call`,
              body: `${caller.name} is calling you...`,
              icon: caller.photoURL || '/icon.svg',
              url: '/'
            })
          });
        }
      }
    } catch (e) {
      console.warn("Call push notification failed:", e);
    }

    // Listen for answer and status changes
    this.unsubCall = onSnapshot(doc(db, 'calls', callId), async (snap) => {
      const data = snap.data() as CallSession | undefined;
      if (!data) return;

      if (data.status === 'accepted' && data.answer) {
        if (!this.pc?.currentRemoteDescription) {
          stopOutgoingRingtone();
          playCallConnectedSound();
          const answerDescription = new RTCSessionDescription(data.answer);
          await this.pc?.setRemoteDescription(answerDescription);
          await this.flushCandidateQueue();
        }
        this.emitStatus('accepted');
        if (onStatusChange) onStatusChange('accepted');
      } else if (data.status === 'declined' || data.status === 'ended') {
        stopOutgoingRingtone();
        playCallEndedSound();
        this.emitStatus(data.status);
        if (onStatusChange) onStatusChange(data.status);
        this.cleanup();
      } else {
        this.emitStatus(data.status);
        if (onStatusChange) onStatusChange(data.status);
      }
    });

    // Listen for receiver's ICE candidates safely with queueing
    this.unsubCandidates = onSnapshot(collection(db, 'calls', callId, 'receiverCandidates'), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          await this.addCandidateSafely(data);
        }
      });
    });

    return callId;
  }

  async answerCall(
    callSession: CallSession,
    onRemoteStream?: (stream: MediaStream) => void,
    onStatusChange?: (status: string) => void
  ): Promise<void> {
    stopRingtone();
    this.candidateQueue = [];
    this.currentStatus = 'connecting';
    this.emitStatus('connecting');
    if (onStatusChange) onStatusChange('connecting');

    const stream = await this.getMedia(callSession.type, callSession.receiver.name);
    this.callId = callSession.id;

    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();

    stream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, stream);
    });

    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }
      this.emitRemoteStream(this.remoteStream);
      if (onRemoteStream) onRemoteStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected') {
        this.emitStatus('accepted');
        if (onStatusChange) onStatusChange('accepted');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc?.iceConnectionState === 'connected' || this.pc?.iceConnectionState === 'completed') {
        this.emitStatus('accepted');
        if (onStatusChange) onStatusChange('accepted');
      }
    };

    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await addDoc(collection(db, 'calls', callSession.id, 'receiverCandidates'), event.candidate.toJSON());
      }
    };

    // Set remote offer
    const offerDescription = new RTCSessionDescription(callSession.offer);
    await this.pc.setRemoteDescription(offerDescription);
    await this.flushCandidateQueue();

    // Create SDP answer
    const answerDescription = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answerDescription);

    await updateDoc(doc(db, 'calls', callSession.id), {
      status: 'accepted',
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      },
    });
    playCallConnectedSound();
    this.emitStatus('accepted');
    if (onStatusChange) onStatusChange('accepted');

    // Listen for caller's ICE candidates
    this.unsubCandidates = onSnapshot(collection(db, 'calls', callSession.id, 'callerCandidates'), (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          await this.addCandidateSafely(data);
        }
      });
    });

    // Listen for status changes
    this.unsubCall = onSnapshot(doc(db, 'calls', callSession.id), (snap) => {
      const data = snap.data() as CallSession | undefined;
      if (!data) return;
      this.emitStatus(data.status);
      if (onStatusChange) onStatusChange(data.status);
      if (data.status === 'ended' || data.status === 'declined') {
        this.cleanup();
      }
    });
  }

  async declineCall(callId: string) {
    stopRingtone();
    playCallEndedSound();
    try {
      await updateDoc(doc(db, 'calls', callId), { status: 'declined', endedAt: Date.now() });
    } catch (e) {
      console.error(e);
    }
    this.cleanup();
  }

  async endCall() {
    stopRingtone();
    playCallEndedSound();
    if (this.callId) {
      try {
        await updateDoc(doc(db, 'calls', this.callId), { status: 'ended', endedAt: Date.now() });
      } catch (e) {
        console.error(e);
      }
    }
    this.cleanup();
  }

  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // returns true if muted
    }
    return false;
  }

  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // returns true if video is turned off
    }
    return false;
  }

  cleanup() {
    stopRingtone();
    this.candidateQueue = [];
    this.currentStatus = 'idle';
    if (this.unsubCall) {
      this.unsubCall();
      this.unsubCall = null;
    }
    if (this.unsubCandidates) {
      this.unsubCandidates();
      this.unsubCandidates = null;
    }

    // Stop all media tracks strictly to ensure mic and camera turn off completely!
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.remoteStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.callId = null;
  }
}

// Global active call listener for incoming calls
const processedCalls = new Set<string>();

export function subscribeToIncomingCalls(userUid: string, onIncoming: (call: CallSession) => void) {
  const q = query(
    collection(db, 'calls'),
    where('receiver.uid', '==', userUid),
    where('status', '==', 'ringing')
  );

  return onSnapshot(q, (snap) => {
    snap.docs.forEach((docSnap) => {
      const callData = docSnap.data() as CallSession;
      if (callData && callData.id && !processedCalls.has(callData.id)) {
        // Allow up to 2 minutes old calls (and tolerate slight clock skews)
        if (Date.now() - callData.createdAt < 120000) {
          processedCalls.add(callData.id);
          playRingtone();
          triggerIncomingCallAlert(callData.caller.name, callData.type, callData.caller.photoURL);
          onIncoming(callData);
        }
      }
    });
  });
}
