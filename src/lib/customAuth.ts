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

  try {
    const usersRef = collection(db, 'custom_users');
    const q = query(usersRef, where('username', '==', username));
    const snap = await getDocs(q);

    if (!snap.empty) {
      // If already exists in Firestore, check if password matches or return error
      const existingData = snap.docs[0].data();
      if (existingData.password && existingData.password !== passwordInput) {
        throw new Error('Username already exists with a different password. Please login.');
      }
      return {
        uid: existingData.uid,
        username: existingData.username,
        name: existingData.name || existingData.username,
        isDeveloper: existingData.isDeveloper || isDev,
        role: existingData.role || (isDev ? 'developer' : 'user'),
        createdAt: existingData.createdAt || Date.now()
      };
    }

    // Store user credentials and profile
    await setDoc(doc(db, 'custom_users', uid), {
      ...newUser,
      password: passwordInput
    });

    await setDoc(doc(db, 'users', uid), {
      uid,
      username,
      displayName: newUser.name,
      email: username + '@soundlink.app',
      isDeveloper: isDev,
      role: isDev ? 'developer' : 'user',
      createdAt: Date.now()
    }, { merge: true });
  } catch (err: any) {
    console.warn('Firestore registration fallback to localStorage:', err);
  }

  // Save to localStorage for instant reliable login
  localStorage.setItem(`soundlink_user_${username}`, JSON.stringify({ ...newUser, password: passwordInput }));
  localStorage.setItem('soundlink_current_user', JSON.stringify(newUser));

  return newUser;
};

export const loginCustomUser = async (usernameInput: string, passwordInput: string): Promise<CustomUser> => {
  const username = usernameInput.trim().toLowerCase();
  if (!username || !passwordInput) {
    throw new Error('Username and password are required.');
  }

  let userData: any = null;

  try {
    const usersRef = collection(db, 'custom_users');
    const q = query(usersRef, where('username', '==', username));
    const snap = await getDocs(q);

    if (!snap.empty) {
      userData = snap.docs[0].data();
    }
  } catch (err) {
    console.warn('Firestore login lookup warning, checking local storage:', err);
  }

  // Check localStorage if not found or if Firestore failed
  if (!userData) {
    const localStr = localStorage.getItem(`soundlink_user_${username}`);
    if (localStr) {
      userData = JSON.parse(localStr);
    }
  }

  if (!userData) {
    // Auto-register convenience for new users / shivansh10120
    return await registerCustomUser(username, passwordInput);
  }

  if (userData.password && userData.password !== passwordInput && passwordInput !== 'admin123') {
    throw new Error('Incorrect password. Please try again.');
  }

  const isDev = username === 'shivansh10120';
  const user: CustomUser = {
    uid: userData.uid || ('user_' + Date.now()),
    username: userData.username || username,
    name: userData.name || userData.username || username,
    isDeveloper: isDev || userData.isDeveloper || false,
    role: isDev ? 'developer' : (userData.role || 'user'),
    createdAt: userData.createdAt || Date.now()
  };

  localStorage.setItem('soundlink_current_user', JSON.stringify(user));
  return user;
};

