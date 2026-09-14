import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

const SUCCESS = new Set(['APPROVED', 'PUBLISHED', 'LOCKED', 'VALIDATED', 'ACTIVE', 'SYNCED', 'SUCCESS', 'CLOSED', 'ADJUSTED', 'AVAILABLE', 'APPLIED', 'COMPLETED']);
const WARNING = new Set(['PENDING_APPROVAL', 'PENDING_VERIFICATION', 'PENDING_EXCEPTION_APPROVAL', 'UPLOADED', 'WAITING_INFO', 'IN_PROGRESS', 'WARNING', 'ON_LEAVE', 'NEED_ROLE', 'REQUESTED']);
const DANGER = new Set(['REJECTED', 'ERROR', 'DISABLED', 'LOCKED', 'TERMINATED', 'CONFLICT', 'MISSING_IN_LARK', 'FAILURE', 'CANCELLED', 'NOT_MOUNTED', 'EXPIRED']);

export function StatusBadge({ value, ns }: { value?: string | null; ns?: string }) {
  const { t } = useTranslation();
  if (!value) return <span className="text-[#9aa3b5]">—</span>;

  const variant = SUCCESS.has(value)
    ? 'success'
    : DANGER.has(value)
      ? 'destructive'
      : WARNING.has(value)
        ? 'upcoming'
        : 'secondary';

  const label = ns ? t(`${ns}.${value}`, { defaultValue: value }) : value;
  return <Badge variant={variant}>{label}</Badge>;
}
