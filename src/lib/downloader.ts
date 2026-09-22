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
        const savedFile = await Filesystem.writeFile({
          path: defaultFilename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        alert(`Downloaded successfully to Documents folder: ${defaultFilename}`);
        return savedFile.uri;
      } catch (err) {
        const savedCache = await Filesystem.writeFile({
          path: defaultFilename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });
        alert(`Downloaded successfully to Cache folder: ${defaultFilename}`);
        return savedCache.uri;
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
      alert("Failed to download file. Please check connection.");
      throw e;
    }
  }
}
