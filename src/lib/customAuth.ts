import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export interface CustomUser {
  uid: string;
  username: string;
  name: string;
  isDeveloper: boolean;
  role: string;
  createdAt: number;
}

export const registerCustomUser = async (usernameInput: string, passwordInput: string): Promise<CustomUser> => {
  const username = usernameInput.trim().toLowerCase();
  if (!username || !passwordInput) {
    throw new Error('Username and password are required.');
  }

  const usersRef = collection(db, 'custom_users');
  const q = query(usersRef, where('username', '==', username));
  const snap = await getDocs(q);

  if (!snap.empty) {
    throw new Error('Username already exists. Please choose another or login.');
  }

  const isDev = username === 'shivansh10120';
  const uid = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

  const newUser: CustomUser = {
    uid,
    username,
    name: username === 'shivansh10120' ? 'Shivansh (Developer)' : username,
    isDeveloper: isDev,
    role: isDev ? 'developer' : 'user',
    createdAt: Date.now()
  };

  // Store user credentials and profile
  await setDoc(doc(db, 'custom_users', uid), {
    ...newUser,
    password: passwordInput // stored in app's database as requested
  });

  // Also sync with users collection for chat/profile compatibility
  await setDoc(doc(db, 'users', uid), {
    uid,
    username,
    displayName: newUser.name,
    email: username + '@soundlink.app',
    isDeveloper: isDev,
    role: isDev ? 'developer' : 'user',
    createdAt: Date.now()
  }, { merge: true });

  return newUser;
};

export const loginCustomUser = async (usernameInput: string, passwordInput: string): Promise<CustomUser> => {
  const username = usernameInput.trim().toLowerCase();
  if (!username || !passwordInput) {
    throw new Error('Username and password are required.');
  }

  const usersRef = collection(db, 'custom_users');
  const q = query(usersRef, where('username', '==', username));
  const snap = await getDocs(q);

  if (snap.empty) {
    // If shivansh10120 tries to login for the first time without registration, auto-register
    if (username === 'shivansh10120') {
      return await registerCustomUser(username, passwordInput);
    }
    throw new Error('User not found. Please register first.');
  }

  const userData = snap.docs[0].data();
  if (userData.password !== passwordInput) {
    throw new Error('Incorrect password.');
  }

  const isDev = username === 'shivansh10120';
  const user: CustomUser = {
    uid: userData.uid,
    username: userData.username,
    name: userData.name || userData.username,
    isDeveloper: isDev || userData.isDeveloper || false,
    role: isDev ? 'developer' : (userData.role || 'user'),
    createdAt: userData.createdAt || Date.now()
  };

  return user;
};
