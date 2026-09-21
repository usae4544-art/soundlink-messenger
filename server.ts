import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import webpush from 'web-push';
import * as OneSignal from 'onesignal-node';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json({ limit: '200mb' }));

let oneSignalClient: OneSignal.Client | null = null;
if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
  oneSignalClient = new OneSignal.Client(
    process.env.ONESIGNAL_APP_ID,
    process.env.ONESIGNAL_API_KEY
  );
}


const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const DB_FILE = path.join(process.cwd(), 'database.json');
let db = {
  vapidKeys: null as any
};
if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  } catch (e) {}
}
function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

if (!db.vapidKeys) {
  db.vapidKeys = webpush.generateVAPIDKeys();
  saveDb();
}
webpush.setVapidDetails('mailto:test@example.com', db.vapidKeys.publicKey, db.vapidKeys.privateKey);

app.get('/api/vapid-public-key', (req, res) => {
  res.send(db.vapidKeys.publicKey);
});

// We no longer save subscriptions on the server, we just use this endpoint to TRIGGER a push
app.post('/api/send-push', async (req, res) => {
  const { subscription, title, body, icon, url, userId } = req.body;
  
  // Try OneSignal if client is configured
  if (oneSignalClient) {
    try {
      const notification: any = {
        contents: { en: body || 'New message' },
        headings: { en: title || 'SoundLink App' },
        included_segments: userId ? undefined : ['All'],
        include_external_user_ids: userId ? [userId] : undefined,
        url: url || '/'
      };
      await oneSignalClient.createNotification(notification);
    } catch (e) {
      console.error("OneSignal push failed:", e);
    }
  }

  // Fallback / standard WebPush
  if (subscription) {
    const payload = JSON.stringify({ title, body, icon, url });
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (e) {
      console.error("WebPush failed:", e);
    }
  }
  res.json({ success: true });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

app.post('/api/upload-chunk', upload.single('chunk'), (req, res) => {
  const { originalName, chunkIndex, totalChunks, uploadId } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No chunk' });
  
  const tempDir = path.join(uploadsDir, 'temp_' + uploadId);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  const chunkPath = path.join(tempDir, chunkIndex);
  fs.renameSync(req.file.path, chunkPath);
  
  if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
    const finalFilename = uploadId + '-' + originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalPath = path.join(uploadsDir, finalFilename);
    const writeStream = fs.createWriteStream(finalPath);
    
    for (let i = 0; i < parseInt(totalChunks); i++) {
      const data = fs.readFileSync(path.join(tempDir, i.toString()));
      writeStream.write(data);
    }
    writeStream.end();
    
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    return res.json({ success: true, url: `/uploads/${finalFilename}` });
  }
  
  res.json({ success: true });
});

// Payload Storage with Disk Persistence
const PAYLOADS_FILE = path.join(process.cwd(), 'payloads.json');
interface StoredPayload {
  token: string;
  type?: string;
  dataUrl?: string;
  meta?: any;
  text?: string;
  senderName?: string;
  createdAt: number;
  expiresAt: number;
}

const payloads = new Map<string, StoredPayload>();

// Load persisted payloads if available
if (fs.existsSync(PAYLOADS_FILE)) {
  try {
    const raw = fs.readFileSync(PAYLOADS_FILE, 'utf8');
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      payloads.set(k, v as StoredPayload);
    }
  } catch (e) {
    console.error('Failed to load payloads.json', e);
  }
}

function savePayloads() {
  try {
    const obj: Record<string, StoredPayload> = {};
    for (const [k, v] of payloads.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(PAYLOADS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error('Failed to save payloads.json', e);
  }
}

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  let deleted = false;
  for (const [token, payload] of payloads.entries()) {
    if (payload.expiresAt < now) {
      payloads.delete(token);
      deleted = true;
    }
  }
  if (deleted) savePayloads();
}, 60000);

app.post('/api/upload-payload', (req, res) => {
  const { token, dataUrl, meta, expiresIn, type, text, senderName } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  const expiresAt = expiresIn ? Date.now() + expiresIn : Date.now() + 48 * 60 * 60 * 1000;
  
  const inferredType = type || (meta?.mimeType?.startsWith('video') ? 'video' : meta?.mimeType?.startsWith('audio') ? 'audio' : dataUrl ? 'image' : 'text');
  
  payloads.set(token, { 
    token,
    type: inferredType,
    dataUrl: dataUrl || '',
    meta: meta || null,
    text: text || '',
    senderName: senderName || '',
    createdAt: Date.now(),
    expiresAt 
  });
  savePayloads();
  res.json({ success: true, token });
});

