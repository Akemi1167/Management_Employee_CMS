import { apiGet, apiPatch } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { Complaint, Paginated } from '@/types/api';

export function fetchComplaints(params: Record<string, unknown>) {
  return apiGet<Paginated<Complaint>>(API_ENDPOINTS.COMPLAINTS, params);
}

export function fetchComplaint(id: string) {
  return apiGet<Complaint>(`${API_ENDPOINTS.COMPLAINTS}/${id}`);
}

export function updateComplaint(id: string, body: Record<string, unknown>) {
  return apiPatch<Complaint>(`${API_ENDPOINTS.COMPLAINTS}/${id}`, body);
}
