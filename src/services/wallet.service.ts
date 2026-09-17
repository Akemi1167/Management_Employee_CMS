import { apiClient, apiGet, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { Paginated, WalletChangeRequest, WalletLockWindow } from '@/types/api';

export function fetchWalletRequests(params: Record<string, unknown>) {
  return apiGet<Paginated<WalletChangeRequest>>(API_ENDPOINTS.WALLET_CHANGE_REQUESTS, params);
}

export function fetchWalletRequest(id: string) {
  return apiGet<WalletChangeRequest>(`${API_ENDPOINTS.WALLET_CHANGE_REQUESTS}/${id}`);
}

export async function fetchWalletRequestImage(id: string) {
  const { data } = await apiClient.get<Blob>(`${API_ENDPOINTS.WALLET_CHANGE_REQUESTS}/${id}/image`, {
    responseType: 'blob',
  });
  if (data.type.includes('application/json')) {
    throw new Error('Khong tai duoc anh vi');
  }
  return data;
}

export function verifyWalletRequest(id: string, reason: string) {
  return apiPost<WalletChangeRequest>(`${API_ENDPOINTS.WALLET_CHANGE_REQUESTS}/${id}/verify`, {
    reason,
  });
}

export function approveWalletRequest(id: string, reason: string) {
  return apiPost<WalletChangeRequest>(`${API_ENDPOINTS.WALLET_CHANGE_REQUESTS}/${id}/approve`, {
    reason,
  });
}

export function approveWalletException(id: string, reason: string) {
  return apiPost<WalletChangeRequest>(
    `${API_ENDPOINTS.WALLET_CHANGE_REQUESTS}/${id}/approve-exception`,
    { reason },
  );
}

export function rejectWalletRequest(id: string, reason: string) {
  return apiPost<WalletChangeRequest>(`${API_ENDPOINTS.WALLET_CHANGE_REQUESTS}/${id}/reject`, {
    reason,
  });
}

export function fetchWalletLockWindows() {
  return apiGet<{ total: number; items: WalletLockWindow[] }>(API_ENDPOINTS.WALLET_LOCK_WINDOWS);
}

export function upsertWalletLockWindow(body: Record<string, unknown>) {
  return apiPost<WalletLockWindow>(API_ENDPOINTS.WALLET_LOCK_WINDOWS, body);
}
