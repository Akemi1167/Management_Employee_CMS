import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, ClipboardList, FileUp, ShieldCheck, Users } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { cardClass, textBody, textTitle } from '@/constants/theme';
import { API_MODULES } from '@/constants/navigation';
import { PERMISSION } from '@/constants/api-endpoints';
import { fetchImports } from '@/services/import.service';
import { fetchPendingApprovals } from '@/services/workflow.service';
import { fetchComplaints } from '@/services/complaint.service';
import { fetchEmployees } from '@/services/employee.service';
import { useAuthStore } from '@/stores/auth-store';

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="mb-3 flex items-center gap-2 text-[#4ade80]">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b8bfd0]">{title}</p>
      </div>
      <p className={`text-2xl font-bold ${textTitle}`}>{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const has = useAuthStore((s) => s.hasPermission);
  const hasAny = useAuthStore((s) => s.hasAnyPermission);
  const roles = useAuthStore((s) => s.user?.roles ?? []);

  const imports = useQuery({
    queryKey: ['dashboard-imports'],
    queryFn: () => fetchImports({ limit: 20 }),
    enabled: has(PERMISSION.IMPORT_READ),
  });
  const approvals = useQuery({
    queryKey: ['dashboard-approvals'],
    queryFn: () => fetchPendingApprovals({ limit: 20 }),
    enabled: has(PERMISSION.DATA_APPROVE),
  });
  const complaints = useQuery({
    queryKey: ['dashboard-complaints'],
    queryFn: () => fetchComplaints({ page: 1, pageSize: 1, status: 'NEW' }),
    enabled: has(PERMISSION.COMPLAINT_READ),
  });
  const employees = useQuery({
    queryKey: ['dashboard-employees'],
    queryFn: () => fetchEmployees({ page: 1, pageSize: 1 }),
    enabled: has(PERMISSION.EMPLOYEE_READ),
  });

  return (
    <PageContainer>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      {roles.includes('system_admin') && !has(PERMISSION.IMPORT_CREATE) ? (
        <div className={`${cardClass} mb-6 p-4 text-sm ${textBody}`}>
          {t('dashboard.adminHint')}
        </div>
      ) : null}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className={`${cardClass} p-4 text-sm ${textBody}`}>{t('dashboard.attendanceDeadline')}</div>
        <div className={`${cardClass} p-4 text-sm ${textBody}`}>{t('dashboard.payrollDeadline')}</div>
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {has(PERMISSION.IMPORT_READ) ? (
          <StatCard title={t('dashboard.imports')} value={imports.data?.total ?? '—'} icon={FileUp} />
        ) : null}
        {has(PERMISSION.DATA_APPROVE) ? (
          <StatCard title={t('dashboard.approvals')} value={approvals.data?.total ?? '—'} icon={ShieldCheck} />
        ) : null}
        {has(PERMISSION.COMPLAINT_READ) ? (
          <StatCard title={t('dashboard.complaints')} value={complaints.data?.total ?? '—'} icon={ClipboardList} />
        ) : null}
        {has(PERMISSION.EMPLOYEE_READ) ? (
          <StatCard title={t('dashboard.employees')} value={employees.data?.total ?? '—'} icon={Users} />
        ) : null}
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/imports/create">{t('dashboard.quickImport')}</Link>
        </Button>
        {has(PERMISSION.DATA_APPROVE) ? (
          <Button variant="outline" asChild>
            <Link to="/approvals">{t('dashboard.quickApprovals')}</Link>
          </Button>
        ) : null}
        {has(PERMISSION.COMPLAINT_READ) ? (
          <Button variant="outline" asChild>
            <Link to="/complaints">{t('dashboard.quickComplaints')}</Link>
          </Button>
        ) : null}
        {has(PERMISSION.ATTENDANCE_READ) ? (
          <Button variant="ghost" asChild>
            <Link to="/attendance">
              <CalendarCheck className="h-4 w-4" />
              {t('nav.attendance')}
            </Link>
          </Button>
        ) : null}
      </div>
      <h2 className={`mb-3 text-sm font-semibold ${textTitle}`}>{t('dashboard.apiCatalog')}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {API_MODULES.map((module) => {
          const allowed =
            module.status === 'planned'
              ? false
              : !module.permission && !module.permissions
                ? true
                : module.permission
                  ? has(module.permission)
                  : hasAny(module.permissions ?? []);
          const body = (
            <div className={`${cardClass} h-full p-4 ${allowed ? '' : 'opacity-70'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#eef0f6]">{t(module.labelKey)}</p>
                <StatusBadge
                  value={module.status === 'live' ? (allowed ? 'AVAILABLE' : 'NEED_ROLE') : 'NOT_MOUNTED'}
                  ns="moduleStatus"
                />
              </div>
              <p className={`text-xs ${textBody}`}>{t(module.rolesKey)}</p>
            </div>
          );
          if (allowed && module.to) {
            return (
              <Link key={module.id} to={module.to} className="block hover:brightness-110">
                {body}
              </Link>
            );
          }
          return <div key={module.id}>{body}</div>;
        })}
      </div>
    </PageContainer>
  );
}
