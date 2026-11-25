import { apiClient, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type {
  LarkPayItemSyncResult,
  Paginated,
  PayItem,
  PayItemImportResult,
  PayItemLarkSyncRun,
  PayItemLarkSyncRunDetail,
  PayItemReconcile,
  PayItemType,
  PayItemUnit,
  PayrollComponentCode,
  PayrollComponentKind,
} from '@/types/api';

export function fetchPayItemTypes() {
  return apiGet<{ items: PayItemType[] }>(`${API_ENDPOINTS.PAY_ITEMS}/types`);
}

export function createPayItemType(body: {
  code: string;
  kind: PayrollComponentKind;
  label: string;
  mapsToPayrollComponent: PayrollComponentCode;
  unit?: PayItemUnit;
}) {
  return apiPost<PayItemType>(`${API_ENDPOINTS.PAY_ITEMS}/types`, body);
}

export function updatePayItemType(
  id: string,
  body: {
    kind?: PayrollComponentKind;
    label?: string;
    mapsToPayrollComponent?: PayrollComponentCode;
    unit?: PayItemUnit;
    enabled?: boolean;
  },
) {
  return apiPatch<PayItemType>(`${API_ENDPOINTS.PAY_ITEMS}/types/${id}`, body);
}

export function fetchPayItems(params: Record<string, unknown>) {
  return apiGet<Paginated<PayItem>>(API_ENDPOINTS.PAY_ITEMS, params);
}

export function createPayItem(body: {
  employeeCode: string;
  occurredOn: string;
  period?: string;
  payItemTypeCode: string;
  hours?: string;
  amount?: string;
  reason?: string | null;
}) {
  return apiPost<PayItem>(API_ENDPOINTS.PAY_ITEMS, body);
}

export function updatePayItem(
  id: string,
  body: {
    occurredOn?: string;
    payItemTypeCode?: string;
    hours?: string | null;
    amount?: string | null;
    reason?: string | null;
    changeReason: string;
  },
) {
  return apiPatch<PayItem>(`${API_ENDPOINTS.PAY_ITEMS}/${id}`, body);
}

export function submitPayItem(id: string) {
  return apiPost<PayItem>(`${API_ENDPOINTS.PAY_ITEMS}/${id}/submit`, {});
}

export function approvePayItem(id: string, reason?: string | null) {
  return apiPost<PayItem>(`${API_ENDPOINTS.PAY_ITEMS}/${id}/approve`, { reason: reason ?? null });
}

export function rejectPayItem(id: string, reason: string) {
  return apiPost<PayItem>(`${API_ENDPOINTS.PAY_ITEMS}/${id}/reject`, { reason });
}

export async function importPayItems(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<PayItemImportResult>(`${API_ENDPOINTS.PAY_ITEMS}/import`, form);
  return data;
}

export async function syncLarkPayItems(sourceId?: string) {
  // Doc Base co the cham — timeout rieng, khong dung mac dinh 60s.
  const { data } = await apiClient.post<LarkPayItemSyncResult>(
    `${API_ENDPOINTS.PAY_ITEMS}/lark-sync`,
    sourceId ? { sourceId } : {},
    { timeout: 180_000 },
  );
  return data;
}

export function fetchLarkPayItemSyncRuns(limit = 30) {
  return apiGet<{ items: PayItemLarkSyncRun[] }>(`${API_ENDPOINTS.PAY_ITEMS}/lark-sync-runs`, {
    limit,
  });
}

export function fetchLarkPayItemSyncRun(
  id: string,
  params?: { outcome?: string; employeeCode?: string; page?: number; pageSize?: number },
) {
  return apiGet<PayItemLarkSyncRunDetail>(`${API_ENDPOINTS.PAY_ITEMS}/lark-sync-runs/${id}`, params);
}

export function fetchPayItemReconcile(period: string) {
  return apiGet<PayItemReconcile>(`${API_ENDPOINTS.PAY_ITEMS}/reconcile`, { period });
}
