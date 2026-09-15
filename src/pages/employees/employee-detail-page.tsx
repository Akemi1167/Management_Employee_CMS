import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarCheck, ClipboardList, CreditCard, KeyRound, Wallet } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass, textSubtle } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { formatDate, formatDay } from '@/lib/period';
import {
  fetchEmployee,
  provisionEmployeePortal,
  resetEmployeePortalPassword,
  setEmployeePortalPassword,
} from '@/services/employee.service';
import { fetchAttendance, fetchPayroll, fetchPenalties } from '@/services/hr-records.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AttendanceRecord,
  EmployeePortalAccount,
  Paginated,
  PayrollRecord,
  PenaltyRecord,
} from '@/types/api';

const PAGE_SIZE = 12;

function mergeByPeriod<T extends { id: string; period: string; source: string }>(
  staging: T[] | undefined,
  published: T[] | undefined,
): T[] {
  return [...(staging ?? []), ...(published ?? [])].sort((a, b) => {
    const periodCmp = b.period.localeCompare(a.period);
    if (periodCmp !== 0) return periodCmp;
    if (a.source !== b.source) return a.source === 'published' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function useEmployeeHrRecords<T extends { id: string; period: string; source: string }>(
  key: string,
  fetcher: (params: Record<string, unknown>) => Promise<Paginated<T>>,
  employeeId: string,
  period: string,
) {
  const base = {
    employeeId: employeeId || undefined,
    period: period || undefined,
    page: 1,
    pageSize: PAGE_SIZE,
  };
  const staging = useQuery({
    queryKey: [key, 'staging', employeeId, period],
    queryFn: () => fetcher({ ...base, source: 'staging' }),
    enabled: Boolean(employeeId),
  });
  const published = useQuery({
    queryKey: [key, 'published', employeeId, period],
    queryFn: () => fetcher({ ...base, source: 'published' }),
    enabled: Boolean(employeeId),
  });
  return {
    items: mergeByPeriod(staging.data?.items, published.data?.items),
    isLoading: staging.isLoading || published.isLoading,
    total: (staging.data?.total ?? 0) + (published.data?.total ?? 0),
  };
}

export function EmployeeDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') ?? '';
  const has = useAuthStore((s) => s.hasPermission);

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => fetchEmployee(id),
    enabled: Boolean(id),
  });

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  };

  const listTo = (path: string) =>
    `${path}?source=staging&employeeId=${id}${period ? `&period=${period}` : ''}`;

  return (
    <PageContainer>
      <PageHeader
        title={data?.fullName ?? t('employees.detail')}
        description={data?.employeeCode}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="#portal-account">
                <KeyRound className="h-4 w-4" />
                {t('employees.setPortalPassword')}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/employees">{t('common.back')}</Link>
            </Button>
          </div>
        }
      />
      {isLoading || !data ? (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      ) : (
        <>
          <div className={`${cardClass} mb-4 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3`}>
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

          <PortalAccountCard employeeId={id} account={data.portalAccount ?? null} />

          <div className={`${cardClass} mb-4 p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-[140px]"
                value={period}
                onChange={(e) => update({ period: e.target.value })}
                placeholder="YYYY-MM"
              />
              {has(PERMISSION.COMPLAINT_READ) ? (
                <Button variant="outline" asChild>
                  <Link to={`/complaints?employeeCode=${encodeURIComponent(data.employeeCode)}`}>
                    <ClipboardList className="h-4 w-4" />
                    {t('employees.viewComplaints')}
                  </Link>
                </Button>
              ) : null}
              {has(PERMISSION.WALLET_READ) ? (
                <Button variant="outline" asChild>
                  <Link to={`/wallet?employeeCode=${encodeURIComponent(data.employeeCode)}`}>
                    <CreditCard className="h-4 w-4" />
                    {t('employees.viewWallet')}
                  </Link>
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-[#9aa3b5]">{t('source.hint')}</p>
          </div>

          {has(PERMISSION.ATTENDANCE_READ) ? (
            <EmployeeAttendancePanel employeeId={id} period={period} openTo={listTo('/attendance')} />
          ) : null}
          {has(PERMISSION.PENALTY_READ) ? (
            <EmployeePenaltyPanel employeeId={id} period={period} openTo={listTo('/penalties')} />
          ) : null}
          {has(PERMISSION.PAYROLL_READ) ? (
            <EmployeePayrollPanel employeeId={id} period={period} openTo={listTo('/payroll')} />
          ) : null}
        </>
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

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

function PortalAccountCard({
  employeeId,
  account,
}: {
  employeeId: string;
  account: EmployeePortalAccount | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [mustChangeOnLogin, setMustChangeOnLogin] = useState(true);
  const [tempPassword, setTempPassword] = useState('');
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  useEffect(() => {
    if (window.location.hash === '#portal-account') {
      document.getElementById('portal-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
  };

  const passwordsMatch = newPassword === confirmPassword;
  const canSetPassword =
    canWrite &&
    newPassword.length >= 12 &&
    passwordsMatch &&
    reason.trim().length >= 10;

  const provision = useMutation({
    mutationFn: () => provisionEmployeePortal(employeeId, reason),
    onSuccess: (result) => {
      setTempPassword(result.temporaryPassword);
      setReason('');
      toast.success(t('employees.portalProvisioned'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:portal:${employeeId}`, retry: () => provision.mutate() }),
      ),
  });

  const resetPassword = useMutation({
    mutationFn: () => resetEmployeePortalPassword(employeeId, reason),
    onSuccess: (result) => {
      setTempPassword(result.temporaryPassword);
      setReason('');
      toast.success(t('employees.portalPasswordReset'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:portal:${employeeId}`, retry: () => resetPassword.mutate() }),
      ),
  });

  const setPassword = useMutation({
    mutationFn: () =>
      setEmployeePortalPassword(employeeId, {
        newPassword,
        confirmPassword,
        mustChangePassword: mustChangeOnLogin,
        reason: reason.trim(),
      }),
    onSuccess: (result) => {
      setNewPassword('');
      setConfirmPassword('');
      setReason('');
      toast.success(result.created ? t('employees.portalPasswordCreated') : t('employees.portalPasswordSet'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:portal:${employeeId}`, retry: () => setPassword.mutate() }),
      ),
  });

  return (
    <div id="portal-account" className={`${cardClass} mb-4 scroll-mt-4 p-5`}>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#eef0f6]">
        <KeyRound className="h-4 w-4 text-[#4ade80]" />
        {t('employees.portalTitle')}
      </h2>
      <p className="mb-4 text-xs text-[#9aa3b5]">{t('employees.portalHint')}</p>
      {account ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('users.username')} value={account.username} />
          <Field label={t('users.email')} value={account.email || '—'} />
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.status')}</p>
            <StatusBadge value={account.status} ns="userStatus" />
          </div>
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employees.mustChangePassword')}</p>
            <StatusBadge
              value={account.mustChangePassword ? 'REQUIRED' : 'DONE'}
              ns="passwordChange"
            />
          </div>
          <Field label={t('employees.lastLoginAt')} value={formatDate(account.lastLoginAt)} />
          <Field
            label={t('employees.passwordChangedAt')}
            value={formatDate(account.passwordChangedAt)}
          />
        </div>
      ) : (
        <p className="mb-4 text-sm text-[#b8bfd0]">{t('employees.portalMissing')}</p>
      )}
      {tempPassword ? (
        <p className="mb-4 rounded-md border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-sm text-[#fbbf24]">
          {t('users.temporaryPassword')}: <strong>{tempPassword}</strong>
        </p>
      ) : null}
      {canWrite ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('employees.newPassword')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className={`text-[10px] ${textSubtle}`}>{t('auth.passwordRule')}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.confirmPassword')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          {confirmPassword && !passwordsMatch ? (
            <p className="text-[10px] text-[#fbbf24]">{t('auth.passwordMismatch')}</p>
          ) : null}
          <div className="space-y-1.5">
            <Label>{t('employees.portalReason')}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('employees.portalReason')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#eef0f6]">
            <input
              type="checkbox"
              checked={mustChangeOnLogin}
              onChange={(e) => setMustChangeOnLogin(e.target.checked)}
            />
            {t('employees.mustChangeOnLogin')}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canSetPassword || setPassword.isPending}
              onClick={() => setPassword.mutate()}
            >
              <KeyRound className="h-4 w-4" />
              {t('employees.setPortalPassword')}
            </Button>
            {account ? (
              <Button
                variant="outline"
                disabled={reason.trim().length < 10 || resetPassword.isPending}
                onClick={() => resetPassword.mutate()}
              >
                {t('employees.resetPortalPassword')}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={reason.trim().length < 10 || provision.isPending}
                onClick={() => provision.mutate()}
              >
                {t('employees.provisionPortal')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#fbbf24]">{t('employees.portalWriteHint')}</p>
      )}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </div>
  );
}

