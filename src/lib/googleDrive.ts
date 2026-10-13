// Google Drive Integration Library with Secure Server Backup Fallback

export interface GoogleDriveFileResult {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
}

let cachedAccessToken: string | null = null;

export const requestGoogleDriveToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (cachedAccessToken) {
      resolve(cachedAccessToken);
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('soundlink_google_client_id');
    if (!clientId || clientId.includes('placeholder')) {
      reject(new Error('Google Client ID not configured. Using secure cloud server backup fallback.'));
      return;
    }

    if (typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initAndPromptToken(clientId, resolve, reject);
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.head.appendChild(script);
    } else {
      initAndPromptToken(clientId, resolve, reject);
    }
  });
};

const initAndPromptToken = (clientId: string, resolve: (token: string) => void, reject: (err: any) => void) => {
  try {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        cachedAccessToken = response.access_token;
        resolve(response.access_token);
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  } catch (err) {
    reject(err);
  }
};

export const uploadFileToGoogleDrive = async (file: File | Blob, fileName: string, mimeType: string): Promise<GoogleDriveFileResult> => {
  try {
    const token = await requestGoogleDriveToken();

    const metadata = {
      name: fileName || `SoundLink_Media_${Date.now()}.mp4`,
      mimeType: mimeType || 'video/mp4',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      name: data.name,
      webViewLink: data.webViewLink,
      webContentLink: data.webContentLink
    };
  } catch (err: any) {
    console.warn('Google Drive API unavailable or invalid client. Falling back to secure server cloud storage backup:', err);
    
    // Fallback to secure server upload so backup & link generation never fail
    const uploadForm = new FormData();
    const fileObj = file instanceof File ? file : new File([file], fileName, { type: mimeType });
    uploadForm.append('file', fileObj);

    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      body: uploadForm
    });

    if (!uploadRes.ok) {
      throw new Error('Cloud server backup failed: ' + (await uploadRes.text()));
    }

    const uploadData = await uploadRes.json();
    const fullUrl = `${window.location.origin}${uploadData.url}`;
    
    return {
      id: 'server-backup-' + Date.now(),
      name: fileName,
      webViewLink: fullUrl,
      webContentLink: fullUrl
    };
  }
};

