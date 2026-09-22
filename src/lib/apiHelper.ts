export const getApiBase = () => {
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || window.location.hostname === 'localhost') {
      return 'https://ais-dev-6jco6cnnascb24h7ip2w6i-68482813493.asia-southeast1.run.app';
    }
  }
  return '';
};

export const apiFetch = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const base = getApiBase();
  const url = endpoint.startsWith('/') ? `${base}${endpoint}` : `${base}/${endpoint}`;
  return fetch(url, options);
};

export const getApiUrl = (endpoint: string): string => {
  const base = getApiBase();
  return endpoint.startsWith('/') ? `${base}${endpoint}` : `${base}/${endpoint}`;
};
