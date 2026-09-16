export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function toCamelCase(str: string) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function toSnakeCase(str: string) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function keysToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(keysToCamel);
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof FormData)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[toCamelCase(key)] = keysToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  // Coerce decimal strings returned by Python/Pydantic ("1000.00") to JS numbers.
  // Matches strings that are purely numeric (with optional leading minus and decimal point).
  if (typeof obj === 'string' && /^-?\d+(\.\d+)?$/.test(obj)) {
    return Number(obj);
  }
  return obj;
}

export function keysToSnake(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(keysToSnake);
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof FormData)) {
    return Object.keys(obj).reduce((acc, key) => {
      acc[toSnakeCase(key)] = keysToSnake(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
}

function onRefreshFailed() {
  refreshSubscribers.forEach(cb => cb(null));
}

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

export async function fetchClient(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = localStorage.getItem('access_token');
  
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // If not multipart/form-data and not explicitly set, default to json
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  const url = `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, config);

  if (response.status === 401 && token) {
    // try to refresh token
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      handleLogout();
      throw new ApiError(401, 'Unauthorized');
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem('access_token', data.access_token);
          if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          isRefreshing = false;
          onRefreshed(data.access_token);
          refreshSubscribers = [];
          
          // Retry original request
          headers.set('Authorization', `Bearer ${data.access_token}`);
          return fetchClient(endpoint, { ...options, headers });
        } else {
          throw new Error('Refresh failed');
        }
      } catch (err) {
        isRefreshing = false;
        onRefreshFailed();
        refreshSubscribers = [];
        handleLogout();
        throw new ApiError(401, 'Session expired');
      }
    } else {
      // wait for refresh to finish and retry
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(newToken => {
          if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            resolve(fetchClient(endpoint, { ...options, headers }));
          } else {
            reject(new ApiError(401, 'Session expired'));
          }
        });
      });
    }
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = null;
    }
    const message = errorData?.detail || response.statusText || 'An error occurred';
    throw new ApiError(response.status, message, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function handleLogout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('ssc-erp-session');
  window.location.href = '/login';
}
