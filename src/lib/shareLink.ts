import { PayloadType, DecodedPayload, ImageMetadata, VideoMetadata, AudioMetadata } from '../types';
import { 
  broadcastData, 
  generateTokenFromBytes, 
  storeImageLocally, 
  storeVideoLocally, 
  storeAudioLocally,
  retrieveImageLocally,
  retrieveVideoLocally,
  retrieveAudioLocally
} from './audioProtocol';

export interface PublishShareParams {
  type: PayloadType;
  token: string;
  dataUrl?: string;
  meta?: any;
  text?: string;
  expiresIn?: number;
  senderName?: string;
}

/**
 * Uploads a blob or file to the server using robust chunking to support long/large videos (100MB+) without timeouts or limits
 */
export async function uploadBlobMedia(blob: Blob, filename: string): Promise<string> {
  const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type });
  const chunkSize = 512 * 1024; // 512KB chunks
  const totalChunks = Math.ceil(file.size / chunkSize);
  const uploadId = Date.now().toString() + Math.random().toString(36).substring(7);
  
  let finalUrl = '';
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('chunk', chunk, 'chunk');
    formData.append('originalName', file.name);
    formData.append('chunkIndex', i.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('uploadId', uploadId);
    
    const res = await fetch('/api/upload-chunk', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed with status ' + res.status);
    const data = await res.json();
    if (data.url) finalUrl = data.url;
  }
  
  return finalUrl;
}

/**
 * Publishes a payload (text, photo, video, audio) to the server and local storage,
 * and generates the universal share link.
 */
export async function publishSharePayload(params: PublishShareParams): Promise<{ shareUrl: string; token: string }> {
  const { type, token, meta, text, expiresIn, senderName } = params;
  let finalDataUrl = params.dataUrl || '';

  // If dataUrl is a local blob URL, upload it to the server so other users can load it via link
  if (finalDataUrl.startsWith('blob:')) {
    try {
      const localVid = type === 'video' ? retrieveVideoLocally(token) : null;
      const filename = meta?.name || `soundlink_${type}_${token}.${type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'png'}`;
      if (localVid?.file) {
        finalDataUrl = await uploadBlobMedia(localVid.file, filename);
      } else {
        const blobRes = await fetch(finalDataUrl);
        const blob = await blobRes.blob();
        finalDataUrl = await uploadBlobMedia(blob, filename);
      }
    } catch (e) {
      console.warn('Could not upload blob to server storage, using original URL fallback:', e);
    }
  }

  // Register in local cache for immediate local multi-tab sync
  if (type === 'image' && finalDataUrl && meta) {
    storeImageLocally(token, finalDataUrl, meta);
  } else if (type === 'video' && finalDataUrl && meta) {
    storeVideoLocally(token, finalDataUrl, meta);
  } else if (type === 'audio' && finalDataUrl && meta) {
    storeAudioLocally(token, finalDataUrl, meta);
  }

  // Persist to server payload store
  try {
    const res = await fetch('/api/upload-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        type,
        dataUrl: finalDataUrl,
        meta,
        text,
        senderName,
        expiresIn: expiresIn && expiresIn > 0 ? expiresIn : undefined,
      }),
    });
    if (!res.ok) {
      console.error('Failed to upload payload to server API');
    }
  } catch (err) {
    console.warn('Network upload payload warning:', err);
  }

  // Build the Share URL pointing to the Listen tab
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(origin + '/');
  url.searchParams.set('listenToken', token);
  url.searchParams.set('type', type);
  if (text) {
    // For text, append encoded preview as an instant client fallback
    url.searchParams.set('t', text.slice(0, 150));
  }

  return {
    shareUrl: url.toString(),
    token,
  };
}

/**
 * Fetches a shared payload by token from server or local storage
 */
export async function fetchSharedPayload(token: string, typeHint?: PayloadType, textHint?: string): Promise<DecodedPayload | null> {
  // Check local cache first
  const localImage = retrieveImageLocally(token);
  if (localImage) {
    return {
      id: Date.now().toString(),
      type: 'image',
      imageDataUrl: localImage.dataUrl,
      imageMeta: localImage.meta,
      time: new Date().toLocaleTimeString(),
      source: 'link',
      token,
    };
  }

  const localVideo = retrieveVideoLocally(token);
  if (localVideo) {
    return {
      id: Date.now().toString(),
      type: 'video',
      videoDataUrl: localVideo.dataUrl,
      videoMeta: localVideo.meta,
      time: new Date().toLocaleTimeString(),
      source: 'link',
      token,
    };
  }

  const localAudio = retrieveAudioLocally(token);
  if (localAudio) {
    return {
      id: Date.now().toString(),
      type: 'audio',
      audioDataUrl: localAudio.dataUrl,
      audioMeta: localAudio.meta,
      time: new Date().toLocaleTimeString(),
      source: 'link',
      token,
    };
  }

  // Fetch from server API
  try {
    const res = await fetch(`/api/payload/${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const payloadType: PayloadType = data.type || typeHint || 'text';
        
        // Cache locally for faster subsequent access
        if (payloadType === 'image' && data.dataUrl) {
          storeImageLocally(token, data.dataUrl, data.meta || { name: 'shared_photo.png', size: 0, width: 400, height: 400, mimeType: 'image/png' });
        } else if (payloadType === 'video' && data.dataUrl) {
          storeVideoLocally(token, data.dataUrl, data.meta || { name: 'shared_video.mp4', size: 0, mimeType: 'video/mp4' });
        } else if (payloadType === 'audio' && data.dataUrl) {
          storeAudioLocally(token, data.dataUrl, data.meta || { name: 'shared_song.mp3', size: 0, mimeType: 'audio/mp3' });
        }

        return {
          id: Date.now().toString(),
          type: payloadType,
          text: data.text,
          imageDataUrl: payloadType === 'image' ? data.dataUrl : undefined,
          imageMeta: payloadType === 'image' ? data.meta : undefined,
          videoDataUrl: payloadType === 'video' ? data.dataUrl : undefined,
          videoMeta: payloadType === 'video' ? data.meta : undefined,
          audioDataUrl: payloadType === 'audio' ? data.dataUrl : undefined,
          audioMeta: payloadType === 'audio' ? data.meta : undefined,
          time: new Date().toLocaleTimeString(),
          source: 'link',
          token,
          senderName: data.senderName,
          createdAt: data.createdAt,
        };
      }
    }
  } catch (err) {
    console.error('Failed to fetch payload from server API:', err);
  }

  // If textHint was provided in the URL, fallback to it
  if (textHint) {
    return {
      id: Date.now().toString(),
      type: 'text',
      text: textHint,
      time: new Date().toLocaleTimeString(),
      source: 'link',
      token,
    };
  }

  return null;
}

/**
 * Plays the acoustic sound wave sequence for a given payload (so the user hears the sound that matches the file)
 */
export async function playAcousticSoundForPayload(
  type: PayloadType,
  tokenOrText: string,
  onProgress?: (percent: number) => void,
  canvas?: HTMLCanvasElement | null,
  onAudioAnalysis?: (analysis: any) => void
): Promise<void> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(tokenOrText);
  await broadcastData(
    type,
    payloadBytes,
    onProgress || (() => {}),
    canvas || null,
    onAudioAnalysis
  );
}

/**
 * Helper to generate a new 6-character token
 */
export function createAcousticToken(prefix: string = 'SL'): string {
  const randomBytes = new Uint8Array(8);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 8; i++) randomBytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = generateTokenFromBytes(randomBytes);
  return `${prefix}-${hex}`;
}
