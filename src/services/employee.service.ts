import { apiClient, apiGet } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { Employee, EmployeeFileImportResult, Paginated } from '@/types/api';

export function fetchEmployees(params: Record<string, unknown>) {
  return apiGet<Paginated<Employee>>(API_ENDPOINTS.EMPLOYEES, params);
}

export function fetchEmployee(id: string) {
  return apiGet<Employee>(`${API_ENDPOINTS.EMPLOYEES}/${id}`);
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
