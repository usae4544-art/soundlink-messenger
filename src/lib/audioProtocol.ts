import { DecodedPayload, ImageMetadata, VideoMetadata, AudioMetadata, AudioAnalysis } from '../types';

export const FREQS = Array.from({ length: 16 }, (_, i) => 1000 + i * 100); // 1000Hz to 2500Hz
export const START_FREQ = 2700;
export const STOP_FREQ = 2900;
export const PAUSE_FREQ = 3100;
export const TONE_DUR = 0.05; // 50ms per tone
export const PAUSE_DUR = 0.025; // 25ms pause
export const THRESHOLD_DB = -65;
export const FREQ_TOLERANCE = 45;

export const MAGIC_HEADER = [0x5, 0xA, 0x3, 0xC];
const SECRET = [0xF, 0x7, 0xA, 0x2];

const BROADCAST_CHANNEL_NAME = 'soundlink_acoustic_bus';
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  // Ignore fallback
}

// Local cache for image payloads indexed by token
const memoryImageStore = new Map<string, { dataUrl: string; meta: ImageMetadata; file?: File }>();
// Local cache for video payloads indexed by token
const memoryVideoStore = new Map<string, { dataUrl: string; meta: VideoMetadata; file?: File }>();
// Local cache for audio payloads indexed by token
const memoryAudioStore = new Map<string, { dataUrl: string; meta: AudioMetadata; file?: File }>();

export function storeImageLocally(token: string, dataUrl: string, meta: ImageMetadata, file?: File) {
  memoryImageStore.set(token, { dataUrl, meta, file });
  try {
    localStorage.setItem(`sl_img_${token}`, JSON.stringify({ dataUrl, meta, ts: Date.now() }));
  } catch {
    // If localStorage quota exceeded, memory store remains
  }
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'REGISTER_IMAGE', token, dataUrl, meta });
  }
}

export function storeVideoLocally(token: string, dataUrl: string, meta: VideoMetadata, file?: File) {
  memoryVideoStore.set(token, { dataUrl, meta, file });
  // Do NOT store video data in localStorage as it will easily exceed the 5MB quota and crash the tab/app.
  // Instead rely purely on memoryVideoStore and BroadcastChannel for same-session multi-tab memory.
  if (broadcastChannel) {
    // Don't broadcast the file object, just the dataUrl
    broadcastChannel.postMessage({ type: 'REGISTER_VIDEO', token, dataUrl, meta });
  }
}

export function storeAudioLocally(token: string, dataUrl: string, meta: AudioMetadata, file?: File) {
  memoryAudioStore.set(token, { dataUrl, meta, file });
  // Similar to video, audio files can easily exceed 5MB quota. Keep in memory and broadcast channel only.
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'REGISTER_AUDIO', token, dataUrl, meta });
  }
}

export function retrieveImageLocally(token: string): { dataUrl: string; meta: ImageMetadata; file?: File } | null {
  if (memoryImageStore.has(token)) {
    return memoryImageStore.get(token)!;
  }
  try {
    const raw = localStorage.getItem(`sl_img_${token}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryImageStore.set(token, { dataUrl: parsed.dataUrl, meta: parsed.meta });
      return { dataUrl: parsed.dataUrl, meta: parsed.meta };
    }
  } catch {
    // ignore
  }
  return null;
}

export function retrieveVideoLocally(token: string): { dataUrl: string; meta: VideoMetadata; file?: File } | null {
  if (memoryVideoStore.has(token)) {
    return memoryVideoStore.get(token)!;
  }
  return null;
}

export function retrieveAudioLocally(token: string): { dataUrl: string; meta: AudioMetadata; file?: File } | null {
  if (memoryAudioStore.has(token)) {
    return memoryAudioStore.get(token)!;
  }
  try {
    const raw = localStorage.getItem(`sl_aud_${token}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryAudioStore.set(token, { dataUrl: parsed.dataUrl, meta: parsed.meta });
      return { dataUrl: parsed.dataUrl, meta: parsed.meta };
    }
  } catch {
    // ignore
  }
  return null;
}

