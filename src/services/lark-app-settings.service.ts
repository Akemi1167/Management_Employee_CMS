import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type {
  LarkAppSettings,
  LarkAppSettingsTestResult,
  LarkAppSettingsUpdate,
} from '@/types/api';

export function fetchLarkAppSettings() {
  return apiGet<LarkAppSettings>(API_ENDPOINTS.LARK_APP_SETTINGS);
}

export function updateLarkAppSettings(body: LarkAppSettingsUpdate) {
  return apiPut<LarkAppSettings>(API_ENDPOINTS.LARK_APP_SETTINGS, body);
}

export function testLarkAppSettings() {
  return apiPost<LarkAppSettingsTestResult>(`${API_ENDPOINTS.LARK_APP_SETTINGS}/test`);
}
