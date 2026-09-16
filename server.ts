import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '200mb' }));

// Ensure uploads dir exists
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

// File-Backed Database
const DB_FILE = path.join(process.cwd(), 'database.json');
let db = {
  users: {} as Record<string, any>,
  friendRequests: {} as Record<string, any>,
  chats: {} as Record<string, any>,
  messages: {} as Record<string, any[]>,
  vapidKeys: null as any
};

if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  } catch (e) {
    console.error("Failed to load database.json", e);
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Initialize Web Push
if (!db.vapidKeys) {
  db.vapidKeys = webpush.generateVAPIDKeys();
  saveDb();
}
webpush.setVapidDetails('mailto:test@example.com', db.vapidKeys.publicKey, db.vapidKeys.privateKey);

app.get('/api/vapid-public-key', (req, res) => {
  res.send(db.vapidKeys.publicKey);
});

app.post('/api/subscribe', (req, res) => {
  const { uid, subscription } = req.body;
  if (!db.users[uid]) {
    db.users[uid] = { uid }; // create dummy if missing somehow
  }
  db.users[uid].pushSubscription = subscription;
  saveDb();
  res.json({ success: true });
});

// --- API ROUTES ---

// 1. Auth & Users
app.post('/api/users/:uid', (req, res) => {
  const { uid } = req.params;
  db.users[uid] = { ...db.users[uid], ...req.body, uid };
  saveDb();
  res.json({ success: true, user: db.users[uid] });
});

app.get('/api/users/:uid', (req, res) => {
  const user = db.users[req.params.uid];
  if (user) res.json(user);
  else res.status(404).json({ error: 'Not found' });
});

app.get('/api/check-username', (req, res) => {
  const { username } = req.query;
  const exists = Object.values(db.users).some(u => u.username === username);
  res.json({ unique: !exists });
});

app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json([]);
  const term = q.toLowerCase();
  const results = Object.values(db.users).filter(u => 
    u.username?.toLowerCase().includes(term)
  ).slice(0, 20);
  res.json(results);
});

// Upload file endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// 2. Friend Requests
app.post('/api/requests', (req, res) => {
  const { fromUid, toUid } = req.body;
  const id = `${fromUid}_${toUid}`;
  db.friendRequests[id] = { id, fromUid, toUid, status: 'pending', timestamp: Date.now() };
  saveDb();
  
  // Push for Friend Request
  const targetUser = db.users[toUid];
  const senderUser = db.users[fromUid];
  if (targetUser && targetUser.pushSubscription) {
    const payload = JSON.stringify({
      title: 'New Friend Request',
      body: `${senderUser?.displayName || 'Someone'} sent you a friend request.`,
      icon: senderUser?.photoURL || '/icon.svg',
      url: '/'
    });
    webpush.sendNotification(targetUser.pushSubscription, payload).catch(e => console.error(e));
  }
  
  res.json({ success: true });
});

app.get('/api/requests/:uid', (req, res) => {
  const { uid } = req.params;
  const reqs = Object.values(db.friendRequests)
    .filter(r => r.toUid === uid && r.status === 'pending')
    .map(r => ({ ...r, user: db.users[r.fromUid] }));
  res.json(reqs);
});

app.post('/api/requests/:reqId/respond', (req, res) => {
  const { reqId } = req.params;
  const { status } = req.body;
  if (db.friendRequests[reqId]) {
    db.friendRequests[reqId].status = status;
    if (status === 'accepted') {
      const { fromUid, toUid } = db.friendRequests[reqId];
      const chatId = [fromUid, toUid].sort().join('_');
      if (!db.chats[chatId]) {
        db.chats[chatId] = { id: chatId, participants: [fromUid, toUid], updatedAt: Date.now(), lastMessage: '' };
        db.messages[chatId] = [];
      }
    }
    saveDb();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// 3. Chats & Messages
app.get('/api/chats/:uid', (req, res) => {
  const { uid } = req.params;
  const userChats = Object.values(db.chats)
    .filter(c => c.participants.includes(uid))
    .map(c => {
      const otherUid = c.participants.find((p: string) => p !== uid);
      return { ...c, user: db.users[otherUid!] };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  res.json(userChats);
});

app.get('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  res.json(db.messages[chatId] || []);
});

app.post('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const msg = { id: Date.now().toString(), ...req.body, timestamp: Date.now() };
  if (!db.messages[chatId]) db.messages[chatId] = [];
  db.messages[chatId].push(msg);
  if (db.chats[chatId]) {
    db.chats[chatId].updatedAt = Date.now();
    db.chats[chatId].lastMessage = msg.text || (msg.soundUrl ? '🎵 SoundLink' : '');
  }
  saveDb();
  
  // Send Web Push Notification
  const chat = db.chats[chatId];
  if (chat) {
    const otherUid = chat.participants.find((p: string) => p !== msg.senderId);
    const otherUser = db.users[otherUid];
    const senderUser = db.users[msg.senderId];
    if (otherUser && otherUser.pushSubscription) {
      const payload = JSON.stringify({
        title: `New message from ${senderUser?.displayName || 'Someone'}`,
        body: msg.text || '🎵 Audio / SoundLink',
        icon: senderUser?.photoURL || '/icon.svg',
        url: '/'
      });
      webpush.sendNotification(otherUser.pushSubscription, payload).catch(err => {
        console.error("WebPush Error:", err);
      });
    }
  }

  res.json({ success: true, message: msg });
});

// Vite middleware
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
