import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { cardClass } from '@/constants/theme';
import { formatDay } from '@/lib/period';
import { fetchEmployee } from '@/services/employee.service';

export function EmployeeDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => fetchEmployee(id),
    enabled: Boolean(id),
  });

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={data?.fullName ?? t('employees.detail')}
        description={data?.employeeCode}
        actions={
          <Button variant="outline" asChild>
            <Link to="/employees">{t('common.back')}</Link>
          </Button>
        }
      />
      {isLoading || !data ? (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      ) : (
        <div className={`${cardClass} grid gap-4 p-5 sm:grid-cols-2`}>
          <Field label={t('employees.code')} value={data.employeeCode} />
          <Field label={t('employees.name')} value={data.fullName} />
          <Field label={t('employees.department')} value={data.departmentCode} />
          <Field label={t('employees.position')} value={data.position ?? '—'} />
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.status')}</p>
            <StatusBadge value={data.employmentStatus} ns="employment" />
          </div>
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">LARK</p>
            <StatusBadge value={data.larkSyncStatus} ns="larkStatus" />
          </div>
          <Field label={t('employees.hiredAt')} value={formatDay(data.hiredAt)} />
          <Field label={t('employees.terminatedAt')} value={formatDay(data.terminatedAt)} />
          <Field label={t('employees.wallet')} value={data.wallet.addressMasked || '—'} />
          <Field label={t('employees.walletPlatform')} value={data.wallet.platform || '—'} />
          <Field label={t('employees.walletNetwork')} value={data.wallet.network || '—'} />
        </div>
      )}
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-[#9aa3b5]">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
