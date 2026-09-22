import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export async function downloadFileToDevice(urlOrDataUrl: string, defaultFilename: string) {
  try {
    let fetchUrl = urlOrDataUrl;
    if (urlOrDataUrl.startsWith('/uploads/')) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      fetchUrl = `${origin}${urlOrDataUrl}`;
    }

    const res = await fetch(fetchUrl);
    const blob = await res.blob();
    
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resStr = reader.result as string;
        const base64 = resStr.includes(',') ? resStr.split(',')[1] : resStr;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (Capacitor.isNativePlatform()) {
      try {
        try {
          await Filesystem.requestPermissions();
        } catch (pErr) {
          console.warn('Permission request error:', pErr);
        }

        let saved = false;
        let savedUri = '';

        // Try Documents
        try {
          const resDoc = await Filesystem.writeFile({
            path: defaultFilename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
          });
          savedUri = resDoc.uri;
          saved = true;
        } catch (docErr) {
          console.warn('Documents write failed, trying ExternalStorage:', docErr);
        }

        // Try ExternalStorage if Documents failed
        if (!saved) {
          try {
            const resExt = await Filesystem.writeFile({
              path: defaultFilename,
              data: base64Data,
              directory: Directory.ExternalStorage,
              recursive: true
            });
            savedUri = resExt.uri;
            saved = true;
          } catch (extErr) {
            console.warn('ExternalStorage write failed, trying Cache:', extErr);
          }
        }

        // Fallback to Cache
        if (!saved) {
          const resCache = await Filesystem.writeFile({
            path: defaultFilename,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true
          });
          savedUri = resCache.uri;
          saved = true;
        }

        alert(`File downloaded successfully to device storage: ${defaultFilename}`);
        return savedUri;
      } catch (nativeErr) {
        console.error('Native storage error:', nativeErr);
        // Try Web Share API if available on native/mobile web
        if (navigator.share && blob) {
          try {
            const file = new File([blob], defaultFilename, { type: blob.type });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: defaultFilename,
              });
              return '';
            }
          } catch (shareErr) {
            console.warn('Share API error:', shareErr);
          }
        }
        throw nativeErr;
      }
    } else {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return blobUrl;
    }
  } catch (e) {
    console.error("Download failed:", e);
    // Fallback anchor click
    try {
      const a = document.createElement('a');
      a.href = urlOrDataUrl;
      a.download = defaultFilename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return '';
    } catch (err) {
      alert("Download failed. Please check file URL or connection.");
      throw e;
    }
  }
}

