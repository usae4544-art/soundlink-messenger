import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs, updateDoc, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { apiFetch } from './apiHelper';


export const checkUsernameUnique = async (username: string) => {
  if (!username) return false;
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snap = await getDocs(q);
  return snap.empty;
};

export const updateUserProfile = async (uid: string, data: any) => {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
};

export const uploadProfilePicture = async (uid: string, file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        await updateUserProfile(uid, { photoURL: dataUrl });
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const searchUsers = async (searchTerm: string) => {
  if (!searchTerm) return [];
  const term = searchTerm.toLowerCase();
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(doc => doc.data())
    .filter(u => u.username?.toLowerCase().includes(term))
    .slice(0, 20);
};

export const sendFriendRequest = async (fromUid: string, toUid: string) => {
  if (fromUid === toUid) {
    throw new Error("You cannot send a friend request to yourself.");
  }
  const id = `${fromUid}_${toUid}`;
  await setDoc(doc(db, 'friendRequests', id), {
    id, fromUid, toUid, status: 'pending', timestamp: Date.now()
  });
  
  // Trigger Push
  const targetUser = await getDoc(doc(db, 'users', toUid));
  const senderUser = await getDoc(doc(db, 'users', fromUid));
  if (targetUser.exists() && senderUser.exists()) {
    const targetData = targetUser.data();
    if (targetData.pushSubscription) {
      try {
        await apiFetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: targetData.pushSubscription,
            title: 'New Friend Request',
            body: `${senderUser.data().displayName || 'Someone'} sent you a friend request.`,
            icon: senderUser.data().photoURL || '/icon.svg',
            url: '/'
          })
        });
      } catch (e) {
        console.error("Push notification failed", e);
      }
    }
  }
};

export const respondToRequest = async (reqId: string, status: 'accepted' | 'rejected') => {
  const reqRef = doc(db, 'friendRequests', reqId);
  const reqSnap = await getDoc(reqRef);
  if (reqSnap.exists()) {
    await updateDoc(reqRef, { status });
    if (status === 'accepted') {
      const data = reqSnap.data();
      const chatId = [data.fromUid, data.toUid].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          id: chatId,
          participants: [data.fromUid, data.toUid],
          updatedAt: Date.now(),
          lastMessage: ''
        });
      }
    }
  }
};

export const sendMessage = async (chatId: string, senderId: string, text: string, soundUrl?: string, expiresIn?: number, fileUrl?: string, fileType?: string) => {
  const msg: any = { id: Date.now().toString(), senderId, text, timestamp: Date.now() };
  if (soundUrl) msg.soundUrl = soundUrl;
  if (expiresIn) msg.expiresAt = Date.now() + expiresIn;
  if (fileUrl) {
    msg.fileUrl = fileUrl;
    msg.fileType = fileType;
  }
  await setDoc(doc(db, 'chats', chatId, 'messages', msg.id), msg);
  
  const lastMessageText = text || (soundUrl ? '🎵 SoundLink' : (fileUrl ? '📎 File' : ''));
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      updatedAt: Date.now(),
      lastMessage: lastMessageText
    });
  } catch (e) {
    console.error("updateDoc error", e);
  }
  
  const chatSnap = await getDoc(doc(db, 'chats', chatId));
  if (chatSnap.exists()) {
    const chatData = chatSnap.data();
    const targetUid = chatData.participants.find((p: string) => p !== senderId);
    if (targetUid) {
      const targetUser = await getDoc(doc(db, 'users', targetUid));
      const senderUser = await getDoc(doc(db, 'users', senderId));
      if (targetUser.exists() && senderUser.exists()) {
        const senderName = senderUser.data().displayName || 'Someone';
        try {
          LocalNotifications.schedule({
            notifications: [
              {
                title: `💬 New message from ${senderName}`,
                body: lastMessageText,
                id: Math.floor(Date.now() % 100000),
                schedule: { at: new Date(Date.now() + 50) },
                channelId: 'soundlink_calls',
              }
            ]
          }).catch(() => {});
        } catch (e) {}

        const tData = targetUser.data();
        if (tData.pushSubscription) {
          await apiFetch('/api/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: tData.pushSubscription,
              title: `New message from ${senderName}`,
              body: lastMessageText,
              icon: senderUser.data().photoURL || '/icon.svg',
              url: '/'
            })
          });
        }
      }
    }
  }
};

export const uploadSoundFile = async (chatId: string, file: Blob) => {
  const formData = new FormData();
  formData.append('file', file, `${Date.now()}.wav`);
  const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  return data.url;
};

export const uploadGeneralFile = async (chatId: string, file: File, onProgress?: (p: number) => void) => {
  const chunkSize = 512 * 1024; // 512KB to avoid nginx limits
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
    
    const res = await apiFetch('/api/upload-chunk', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed with status ' + res.status);
    const data = await res.json();
    
    if (onProgress) onProgress(((i + 1) / totalChunks) * 100);
    if (data.url) finalUrl = data.url;
  }
  
  return finalUrl;
};

export const DEVELOPER_EMAIL = 'usae4544@gmail.com';