if (broadcastChannel) {
  broadcastChannel.onmessage = (ev) => {
    if (ev.data?.type === 'REGISTER_IMAGE') {
      memoryImageStore.set(ev.data.token, { dataUrl: ev.data.dataUrl, meta: ev.data.meta });
    }
    if (ev.data?.type === 'REGISTER_VIDEO') {
      memoryVideoStore.set(ev.data.token, { dataUrl: ev.data.dataUrl, meta: ev.data.meta });
    }
    if (ev.data?.type === 'REGISTER_AUDIO') {
      memoryAudioStore.set(ev.data.token, { dataUrl: ev.data.dataUrl, meta: ev.data.meta });
    }
  };
}

export function generateTokenFromBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = (hash * 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(6, '0').slice(-6).toUpperCase();
}

export function buildSequence(
  type: 'text' | 'image' | 'video' | 'audio',
  payload: Uint8Array
): Array<'START' | 'STOP' | number> {
  const nibbles: number[] = [];
  for (const b of payload) {
    nibbles.push(b >> 4);
    nibbles.push(b & 0x0f);
  }

  // Encrypt payload (XOR) to prevent noise hijacking
  const encrypted = nibbles.map((n, i) => n ^ SECRET[i % SECRET.length]);
  const typeNibble = type === 'text' ? 0 : type === 'image' ? 1 : type === 'video' ? 2 : 3;

  // Checksum
  let checksum = typeNibble;
  for (const n of encrypted) checksum += n;
  const cs1 = (checksum >> 4) & 0x0f;
  const cs2 = checksum & 0x0f;

  return ['START', ...MAGIC_HEADER, typeNibble, ...encrypted, cs1, cs2, 'STOP'];
}

export function decodeSequence(buffer: number[]): { type: 'text' | 'image' | 'video' | 'audio'; data: Uint8Array } | null {
  if (buffer.length < 7) return null; // Magic(4) + Type(1) + CS(2)

  // Verify Magic Header
  for (let i = 0; i < 4; i++) {
    if (buffer[i] !== MAGIC_HEADER[i]) return null;
  }

  const typeNibble = buffer[4];
  const encrypted = buffer.slice(5, buffer.length - 2);
  const cs1 = buffer[buffer.length - 2];
  const cs2 = buffer[buffer.length - 1];

  let checksum = typeNibble;
  for (const n of encrypted) checksum += n;
  if (cs1 !== ((checksum >> 4) & 0x0f) || cs2 !== (checksum & 0x0f)) {
    console.warn('Audio Checksum mismatch.');
    return null;
  }

  const decrypted = encrypted.map((n, i) => n ^ SECRET[i % SECRET.length]);
  const bytes = new Uint8Array(Math.floor(decrypted.length / 2));
  for (let i = 0; i < decrypted.length - 1; i += 2) {
    bytes[i / 2] = (decrypted[i] << 4) | decrypted[i + 1];
  }

  return {
    type: typeNibble === 0 ? 'text' : typeNibble === 1 ? 'image' : typeNibble === 2 ? 'video' : 'audio',
    data: bytes,
  };
}

function matchFreq(freq: number): 'START' | 'STOP' | 'PAUSE' | number | null {
  if (Math.abs(freq - START_FREQ) < FREQ_TOLERANCE) return 'START';
  if (Math.abs(freq - STOP_FREQ) < FREQ_TOLERANCE) return 'STOP';
  if (Math.abs(freq - PAUSE_FREQ) < FREQ_TOLERANCE) return 'PAUSE';
  for (let i = 0; i < 16; i++) {
    if (Math.abs(freq - FREQS[i]) < FREQ_TOLERANCE) return i;
  }
  return null;
}

export function computeAudioAnalysis(analyser: AnalyserNode): AudioAnalysis {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  const binCount = data.length;
  if (binCount === 0) return { overall: 0, bass: 0, mid: 0, treble: 0 };

  const bassEnd = Math.floor(binCount * 0.15);
  const midEnd = Math.floor(binCount * 0.5);

  let bassSum = 0;
  for (let i = 0; i < bassEnd; i++) bassSum += data[i];

  let midSum = 0;
  for (let i = bassEnd; i < midEnd; i++) midSum += data[i];

  let trebleSum = 0;
  for (let i = midEnd; i < binCount; i++) trebleSum += data[i];

  let totalSum = bassSum + midSum + trebleSum;

  const bass = Math.min(1, bassSum / (Math.max(1, bassEnd) * 255));
  const mid = Math.min(1, midSum / (Math.max(1, midEnd - bassEnd) * 255));
  const treble = Math.min(1, trebleSum / (Math.max(1, binCount - midEnd) * 255));
  const overall = Math.min(1, totalSum / (binCount * 255));

  return { overall, bass, mid, treble };
}

