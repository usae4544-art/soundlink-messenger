import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from './lib/apiHelper';
import { downloadFileToDevice } from './lib/downloader';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { App as CapApp } from '@capacitor/app';
import { CustomLoginModal } from './components/CustomLoginModal';
import { CustomUser } from './lib/customAuth';
import {
  broadcastData,
  startListening,
  generateWavBlob,
  analyzeAudioFile,
  storeImageLocally,
  storeVideoLocally,
  storeAudioLocally,
  retrieveImageLocally,
  retrieveVideoLocally,
  retrieveAudioLocally,
  generateTokenFromBytes,
  computeAudioAnalysis,
} from './lib/audioProtocol';
import {
  Users,
  Mic,
  Send,
  RadioReceiver,
  Activity,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Keyboard,
  MicIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  CheckCircle2,
  Sparkles,
  Volume2,
  Info,
  HardDrive,
  Shield,
  Crown,
  Share2,
  Link as LinkIcon,
  KeyRound,
} from 'lucide-react';
import { AudioAnalysis, DecodedPayload, ImageMetadata, VideoMetadata, AudioMetadata, MotionMode, SentHistoryItem, PayloadType } from './types';
import { ProfileSetup } from './components/social/ProfileSetup';
import { SocialTab } from './components/social/SocialTab';
import { StorageManagerModal } from './components/StorageManagerModal';
import { DeveloperPanel } from './components/social/DeveloperPanel';

import { AudioReactiveImage } from './components/AudioReactiveImage';
import { isDeveloperUser, DEVELOPER_EMAIL } from './lib/social';

import { PWAInstallButton } from './components/PWAInstallButton';
import { ShareLinkCard } from './components/ShareLinkCard';
import { ReceivedFromLinkBanner, ManualPasteBar } from './components/ReceivedFromLinkBanner';
import { WebRTCCallService, CallSession, subscribeToIncomingCalls } from './lib/webrtcCall';
import { CallModal } from './components/social/CallModal';
import { 
  publishSharePayload, 
  fetchSharedPayload, 
  playAcousticSoundForPayload, 
  createAcousticToken,
  uploadBlobMedia
} from './lib/shareLink';

