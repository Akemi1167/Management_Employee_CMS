export const COMPLAINT_TRANSITIONS: Record<string, string[]> = {
  NEW: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['WAITING_INFO', 'ADJUSTED', 'REJECTED'],
  WAITING_INFO: ['IN_PROGRESS', 'REJECTED'],
  ADJUSTED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

export function nextComplaintStatuses(current: string) {
  return COMPLAINT_TRANSITIONS[current] ?? [];
}

export function isPeriodLocked(item: { lockedAt?: string | null; status?: string } | null | undefined) {
  if (!item) return false;
  return Boolean(item.lockedAt) || item.status === 'LOCKED';
}
