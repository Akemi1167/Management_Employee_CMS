import { apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { DataPeriod, Listed, PendingApproval } from '@/types/api';

export function fetchPendingApprovals(params: Record<string, unknown>) {
  return apiGet<Listed<PendingApproval>>(API_ENDPOINTS.APPROVALS, params);
}

export function approveSession(
  id: string,
  body: { reason?: string; expectedRecordCount?: number; expectedTotalAmount?: string },
) {
  return apiPost(`${API_ENDPOINTS.APPROVALS}/${id}/approve`, body, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}

export function rejectSession(id: string, reason: string) {
  return apiPost(`${API_ENDPOINTS.APPROVALS}/${id}/reject`, { reason }, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}

export function fetchPeriods(params: Record<string, unknown>) {
  return apiGet<Listed<DataPeriod>>(`${API_ENDPOINTS.PUBLISHING}/periods`, params);
}

export function publishSession(id: string, body: { reason?: string; expectedRecordCount?: number }) {
  return apiPost(`${API_ENDPOINTS.PUBLISHING}/${id}/publish`, body, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}

export function lockPeriod(id: string, reason: string) {
  return apiPost(`${API_ENDPOINTS.PUBLISHING}/${id}/lock`, { reason }, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}
