export type PayloadType = 'text' | 'image' | 'video' | 'audio';

export interface ImageMetadata {
  name: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
}

export interface VideoMetadata {
  name: string;
  size: number;
  mimeType: string;
}

export interface AudioMetadata {
  name: string;
  size: number;
  mimeType: string;
}

export interface DecodedPayload {
  id: string;
  type: PayloadType;
  text?: string;
  imageDataUrl?: string;
  imageMeta?: ImageMetadata;
  videoDataUrl?: string;
  videoMeta?: VideoMetadata;
  audioDataUrl?: string;
  audioMeta?: AudioMetadata;
  rawBytes?: Uint8Array;
  time: string;
  source: 'mic' | 'file' | 'broadcast';
}

export type MotionMode = 'pulse' | 'ripple' | 'equalizer' | 'dance';

export interface AudioAnalysis {
  overall: number; // 0 to 1
  bass: number;    // 0 to 1
  mid: number;     // 0 to 1
  treble: number;  // 0 to 1
}

export interface SentHistoryItem {
  id: string;
  type: PayloadType;
  time: string;
  name?: string;
  previewUrl?: string;
}
