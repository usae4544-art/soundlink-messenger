var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_web_push = __toESM(require("web-push"), 1);
var OneSignal = __toESM(require("onesignal-node"), 1);
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use((0, import_cors.default)());
app.use(import_express.default.json({ limit: "200mb" }));
var oneSignalClient = null;
if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
  oneSignalClient = new OneSignal.Client(
    process.env.ONESIGNAL_APP_ID,
    process.env.ONESIGNAL_API_KEY
  );
}
var uploadsDir = import_path.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(uploadsDir)) {
  import_fs.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", import_express.default.static(uploadsDir));
var storage = import_multer.default.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});
var upload = (0, import_multer.default)({ storage });
var DB_FILE = import_path.default.join(process.cwd(), "database.json");
var db = {
  vapidKeys: null
};
if (import_fs.default.existsSync(DB_FILE)) {
  try {
    const data = import_fs.default.readFileSync(DB_FILE, "utf8");
    db = JSON.parse(data);
  } catch (e) {
  }
}
function saveDb() {
  import_fs.default.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
if (!db.vapidKeys) {
  db.vapidKeys = import_web_push.default.generateVAPIDKeys();
  saveDb();
}
import_web_push.default.setVapidDetails("mailto:test@example.com", db.vapidKeys.publicKey, db.vapidKeys.privateKey);
app.get("/api/vapid-public-key", (req, res) => {
  res.send(db.vapidKeys.publicKey);
});
app.post("/api/send-push", async (req, res) => {
  const { subscription, title, body, icon, url, userId } = req.body;
  if (oneSignalClient) {
    try {
      const notification = {
        contents: { en: body || "New message" },
        headings: { en: title || "SoundLink App" },
        included_segments: userId ? void 0 : ["All"],
        include_external_user_ids: userId ? [userId] : void 0,
        url: url || "/"
      };
      await oneSignalClient.createNotification(notification);
    } catch (e) {
      console.error("OneSignal push failed:", e);
    }
  }
  if (subscription) {
    const payload = JSON.stringify({ title, body, icon, url });
    try {
      await import_web_push.default.sendNotification(subscription, payload);
    } catch (e) {
      console.error("WebPush failed:", e);
    }
  }
  res.json({ success: true });
});
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});
app.post("/api/upload-chunk", upload.single("chunk"), (req, res) => {
  const { originalName, chunkIndex, totalChunks, uploadId } = req.body;
  if (!req.file) return res.status(400).json({ error: "No chunk" });
  const tempDir = import_path.default.join(uploadsDir, "temp_" + uploadId);
  if (!import_fs.default.existsSync(tempDir)) import_fs.default.mkdirSync(tempDir, { recursive: true });
  const chunkPath = import_path.default.join(tempDir, `chunk_${chunkIndex}`);
  import_fs.default.renameSync(req.file.path, chunkPath);
  const expectedChunks = parseInt(totalChunks);
  const receivedFiles = import_fs.default.readdirSync(tempDir).filter((f) => f.startsWith("chunk_"));
  const receivedChunks = receivedFiles.length;
  if (receivedChunks === expectedChunks) {
    const finalFilename = uploadId + "-" + (originalName ? originalName.replace(/[^a-zA-Z0-9.-]/g, "_") : "video.mp4");
    const finalPath = import_path.default.join(uploadsDir, finalFilename);
    const writeStream = import_fs.default.createWriteStream(finalPath);
    for (let i = 0; i < expectedChunks; i++) {
      const p = import_path.default.join(tempDir, `chunk_${i}`);
      if (import_fs.default.existsSync(p)) {
        const data = import_fs.default.readFileSync(p);
        writeStream.write(data);
      }
    }
    writeStream.end();
    setTimeout(() => {
      try {
        import_fs.default.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
      }
    }, 1e3);
    return res.json({ success: true, url: `/uploads/${finalFilename}` });
  }
  res.json({ success: true, received: receivedChunks, total: expectedChunks });
});
var PAYLOADS_FILE = import_path.default.join(process.cwd(), "payloads.json");
var payloads = /* @__PURE__ */ new Map();
if (import_fs.default.existsSync(PAYLOADS_FILE)) {
  try {
    const raw = import_fs.default.readFileSync(PAYLOADS_FILE, "utf8");
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      payloads.set(k, v);
    }
  } catch (e) {
    console.error("Failed to load payloads.json", e);
  }
}
function savePayloads() {
  try {
    const obj = {};
    for (const [k, v] of payloads.entries()) {
      obj[k] = v;
    }
    import_fs.default.writeFileSync(PAYLOADS_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.error("Failed to save payloads.json", e);
  }
}
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
}, 6e4);
app.post("/api/upload-payload", (req, res) => {
  const { token, dataUrl, meta, expiresIn, type, text, senderName } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required" });
  const expiresAt = expiresIn ? Date.now() + expiresIn : Date.now() + 48 * 60 * 60 * 1e3;
  const inferredType = type || (meta?.mimeType?.startsWith("video") ? "video" : meta?.mimeType?.startsWith("audio") ? "audio" : dataUrl ? "image" : "text");
  payloads.set(token, {
    token,
    type: inferredType,
    dataUrl: dataUrl || "",
    meta: meta || null,
    text: text || "",
    senderName: senderName || "",
    createdAt: Date.now(),
    expiresAt
  });
  savePayloads();
  res.json({ success: true, token });
});
app.get("/api/payload/:token", (req, res) => {
  const payload = payloads.get(req.params.token);
  if (!payload || payload.expiresAt < Date.now()) {
    if (payload) {
      payloads.delete(req.params.token);
      savePayloads();
    }
    return res.status(404).json({ error: "Expired or not found" });
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
app.post("/api/insights", (req, res) => {
  res.json({ success: true, text: "AI Insights generated for the payload. (Mocked)" });
});
var TOTAL_STORAGE_QUOTA_BYTES = 500 * 1024 * 1024;
var WARNING_THRESHOLD_PERCENT = 60;
var FILE_RETENTION_MS = 2 * 24 * 60 * 60 * 1e3;
function getStorageMetrics() {
  let usedBytes = 0;
  let fileCount = 0;
  const filesList = [];
  if (import_fs.default.existsSync(uploadsDir)) {
    const entries = import_fs.default.readdirSync(uploadsDir);
    for (const entry of entries) {
      if (entry.startsWith("temp_")) continue;
      const fullPath = import_path.default.join(uploadsDir, entry);
      try {
        const stat = import_fs.default.statSync(fullPath);
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
      } catch (e) {
      }
    }
  }
  const usagePercent = Math.min(100, Math.round(usedBytes / TOTAL_STORAGE_QUOTA_BYTES * 100));
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
  if (metrics.usagePercent >= WARNING_THRESHOLD_PERCENT || force) {
    const now = Date.now();
    const sortedFiles = metrics.filesList.sort((a, b) => a.mtime - b.mtime);
    for (const file of sortedFiles) {
      const ageMs = now - file.mtime;
      if (ageMs >= FILE_RETENTION_MS || force) {
        try {
          import_fs.default.unlinkSync(file.fullPath);
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
setInterval(() => {
  try {
    runStorageCleanup(false);
  } catch (e) {
    console.error("Periodic cleanup error", e);
  }
}, 30 * 60 * 1e3);
app.get("/api/storage-status", (req, res) => {
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
    files: metrics.filesList.map((f) => ({
      name: f.name,
      size: f.size,
      mtime: f.mtime,
      url: `/uploads/${f.name}`
    }))
  });
});
app.delete("/api/storage-file/:filename", (req, res) => {
  const filename = import_path.default.basename(req.params.filename);
  const targetPath = import_path.default.join(uploadsDir, filename);
  if (!import_fs.default.existsSync(targetPath)) {
    return res.status(404).json({ error: "File not found" });
  }
  try {
    const stat = import_fs.default.statSync(targetPath);
    import_fs.default.unlinkSync(targetPath);
    const metrics = getStorageMetrics();
    res.json({ success: true, freedBytes: stat.size, metrics });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to delete file" });
  }
});
app.post("/api/cleanup-storage", (req, res) => {
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
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