export function drawSpectrum(
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement,
  visualArray: Uint8Array,
  highlightFreq?: number | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const barCount = 48;
  const step = Math.floor(visualArray.length / barCount);
  const barWidth = (width / barCount) - 2;

  for (let i = 0; i < barCount; i++) {
    const val = visualArray[i * step] || 0;
    const barHeight = Math.max(3, (val / 255) * (height - 6));
    const x = i * (barWidth + 2);
    const y = height - barHeight;

    const freq = (i * step) * (analyser.context.sampleRate / analyser.fftSize);
    const isHighlight = highlightFreq && Math.abs(freq - highlightFreq) < 120;

    const gradient = ctx.createLinearGradient(0, y, 0, height);
    if (isHighlight) {
      gradient.addColorStop(0, '#34d399');
      gradient.addColorStop(1, '#059669');
    } else {
      gradient.addColorStop(0, 'rgba(52, 211, 153, 0.9)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
    ctx.fill();
  }
}

function scheduleSequence(
  ctx: BaseAudioContext,
  dest: AudioNode,
  sequence: Array<'START' | 'STOP' | number>,
  startTimeOffset: number
) {
  let startTime = ctx.currentTime + startTimeOffset;

  sequence.forEach((val, i) => {
    const freq = val === 'START' ? START_FREQ : val === 'STOP' ? STOP_FREQ : FREQS[val as number];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.8, startTime + 0.005);
    gain.gain.setValueAtTime(0.8, startTime + TONE_DUR - 0.005);
    gain.gain.linearRampToValueAtTime(0, startTime + TONE_DUR);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + TONE_DUR);

    if (i < sequence.length - 1) {
      const pOsc = ctx.createOscillator();
      const pGain = ctx.createGain();
      pOsc.type = 'sine';
      pOsc.frequency.value = PAUSE_FREQ;

      pGain.gain.setValueAtTime(0, startTime + TONE_DUR);
      pGain.gain.linearRampToValueAtTime(0.3, startTime + TONE_DUR + 0.005);
      pGain.gain.setValueAtTime(0.3, startTime + TONE_DUR + PAUSE_DUR - 0.005);
      pGain.gain.linearRampToValueAtTime(0, startTime + TONE_DUR + PAUSE_DUR);

      pOsc.connect(pGain);
      pGain.connect(dest);
      pOsc.start(startTime + TONE_DUR);
      pOsc.stop(startTime + TONE_DUR + PAUSE_DUR);
    }

    startTime += TONE_DUR + PAUSE_DUR;
  });

  return {
    totalSeconds: startTime - (ctx.currentTime + startTimeOffset),
  };
}

export async function broadcastData(
  type: 'text' | 'image' | 'video' | 'audio',
  payload: Uint8Array,
  onProgress: (percent: number) => void,
  canvas: HTMLCanvasElement | null,
  onAudioAnalysis?: (analysis: AudioAnalysis) => void
): Promise<void> {
  const sequence = buildSequence(type, payload);
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  analyser.connect(ctx.destination);

  let isPlaying = true;
  const visualArray = new Uint8Array(analyser.frequencyBinCount);

  const drawAndAnalyze = () => {
    if (!isPlaying) return;
    requestAnimationFrame(drawAndAnalyze);
    analyser.getByteFrequencyData(visualArray);
    if (canvas) drawSpectrum(analyser, canvas, visualArray);
    if (onAudioAnalysis) {
      onAudioAnalysis(computeAudioAnalysis(analyser));
    }
  };
  drawAndAnalyze();

  const { totalSeconds } = scheduleSequence(ctx, analyser, sequence, 0.08);

  return new Promise((resolve) => {
    const startMs = Date.now();
    const durationMs = totalSeconds * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const progress = Math.min((elapsed / durationMs) * 100, 100);
      onProgress(progress);

      if (elapsed >= durationMs + 100) {
        clearInterval(interval);
        isPlaying = false;
        ctx.close();
        if (onAudioAnalysis) {
          onAudioAnalysis({ overall: 0, bass: 0, mid: 0, treble: 0 });
        }
        resolve();
      }
    }, 25);
  });
}

