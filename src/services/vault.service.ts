import { apiGet, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { ControlledDecryptRequest, Paginated, VaultRecoveryRequest } from '@/types/api';

export function fetchVaultRecoveries(params: Record<string, unknown>) {
  return apiGet<Paginated<VaultRecoveryRequest>>(API_ENDPOINTS.VAULT_RECOVERY, params);
}

export function fetchVaultRecovery(id: string) {
  return apiGet<VaultRecoveryRequest>(`${API_ENDPOINTS.VAULT_RECOVERY}/${id}`);
}

export function createVaultRecovery(body: Record<string, unknown>) {
  return apiPost<VaultRecoveryRequest>(API_ENDPOINTS.VAULT_RECOVERY, body);
}

export function approveVaultRecovery(id: string, reason: string) {
  return apiPost<VaultRecoveryRequest>(`${API_ENDPOINTS.VAULT_RECOVERY}/${id}/approve`, { reason });
}

export function rejectVaultRecovery(id: string, reason: string) {
  return apiPost<VaultRecoveryRequest>(`${API_ENDPOINTS.VAULT_RECOVERY}/${id}/reject`, { reason });
}

export function fetchDecryptRequests(params: Record<string, unknown>) {
  return apiGet<Paginated<ControlledDecryptRequest>>(API_ENDPOINTS.CONTROLLED_DECRYPT, params);
}

export function fetchDecryptRequest(id: string) {
  return apiGet<ControlledDecryptRequest>(`${API_ENDPOINTS.CONTROLLED_DECRYPT}/${id}`);
}

export function createDecryptRequest(body: Record<string, unknown>) {
  return apiPost<ControlledDecryptRequest>(API_ENDPOINTS.CONTROLLED_DECRYPT, body);
}

export function approveDecryptRequest(id: string, reason: string) {
  return apiPost<ControlledDecryptRequest>(`${API_ENDPOINTS.CONTROLLED_DECRYPT}/${id}/approve`, {
    reason,
  });
}

export function rejectDecryptRequest(id: string, reason: string) {
  return apiPost<ControlledDecryptRequest>(`${API_ENDPOINTS.CONTROLLED_DECRYPT}/${id}/reject`, {
    reason,
  });
}
