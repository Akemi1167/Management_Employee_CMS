import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { EmployeeSyncSession } from '@/types/api';

export function fetchEmployeeSyncSessions(limit = 20) {
  return apiGet<Array<Omit<EmployeeSyncSession, 'changes'>>>(API_ENDPOINTS.EMPLOYEE_SYNC, { limit });
}

export function fetchEmployeeSync(id: string) {
  return apiGet<EmployeeSyncSession>(`${API_ENDPOINTS.EMPLOYEE_SYNC}/${id}`);
}

export function previewEmployeeSync() {
  return apiPost<EmployeeSyncSession>(`${API_ENDPOINTS.EMPLOYEE_SYNC}/preview`);
}

export function applyEmployeeSync(id: string, confirmedChangeIds: string[], reason?: string) {
  return apiPost(`${API_ENDPOINTS.EMPLOYEE_SYNC}/${id}/apply`, { confirmedChangeIds, reason }, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}

export function discardEmployeeSync(id: string, reason: string) {
  return apiPost(`${API_ENDPOINTS.EMPLOYEE_SYNC}/${id}/discard`, { reason });
}