function sourceColumn<T extends { source: 'staging' | 'published' }>(
  t: (key: string) => string,
): Column<T> {
  return {
    key: 'source',
    header: t('source.label'),
    render: (row) => t(`source.${row.source}`),
  };
}

function EmployeeAttendancePanel({
  employeeId,
  period,
  openTo,
}: {
  employeeId: string;
  period: string;
  openTo: string;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-attendance',
    fetchAttendance,
    employeeId,
    period,
  );
  const columns: Column<AttendanceRecord>[] = [
    { key: 'period', header: t('common.period') },
    sourceColumn<AttendanceRecord>(t),
    {
      key: 'actualWorkedDays',
      header: t('attendance.actualDays'),
      render: (row) => moneyText(row.actualWorkedDays ?? row.summary?.actualWorkedDays),
    },
    {
      key: 'periodWorkingDays',
      header: t('attendance.workingDays'),
      render: (row) => moneyText(row.periodWorkingDays ?? row.summary?.periodWorkingDays),
    },
    {
      key: 'overtimeDays',
      header: t('attendance.overtime'),
      render: (row) => moneyText(row.overtimeDays ?? row.summary?.overtimeDays),
    },
    {
      key: 'penaltyAmount',
      header: t('attendance.penaltyAmount'),
      render: (row) => moneyText(row.penaltyAmount),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—'),
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader
        icon={CalendarCheck}
        title={t('attendance.title')}
        to={openTo}
        label={t('employees.openList')}
      />
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('employees.noPeriodData')}
        count={total}
      />
    </div>
  );
}

