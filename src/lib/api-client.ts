import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiErrorBody, AuthenticatedResult } from '@/types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

function isPublicAuthRequest(url = '') {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/mfa/verify') ||
    url.includes('/auth/refresh')
  );
}

export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi khi xử lý yêu cầu') {
  const axiosErr = error as AxiosError<ApiErrorBody>;
  const message = axiosErr.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    if (parts.length > 0) return parts.join('; ');
  }
  if (axiosErr.message) return axiosErr.message;
  return fallback;
}

export function isUnknownDtoFieldError(error: unknown, field: string) {
  return new RegExp(`property ${field}|${field}.*should not exist`, 'i').test(getApiErrorMessage(error));
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  const { data } = await axios.post<AuthenticatedResult>(
    `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
    { refreshToken },
  );

  if (data.status !== 'AUTHENTICATED') return null;
  useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (status === 401 && !isPublicAuthRequest(requestUrl) && original && !original._retry) {
      original._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const nextToken = await refreshPromise;
        if (nextToken) {
          original.headers.Authorization = `Bearer ${nextToken}`;
          return apiClient(original);
        }
      } catch {
        /* fall through */
      }
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if ((status ?? 0) >= 500 && error.response?.data?.message) {
      toast.error(error.response.data.message);
    }

    return Promise.reject(error);
  },
);

export async function apiGet<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await apiClient.get<T>(url, { params });
  return data;
}

export async function apiPost<T>(url: string, body?: unknown, headers?: Record<string, string>) {
  const { data } = await apiClient.post<T>(url, body, { headers });
  return data;
}

export async function apiPatch<T>(url: string, body?: unknown, headers?: Record<string, string>) {
  const { data } = await apiClient.patch<T>(url, body, { headers });
  return data;
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function moneyText(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') {
    const record = value as { $numberDecimal?: string; toString?: () => string };
    if (record.$numberDecimal) return record.$numberDecimal;
  }
  return String(value);
}

export function changeId(change: { _id?: unknown; id?: unknown }) {
  const raw = change._id ?? change.id;
  if (typeof raw === 'string' && raw) return raw;
  if (raw && typeof raw === 'object') {
    const record = raw as { $oid?: string; toHexString?: () => string };
    if (record.$oid) return record.$oid;
    if (typeof record.toHexString === 'function') return record.toHexString();
  }
  return '';
}