export const isDeveloperUser = (email?: string | null, username?: string | null) => {
  const e = email?.toLowerCase().trim();
  const u = username?.toLowerCase().trim();
  return e === DEVELOPER_EMAIL.toLowerCase() || u === 'shivansh10120' || e === 'shivansh10120@soundlink.app';
};

// In-memory user profile cache for instantaneous chat list loading
const userProfileCache = new Map<string, any>();

export const getCachedUserProfile = async (uid: string) => {
  if (userProfileCache.has(uid)) {
    return userProfileCache.get(uid);
  }
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      userProfileCache.set(uid, data);
      return data;
    }
  } catch (e) {
    console.error("Failed to load user profile for", uid, e);
  }
  return null;
};

// Real-time subscriptions with ultra-fast parallel caching
export const subscribeToIncomingRequests = (uid: string, callback: (reqs: any[]) => void) => {
  const q = query(collection(db, 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(q, async (snap) => {
    const promises = snap.docs.map(async (d) => {
      const r = d.data();
      let userData = await getCachedUserProfile(r.fromUid);
      return { ...r, user: userData || { displayName: 'User', username: 'user' } };
    });
    const reqs = await Promise.all(promises);
    callback(reqs);
  });
};

export const subscribeToChats = (uid: string, callback: (chats: any[]) => void) => {
  const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
  return onSnapshot(q, async (snap) => {
    const promises = snap.docs.map(async (d) => {
      const c = d.data();
      const otherUid = c.participants.find((p: string) => p !== uid);
      if (otherUid) {
        let otherUser = await getCachedUserProfile(otherUid);
        return {
          ...c,
          user: otherUser || {
            uid: otherUid,
            displayName: 'Contact',
            username: 'contact',
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUid}`
          }
        };
      }
      return null;
    });

    const results = await Promise.all(promises);
    const validChats = results.filter(Boolean) as any[];
    validChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    callback(validChats);
  }, (err) => {
    console.error("subscribeToChats error:", err);
  });
};

export const updateChatTheme = async (chatId: string, theme: string) => {
  await updateDoc(doc(db, 'chats', chatId), { theme });
};

// Developer Admin Functions
export const subscribeToAllUsers = (callback: (users: any[]) => void) => {
  const q = collection(db, 'users');
  return onSnapshot(q, (snap) => {
    const allUsers = snap.docs.map(d => d.data());
    allUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(allUsers);
  }, (err) => {
    console.error("subscribeToAllUsers error:", err);
  });
};

export const setUserSuspendedStatus = async (targetUid: string, suspended: boolean) => {
  await updateDoc(doc(db, 'users', targetUid), { suspended });
  // Also invalidate local cache
  userProfileCache.delete(targetUid);
};

export const subscribeToMessages = (chatId: string, callback: (msgs: any[]) => void) => {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const msgs: any[] = [];
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.expiresAt && data.expiresAt < now) {
        import('firebase/firestore').then(({ deleteDoc, doc: fDoc }) => deleteDoc(fDoc(db, 'chats', chatId, 'messages', data.id))).catch(() => {});
      } else {
        msgs.push(data);
      }
    });
    callback(msgs);
  }, (err) => {
    console.error("subscribeToMessages error:", err);
  });
};

export const deleteMessage = async (chatId: string, messageId: string) => {
  await import('firebase/firestore').then(({ deleteDoc, doc }) => deleteDoc(doc(db, 'chats', chatId, 'messages', messageId)));
};

export const clearChatMessages = async (chatId: string, options?: { onlyMedia?: boolean; senderId?: string }) => {
  const { getDocs, deleteDoc, doc: fDoc, collection: fCollection } = await import('firebase/firestore');
  const snap = await getDocs(fCollection(db, 'chats', chatId, 'messages'));
  const deletePromises: Promise<any>[] = [];
  const filesToDelete: string[] = [];

  for (const messageDoc of snap.docs) {
    const data = messageDoc.data();
    if (options?.senderId && data.senderId !== options.senderId) {
      continue;
    }
    if (options?.onlyMedia) {
      if (!data.fileUrl && !data.soundUrl) {
        continue;
      }
    }

    // Collect attached file path if stored on our server
    const targetUrl = data.fileUrl || data.soundUrl;
    if (targetUrl && targetUrl.startsWith('/uploads/')) {
      const fname = targetUrl.replace('/uploads/', '');
      if (fname && !filesToDelete.includes(fname)) {
        filesToDelete.push(fname);
      }
    }

    deletePromises.push(deleteDoc(fDoc(db, 'chats', chatId, 'messages', messageDoc.id)));
  }

  await Promise.all(deletePromises);

  // Also clean up physical files on server
  for (const filename of filesToDelete) {
    try {
      await fetch(`/api/storage-file/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Could not delete physical chat file", filename, e);
    }
  }

  // Update chat lastMessage
  try {
    const { updateDoc: fUpdateDoc, doc: fDocRef } = await import('firebase/firestore');
    await fUpdateDoc(fDocRef(db, 'chats', chatId), {
      lastMessage: options?.onlyMedia ? 'Media cleared' : 'Chat history cleared',
      updatedAt: Date.now()
    });
  } catch (e) {
    // ignore
  }

  return { deletedCount: deletePromises.length, deletedFilesCount: filesToDelete.length };
};
