import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { AdminUser, Paginated } from '@/types/api';

export function fetchUsers(params: Record<string, unknown>) {
  return apiGet<Paginated<AdminUser>>(API_ENDPOINTS.USERS, params);
}

export function fetchUser(id: string) {
  return apiGet<AdminUser>(`${API_ENDPOINTS.USERS}/${id}`);
}

export function createUser(body: Record<string, unknown>) {
  return apiPost<{ user: AdminUser; temporaryPassword: string }>(API_ENDPOINTS.USERS, body);
}

export function updateUser(id: string, body: Record<string, unknown>) {
  return apiPatch<AdminUser>(`${API_ENDPOINTS.USERS}/${id}`, body);
}

export function disableUser(id: string, reason: string) {
  return apiPost(`${API_ENDPOINTS.USERS}/${id}/disable`, { reason });
}

export function enableUser(id: string, reason: string) {
  return apiPost(`${API_ENDPOINTS.USERS}/${id}/enable`, { reason });
}

export function resetUserPassword(id: string, reason: string) {
  return apiPost<{ user: AdminUser; temporaryPassword: string }>(
    `${API_ENDPOINTS.USERS}/${id}/password/reset`,
    { reason },
  );
}

export function disableUserMfa(id: string, reason: string) {
  return apiPost<AdminUser>(`${API_ENDPOINTS.USERS}/${id}/mfa/disable`, { reason });
}

export function enableUserMfa(id: string, reason: string) {
  return apiPost<AdminUser>(`${API_ENDPOINTS.USERS}/${id}/mfa/enable`, { reason });
}
