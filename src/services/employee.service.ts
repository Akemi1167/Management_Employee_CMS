import { apiClient, apiGet, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { Employee, EmployeeFileImportResult, EmployeePortalAccount, Paginated } from '@/types/api';

export function fetchEmployees(params: Record<string, unknown>) {
  return apiGet<Paginated<Employee>>(API_ENDPOINTS.EMPLOYEES, params);
}

export function fetchEmployee(id: string) {
  return apiGet<Employee>(`${API_ENDPOINTS.EMPLOYEES}/${id}`);
}

export function provisionEmployeePortal(id: string, reason: string) {
  return apiPost<{ portalAccount: EmployeePortalAccount; temporaryPassword: string }>(
    `${API_ENDPOINTS.EMPLOYEES}/${id}/portal-account`,
    { reason },
  );
}

export function setEmployeePortalPassword(
  id: string,
  body: {
    newPassword: string;
    confirmPassword: string;
    mustChangePassword?: boolean;
    reason: string;
  },
) {
  return apiPost<{ portalAccount: EmployeePortalAccount; created: boolean }>(
    `${API_ENDPOINTS.EMPLOYEES}/${id}/portal-account/password`,
    body,
  );
}

export function resetEmployeePortalPassword(id: string, reason: string) {
  return apiPost<{ portalAccount: EmployeePortalAccount; temporaryPassword: string }>(
    `${API_ENDPOINTS.EMPLOYEES}/${id}/portal-account/password/reset`,
    { reason },
  );
}

export async function importEmployees(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<EmployeeFileImportResult>(
    `${API_ENDPOINTS.EMPLOYEES}/import`,
    form,
  );
  return data;
}
