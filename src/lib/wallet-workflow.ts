export const WALLET_REQUEST_STATUSES = [
  'PENDING_VERIFICATION',
  'PENDING_APPROVAL',
  'PENDING_EXCEPTION_APPROVAL',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED',
] as const;

export function hasAssignedWallet(wallet: { addressMasked?: string | null } | null | undefined) {
  return Boolean(wallet?.addressMasked);
}

export function isSameVerifier(userId: string | undefined, hrVerifiedBy: string | null | undefined) {
  return Boolean(userId && hrVerifiedBy && userId === hrVerifiedBy);
}

export function walletNextStep(row: {
  status: string;
  employeeConsentedAt?: string | null;
  requiresException?: boolean;
}) {
  if (row.status === 'PENDING_VERIFICATION') return 'verify';
  if (row.status === 'PENDING_EXCEPTION_APPROVAL' || row.requiresException) return 'exception';
  if (row.status === 'PENDING_APPROVAL' && !row.employeeConsentedAt) return 'consent';
  if (row.status === 'PENDING_APPROVAL') return 'approve';
  return 'done';
}
