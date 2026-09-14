import { apiClient, apiGet, apiPost, newIdempotencyKey } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { DataType, ImportRowError, ImportSessionDetail, ImportSessionListItem, Listed, Paginated } from '@/types/api';

export function fetchImports(params: Record<string, unknown>) {
  return apiGet<Listed<ImportSessionListItem>>(API_ENDPOINTS.IMPORTS, params);
}

export function fetchImport(id: string) {
  return apiGet<ImportSessionDetail>(`${API_ENDPOINTS.IMPORTS}/${id}`);
}

export function fetchImportErrors(id: string, params: Record<string, unknown>) {
  return apiGet<Paginated<ImportRowError>>(`${API_ENDPOINTS.IMPORTS}/${id}/errors`, params);
}

export async function createImport(input: {
  dataType: DataType;
  period: string;
  templateVersion: string;
  file: File;
}) {
  const form = new FormData();
  form.append('dataType', input.dataType);
  form.append('period', input.period);
  form.append('templateVersion', input.templateVersion);
  form.append('file', input.file);
  const { data } = await apiClient.post(`${API_ENDPOINTS.IMPORTS}`, form, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  return data as { id: string; code: string; status: string; file?: { sha256?: string } };
}

export function validateImport(id: string) {
  return apiPost(`${API_ENDPOINTS.IMPORTS}/${id}/validate`, {}, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}

export function submitImport(id: string) {
  return apiPost(`${API_ENDPOINTS.IMPORTS}/${id}/submit`, {}, {
    'Idempotency-Key': newIdempotencyKey(),
  });
}
