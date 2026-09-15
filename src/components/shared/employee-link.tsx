import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PERMISSION } from '@/constants/api-endpoints';
import { useAuthStore } from '@/stores/auth-store';

export function EmployeeLink({
  id,
  code,
  className,
}: {
  id?: string | null;
  code?: string | null;
  className?: string;
}) {
  const canOpen = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_READ));
  const label = code || '—';

  if (!id || !canOpen) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      to={`/employees/${id}`}
      className={cn('text-[#4ade80] hover:underline', className)}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  );
}
