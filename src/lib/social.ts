export const checkUsernameUnique = async (username: string) => {
  if (!username) return false;
  const res = await fetch(`/api/check-username?username=${username}`);
  const data = await res.json();
  return data.unique;
};

export const updateUserProfile = async (uid: string, data: any) => {
  await fetch(`/api/users/${uid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const uploadProfilePicture = async (uid: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  await updateUserProfile(uid, { photoURL: data.url });
  return data.url;
};

export const searchUsers = async (searchTerm: string) => {
  if (!searchTerm) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
  return await res.json();
};

export const sendFriendRequest = async (fromUid: string, toUid: string) => {
  await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromUid, toUid })
  });
};

export const respondToRequest = async (reqId: string, status: 'accepted' | 'rejected') => {
  await fetch(`/api/requests/${reqId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
};

export const sendMessage = async (chatId: string, senderId: string, text: string, soundUrl?: string) => {
  await fetch(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId, text, soundUrl })
  });
};

export const uploadSoundFile = async (chatId: string, file: Blob) => {
  const formData = new FormData();
  formData.append('file', file, `${Date.now()}.wav`);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  return data.url;
};

// Polling helpers
export const subscribeToIncomingRequests = (uid: string, callback: (reqs: any[]) => void) => {
  let isCancelled = false;
  const poll = async () => {
    if (isCancelled) return;
    try {
      const res = await fetch(`/api/requests/${uid}`);
      const data = await res.json();
      callback(data);
    } catch(e) {}
    if (!isCancelled) setTimeout(poll, 2000);
  };
  poll();
  return () => { isCancelled = true; };
};

export const subscribeToChats = (uid: string, callback: (chats: any[]) => void) => {
  let isCancelled = false;
  const poll = async () => {
    if (isCancelled) return;
    try {
      const res = await fetch(`/api/chats/${uid}`);
      const data = await res.json();
      callback(data);
    } catch(e) {}
    if (!isCancelled) setTimeout(poll, 2000);
  };
  poll();
  return () => { isCancelled = true; };
};

export const subscribeToMessages = (chatId: string, callback: (msgs: any[]) => void) => {
  let isCancelled = false;
  const poll = async () => {
    if (isCancelled) return;
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      const data = await res.json();
      callback(data);
    } catch(e) {}
    if (!isCancelled) setTimeout(poll, 2000);
  };
  poll();
  return () => { isCancelled = true; };
};