function EmployeePenaltyPanel({
  employeeId,
  period,
  openTo,
}: {
  employeeId: string;
  period: string;
  openTo: string;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-penalties',
    fetchPenalties,
    employeeId,
    period,
  );
  const columns: Column<PenaltyRecord>[] = [
    { key: 'period', header: t('common.period') },
    sourceColumn<PenaltyRecord>(t),
    { key: 'amount', header: t('penalties.amount'), render: (row) => moneyText(row.amount ?? row.totalAmount) },
    { key: 'currency', header: t('penalties.currency') },
    { key: 'penaltyReason', header: t('penalties.reason') },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—'),
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader
        icon={ClipboardList}
        title={t('penalties.title')}
        to={openTo}
        label={t('employees.openList')}
      />
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('employees.noPeriodData')}
        count={total}
      />
    </div>
  );
}

function EmployeePayrollPanel({
  employeeId,
  period,
  openTo,
}: {
  employeeId: string;
  period: string;
  openTo: string;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-payroll',
    fetchPayroll,
    employeeId,
    period,
  );
  const columns: Column<PayrollRecord>[] = [
    { key: 'period', header: t('common.period') },
    sourceColumn<PayrollRecord>(t),
    { key: 'periodSalary', header: t('payroll.periodSalary'), render: (row) => moneyText(row.periodSalary) },
    { key: 'netAmount', header: t('payroll.net'), render: (row) => moneyText(row.netAmount) },
    { key: 'usdtAmount', header: t('payroll.usdt'), render: (row) => moneyText(row.usdtAmount) },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—'),
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader icon={Wallet} title={t('payroll.title')} to={openTo} label={t('employees.openList')} />
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('employees.noPeriodData')}
        count={total}
      />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  to,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  to: string;
  label: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#eef0f6]">
        <Icon className="h-4 w-4 text-[#4ade80]" />
        {title}
      </h2>
      <Button variant="ghost" size="sm" asChild>
        <Link to={to}>{label}</Link>
      </Button>
    </div>
  );
}
