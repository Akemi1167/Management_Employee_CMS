import { apiGet } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { PeriodOverview } from '@/types/api';

export function fetchPeriodOverview(params: Record<string, unknown>) {
  return apiGet<PeriodOverview>(`${API_ENDPOINTS.REPORTS}/period-overview`, params);
}