/**
 * Packs audio PCM into WAV with optional custom SLNK chunk containing real image or video data.
 */
export async function generateWavBlob(
  type: 'text' | 'image' | 'video' | 'audio',
  payload: Uint8Array,
  mediaMetaPayload?: { dataUrl: string; meta: any; file?: File }
): Promise<Blob> {
  const sequence = buildSequence(type, payload);
  const sampleRate = 44100;
  const totalSeconds = sequence.length * (TONE_DUR + PAUSE_DUR) + 0.2;
  const exactOfflineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * totalSeconds), sampleRate);

  scheduleSequence(exactOfflineCtx, exactOfflineCtx.destination, sequence, 0.08);

  const renderedBuffer = await exactOfflineCtx.startRendering();

  let extraChunk: { id: string; data: Uint8Array } | undefined;
  let rawFileChunk: { id: string; data: Uint8Array } | undefined;

  if ((type === 'image' || type === 'video' || type === 'audio') && mediaMetaPayload) {
    const jsonStr = JSON.stringify({
      version: '2.0',
      type: type,
      // Pass empty dataUrl if we have a real file, so we don't put blob:http:// in the JSON
      dataUrl: mediaMetaPayload.file ? '' : mediaMetaPayload.dataUrl,
      meta: mediaMetaPayload.meta,
    });
    const enc = new TextEncoder().encode(jsonStr);
    extraChunk = { id: 'SLNK', data: enc };

    if (mediaMetaPayload.file) {
       const arrayBuf = await mediaMetaPayload.file.arrayBuffer();
       rawFileChunk = { id: 'SDAT', data: new Uint8Array(arrayBuf) };
    }
  }

  const wavData = audioBufferToWav(renderedBuffer, extraChunk, rawFileChunk);
  return new Blob([wavData], { type: 'audio/wav' });
}

