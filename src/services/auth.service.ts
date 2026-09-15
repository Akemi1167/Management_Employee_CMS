import { apiGet, apiPost, getApiErrorMessage } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AuthenticatedResult,
  AuthUser,
  LoginResult,
  MfaRequiredResult,
} from '@/types/api';

export function isMfaRequired(result: LoginResult): result is MfaRequiredResult {
  return result.status === 'MFA_REQUIRED';
}

export async function login(username: string, password: string) {
  return apiPost<LoginResult>(API_ENDPOINTS.AUTH.LOGIN, { username, password });
}

export async function verifyMfa(mfaToken: string, otp: string) {
  return apiPost<AuthenticatedResult>(API_ENDPOINTS.AUTH.MFA_VERIFY, { mfaToken, otp });
}

export async function fetchMe() {
  return apiGet<AuthUser>(API_ENDPOINTS.AUTH.ME);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  return apiPost<AuthenticatedResult>(API_ENDPOINTS.AUTH.PASSWORD_CHANGE, {
    currentPassword,
    newPassword,
    confirmPassword,
  });
}

export async function requestStepUp(action: string) {
  return apiPost<{ challengeId: string; expiresAt: string }>(API_ENDPOINTS.AUTH.STEP_UP_REQUEST, {
    action,
  });
}

export async function verifyStepUp(challengeId: string, otp: string, action: string) {
  await apiPost<void>(API_ENDPOINTS.AUTH.STEP_UP_VERIFY, { challengeId, otp, action });
}

export async function completeLogin(result: AuthenticatedResult) {
  useAuthStore.getState().setTokens(result.accessToken, result.refreshToken);
  const user = await fetchMe();
  useAuthStore.getState().setUser(user);
  return user;
}

export async function logout() {
  try {
    await apiPost<void>(API_ENDPOINTS.AUTH.LOGOUT);
  } catch (error) {
    console.warn(getApiErrorMessage(error));
  } finally {
    useAuthStore.getState().clearAuth();
  }
}