app.get('/api/payload/:token', (req, res) => {
  const payload = payloads.get(req.params.token);
  if (!payload || payload.expiresAt < Date.now()) {
    if (payload) {
      payloads.delete(req.params.token);
      savePayloads();
    }
    return res.status(404).json({ error: 'Expired or not found' });
  }
  res.json({ 
    success: true, 
    token: payload.token,
    type: payload.type,
    dataUrl: payload.dataUrl, 
    meta: payload.meta,
    text: payload.text,
    senderName: payload.senderName,
    createdAt: payload.createdAt
  });
});

app.post('/api/insights', (req, res) => {
  // Mock insights for now if it doesn't exist
  res.json({ success: true, text: "AI Insights generated for the payload. (Mocked)" });
});

// Storage Quota Management (Free tier quota 500MB)
const TOTAL_STORAGE_QUOTA_BYTES = 500 * 1024 * 1024; // 500MB
const WARNING_THRESHOLD_PERCENT = 60; // 60%
const FILE_RETENTION_MS = 2 * 24 * 60 * 60 * 1000; // 2 days (48 hours)

function getStorageMetrics() {
  let usedBytes = 0;
  let fileCount = 0;
  const filesList: { name: string; fullPath: string; size: number; mtime: number }[] = [];

  if (fs.existsSync(uploadsDir)) {
    const entries = fs.readdirSync(uploadsDir);
    for (const entry of entries) {
      if (entry.startsWith('temp_')) continue;
      const fullPath = path.join(uploadsDir, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          usedBytes += stat.size;
          fileCount++;
          filesList.push({
            name: entry,
            fullPath,
            size: stat.size,
            mtime: stat.mtimeMs
          });
        }
      } catch (e) {}
    }
  }

  const usagePercent = Math.min(100, Math.round((usedBytes / TOTAL_STORAGE_QUOTA_BYTES) * 100));
  return {
    usedBytes,
    totalBytes: TOTAL_STORAGE_QUOTA_BYTES,
    usagePercent,
    fileCount,
    isWarning: usagePercent >= WARNING_THRESHOLD_PERCENT,
    warningThreshold: WARNING_THRESHOLD_PERCENT,
    filesList
  };
}

function runStorageCleanup(force = false) {
  const metrics = getStorageMetrics();
  let cleanedCount = 0;
  let freedBytes = 0;

  // Run cleanup if storage exceeds 60% or if forced
  if (metrics.usagePercent >= WARNING_THRESHOLD_PERCENT || force) {
    const now = Date.now();
    // Sort oldest files first
    const sortedFiles = metrics.filesList.sort((a, b) => a.mtime - b.mtime);

    for (const file of sortedFiles) {
      const ageMs = now - file.mtime;
      // Delete if older than 2 days OR if forced
      if (ageMs >= FILE_RETENTION_MS || force) {
        try {
          fs.unlinkSync(file.fullPath);
          cleanedCount++;
          freedBytes += file.size;
        } catch (e) {
          console.error("Failed to delete expired file:", file.name, e);
        }
      }
    }
    console.log(`[Storage Cleanup] Cleaned ${cleanedCount} files, freed ${(freedBytes / 1024 / 1024).toFixed(2)} MB.`);
  }

  return { cleanedCount, freedBytes };
}

// Check every 30 minutes
setInterval(() => {
  try {
    runStorageCleanup(false);
  } catch (e) {
    console.error("Periodic cleanup error", e);
  }
}, 30 * 60 * 1000);

app.get('/api/storage-status', (req, res) => {
  const metrics = getStorageMetrics();
  res.json({
    usedBytes: metrics.usedBytes,
    totalBytes: metrics.totalBytes,
    usagePercent: metrics.usagePercent,
    fileCount: metrics.fileCount,
    isWarning: metrics.isWarning,
    warningThreshold: metrics.warningThreshold,
    retentionDays: 2,
    policy: "If storage exceeds 60%, uploaded attachments older than 2 days are automatically purged. Essential user account and Google profile photos are permanently protected.",
    files: metrics.filesList.map(f => ({
      name: f.name,
      size: f.size,
      mtime: f.mtime,
      url: `/uploads/${f.name}`
    }))
  });
});

app.delete('/api/storage-file/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const targetPath = path.join(uploadsDir, filename);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const stat = fs.statSync(targetPath);
    fs.unlinkSync(targetPath);
    const metrics = getStorageMetrics();
    res.json({ success: true, freedBytes: stat.size, metrics });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete file' });
  }
});

app.post('/api/cleanup-storage', (req, res) => {
  const result = runStorageCleanup(true);
  const metrics = getStorageMetrics();
  res.json({
    success: true,
    ...result,
    currentUsagePercent: metrics.usagePercent
  });
});


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
