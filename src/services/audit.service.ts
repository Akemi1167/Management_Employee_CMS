import { apiGet } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { AuditEvent, Paginated } from '@/types/api';

export function fetchAuditEvents(params: Record<string, unknown>) {
  return apiGet<Paginated<AuditEvent>>(API_ENDPOINTS.AUDIT, params);
}