function audioBufferToWav(
  buffer: AudioBuffer,
  extraChunk?: { id: string; data: Uint8Array },
  rawFileChunk?: { id: string; data: Uint8Array }
): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const result = new Float32Array(buffer.length);
  buffer.copyFromChannel(result, 0);

  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = result.length * blockAlign;

  let extraSize = 0;
  if (extraChunk) {
    extraSize += 8 + extraChunk.data.length + (extraChunk.data.length % 2);
  }
  if (rawFileChunk) {
    extraSize += 8 + rawFileChunk.data.length + (rawFileChunk.data.length % 2);
  }

  const totalLength = 44 + dataSize + extraSize;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize + extraSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < result.length; i++) {
    let s = Math.max(-1, Math.min(1, result[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  if (extraChunk) {
    writeString(offset, extraChunk.id);
    view.setUint32(offset + 4, extraChunk.data.length, true);
    offset += 8;
    new Uint8Array(arrayBuffer, offset, extraChunk.data.length).set(extraChunk.data);
    offset += extraChunk.data.length + (extraChunk.data.length % 2);
  }

  if (rawFileChunk) {
    writeString(offset, rawFileChunk.id);
    view.setUint32(offset + 4, rawFileChunk.data.length, true);
    offset += 8;
    new Uint8Array(arrayBuffer, offset, rawFileChunk.data.length).set(rawFileChunk.data);
    offset += rawFileChunk.data.length + (rawFileChunk.data.length % 2);
  }

  return arrayBuffer;
}

export function extractEmbeddedPayloadFromWav(arrayBuffer: ArrayBuffer): { type: 'image' | 'video' | 'audio'; dataUrl: string; meta: any } | null {
  const bytes = new Uint8Array(arrayBuffer);
  let slnkParsed: any = null;
  let sdatBlobUrl: string | null = null;

  if (bytes.length < 12) return null;
  
  // Check 'RIFF' and 'WAVE'
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null;
  if (bytes[8] !== 0x57 || bytes[9] !== 0x41 || bytes[10] !== 0x56 || bytes[11] !== 0x45) return null;

  let i = 12; // Start after 'RIFF', size, and 'WAVE'
  while (i <= bytes.length - 8) {
    const chunkId = String.fromCharCode(bytes[i], bytes[i+1], bytes[i+2], bytes[i+3]);
    const view = new DataView(arrayBuffer, i + 4, 4);
    const chunkLen = view.getUint32(0, true);

    if (chunkId === 'SLNK') {
      try {
        const chunkBytes = bytes.slice(i + 8, i + 8 + chunkLen);
        const jsonStr = new TextDecoder().decode(chunkBytes);
        slnkParsed = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse embedded SLNK chunk', e);
      }
    } else if (chunkId === 'SDAT') {
      try {
        const chunkBytes = bytes.slice(i + 8, i + 8 + chunkLen);
        const mime = slnkParsed?.meta?.mimeType || 'application/octet-stream';
        sdatBlobUrl = URL.createObjectURL(new Blob([chunkBytes], { type: mime }));
      } catch (e) {
        console.error('Failed to parse embedded SDAT chunk', e);
      }
    }
    
    i += 8 + chunkLen + (chunkLen % 2);
  }

  if (slnkParsed && (slnkParsed.dataUrl || sdatBlobUrl)) {
    return {
      type: slnkParsed.type || 'image',
      dataUrl: sdatBlobUrl || slnkParsed.dataUrl,
      meta: slnkParsed.meta || {
        name: slnkParsed.type === 'video' ? 'embedded_video.mp4' : slnkParsed.type === 'audio' ? 'embedded_audio.mp3' : 'embedded_image.png',
        size: 0,
        mimeType: slnkParsed.type === 'video' ? 'video/mp4' : slnkParsed.type === 'audio' ? 'audio/mp3' : 'image/png',
      },
    };
  }

  return null;
}

function setupAnalyzer(ctx: BaseAudioContext) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.0;
  return analyser;
}

function createDecoder(
  ctx: BaseAudioContext,
  analyser: AnalyserNode,
  canvas: HTMLCanvasElement | null,
  onMessage: (payload: DecodedPayload) => void,
  onHexProgress: (hex: string) => void,
  onError: (err: string) => void,
  sourceType: 'mic' | 'file',
  onAudioAnalysis?: (analysis: AudioAnalysis) => void
) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  const visualArray = new Uint8Array(bufferLength);

  let isRunning = true;
  let state: 'IDLE' | 'RECEIVING' = 'IDLE';
  let currentTone: any = null;
  let nibbleBuffer: number[] = [];
  let currentDetectedFreq: number | null = null;

  function handleTone(tone: 'START' | 'STOP' | 'PAUSE' | number) {
    if (tone === 'PAUSE') return;

    if (state === 'IDLE' && tone === 'START') {
      state = 'RECEIVING';
      nibbleBuffer = [];
      onHexProgress('START_OF_MESSAGE');
    } else if (state === 'RECEIVING') {
      if (tone === 'STOP') {
        state = 'IDLE';
        const decoded = decodeSequence(nibbleBuffer);
        if (decoded) {
          if (decoded.type === 'text') {
            const text = new TextDecoder().decode(decoded.data);
            onMessage({
              id: Date.now().toString(),
              type: 'text',
              text,
              time: new Date().toLocaleTimeString(),
              source: sourceType,
            });
            onHexProgress('END_OF_MESSAGE (TEXT_VERIFIED)');
          } else if (decoded.type === 'image') {
            // Image token payload
            const token = new TextDecoder().decode(decoded.data);
            const found = retrieveImageLocally(token);
            if (found) {
              onMessage({
                id: Date.now().toString(),
                type: 'image',
                imageDataUrl: found.dataUrl,
                imageMeta: found.meta,
                time: new Date().toLocaleTimeString(),
                source: sourceType,
              });
              onHexProgress(`END_OF_MESSAGE (REAL_IMAGE_VERIFIED #${token})`);
            } else {
              onHexProgress(`DOWNLOADING_FROM_CLOUD [${token}]...`);
              fetch(`/api/payload/${token}`)
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.dataUrl) {
                    onMessage({
                      id: Date.now().toString(),
                      type: 'image',
                      imageDataUrl: data.dataUrl,
                      imageMeta: data.meta,
                      time: new Date().toLocaleTimeString(),
                      source: sourceType,
                    });
                    onHexProgress(`END_OF_MESSAGE (CLOUD_IMAGE_DOWNLOADED)`);
                  } else {
                    throw new Error('Not found');
                  }
                })
                .catch(() => {
                  // Fallback to text message if cloud fails
                  onMessage({
                    id: Date.now().toString(),
                    type: 'image',
                    imageDataUrl: '',
                    imageMeta: {
                      name: `Acoustic_Image_${token}.png`,
                      size: decoded.data.length,
                      width: 400,
                      height: 400,
                      mimeType: 'image/png',
                    },
                    text: `Received image token [${token}] but cloud download failed.`,
                    time: new Date().toLocaleTimeString(),
                    source: sourceType,
                  });
                  onHexProgress(`END_OF_MESSAGE (SIGNAL_RECEIVED #${token})`);
                });
            }
          } else if (decoded.type === 'video') {
            // Video token payload
            const token = new TextDecoder().decode(decoded.data);
            const found = retrieveVideoLocally(token);
            if (found) {
              onMessage({
                id: Date.now().toString(),
                type: 'video',
                videoDataUrl: found.dataUrl,
                videoMeta: found.meta,
                time: new Date().toLocaleTimeString(),
                source: sourceType,
              });
              onHexProgress(`END_OF_MESSAGE (REAL_VIDEO_VERIFIED #${token})`);
            } else {
              onHexProgress(`DOWNLOADING_FROM_CLOUD [${token}]...`);
              fetch(`/api/payload/${token}`)
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.dataUrl) {
                    onMessage({
                      id: Date.now().toString(),
                      type: 'video',
                      videoDataUrl: data.dataUrl,
                      videoMeta: data.meta,
                      time: new Date().toLocaleTimeString(),
                      source: sourceType,
                    });
                    onHexProgress(`END_OF_MESSAGE (CLOUD_VIDEO_DOWNLOADED)`);
                  } else {
                    throw new Error('Not found');
                  }
                })
                .catch(() => {
                  onMessage({
                    id: Date.now().toString(),
                    type: 'video',
                    videoDataUrl: '',
                    videoMeta: {
                      name: `Acoustic_Video_${token}.mp4`,
                      size: decoded.data.length,
                      mimeType: 'video/mp4',
                    },
                    text: `Received video token [${token}] but cloud download failed.`,
                    time: new Date().toLocaleTimeString(),
                    source: sourceType,
                  });
                  onHexProgress(`END_OF_MESSAGE (SIGNAL_RECEIVED #${token})`);
                });
            }
          } else if (decoded.type === 'audio') {
            // Audio token payload
            const token = new TextDecoder().decode(decoded.data);
            const found = retrieveAudioLocally(token);
            if (found) {
              onMessage({
                id: Date.now().toString(),
                type: 'audio',
                audioDataUrl: found.dataUrl,
                audioMeta: found.meta,
                time: new Date().toLocaleTimeString(),
                source: sourceType,
              });
              onHexProgress(`END_OF_MESSAGE (REAL_AUDIO_VERIFIED #${token})`);
            } else {
              onHexProgress(`DOWNLOADING_FROM_CLOUD [${token}]...`);
              fetch(`/api/payload/${token}`)
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.dataUrl) {
                    onMessage({
                      id: Date.now().toString(),
                      type: 'audio',
                      audioDataUrl: data.dataUrl,
                      audioMeta: data.meta,
                      time: new Date().toLocaleTimeString(),
                      source: sourceType,
                    });
                    onHexProgress(`END_OF_MESSAGE (CLOUD_AUDIO_DOWNLOADED)`);
                  } else {
                    throw new Error('Not found');
                  }
                })
                .catch(() => {
                  onMessage({
                    id: Date.now().toString(),
                    type: 'audio',
                    audioDataUrl: '',
                    audioMeta: {
                      name: `Acoustic_Audio_${token}.mp3`,
                      size: decoded.data.length,
                      mimeType: 'audio/mp3',
                    },
                    text: `Received audio token [${token}] but cloud download failed.`,
                    time: new Date().toLocaleTimeString(),
                    source: sourceType,
                  });
                  onHexProgress(`END_OF_MESSAGE (SIGNAL_RECEIVED #${token})`);
                });
            }
          }
        } else {
          onError('Audio discarded: Corrupted or unauthenticated acoustic transmission.');
          onHexProgress('ERROR_OR_UNAUTHORIZED');
        }
      } else if (typeof tone === 'number') {
        nibbleBuffer.push(tone);
        onHexProgress(tone.toString(16).toUpperCase());
      }
    }
  }

  function analyze() {
    if (!isRunning) return;
    requestAnimationFrame(analyze);

    analyser.getFloatFrequencyData(dataArray);
    analyser.getByteFrequencyData(visualArray);

    if (canvas) drawSpectrum(analyser, canvas, visualArray, currentDetectedFreq);
    if (onAudioAnalysis) {
      onAudioAnalysis(computeAudioAnalysis(analyser));
    }

    const minFreq = 800;
    const maxFreq = 3500;
    const minBin = Math.floor((minFreq * analyser.fftSize) / ctx.sampleRate);
    const maxBin = Math.ceil((maxFreq * analyser.fftSize) / ctx.sampleRate);

    let maxVal = -Infinity;
    let maxBinIndex = -1;

    for (let i = minBin; i <= maxBin; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
        maxBinIndex = i;
      }
    }

    if (maxVal > THRESHOLD_DB) {
      const peakFreq = (maxBinIndex * ctx.sampleRate) / analyser.fftSize;
      currentDetectedFreq = peakFreq;
      const matched = matchFreq(peakFreq);

      if (matched === 'PAUSE') {
        currentTone = 'PAUSE';
      } else if (matched !== null && matched !== currentTone) {
        currentTone = matched;
        handleTone(matched);
      }
    } else {
      currentTone = null;
      currentDetectedFreq = null;
    }
  }

  analyze();

  return () => {
    isRunning = false;
  };
}

