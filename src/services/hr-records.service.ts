import { apiGet, apiPatch } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { AttendanceRecord, Paginated, PenaltyRecord, PayrollRecord } from '@/types/api';

export function fetchAttendance(params: Record<string, unknown>) {
  return apiGet<Paginated<AttendanceRecord>>(API_ENDPOINTS.ATTENDANCE, params);
}

export function fetchAttendanceRecord(id: string, source = 'staging') {
  return apiGet<AttendanceRecord>(`${API_ENDPOINTS.ATTENDANCE}/${id}`, { source });
}

export function patchAttendance(id: string, body: Record<string, unknown>) {
  return apiPatch(`${API_ENDPOINTS.ATTENDANCE}/${id}`, body);
}

export function fetchPenalties(params: Record<string, unknown>) {
  return apiGet<Paginated<PenaltyRecord>>(API_ENDPOINTS.PENALTIES, params);
}

export function fetchPenaltyRecord(id: string, source = 'staging') {
  return apiGet<PenaltyRecord>(`${API_ENDPOINTS.PENALTIES}/${id}`, { source });
}

export function patchPenalty(id: string, body: Record<string, unknown>) {
  return apiPatch(`${API_ENDPOINTS.PENALTIES}/${id}`, body);
}

export function fetchPayroll(params: Record<string, unknown>) {
  return apiGet<Paginated<PayrollRecord>>(API_ENDPOINTS.PAYROLL, params);
}

export function fetchPayrollRecord(id: string, source = 'staging') {
  return apiGet<PayrollRecord>(`${API_ENDPOINTS.PAYROLL}/${id}`, { source });
}

export function patchPayroll(id: string, body: Record<string, unknown>) {
  return apiPatch(`${API_ENDPOINTS.PAYROLL}/${id}`, body);
}
