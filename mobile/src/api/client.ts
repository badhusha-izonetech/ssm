import axios, { AxiosError, AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Same backend, same auth mechanism as the web app (JWT bearer). No new
// auth system, no new backend — this is just another authenticated client.
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) || 'http://localhost:8000/api/v1';
export const WS_BASE_URL: string =
  (Constants.expoConfig?.extra?.wsBaseUrl as string) || API_BASE_URL.replace(/^http/, 'ws');

const ACCESS_TOKEN_KEY = 'ssc_field_access_token';
const REFRESH_TOKEN_KEY = 'ssc_field_refresh_token';

export const tokenStore = {
  async getAccessToken() {
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken?: string) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  async clear() {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'X-Client-App': 'mobile',
  },
});

// Fired when the refresh token itself is invalid/expired — the app should
// drop back to the Login screen. Wired up by AuthContext.
type LogoutHandler = () => void;
let onSessionExpired: LogoutHandler | null = null;
export function setSessionExpiredHandler(handler: LogoutHandler) {
  onSessionExpired = handler;
}

api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};
  (config.headers as Record<string, string>)['X-Client-App'] = 'mobile';
  const token = await tokenStore.getAccessToken();
  if (token) {
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function flushQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry) {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        await tokenStore.clear();
        onSessionExpired?.();
        return Promise.reject(new ApiError(401, 'Session expired'));
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) {
              reject(new ApiError(401, 'Session expired'));
              return;
            }
            original._retry = true;
            original.headers = original.headers ?? {};
            (original.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        }, {
          headers: { 'X-Client-App': 'mobile' },
        });
        await tokenStore.setTokens(data.access_token, data.refresh_token);
        isRefreshing = false;
        flushQueue(data.access_token);

        original._retry = true;
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshErr) {
        isRefreshing = false;
        flushQueue(null);
        await tokenStore.clear();
        onSessionExpired?.();
        return Promise.reject(new ApiError(401, 'Session expired'));
      }
    }

    const status = error.response?.status ?? 0;
    const detail =
      (error.response?.data as { detail?: string } | undefined)?.detail ||
      error.message ||
      'Network error';
    return Promise.reject(new ApiError(status, detail, error.response?.data));
  }
);
