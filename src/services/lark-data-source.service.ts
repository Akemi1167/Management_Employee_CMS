import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type {
  LarkDataSource,
  LarkDataSourceList,
  LarkDataSourceUpsert,
  LarkInspectResult,
  LarkPreviewResult,
} from '@/types/api';

export function fetchLarkDataSources() {
  return apiGet<LarkDataSourceList>(API_ENDPOINTS.LARK_DATA_SOURCES);
}

export function inspectLarkDataSource(body: {
  kind?: LarkDataSourceUpsert['kind'];
  sourceUrl?: string;
  appToken?: string;
  tableId?: string;
  spreadsheetToken?: string;
}) {
  return apiPost<LarkInspectResult>(`${API_ENDPOINTS.LARK_DATA_SOURCES}/inspect`, body);
}

export function createLarkDataSource(body: LarkDataSourceUpsert) {
  return apiPost<LarkDataSource>(API_ENDPOINTS.LARK_DATA_SOURCES, body);
}

export function updateLarkDataSource(id: string, body: Partial<LarkDataSourceUpsert>) {
  return apiPatch<LarkDataSource>(`${API_ENDPOINTS.LARK_DATA_SOURCES}/${id}`, body);
}

export function deleteLarkDataSource(id: string) {
  return apiDelete(`${API_ENDPOINTS.LARK_DATA_SOURCES}/${id}`);
}

export function testLarkDataSource(id: string) {
  return apiPost<{ ok: boolean; message: string; preview: LarkPreviewResult }>(
    `${API_ENDPOINTS.LARK_DATA_SOURCES}/${id}/test`,
  );
}

export function previewLarkDataSource(id: string) {
  return apiGet<LarkPreviewResult>(`${API_ENDPOINTS.LARK_DATA_SOURCES}/${id}/preview`);
}
