import { apiClient, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import type { Employee, EmployeeFileImportResult, EmployeePortalAccount, Paginated } from '@/types/api';

export const WALLET_PLATFORMS = ['BINANCE', 'OTHER'] as const;
export const WALLET_NETWORKS = ['BEP20', 'TRC20', 'ERC20', 'OTHER'] as const;
export const WALLET_IMAGE_MAX_BYTES = 5_242_880;
export const WALLET_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export type WalletPlatform = (typeof WALLET_PLATFORMS)[number];
export type WalletNetwork = (typeof WALLET_NETWORKS)[number];

export function fetchEmployees(params: Record<string, unknown>) {
  return apiGet<Paginated<Employee>>(API_ENDPOINTS.EMPLOYEES, params);
}

export function fetchEmployee(id: string) {
  return apiGet<Employee>(`${API_ENDPOINTS.EMPLOYEES}/${id}`);
}

export function deleteEmployee(id: string, reason: string) {
  return apiPost<{ id: string; employeeCode: string }>(
    `${API_ENDPOINTS.EMPLOYEES}/${id}/delete`,
    { reason },
  );
}

export function updateEmployee(
  id: string,
  body: {
    fullName?: string;
    workEmail?: string | null;
    departmentCode?: string;
    position?: string | null;
    hiredAt?: string;
    employmentStatus?: string;
    terminatedAt?: string | null;
    reason: string;
  },
) {
  return apiPatch<Employee>(`${API_ENDPOINTS.EMPLOYEES}/${id}`, body);
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

export function setEmployeeWallet(
  id: string,
  input: {
    address: string;
    platform: WalletPlatform;
    network: WalletNetwork;
    ownerName?: string;
    reason: string;
    image: File;
  },
) {
  const form = new FormData();
  form.append('address', input.address);
  form.append('platform', input.platform);
  form.append('network', input.network);
  if (input.ownerName?.trim()) form.append('ownerName', input.ownerName.trim());
  form.append('reason', input.reason);
  form.append('image', input.image);
  return apiPost<{
    id: string;
    employeeCode: string;
    wallet: Employee['wallet'];
  }>(`${API_ENDPOINTS.EMPLOYEES}/${id}/wallet`, form);
}

export async function fetchEmployeeWalletImage(id: string) {
  const { data } = await apiClient.get<Blob>(`${API_ENDPOINTS.EMPLOYEES}/${id}/wallet/image`, {
    responseType: 'blob',
  });
  if (data.type.includes('application/json')) {
    throw new Error('Khong tai duoc anh vi');
  }
  return data;
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