export async function startListening(
  onMessage: (payload: DecodedPayload) => void,
  onHexProgress: (hex: string) => void,
  onError: (err: string) => void,
  canvas: HTMLCanvasElement | null,
  onAudioAnalysis?: (analysis: AudioAnalysis) => void
): Promise<(() => void) | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch {
    onError('Microphone permission denied or not available.');
    return null;
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = setupAnalyzer(ctx);
  source.connect(analyser);

  const stopDecoder = createDecoder(
    ctx,
    analyser,
    canvas,
    onMessage,
    onHexProgress,
    onError,
    'mic',
    onAudioAnalysis
  );

  return () => {
    stopDecoder();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close();
  };
}

export async function analyzeAudioFile(
  file: File,
  onMessage: (payload: DecodedPayload) => void,
  onHexProgress: (hex: string) => void,
  onError: (err: string) => void,
  canvas: HTMLCanvasElement | null,
  onPlaybackEnd: () => void,
  onAudioAnalysis?: (analysis: AudioAnalysis) => void
): Promise<(() => void) | null> {
  const arrayBuffer = await file.arrayBuffer();

  // Check if file has direct embedded payload (e.g. Real Image container)
  const embedded = extractEmbeddedPayloadFromWav(arrayBuffer);
  if (embedded) {
    onMessage({
      id: Date.now().toString(),
      type: embedded.type,
      imageDataUrl: embedded.type === 'image' ? embedded.dataUrl : undefined,
      imageMeta: embedded.type === 'image' ? embedded.meta : undefined,
      videoDataUrl: embedded.type === 'video' ? embedded.dataUrl : undefined,
      videoMeta: embedded.type === 'video' ? embedded.meta : undefined,
      audioDataUrl: embedded.type === 'audio' ? embedded.dataUrl : undefined,
      audioMeta: embedded.type === 'audio' ? embedded.meta : undefined,
      time: new Date().toLocaleTimeString(),
      source: 'file',
    });
    onHexProgress(`EMBEDDED_REAL_${embedded.type.toUpperCase()}_FOUND_AND_DECODED`);
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioContextClass();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    onError('Failed to decode audio file.');
    return null;
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = setupAnalyzer(ctx);
  source.connect(analyser);
  analyser.connect(ctx.destination);

  const stopDecoder = createDecoder(
    ctx,
    analyser,
    canvas,
    embedded ? () => {} : onMessage, // If we found an embedded payload, don't emit duplicate acoustic token message
    onHexProgress,
    onError,
    'file',
    onAudioAnalysis
  );

  source.onended = () => {
    stopDecoder();
    ctx.close();
    onPlaybackEnd();
  };

  source.start(0);

  return () => {
    stopDecoder();
    source.stop();
    ctx.close();
  };
}