export default function App() {
  const [activeTab, setActiveTab] = useState<'send' | 'receive' | 'social'>('send');
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showCustomLoginModal, setShowCustomLoginModal] = useState(false);
  
  useEffect(() => {
    // Initial fast local restore
    const savedUser = localStorage.getItem('soundlink_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        getDoc(doc(db, 'users', u.uid))
          .then(docSnap => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setUserProfile(data);
            }
          })
          .catch(err => console.warn("Initial user fetch:", err));
      } catch (e) {}
    }
  }, []);

  // Global incoming call subscription for real-time ring, vibrate, and notifications across all tabs
  const callServiceRef = useRef<WebRTCCallService>(new WebRTCCallService());
  const [activeCallSession, setActiveCallSession] = useState<CallSession | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubCall = subscribeToIncomingCalls(user.uid, (call) => {
      setActiveCallSession(call);
      setIsIncomingCall(true);
    });
    return unsubCall;
  }, [user?.uid]);

  
  useEffect(() => {
    if (!user?.uid) return;
    
    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    const subscribePush = async () => {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          await navigator.serviceWorker.register('/sw.js');
          const reg = await navigator.serviceWorker.ready;
          const res = await apiFetch('/api/vapid-public-key');
          const vapidPublicKey = await res.text();
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub) {
            await existingSub.unsubscribe();
          }

          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });

          await setDoc(doc(db, 'users', user.uid), { pushSubscription: subscription.toJSON() }, { merge: true });
          console.log("Subscribed to Web Push");
        }
      } catch (err) {
        console.error("Push subscription failed", err);
      }
    };

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        subscribePush();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') subscribePush();
        });
      }
    }
  }, [user?.uid]);

  // Ensure microphone is strictly closed when switching away from receive tab
  useEffect(() => {
    if (activeTab !== 'receive') {
      if (stopListeningRef.current) {
        stopListeningRef.current();
        stopListeningRef.current = null;
        setIsListening(false);
        setLiveHex('');
        setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
      }
    }
  }, [activeTab]);

  const processLoggedInUser = async (fbUser: any) => {
    const u = {
      uid: fbUser.uid,
      name: fbUser.displayName,
      email: fbUser.email,
      picture: fbUser.photoURL,
    };
    setUser(u);
    localStorage.setItem('soundlink_user', JSON.stringify(u));
    
    const isDev = isDeveloperUser(fbUser.email);
    const userRef = doc(db, 'users', fbUser.uid);
    const userDoc = await getDoc(userRef);

    const baseLoginData = {
      joined: true,
      online: true,
      lastLogin: Date.now(),
      lastActive: Date.now()
    };
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (isDev && data.role !== 'developer') {
        await setDoc(userRef, { ...baseLoginData, role: 'developer', isDeveloper: true }, { merge: true });
        data.role = 'developer';
        data.isDeveloper = true;
      } else {
        await setDoc(userRef, baseLoginData, { merge: true });
      }
      setUserProfile(data);
      if (!data.username) setShowProfileSetup(true);
    } else {
      const newProfile: any = { 
        uid: u.uid,
        email: u.email,
        displayName: u.name,
        photoURL: u.picture,
        createdAt: Date.now(),
        ...baseLoginData
      };
      if (isDev) {
        newProfile.role = 'developer';
        newProfile.isDeveloper = true;
      }
      await setDoc(userRef, newProfile);
      setUserProfile(newProfile);
      setShowProfileSetup(true);
    }
  };



  const handleCustomLoginSuccess = async (customUser: CustomUser) => {
    const u = {
      uid: customUser.uid,
      name: customUser.name,
      email: customUser.username + '@soundlink.app',
      picture: '',
      username: customUser.username
    };
    setUser(u);
    localStorage.setItem('soundlink_user', JSON.stringify(u));

    const userRef = doc(db, 'users', customUser.uid);
    const docSnap = await getDoc(userRef);
    const baseLoginData = {
      joined: true,
      online: true,
      lastLogin: Date.now(),
      lastActive: Date.now()
    };

    if (docSnap.exists()) {
      await setDoc(userRef, baseLoginData, { merge: true });
      setUserProfile(docSnap.data());
    } else {
      const newProfile = {
        uid: customUser.uid,
        username: customUser.username,
        displayName: customUser.name,
        email: customUser.username + '@soundlink.app',
        isDeveloper: customUser.isDeveloper,
        role: customUser.role,
        createdAt: Date.now(),
        ...baseLoginData
      };
      await setDoc(userRef, newProfile);
      setUserProfile(newProfile);
    }
  };

  // Background app state and heartbeat listener for calls & notifications
  useEffect(() => {
    let heartbeatInterval: any;
    const setupBackgroundListener = async () => {
      try {
        CapApp.addListener('appStateChange', async (state) => {
          console.log('App state changed:', state);
          if (user?.uid) {
            try {
              await setDoc(doc(db, 'users', user.uid), {
                online: state.isActive,
                lastActive: Date.now(),
                joined: true
              }, { merge: true });
            } catch (e) {
              console.error('Failed to update online state:', e);
            }
          }
        });

        // Heartbeat interval to keep connection / status fresh
        heartbeatInterval = setInterval(async () => {
          if (user?.uid) {
            try {
              await setDoc(doc(db, 'users', user.uid), {
                lastActive: Date.now(),
                online: true,
                joined: true
              }, { merge: true });
            } catch (e) {}
          }
        }, 30000);
      } catch (e) {
        console.warn('Background app listener setup failed:', e);
      }
    };

    setupBackgroundListener();

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [user?.uid]);

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
    setSentHistory([]);
    localStorage.removeItem('soundlink_user');
  };



  // Transmit State
  const [sendMode, setSendMode] = useState<'text' | 'image' | 'video' | 'audio'>('image'); // Default to image
  const [message, setMessage] = useState('');
  const [realImageDataUrl, setRealImageDataUrl] = useState<string | null>(null);
  const [realImageMeta, setRealImageMeta] = useState<ImageMetadata | null>(null);
  const [imageAcousticToken, setImageAcousticToken] = useState<string>('');
  
  const [realVideoDataUrl, setRealVideoDataUrl] = useState<string | null>(null);
  const [realVideoMeta, setRealVideoMeta] = useState<VideoMetadata | null>(null);
  const [videoAcousticToken, setVideoAcousticToken] = useState<string>('');

  const [realAudioDataUrl, setRealAudioDataUrl] = useState<string | null>(null);
  const [realAudioMeta, setRealAudioMeta] = useState<AudioMetadata | null>(null);
  const [audioAcousticToken, setAudioAcousticToken] = useState<string>('');
  
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [isDictating, setIsDictating] = useState(false);
  const [broadcastExpiryMs, setBroadcastExpiryMs] = useState<number>(0);
  const [dictationNotice, setDictationNotice] = useState('');
  const [sentHistory, setSentHistory] = useState<SentHistoryItem[]>([]);
  
  // Share Link State
  const [textAcousticToken, setTextAcousticToken] = useState<string>('');
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string>('');
  const [lastSharedToken, setLastSharedToken] = useState<string>('');
  const [isPublishingShare, setIsPublishingShare] = useState<boolean>(false);

  // Link Recipient State (Listen tab)
  const [linkReceivedPayload, setLinkReceivedPayload] = useState<DecodedPayload | null>(null);
  const [isPlayingLinkSound, setIsPlayingLinkSound] = useState<boolean>(false);
  const [linkSoundProgress, setLinkSoundProgress] = useState<number>(0);
  const [isManualDecoding, setIsManualDecoding] = useState<boolean>(false);

  // Audio Motion State
  const [motionMode, setMotionMode] = useState<MotionMode>('pulse');
  const [isTestingSound, setIsTestingSound] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysis>({
    overall: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  });

  const sendCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const audioUploadRef = useRef<HTMLInputElement>(null);

  // Receive State
  const [isListening, setIsListening] = useState(false);
  const [receivedMessages, setReceivedMessages] = useState<DecodedPayload[]>([]);
  const [liveHex, setLiveHex] = useState<string>('');
  const [receiveError, setReceiveError] = useState<string>('');
  const [aiInsights, setAiInsights] = useState<Record<string, { loading: boolean; result?: string; error?: string }>>({});
  const receiveCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopListeningRef = useRef<(() => void) | null>(null);

  const handleGetInsight = async (msgId: string, text?: string, dataUrl?: string, mimeType?: string) => {
    setAiInsights((prev) => ({ ...prev, [msgId]: { loading: true } }));
    try {
      const payload: any = { query: text ? `Analyze this text: ${text}` : 'Analyze this media and explain what is in it in detail.' };
      
      if (dataUrl) {
        if (dataUrl.startsWith('blob:')) {
          // Fetch the blob and convert to base64 so the server can send it to Gemini
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          payload.imageDataUrl = base64;
        } else {
          payload.imageDataUrl = dataUrl;
        }
        payload.mimeType = mimeType || 'image/png';
      }

      const res = await apiFetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch AI Insights');

      setAiInsights((prev) => ({ ...prev, [msgId]: { loading: false, result: data.result } }));
    } catch (err: any) {
      setAiInsights((prev) => ({ ...prev, [msgId]: { loading: false, error: err.message } }));
    }
  };

  useEffect(() => {
    // Only clean up microphone on unmount.
    // Microphone is NEVER auto-started without explicit user action.
    return () => {
      if (stopListeningRef.current) stopListeningRef.current();
    };
  }, []);

  // Listen Tab: Detect URL share link on mount (?listenToken=... or ?share=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
    const token =
      searchParams.get('listenToken') ||
      searchParams.get('share') ||
      searchParams.get('token') ||
      hashParams.get('listenToken') ||
      hashParams.get('token');

    const typeHint = (searchParams.get('type') || hashParams.get('type')) as PayloadType | undefined;
    const textHint = searchParams.get('t') || hashParams.get('t') || undefined;

    if (token) {
      // 1. Direct navigation to Listen tab
      setActiveTab('receive');
      setLiveHex(`LINK_PASTED: Acoustic Token [#${token}] detected! Loading payload...`);

      // 2. Fetch and decode payload
      (async () => {
        try {
          const payload = await fetchSharedPayload(token, typeHint, textHint);
          if (payload) {
            setLinkReceivedPayload(payload);
            setReceivedMessages((prev) => {
              if (prev.some((p) => p.token === token || (p.text && payload.text && p.text === payload.text))) {
                return prev;
              }
              return [payload, ...prev];
            });
            setLiveHex(`DECODED_FROM_LINK: Token [#${token}] - ${payload.type.toUpperCase()} ready!`);
          } else {
            setReceiveError(`Could not find shared payload for token #${token}. It may have expired.`);
            setLiveHex(`TOKEN_EXPIRED_OR_NOT_FOUND: #${token}`);
          }
        } catch (err: any) {
          setReceiveError(`Error loading shared payload: ${err.message || err}`);
        }
      })();
    }
  }, []);

  // Text Mode: auto-generate acoustic token and share link on text changes
  useEffect(() => {
    if (sendMode === 'text' && message.trim()) {
      const handler = setTimeout(() => {
        const token = textAcousticToken || createAcousticToken('TXT');
        if (!textAcousticToken) setTextAcousticToken(token);
        publishSharePayload({
          type: 'text',
          token,
          text: message.trim(),
          expiresIn: broadcastExpiryMs > 0 ? broadcastExpiryMs : undefined,
          senderName: userProfile?.username || user?.displayName || 'SoundLink User',
        })
          .then(({ shareUrl }) => {
            setGeneratedShareUrl(shareUrl);
            setLastSharedToken(token);
          })
          .catch(console.error);
      }, 500);
      return () => clearTimeout(handler);
    }
  }, [message, sendMode, broadcastExpiryMs, textAcousticToken]);

  // Publish or re-publish share link
  const ensureAndPublishShareLink = async (explicitUserAction: boolean = false): Promise<string | null> => {
    let token = '';
    let dataUrl: string | undefined;
    let meta: any;
    let text: string | undefined;

    if (sendMode === 'image' && realImageDataUrl) {
      token = imageAcousticToken || createAcousticToken('IMG');
      dataUrl = realImageDataUrl;
      meta = realImageMeta;
    } else if (sendMode === 'video' && realVideoDataUrl) {
      token = videoAcousticToken || createAcousticToken('VID');
      dataUrl = realVideoDataUrl;
      meta = realVideoMeta;
    } else if (sendMode === 'audio' && realAudioDataUrl) {
      token = audioAcousticToken || createAcousticToken('AUD');
      dataUrl = realAudioDataUrl;
      meta = realAudioMeta;
    } else if (sendMode === 'text' && message.trim()) {
      token = textAcousticToken || createAcousticToken('TXT');
      text = message.trim();
    }

    if (!token) return null;

    setIsPublishingShare(true);
    try {
      const { shareUrl } = await publishSharePayload({
        type: sendMode,
        token,
        dataUrl,
        meta,
        text,
        expiresIn: broadcastExpiryMs > 0 ? broadcastExpiryMs : undefined,
        senderName: userProfile?.username || user?.displayName || 'SoundLink User',
      });
      setGeneratedShareUrl(shareUrl);
      setLastSharedToken(token);
      return shareUrl;
    } catch (e) {
      console.error('Failed to publish share payload', e);
      return null;
    } finally {
      setIsPublishingShare(false);
    }
  };

  // Listen Tab: Play acoustic sound wave for link-received payload
  const handlePlayLinkAcousticSound = async () => {
    if (!linkReceivedPayload || isPlayingLinkSound) return;
    setIsPlayingLinkSound(true);
    setLinkSoundProgress(0);

    try {
      const tokenOrText =
        linkReceivedPayload.type === 'text'
          ? linkReceivedPayload.text || 'text'
          : linkReceivedPayload.token || 'SL-LINK';

      await playAcousticSoundForPayload(
        linkReceivedPayload.type,
        tokenOrText,
        (progress) => setLinkSoundProgress(progress),
        receiveCanvasRef.current,
        (analysis) => setAudioAnalysis(analysis)
      );
    } catch (e) {
      console.error('Failed to play acoustic sound wave', e);
    } finally {
      setIsPlayingLinkSound(false);
      setLinkSoundProgress(0);
      setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
    }
  };

  // Listen Tab: Manual Paste & Decode
  const handleManualPasteAndDecode = async (rawInput: string) => {
    setIsManualDecoding(true);
    try {
      let token = rawInput.trim();
      let typeHint: PayloadType | undefined;
      let textHint: string | undefined;

      // Extract from full URL if pasted
      if (token.includes('http://') || token.includes('https://') || token.includes('?')) {
        try {
          const parsed = new URL(token, window.location.origin);
          const t =
            parsed.searchParams.get('listenToken') ||
            parsed.searchParams.get('share') ||
            parsed.searchParams.get('token');
          if (t) token = t;
          typeHint = (parsed.searchParams.get('type') as PayloadType) || undefined;
          textHint = parsed.searchParams.get('t') || undefined;
        } catch (e) {}
      }

      if (token.startsWith('#')) token = token.slice(1);

      setLiveHex(`MANUAL_PASTE: Processing token [#${token}]...`);
      const payload = await fetchSharedPayload(token, typeHint, textHint);
      if (payload) {
        setLinkReceivedPayload(payload);
        setReceivedMessages((prev) => [payload, ...prev]);
        setLiveHex(`PASTED_AND_DECODED: Token [#${token}] - ${payload.type.toUpperCase()} received!`);
      } else {
        throw new Error(`Payload for token "${token}" was not found or has expired.`);
      }
    } finally {
      setIsManualDecoding(false);
    }
  };

  // Handle Real Audio Upload (Instant)
  const handleRealAudioUpload = (e: React.ChangeEvent<HTMLInputElement> | DragEvent | File) => {
    let file: File | undefined;
    let targetInput: HTMLInputElement | null = null;
    if (e instanceof File) {
      file = e;
    } else if ('dataTransfer' in e && e.dataTransfer?.files?.[0]) {
      file = e.dataTransfer.files[0];
    } else if ('target' in e && e.target && (e.target as HTMLInputElement).files?.[0]) {
      targetInput = e.target as HTMLInputElement;
      file = targetInput.files![0];
    }

    if (!file) return;

    if (targetInput) {
      targetInput.value = '';
    }

    setRealImageDataUrl(null);
    setRealVideoDataUrl(null);
    
    const dataUrl = URL.createObjectURL(file);
    const meta: AudioMetadata = {
      name: file.name,
      size: file.size,
      mimeType: file.type || 'audio/mp3',
    };

    const encoder = new TextEncoder();
    const token = generateTokenFromBytes(encoder.encode(file.name + file.size + Date.now() + "aud"));

    setRealAudioDataUrl(dataUrl);
    setRealAudioMeta(meta);
    setAudioAcousticToken(token);

    storeAudioLocally(token, dataUrl, meta, file);
  };

  // Handle Real Video Upload (Instant)
  const handleRealVideoUpload = (e: React.ChangeEvent<HTMLInputElement> | DragEvent | File) => {
    let file: File | undefined;
    let targetInput: HTMLInputElement | null = null;
    if (e instanceof File) {
      file = e;
    } else if ('dataTransfer' in e && e.dataTransfer?.files?.[0]) {
      file = e.dataTransfer.files[0];
    } else if ('target' in e && e.target && (e.target as HTMLInputElement).files?.[0]) {
      targetInput = e.target as HTMLInputElement;
      file = targetInput.files![0];
    }

    if (!file) return;

    if (targetInput) {
      targetInput.value = '';
    }

    setRealImageDataUrl(null);
    setRealAudioDataUrl(null);

    const dataUrl = URL.createObjectURL(file);
    const meta: VideoMetadata = {
      name: file.name,
      size: file.size,
      mimeType: file.type || 'video/mp4',
    };

    const encoder = new TextEncoder();
    const token = generateTokenFromBytes(encoder.encode(file.name + file.size + Date.now() + "vid"));

    setRealVideoDataUrl(dataUrl);
    setRealVideoMeta(meta);
    setVideoAcousticToken(token);

    storeVideoLocally(token, dataUrl, meta, file);
  };

  // Handle Real Photo Upload (Instant)
  const handleRealPhotoUpload = (e: React.ChangeEvent<HTMLInputElement> | DragEvent | File) => {
    let file: File | undefined;
    let targetInput: HTMLInputElement | null = null;
    if (e instanceof File) {
      file = e;
    } else if ('dataTransfer' in e && e.dataTransfer?.files?.[0]) {
      file = e.dataTransfer.files[0];
    } else if ('target' in e && e.target && (e.target as HTMLInputElement).files?.[0]) {
      targetInput = e.target as HTMLInputElement;
      file = targetInput.files![0];
    }

    if (!file) return;

    if (targetInput) {
      targetInput.value = '';
    }

    setRealVideoDataUrl(null);
    setRealAudioDataUrl(null);

    const dataUrl = URL.createObjectURL(file);
    const meta: ImageMetadata = {
      name: file.name,
      size: file.size,
      width: 800,
      height: 800,
      mimeType: file.type || 'image/png',
    };

    const encoder = new TextEncoder();
    const token = generateTokenFromBytes(encoder.encode(file.name + file.size + Date.now()));

    setRealImageDataUrl(dataUrl);
    setRealImageMeta(meta);
    setImageAcousticToken(token);

    storeImageLocally(token, dataUrl, meta, file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleRealPhotoUpload(e.dataTransfer.files[0]);
    }
  };

  const playTestSound = async () => {
    if (isTestingSound || isSending || isListening) return;
    setIsTestingSound(true);

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.connect(ctx.destination);

      // Acoustic chord test pattern to make photo dance
      const notes = [440, 554, 659, 880, 1108, 880, 659, 440];
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0, now + idx * 0.15);
        gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.2);

        osc.connect(gain);
        gain.connect(analyser);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.22);
      });

      let active = true;
      const updateLoop = () => {
        if (!active) return;
        setAudioAnalysis(computeAudioAnalysis(analyser));
        requestAnimationFrame(updateLoop);
      };
      updateLoop();

      await new Promise((r) => setTimeout(r, notes.length * 150 + 250));
      active = false;
      ctx.close();
      setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setIsTestingSound(false);
    }
  };

  const startDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDictationNotice('Speech recognition is not supported in this browser.');
      setTimeout(() => setDictationNotice(''), 4000);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsDictating(true);
      recognition.onresult = (event: any) =>
        setMessage((prev) =>
          prev ? prev + ' ' + event.results[0][0].transcript : event.results[0][0].transcript
        );
      recognition.onerror = () => setIsDictating(false);
      recognition.onend = () => setIsDictating(false);
      recognition.start();
    } catch (err) {
      setIsDictating(false);
      setDictationNotice('Microphone access was denied for voice typing.');
      setTimeout(() => setDictationNotice(''), 4000);
    }
  };

  const getPayloadToBroadcast = (): Uint8Array => {
    if (sendMode === 'text') {
      return new TextEncoder().encode(message.trim());
    } else if (sendMode === 'video') {
      const token = videoAcousticToken || 'VID001';
      return new TextEncoder().encode(token);
    } else if (sendMode === 'audio') {
      const token = audioAcousticToken || 'AUD001';
      return new TextEncoder().encode(token);
    }
    // For real image, encode the 6-character acoustic token
    const token = imageAcousticToken || 'IMG001';
    return new TextEncoder().encode(token);
  };

  const isBroadcastDisabled = () =>
    isSending || (sendMode === 'text' ? !message.trim() : sendMode === 'video' ? !realVideoDataUrl : sendMode === 'audio' ? !realAudioDataUrl : !realImageDataUrl);

  const addToSentHistory = () => {
    let name = '';
    let previewUrl = '';
    if (sendMode === 'text') name = message.substring(0, 30) + (message.length > 30 ? '...' : '');
    if (sendMode === 'image') { name = realImageMeta?.name || 'Image'; previewUrl = realImageDataUrl || ''; }
    if (sendMode === 'video') { name = realVideoMeta?.name || 'Video'; previewUrl = realVideoDataUrl || ''; }
    if (sendMode === 'audio') { name = realAudioMeta?.name || 'Audio'; previewUrl = realAudioDataUrl || ''; }

    const currentToken =
      sendMode === 'image'
        ? imageAcousticToken
        : sendMode === 'video'
        ? videoAcousticToken
        : sendMode === 'audio'
        ? audioAcousticToken
        : textAcousticToken;

    const newItem: SentHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      type: sendMode,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      name,
      previewUrl,
      shareUrl: generatedShareUrl || '',
      token: currentToken || '',
    };
    
    setSentHistory(prev => [newItem, ...prev]);
  };

  const handleSend = async () => {
    if (isBroadcastDisabled()) return;

    setIsSending(true);
    setSendProgress(0);
    await new Promise((r) => setTimeout(r, 80));

    try {
      // Ensure share link is published so recipient can decode via link
      ensureAndPublishShareLink().catch(console.error);
      addToSentHistory();
      
      // Upload media to cloud in background for cross-device support
      if (sendMode !== 'text') {
        let payloadToken = '';
        let payloadDataUrl = '';
        let payloadMeta: any = {};
        
        if (sendMode === 'image') {
          payloadToken = imageAcousticToken;
          payloadDataUrl = realImageDataUrl || '';
          payloadMeta = realImageMeta || {};
        } else if (sendMode === 'video') {
          payloadToken = videoAcousticToken;
          payloadDataUrl = realVideoDataUrl || '';
          payloadMeta = realVideoMeta || {};
        } else if (sendMode === 'audio') {
          payloadToken = audioAcousticToken;
          payloadDataUrl = realAudioDataUrl || '';
          payloadMeta = realAudioMeta || {};
        }
        
        if (payloadToken && payloadDataUrl) {
          (async () => {
            let finalDataUrl = payloadDataUrl;
            if (finalDataUrl.startsWith('blob:')) {
              try {
                const res = await fetch(finalDataUrl);
                const blob = await res.blob();
                finalDataUrl = await uploadBlobMedia(blob, payloadMeta?.name || 'media.bin');
              } catch (e) { console.error('Upload failed', e); }
            }
            fetch('/api/upload-payload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: payloadToken,
                dataUrl: finalDataUrl,
                meta: payloadMeta,
                expiresIn: broadcastExpiryMs > 0 ? broadcastExpiryMs : undefined
              })
            }).catch(console.error);
          })();
        }
      }

      await broadcastData(
        sendMode,
        getPayloadToBroadcast(),
        (progress) => {
          setSendProgress(progress);
        },
        sendCanvasRef.current,
        (analysis) => {
          setAudioAnalysis(analysis);
        }
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
      setSendProgress(0);
      setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
    }
  };

  const handleDownload = async () => {
    if (isBroadcastDisabled()) return;

    setIsSending(true);
    try {
      addToSentHistory();
      let mediaPayload;
      if (sendMode === 'image' && realImageDataUrl && realImageMeta) {
        mediaPayload = retrieveImageLocally(imageAcousticToken) || { dataUrl: realImageDataUrl, meta: realImageMeta };
      } else if (sendMode === 'video' && realVideoDataUrl && realVideoMeta) {
        mediaPayload = retrieveVideoLocally(videoAcousticToken) || { dataUrl: realVideoDataUrl, meta: realVideoMeta };
      } else if (sendMode === 'audio' && realAudioDataUrl && realAudioMeta) {
        mediaPayload = retrieveAudioLocally(audioAcousticToken) || { dataUrl: realAudioDataUrl, meta: realAudioMeta };
      }

      // Ensure share link is published
      ensureAndPublishShareLink().catch(console.error);

      // Upload to cloud as backup for WhatsApp/sharing which strips WAV metadata
      if (sendMode !== 'text') {
        let payloadToken = '';
        let payloadDataUrl = '';
        let payloadMeta: any = {};
        
        if (sendMode === 'image') {
          payloadToken = imageAcousticToken;
          payloadDataUrl = realImageDataUrl || '';
          payloadMeta = realImageMeta || {};
        } else if (sendMode === 'video') {
          payloadToken = videoAcousticToken;
          payloadDataUrl = realVideoDataUrl || '';
          payloadMeta = realVideoMeta || {};
        } else if (sendMode === 'audio') {
          payloadToken = audioAcousticToken;
          payloadDataUrl = realAudioDataUrl || '';
          payloadMeta = realAudioMeta || {};
        }
        
        if (payloadToken && payloadDataUrl) {
          (async () => {
            let finalDataUrl = payloadDataUrl;
            if (finalDataUrl.startsWith('blob:')) {
              try {
                const res = await fetch(finalDataUrl);
                const blob = await res.blob();
                finalDataUrl = await uploadBlobMedia(blob, payloadMeta?.name || 'media.bin');
              } catch (e) { console.error('Upload failed', e); }
            }
            fetch('/api/upload-payload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: payloadToken,
                dataUrl: finalDataUrl,
                meta: payloadMeta,
                expiresIn: broadcastExpiryMs > 0 ? broadcastExpiryMs : undefined
              })
            }).catch(console.error);
          })();
        }
      }
      
      const blob = await generateWavBlob(sendMode, getPayloadToBroadcast(), mediaPayload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soundlink_${sendMode}_${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const handleDecodedPayload = (payload: DecodedPayload) => {
    setReceivedMessages((prev) => [payload, ...prev]);
  };

  const [showMicModal, setShowMicModal] = useState(false);
  const toggleListening = async () => {
    if (isListening) {
      if (stopListeningRef.current) {
        stopListeningRef.current();
        stopListeningRef.current = null;
      }
      setIsListening(false);
      setLiveHex('');
      setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
    } else {
      // Check if we need to show the modal first
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as any });
        if (result.state === 'prompt') {
          setShowMicModal(true);
          return;
        }
      } catch (e) {}
      startMic();
    }
  };

  const startMic = async () => {
    setShowMicModal(false);
    setIsListening(true);
    setLiveHex('Awaiting acoustic frequencies...');
    setReceiveError('');

    const stopFn = await startListening(
      handleDecodedPayload,
      (hex) => {
        setLiveHex((prev) => {
          if (hex === 'START_OF_MESSAGE') return 'Incoming Transmission: ';
          if (hex.includes('END_OF_MESSAGE') || hex.includes('ERROR_OR_UNAUTHORIZED')) {
            setTimeout(() => {
              if (isListening) setLiveHex('Awaiting acoustic frequencies...');
            }, 3000);
          }
          if (prev.startsWith('Incoming') || prev.startsWith('Awaiting')) {
            return prev.replace('Incoming Transmission: ', '') + ' ' + hex;
          }
          return prev + ' ' + hex;
        });
      },
      (err) => {
        setReceiveError(err);
        setIsListening(false);
        setLiveHex('');
      },
      receiveCanvasRef.current,
      (analysis) => setAudioAnalysis(analysis)
    );

    if (stopFn) {
      stopListeningRef.current = stopFn;
    } else {
      setIsListening(false);
      setLiveHex('');
    }
  };

  
  const handleDecodeRemoteFile = async (url: string) => {
    setActiveTab('receive');
    
    if (stopListeningRef.current) {
      stopListeningRef.current();
      stopListeningRef.current = null;
    }

    setIsListening(true);
    setLiveHex('Downloading audio file...');
    setReceiveError('');

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], "soundlink.wav", { type: blob.type });

      setLiveHex('Analyzing audio file...');
      
      const stopFn = await analyzeAudioFile(
        file,
        handleDecodedPayload,
        (hex) => {
          setLiveHex((prev) => {
            if (hex === 'START_OF_MESSAGE') return 'Incoming Transmission: ';
            if (hex.includes('END_OF_MESSAGE') || hex.includes('ERROR_OR_UNAUTHORIZED')) return hex;
            if (
              prev.includes('Awaiting') ||
              prev.includes('END_') ||
              prev.includes('ERROR') ||
              prev.includes('Analyzing')
            )
              return 'Incoming Transmission: ' + hex;
            return prev + ' ' + hex;
          });
        },
        (err) => {
          setReceiveError(err);
        },
        receiveCanvasRef.current,
        () => {
          setIsListening(false);
          stopListeningRef.current = null;
          setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
        },
        (analysis) => {
          setAudioAnalysis(analysis);
        }
      );

      if (stopFn) {
        stopListeningRef.current = stopFn;
      }
    } catch (e) {
      setReceiveError('Failed to download audio for translation.');
      setIsListening(false);
      setLiveHex('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (stopListeningRef.current) {
      stopListeningRef.current();
      stopListeningRef.current = null;
    }

    setIsListening(true);
    setLiveHex('Analyzing audio file...');
    setReceiveError('');

    const stopFn = await analyzeAudioFile(
      file,
      handleDecodedPayload,
      (hex) => {
        setLiveHex((prev) => {
          if (hex === 'START_OF_MESSAGE') return 'Incoming Transmission: ';
          if (hex.includes('END_OF_MESSAGE') || hex.includes('ERROR_OR_UNAUTHORIZED')) return hex;
          if (
            prev.includes('Awaiting') ||
            prev.includes('END_') ||
            prev.includes('ERROR') ||
            prev.includes('Analyzing')
          )
            return 'Incoming Transmission: ' + hex;
          return prev + ' ' + hex;
        });
      },
      (err) => {
        setReceiveError(err);
      },
      receiveCanvasRef.current,
      () => {
        setIsListening(false);
        stopListeningRef.current = null;
        setAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
      },
      (analysis) => {
        setAudioAnalysis(analysis);
      }
    );

    if (stopFn) {
      stopListeningRef.current = stopFn;
    } else {
      setIsListening(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen text-zinc-100 flex items-center justify-center p-3 sm:p-6 font-sans selection:bg-emerald-500/30">
      <div className="w-full max-w-3xl h-[95vh] sm:h-[90vh] glass-panel rounded-3xl overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-base sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">SoundLink</h1>
                  <span className="text-emerald-400 font-bold text-[9px] sm:text-[10px] px-2 py-0.5 bg-emerald-500/15 rounded-full border border-emerald-500/30 tracking-wide uppercase whitespace-nowrap">
                    Real Image & Audio
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 hidden sm:block whitespace-normal leading-tight">
                  Transmit real high-resolution photos & messages via acoustic sound waves
                </p>
              </div>
            </div>
            
            <div className="flex sm:hidden items-center gap-1.5 shrink-0">
              <PWAInstallButton />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 flex-wrap shrink-0 w-full sm:w-auto">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sound Motion Enabled</span>
            </div>
            
            {user ? (
              <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-full border ${isDeveloperUser(user?.email) || userProfile?.role === 'developer' || userProfile?.isDeveloper === true ? 'bg-amber-950/40 border-amber-500/50 shadow-sm shadow-amber-500/20' : 'bg-zinc-900 border-zinc-700'}`}>
                <div className="relative shrink-0">
                  <img 
                    src={userProfile?.photoURL || user.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username || user?.name || 'user'}`} 
                    alt="Profile" 
                    className={`w-6 h-6 rounded-full cursor-pointer hover:opacity-80 object-cover ${isDeveloperUser(user?.email) || userProfile?.role === 'developer' || userProfile?.isDeveloper === true ? 'ring-1 ring-amber-400' : ''}`} 
                    onClick={() => setShowProfileSetup(true)}
                    title="Edit Profile"
                  />
                  {(isDeveloperUser(user?.email) || userProfile?.role === 'developer' || userProfile?.isDeveloper === true) && (
                    <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center text-[7px] text-black font-extrabold">
                      ★
                    </span>
                  )}
                </div>
                <div 
                  className="flex items-center gap-1 sm:gap-1.5 cursor-pointer hover:text-white"
                  onClick={() => setShowProfileSetup(true)}
                  title="Edit Profile"
                >
                  <span className="text-xs text-zinc-300 font-medium max-w-[100px] sm:max-w-[150px] truncate">
                    {userProfile?.username ? '@'+userProfile.username : user.name}
                  </span>
                  {(isDeveloperUser(user?.email) || userProfile?.role === 'developer' || userProfile?.isDeveloper === true) && (
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-400 border border-amber-500/50 uppercase tracking-wider whitespace-nowrap">
                      Developer
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    handleLogout();
                  }}
                  className="text-xs text-zinc-400 hover:text-white px-1 sm:px-1.5 transition-colors whitespace-nowrap"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md h-[34px] flex items-center justify-center">
                <button onClick={() => setShowCustomLoginModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-500 transition-colors border border-emerald-500 text-xs whitespace-nowrap shadow-md">
                  <KeyRound className="w-3.5 h-3.5" />
                  Login / Register
                </button>
              </div>
            )}
            
            {/* Direct Developer Panel Button for instant full access across all devices */}
            {isDeveloperUser(user?.email) && (
              <button
                onClick={() => setShowDevPanel(true)}
                className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0"
                title="Open Developer Control Panel"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="whitespace-nowrap">Developer</span>
              </button>
            )}
            
            <button
              onClick={() => setShowStorageManager(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-medium flex items-center gap-1.5 transition-colors active:scale-95 shrink-0"
              title="Manage Cloud Storage & Uploads"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline whitespace-nowrap">Storage</span>
            </button>
            
            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1.5 mx-4 mt-4 sm:mx-6 sm:mt-6 mb-1 bg-zinc-950/60 rounded-2xl border border-zinc-800/50 shadow-inner">
          <button
            onClick={() => setActiveTab('send')}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 ${
              activeTab === 'send'
                ? 'bg-zinc-800 text-emerald-400 shadow-lg border border-zinc-700/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent'
            }`}
          >
            <Send className="w-4 h-4" /> Broadcast (Send)
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 ${
              activeTab === 'receive'
                ? 'bg-zinc-800 text-emerald-400 shadow-lg border border-zinc-700/50'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent'
            }`}
          >
            <RadioReceiver className="w-4 h-4" /> Listen
          </button>
          {user && (
            <button
              onClick={() => setActiveTab('social')}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 ${
                activeTab === 'social'
                  ? 'bg-zinc-800 text-emerald-400 shadow-lg border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" /> Chat
            </button>
          )}
        </div>

        
        {showProfileSetup && user && (
          <ProfileSetup 
            user={user} 
            existingProfile={userProfile} 
            onComplete={(updatedProfile) => { if (updatedProfile) setUserProfile({...userProfile, ...updatedProfile}); setShowProfileSetup(false); }} 
            onClose={() => {
              localStorage.setItem('profile_setup_dismissed_' + user.uid, 'true');
              setShowProfileSetup(false);
            }}
          />
        )}
        
        {/* Content Body */}
        <div className="p-3 sm:p-6 flex-1 overflow-hidden flex flex-col">
          
          {activeTab === 'social' && user && userProfile ? (
            <div className="flex-1 animate-in fade-in duration-200 flex flex-col h-full min-h-[400px]">
              <SocialTab user={user} userProfile={userProfile} onDecodeRequest={handleDecodeRemoteFile} />
            </div>
          ) : activeTab === 'send' ? (
            <div className="space-y-6 animate-in fade-in duration-200 pb-10 overflow-y-auto h-full pr-2">
              
              {/* Broadcast Mode Toggle */}
              <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-950/80 rounded-2xl border border-zinc-800 shadow-inner">
                <button
                  onClick={() => setSendMode('image')}
                  className={`flex-1 min-w-[120px] py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                    sendMode === 'image'
                      ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-emerald-400" /> Photo Payload
                </button>
                <button
                  onClick={() => setSendMode('video')}
                  className={`flex-1 min-w-[120px] py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                    sendMode === 'video'
                      ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <VideoIcon className="w-4 h-4 text-emerald-400" /> Video Payload
                </button>
                <button
                  onClick={() => setSendMode('audio')}
                  className={`flex-1 min-w-[120px] py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                    sendMode === 'audio'
                      ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Music className="w-4 h-4 text-emerald-400" /> Audio Payload
                </button>
                <button
                  onClick={() => setSendMode('text')}
                  className={`flex-1 min-w-[120px] py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                    sendMode === 'text'
                      ? 'bg-zinc-800 text-white shadow-md border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Keyboard className="w-4 h-4 text-emerald-400" /> Text Payload
                </button>
              </div>

              {/* Payload Renderers */}
              {sendMode === 'image' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <span>Original Photo</span>
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        100% Real Quality
                      </span>
                      <select
                        value={broadcastExpiryMs}
                        onChange={(e) => setBroadcastExpiryMs(Number(e.target.value))}
                        className="bg-zinc-800/80 text-zinc-300 text-[10px] rounded-lg px-2 py-1 border border-zinc-700 outline-none focus:border-emerald-500/50 ml-2"
                        title="Auto-delete timer"
                      >
                        <option value={0}>Keep</option>
                        <option value={60000}>1 Min</option>
                        <option value={3600000}>1 Hour</option>
                        <option value={86400000}>24 Hours</option>
                      </select>
                    </label>

                    {realImageDataUrl && (
                      <button
                        onClick={() => imageUploadRef.current?.click()}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Change Photo
                      </button>
                    )}
                  </div>

                  {realImageDataUrl ? (
                    <AudioReactiveImage
                      src={realImageDataUrl}
                      metadata={realImageMeta || undefined}
                      isPlayingSound={isSending}
                      audioAnalysis={audioAnalysis}
                      motionMode={motionMode}
                      onMotionModeChange={setMotionMode}
                      onClear={() => {
                        setRealImageDataUrl(null);
                        setRealImageMeta(null);
                        setImageAcousticToken('');
                      }}
                      onTestSound={playTestSound}
                      isTestingSound={isTestingSound}
                    />
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => imageUploadRef.current?.click()}
                      className="w-full h-56 bg-zinc-950/70 border-2 border-dashed border-zinc-700/80 hover:border-emerald-500/70 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-zinc-950 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:scale-105 transition-all shadow-lg">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-center px-4">
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                          Click to upload your real photo
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Drag and drop JPG, PNG, WebP or click here
                        </p>
                        <p className="text-[11px] text-emerald-400/90 font-medium mt-1">
                          Preserves full colors & clarity — with audio-reactive sound motion!
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={imageUploadRef}
                    onChange={handleRealPhotoUpload}
                    accept="image/*,.jpg,.jpeg,.png,.webp,.gif"
                    className="hidden"
                  />
                </div>
              ) : sendMode === 'video' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <span>Original Video</span>
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Fast Real Video (MP4/WebM)
                      </span>
                    </label>

                    {realVideoDataUrl && (
                      <button
                        onClick={() => videoUploadRef.current?.click()}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Change Video
                      </button>
                    )}
                  </div>

                  {realVideoDataUrl ? (
                    <div className="relative w-full rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-zinc-950 flex flex-col">
                      <video 
                        src={realVideoDataUrl} 
                        controls 
                        className={`w-full max-h-64 object-contain transition-all ${isSending ? 'opacity-80 scale-[0.98]' : ''}`}
                      />
                      <div className="absolute top-2 right-2 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setRealVideoDataUrl(null);
                            setRealVideoMeta(null);
                            setVideoAcousticToken('');
                          }}
                          className="bg-black/60 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </div>
                      {isSending && (
                        <div className="absolute inset-0 pointer-events-none ring-4 ring-emerald-400/50 rounded-2xl animate-pulse" />
                      )}
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleRealVideoUpload(e.dataTransfer.files[0]); }}
                      onClick={() => videoUploadRef.current?.click()}
                      className="w-full h-56 bg-zinc-950/70 border-2 border-dashed border-zinc-700/80 hover:border-emerald-500/70 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-zinc-950 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:scale-105 transition-all shadow-lg">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-center px-4">
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                          Click to upload a video
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Drag and drop MP4, WebM or click here
                        </p>
                        <p className="text-[11px] text-emerald-400/90 font-medium mt-1">
                          Acoustically transmits instantly over speakers!
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={videoUploadRef}
                    onChange={handleRealVideoUpload}
                    accept="video/*,.mp4,.webm,.mov,.m4v,.3gp,.avi"
                    className="hidden"
                  />
                </div>
              ) : sendMode === 'audio' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                      <span>Original Audio</span>
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Fast Real Audio (MP3/WAV)
                      </span>
                    </label>

                    {realAudioDataUrl && (
                      <button
                        onClick={() => audioUploadRef.current?.click()}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Change Audio
                      </button>
                    )}
                  </div>

                  {realAudioDataUrl ? (
                    <div className="relative w-full rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-zinc-950 flex flex-col p-6 items-center gap-4">
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center animate-pulse">
                        <Music className="w-8 h-8 text-emerald-400" />
                      </div>
                      <audio 
                        src={realAudioDataUrl} 
                        controls 
                        className={`w-full transition-all ${isSending ? 'opacity-80 scale-[0.98]' : ''}`}
                      />
                      <div className="absolute top-2 right-2 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setRealAudioDataUrl(null);
                            setRealAudioMeta(null);
                            setAudioAcousticToken('');
                          }}
                          className="bg-zinc-800/80 hover:bg-red-500/80 text-white p-2 rounded-full backdrop-blur-md transition-colors"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      </div>
                      {isSending && (
                        <div className="absolute inset-0 pointer-events-none ring-4 ring-emerald-400/50 rounded-2xl animate-pulse" />
                      )}
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleRealAudioUpload(e.dataTransfer.files[0]); }}
                      onClick={() => audioUploadRef.current?.click()}
                      className="w-full h-56 bg-zinc-950/70 border-2 border-dashed border-zinc-700/80 hover:border-emerald-500/70 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-zinc-950 group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:scale-105 transition-all shadow-lg">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-center px-4">
                        <p className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                          Click to upload audio
                        </p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Drag and drop MP3, WAV or click here
                        </p>
                        <p className="text-[11px] text-emerald-400/90 font-medium mt-1">
                          Acoustically transmits instantly over speakers!
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={audioUploadRef}
                    onChange={handleRealAudioUpload}
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                    className="hidden"
                  />
                </div>
              ) : (
                /* Text Mode */
                <div className="space-y-2 relative">
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-sm font-medium text-zinc-300">Message to Broadcast</label>
                    <div className="flex items-center gap-2">
                      <select
                      value={broadcastExpiryMs}
                      onChange={(e) => setBroadcastExpiryMs(Number(e.target.value))}
                      className="bg-zinc-800/80 text-zinc-300 text-[10px] rounded-lg px-2 py-1 border border-zinc-700 outline-none focus:border-emerald-500/50"
                      title="Auto-delete timer"
                    >
                      <option value={0}>Keep</option>
                      <option value={60000}>1 Min</option>
                      <option value={3600000}>1 Hour</option>
                      <option value={86400000}>24 Hours</option>
                    </select>
                      <button
                      onClick={startDictation}
                      disabled={isDictating || isSending}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                        isDictating
                          ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/60'
                      }`}
                    >
                      <MicIcon className="w-3.5 h-3.5" />
                      {isDictating ? 'Listening to voice...' : 'Voice Translate'}
                    </button>
                  </div>
                  </div>

                  {dictationNotice && (
                    <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{dictationNotice}</span>
                    </div>
                  )}

                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSending}
                    placeholder="Type an acoustic text payload or tap Voice Translate..."
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 transition-all placeholder:text-zinc-600"
                  />
                </div>
              )}

              {/* Spectrum Display */}
              <div className="h-24 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
                <canvas
                  ref={sendCanvasRef}
                  width={640}
                  height={96}
                  className="w-full h-full opacity-90"
                />
                {!isSending && (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs uppercase tracking-widest font-semibold pointer-events-none">
                    Acoustic Transmission Waveform
                  </div>
                )}
                {isSending && (
                  <div
                    className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                    style={{ width: `${sendProgress}%` }}
                  />
                )}
              </div>

              {/* Send Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={handleSend}
                  disabled={isBroadcastDisabled()}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-[0.98]"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Broadcasting Sound Wave...
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-5 h-5" />
                      Play Sound (Acoustic Broadcast)
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isBroadcastDisabled()}
                  className="flex-1 py-4 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 font-semibold rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-all duration-300 border border-zinc-700 shadow-lg active:scale-[0.98]"
                >
                  <Download className="w-5 h-5 text-emerald-400" />
                  Download Audio (WAV)
                </button>
              </div>

              {/* Share Link Generation Card */}
              {((sendMode === 'image' && realImageDataUrl) ||
                (sendMode === 'video' && realVideoDataUrl) ||
                (sendMode === 'audio' && realAudioDataUrl) ||
                (sendMode === 'text' && message.trim())) && (
                <div className="mt-2">
                  {generatedShareUrl &&
                  lastSharedToken ===
                    (sendMode === 'image'
                      ? imageAcousticToken
                      : sendMode === 'video'
                      ? videoAcousticToken
                      : sendMode === 'audio'
                      ? audioAcousticToken
                      : textAcousticToken) ? (
                    <ShareLinkCard
                      type={sendMode}
                      token={lastSharedToken}
                      shareUrl={generatedShareUrl}
                      itemName={
                        sendMode === 'image'
                          ? realImageMeta?.name
                          : sendMode === 'video'
                          ? realVideoMeta?.name
                          : sendMode === 'audio'
                          ? realAudioMeta?.name
                          : message.slice(0, 30)
                      }
                      onPlaySound={handleSend}
                      isPlayingSound={isSending}
                    />
                  ) : (
                    <button
                      onClick={() => ensureAndPublishShareLink(true)}
                      disabled={isPublishingShare || isBroadcastDisabled()}
                      className="w-full py-3.5 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                    >
                      {isPublishingShare ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Generating Acoustic Sound & Share Link...</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-4 h-4 text-emerald-400" />
                          <span>Generate Sound Wave & Share Link</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Helpful Hint */}
              <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/80 flex items-start gap-2.5 text-xs text-zinc-400">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong>How it works:</strong> "Play Sound" broadcasts short acoustic frequencies through your speakers, while the <strong>SoundLink Share Link</strong> lets anyone click to automatically paste the sound and decode your {sendMode === 'image' ? 'photo' : sendMode === 'video' ? 'video' : sendMode === 'audio' ? 'song' : 'message'}!
                </p>
              </div>

              {/* Transmission History */}
              {sentHistory.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-800/60 mt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Transmission History
                    </span>
                    <span className="text-xs text-zinc-500 bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800">
                      {sentHistory.length} Sent
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {sentHistory.map((item) => (
                      <div key={item.id} className="p-3 rounded-2xl glass-panel text-sm flex flex-col gap-2.5 shadow-md animate-fade-in-up">
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.type === 'text' ? 'Text Payload' : item.type === 'audio' ? 'Audio Payload' : item.type === 'video' ? 'Video Payload' : 'Image Payload'}
                          </span>
                          <div className="flex items-center gap-2">
                            {item.shareUrl && (
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(item.shareUrl!);
                                    setLiveHex(`COPIED: Share link for #${item.token || 'item'} copied!`);
                                  } catch (e) {}
                                }}
                                className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 flex items-center gap-1 transition-all"
                                title="Copy direct share link"
                              >
                                <Share2 className="w-3 h-3" />
                                <span>Copy Link</span>
                              </button>
                            )}
                            <span className="text-zinc-500 text-[11px]">{item.time}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.previewUrl && item.type === 'image' && (
                            <img src={item.previewUrl} alt="preview" className="w-10 h-10 object-cover rounded-lg border border-zinc-700 shadow-sm shrink-0" />
                          )}
                          {item.previewUrl && item.type === 'video' && (
                            <video src={item.previewUrl} className="w-10 h-10 object-cover rounded-lg border border-zinc-700 shadow-sm shrink-0" />
                          )}
                          {item.previewUrl && item.type === 'audio' && (
                            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
                              <Volume2 className="w-5 h-5 text-emerald-400" />
                            </div>
                          )}
                          {!item.previewUrl && item.type === 'text' && (
                            <div className="w-10 h-10 bg-zinc-800/80 border border-zinc-700 rounded-lg flex items-center justify-center shrink-0">
                              <span className="text-zinc-400 font-serif text-lg">T</span>
                            </div>
                          )}
                          <div className="text-zinc-200 text-sm font-medium truncate flex-1 leading-tight">
                            {item.name || 'Unknown Payload'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* Receive Tab */
            <div className="space-y-6 animate-in fade-in duration-200 overflow-y-auto h-full pb-10 pr-2">
              
              {/* Received from Share Link Celebration Banner */}
              {linkReceivedPayload && (
                <ReceivedFromLinkBanner
                  payload={linkReceivedPayload}
                  onPlaySound={handlePlayLinkAcousticSound}
                  isPlayingSound={isPlayingLinkSound}
                  soundProgress={linkSoundProgress}
                  onDismiss={() => setLinkReceivedPayload(null)}
                  onScrollToItem={() => {
                    const el = document.getElementById('decoded-feed');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              )}

              {/* Manual SoundLink URL or Token Paste Bar */}
              <ManualPasteBar
                onPasteAndDecode={handleManualPasteAndDecode}
                isLoading={isManualDecoding}
              />

              {/* Receiver Spectrum Display */}
              <div className="h-32 bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
                <canvas
                  ref={receiveCanvasRef}
                  width={640}
                  height={128}
                  className="w-full h-full opacity-90"
                />
                {!isListening && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 font-semibold pointer-events-none">
                    <span className="text-xs uppercase tracking-widest mb-1.5">Microphone Inactive</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/25">
                      Ready to decode sound waves
                    </span>
                  </div>
                )}
              </div>

              {receiveError && (
                <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start gap-3 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{receiveError}</p>
                </div>
              )}

              {/* Listening Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={toggleListening}
                  disabled={isListening && !liveHex.includes('Awaiting')}
                  className={`flex-1 py-4 font-bold rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-300 shadow-lg active:scale-[0.98] ${
                    isListening && liveHex.includes('Awaiting')
                      ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] disabled:opacity-40'
                  }`}
                >
                  {isListening && liveHex.includes('Awaiting') ? (
                    <>
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
                      Stop Mic Listening
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      Listen via Microphone
                    </>
                  )}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isListening}
                  className="flex-1 py-4 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-100 font-semibold rounded-2xl flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:hover:bg-zinc-800 transition-all duration-300 border border-zinc-700 shadow-lg active:scale-[0.98]"
                >
                  <Upload className="w-5 h-5 text-emerald-400" />
                  Upload Audio File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="audio/*"
                  className="hidden"
                />
              </div>

              {/* Live Signal Status */}
              <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800/80 p-4 min-h-[110px] flex flex-col shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex justify-between z-10">
                  <span>Live Signal Stream</span>
                  {isListening && (
                    <span className="text-emerald-400 flex items-center gap-1.5 font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ACTIVE
                    </span>
                  )}
                </div>
                <div className="font-mono text-emerald-400 text-sm break-all flex-1 z-10 text-shadow-glow">
                  {liveHex || <span className="text-zinc-600">Waiting for acoustic signals from speakers or audio files...</span>}
                </div>
              </div>

              {/* Decoded Messages / Images Feed */}
              {receivedMessages.length > 0 ? (
                <div id="decoded-feed" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Decoded Payloads ({receivedMessages.length})
                    </span>
                    <button
                      onClick={() => setReceivedMessages([])}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="space-y-3">
                    {receivedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-2xl glass-panel text-sm flex flex-col gap-3 shadow-md animate-fade-in-up ${
                          msg.source === 'link' ? 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : ''
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {msg.type === 'text' ? 'Acoustic Text' : msg.type === 'audio' ? 'Fast Real Audio' : msg.type === 'video' ? 'Fast Real Video' : 'Real Original Photo'}
                            </span>
                            {msg.token && (
                              <span className="bg-emerald-500/10 text-emerald-300 font-mono text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                                #{msg.token}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const tokenOrText = msg.type === 'text' ? (msg.text || 'text') : (msg.token || 'SL-LINK');
                                try {
                                  await playAcousticSoundForPayload(msg.type, tokenOrText, undefined, receiveCanvasRef.current);
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="text-[11px] px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 rounded-lg font-medium flex items-center gap-1.5 transition-all active:scale-95"
                              title="Play the acoustic sound wave that encodes this file"
                            >
                              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Play Sound Wave</span>
                            </button>

                            <span className="bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800 text-[11px] flex items-center gap-1">
                              {msg.source === 'link' ? (
                                <>
                                  <Share2 className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-300 font-medium">Direct Link</span>
                                </>
                              ) : msg.source === 'mic' ? 'Microphone' : 'Audio File'}
                            </span>
                            <span className="text-zinc-500 text-[11px]">{msg.time}</span>
                          </div>
                        </div>

                        {msg.type === 'text' ? (
                          <div className="flex flex-col gap-2">
                            <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800/80 text-zinc-100 font-sans">
                              {msg.text}
                            </div>
                            
                            <div className="flex flex-col mt-2 gap-2">
                              {aiInsights[msg.id]?.loading ? (
                                <div className="text-xs text-zinc-400 flex items-center gap-2 animate-pulse p-3 bg-zinc-900/40 rounded-xl border border-zinc-800">
                                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                                  AI is analyzing this text...
                                </div>
                              ) : aiInsights[msg.id]?.result ? (
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5" /> AI Insight
                                  </div>
                                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{aiInsights[msg.id].result}</div>
                                </div>
                              ) : aiInsights[msg.id]?.error ? (
                                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-xs text-red-400">
                                  Error: {aiInsights[msg.id].error}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGetInsight(msg.id, msg.text)}
                                  className="self-start text-xs flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Ask AI Insights
                                </button>
                              )}
                            </div>
                          </div>
                        ) : msg.audioDataUrl ? (
                          <div className="flex flex-col items-center gap-3 bg-zinc-900/60 rounded-xl p-3 border border-zinc-800">
                            <div className="relative w-full rounded-lg overflow-hidden border border-zinc-700 shadow-lg p-6 bg-zinc-950 flex flex-col items-center gap-4">
                              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                                <Music className="w-8 h-8 text-emerald-400" />
                              </div>
                              <audio
                                src={msg.audioDataUrl}
                                controls
                                className="w-full"
                              />
                            </div>
                            <div className="flex items-center justify-between w-full text-xs text-zinc-400 px-1">
                              <span>
                                {msg.audioMeta?.mimeType} • {(msg.audioMeta?.size || 0) > 1024 * 1024 ? `${((msg.audioMeta?.size || 0) / (1024 * 1024)).toFixed(1)} MB` : `${Math.round((msg.audioMeta?.size || 0) / 1024)} KB`}
                              </span>
                              <button
                                onClick={() => downloadFileToDevice(msg.audioDataUrl, msg.audioMeta?.name || 'soundlink_audio.mp3')}
                                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> Download Audio
                              </button>
                            </div>
                            <div className="flex flex-col gap-2 w-full mt-2">
                              {aiInsights[msg.id]?.loading ? (
                                <div className="text-xs text-zinc-400 flex items-center justify-center gap-2 animate-pulse p-3 bg-zinc-900/40 rounded-xl border border-zinc-800">
                                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                                  AI is analyzing this audio...
                                </div>
                              ) : aiInsights[msg.id]?.result ? (
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5" /> AI Insight
                                  </div>
                                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{aiInsights[msg.id].result}</div>
                                </div>
                              ) : aiInsights[msg.id]?.error ? (
                                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-xs text-red-400">
                                  Error: {aiInsights[msg.id].error}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGetInsight(msg.id, undefined, msg.audioDataUrl, msg.audioMeta?.mimeType)}
                                  className="w-full justify-center text-xs flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Analyze Audio with AI
                                </button>
                              )}
                            </div>
                          </div>
                        ) : msg.videoDataUrl ? (
                          <div className="flex flex-col items-center gap-3 bg-zinc-900/60 rounded-xl p-3 border border-zinc-800">
                            <div className="relative w-full rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
                              <video
                                src={msg.videoDataUrl}
                                controls
                                className="w-full max-h-64 object-contain bg-black"
                              />
                            </div>
                            <div className="flex items-center justify-between w-full text-xs text-zinc-400 px-1">
                              <span>
                                {msg.videoMeta?.mimeType} • {(msg.videoMeta?.size || 0) > 1024 * 1024 ? `${((msg.videoMeta?.size || 0) / (1024 * 1024)).toFixed(1)} MB` : `${Math.round((msg.videoMeta?.size || 0) / 1024)} KB`}
                              </span>
                              <button
                                onClick={() => downloadFileToDevice(msg.videoDataUrl, msg.videoMeta?.name || 'soundlink_video.mp4')}
                                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> Download Video
                              </button>
                            </div>
                            <div className="flex flex-col gap-2 w-full mt-2">
                              {aiInsights[msg.id]?.loading ? (
                                <div className="text-xs text-zinc-400 flex items-center justify-center gap-2 animate-pulse p-3 bg-zinc-900/40 rounded-xl border border-zinc-800">
                                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                                  AI is analyzing this video...
                                </div>
                              ) : aiInsights[msg.id]?.result ? (
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5" /> AI Insight
                                  </div>
                                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{aiInsights[msg.id].result}</div>
                                </div>
                              ) : aiInsights[msg.id]?.error ? (
                                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-xs text-red-400">
                                  Error: {aiInsights[msg.id].error}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGetInsight(msg.id, undefined, msg.videoDataUrl, msg.videoMeta?.mimeType)}
                                  className="w-full justify-center text-xs flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Analyze Video with AI
                                </button>
                              )}
                            </div>
                          </div>
                        ) : msg.imageDataUrl ? (
                          <div className="flex flex-col items-center gap-3 bg-zinc-900/60 rounded-xl p-3 border border-zinc-800">
                            <div className="relative max-h-64 rounded-lg overflow-hidden border border-zinc-700 shadow-lg">
                              <img
                                src={msg.imageDataUrl}
                                alt="Decoded Real Photo"
                                className="max-h-64 object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between w-full text-xs text-zinc-400 px-1">
                              <span>
                                {msg.imageMeta?.width} × {msg.imageMeta?.height}px
                              </span>
                              <button
                                onClick={() => downloadFileToDevice(msg.imageDataUrl, msg.imageMeta?.name || 'soundlink_photo.png')}
                                className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" /> Download Photo
                              </button>
                            </div>
                            <div className="flex flex-col gap-2 w-full mt-2">
                              {aiInsights[msg.id]?.loading ? (
                                <div className="text-xs text-zinc-400 flex items-center justify-center gap-2 animate-pulse p-3 bg-zinc-900/40 rounded-xl border border-zinc-800">
                                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                                  AI is analyzing this image...
                                </div>
                              ) : aiInsights[msg.id]?.result ? (
                                <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5" /> AI Insight
                                  </div>
                                  <div className="text-sm text-zinc-300 whitespace-pre-wrap">{aiInsights[msg.id].result}</div>
                                </div>
                              ) : aiInsights[msg.id]?.error ? (
                                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-xs text-red-400">
                                  Error: {aiInsights[msg.id].error}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleGetInsight(msg.id, undefined, msg.imageDataUrl, msg.imageMeta?.mimeType)}
                                  className="w-full justify-center text-xs flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Analyze Photo with AI
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 p-4 bg-red-500/10 rounded-xl border border-red-500/20 text-red-100/90 text-xs text-center">
                            <div className="flex items-center justify-center gap-1.5 font-semibold text-red-400">
                               <Info className="w-4 h-4" /> Cloud Fetch Failed
                            </div>
                            <p>
                              Received token: <strong className="font-mono bg-red-500/20 px-1 py-0.5 rounded text-red-300">{msg.text?.match(/\[(.*?)\]/)?.[1] || 'UNKNOWN'}</strong>
                            </p>
                            <p className="text-[11px] opacity-80 mt-1">
                              The token was received successfully via microphone, but the associated {msg.type} could not be downloaded from the cloud. The sender may need to re-broadcast it, or you can try sharing via the <strong>Download Audio (WAV)</strong> button.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-12 px-6 rounded-2xl border border-zinc-800/60 bg-zinc-950/40 border-dashed flex flex-col items-center justify-center text-center animate-fade-in-up">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center mb-4 shadow-inner">
                    <RadioReceiver className="w-7 h-7 text-zinc-500" />
                  </div>
                  <h3 className="text-zinc-200 font-semibold mb-1">No Payloads Received</h3>
                  <p className="text-zinc-500 text-sm max-w-sm">
                    Activate the microphone above and play a SoundLink audio file on another device to receive photos, videos, or messages.
                  </p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    
      {/* Storage Manager Modal */}
      {showStorageManager && (
        <StorageManagerModal onClose={() => setShowStorageManager(false)} />
      )}

      {/* Developer Master Panel Modal */}
      {showDevPanel && isDeveloperUser(user?.email) && (
        <DeveloperPanel 
          onClose={() => setShowDevPanel(false)} 
          currentUser={user}
        />
      )}

      {/* Global Active or Incoming Call Modal */}
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

      {/* Mic Permission Modal */}
      {showMicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Mic className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Microphone Access Needed</h3>
              <p className="text-zinc-400 text-sm mb-6">
                SoundLink requires microphone access to listen for and decode acoustic frequencies. 
                Please click "Allow" on the browser prompt to continue.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowMicModal(false)}
                  className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={startMic}
                  className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCustomLoginModal && (
        <CustomLoginModal
          isOpen={showCustomLoginModal}
          onClose={() => setShowCustomLoginModal(false)}
          onLoginSuccess={handleCustomLoginSuccess}
        />
      )}
    </div>
  );
}
