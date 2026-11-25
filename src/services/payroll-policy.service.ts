import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type {
  PayrollPolicy,
  PayrollPolicyItem,
  PayrollPolicyResolve,
} from '@/types/api';

export function fetchPayrollPolicies() {
  return apiGet<{ items: PayrollPolicy[] }>(API_ENDPOINTS.PAYROLL_POLICIES);
}

export function fetchPayrollPolicy(id: string) {
  return apiGet<PayrollPolicy>(`${API_ENDPOINTS.PAYROLL_POLICIES}/${id}`);
}

export function resolvePayrollPolicy(params: { employeeId?: string; departmentCode?: string }) {
  return apiGet<PayrollPolicyResolve>(`${API_ENDPOINTS.PAYROLL_POLICIES}/resolve`, params);
}

export function createPayrollPolicy(body: {
  code: string;
  name: string;
  cutoffDay?: number;
  workHoursPerDay?: number;
  fx?: { source?: string; payoutDay?: number };
  departmentCodes?: string[];
  items?: PayrollPolicyItem[];
}) {
  return apiPost<PayrollPolicy>(API_ENDPOINTS.PAYROLL_POLICIES, body);
}

export function updatePayrollPolicy(
  id: string,
  body: {
    name?: string;
    enabled?: boolean;
    cutoffDay?: number;
    workHoursPerDay?: number;
    fx?: { source?: string; payoutDay?: number };
    departmentCodes?: string[];
    items?: PayrollPolicyItem[];
  },
) {
  return apiPatch<PayrollPolicy>(`${API_ENDPOINTS.PAYROLL_POLICIES}/${id}`, body);
}

export function deletePayrollPolicy(id: string) {
  return apiDelete<{ id: string; code: string }>(`${API_ENDPOINTS.PAYROLL_POLICIES}/${id}`);
}
