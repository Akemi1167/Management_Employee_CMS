import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  KeyRound,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { FilterField } from '@/components/shared/filter-bar';
import { IconActionButton, IconActionLink } from '@/components/shared/icon-action';
import { PeriodSelect } from '@/components/shared/period-select';
import { StatusBadge } from '@/components/shared/status-badge';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass, textSubtle } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorCode, getApiErrorMessage, moneyText } from '@/lib/api-client';
import { managersByRegion } from '@/lib/region-managers';
import { dateInputToIso, formatDate, formatDay, toDateInput } from '@/lib/period';
import { hasAssignedWallet } from '@/lib/wallet-workflow';
import {
  deleteEmployee,
  fetchEmployee,
  fetchEmployeeLarkPayItems,
  fetchEmployeeWalletImage,
  provisionEmployeePortal,
  resetEmployeePortalPassword,
  setEmployeePortalPassword,
  setEmployeeWallet,
  updateEmployee,
  WALLET_IMAGE_ACCEPT,
  WALLET_IMAGE_MAX_BYTES,
  WALLET_NETWORKS,
  WALLET_PLATFORMS,
  type WalletNetwork,
  type WalletPlatform,
} from '@/services/employee.service';
import { fetchAttendance, fetchPayroll, fetchPenalties } from '@/services/hr-records.service';
import { fetchPayItemTypes } from '@/services/pay-item.service';
import { fetchPayrollPolicies, resolvePayrollPolicy } from '@/services/payroll-policy.service';
import { fetchUsers } from '@/services/user.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AttendanceRecord,
  Employee,
  EmployeePortalAccount,
  Paginated,
  PayItem,
  PayrollRecord,
} from '@/types/api';

const PAGE_SIZE = 12;

type EmployeeTab = 'overview' | 'profile' | 'records' | 'wallet' | 'portal';
type RecordsSubTab = 'lark' | 'penalties' | 'attendance' | 'payroll';

const EMPLOYEE_TABS: EmployeeTab[] = ['overview', 'profile', 'records', 'wallet', 'portal'];

function tabFromHash(hash: string): EmployeeTab | null {
  if (hash === '#employee-profile' || hash === '#delete-employee') return 'profile';
  if (hash === '#employee-wallet') return 'wallet';
  if (hash === '#portal-account') return 'portal';
  return null;
}

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
  const tabParam = searchParams.get('tab') ?? '';
  const recordsParam = searchParams.get('records') ?? '';
  const has = useAuthStore((s) => s.hasPermission);

  const tab: EmployeeTab = EMPLOYEE_TABS.includes(tabParam as EmployeeTab)
    ? (tabParam as EmployeeTab)
    : 'overview';
  const recordsSub: RecordsSubTab =
    recordsParam === 'penalties' ||
    recordsParam === 'attendance' ||
    recordsParam === 'payroll' ||
    recordsParam === 'lark'
      ? recordsParam
      : 'lark';

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
    setSearchParams(next, { replace: true });
  };

  const setTab = (next: EmployeeTab) => {
    update({
      tab: next === 'overview' ? '' : next,
      records: next === 'records' ? recordsSub : '',
    });
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  useEffect(() => {
    const fromHash = tabFromHash(window.location.hash);
    if (fromHash) setTab(fromHash);
    const onHash = () => {
      const mapped = tabFromHash(window.location.hash);
      if (mapped) setTab(mapped);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đồng bộ hash lần đầu / khi đổi hash
  }, []);

  const listTo = (path: string) =>
    `${path}?source=staging&employeeId=${id}${period ? `&period=${period}` : ''}`;

  const visibleTabs = EMPLOYEE_TABS.filter((item) => {
    if (item === 'wallet') return has(PERMISSION.WALLET_READ) || has(PERMISSION.WALLET_WRITE);
    if (item === 'portal') return has(PERMISSION.EMPLOYEE_READ);
    if (item === 'records') {
      return (
        has(PERMISSION.EMPLOYEE_READ) ||
        has(PERMISSION.ATTENDANCE_READ) ||
        has(PERMISSION.PENALTY_READ) ||
        has(PERMISSION.PAYROLL_READ) ||
        has(PERMISSION.PAYITEM_READ)
      );
    }
    return true;
  });
  const activeTab = visibleTabs.includes(tab) ? tab : 'overview';

  return (
    <PageContainer>
      <PageHeader
        title={data?.fullName ?? t('employees.detail')}
        description={data?.employeeCode}
        actions={
          <div className="flex flex-wrap items-center gap-0.5">
            {has(PERMISSION.EMPLOYEE_UPDATE) ? (
              <IconActionButton
                label={t('common.edit')}
                tone="primary"
                onClick={() => setTab('profile')}
              >
                <Pencil className="h-4 w-4" />
              </IconActionButton>
            ) : null}
            <IconActionLink to="/employees" label={t('common.back')}>
              <ArrowLeft className="h-4 w-4" />
            </IconActionLink>
          </div>
        }
      />
      {isLoading || !data ? (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      ) : (
        <div className="space-y-4">
          <EmployeeHeroSummary employee={data} />

          <div className="flex flex-wrap gap-1 rounded-xl border border-[#2a3040] bg-[#12151c] p-1">
            {visibleTabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={
                  activeTab === item
                    ? 'rounded-lg bg-[#1c2030] px-3 py-2 text-sm font-medium text-[#eef0f6] shadow-sm'
                    : 'rounded-lg px-3 py-2 text-sm text-[#9aa3b5] hover:bg-[#1a1e28] hover:text-[#eef0f6]'
                }
              >
                {t(`employees.tabs.${item}`)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <EmployeeOverviewPanel
              employee={data}
              employeeId={id}
              onOpenTab={(next) => {
                if (next === 'records') {
                  update({ tab: 'records', records: 'lark' });
                  return;
                }
                setTab(next);
              }}
              canEdit={has(PERMISSION.EMPLOYEE_UPDATE)}
              canWallet={has(PERMISSION.WALLET_READ) || has(PERMISSION.WALLET_WRITE)}
              canComplaints={has(PERMISSION.COMPLAINT_READ)}
              canPayItems={has(PERMISSION.PAYITEM_READ)}
              canRecords={visibleTabs.includes('records')}
              period={period}
            />
          ) : null}

          {activeTab === 'profile' ? <EmployeeProfileCard employee={data} /> : null}

          {activeTab === 'wallet' ? (
            <WalletAssignCard employeeId={id} employeeCode={data.employeeCode} wallet={data.wallet} />
          ) : null}

          {activeTab === 'portal' ? (
            <PortalAccountCard employeeId={id} account={data.portalAccount ?? null} />
          ) : null}

          {activeTab === 'records' ? (
            <div className="space-y-4">
              <div className={`${cardClass} p-4`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <FilterField label={t('common.period')} className="sm:max-w-xs">
                    <PeriodSelect allowAll value={period} onChange={(value) => update({ period: value })} />
                  </FilterField>
                  <div className="flex flex-wrap gap-1 rounded-lg border border-[#2a3040] bg-[#12151c] p-1">
                    {(
                      [
                        has(PERMISSION.EMPLOYEE_READ) || has(PERMISSION.PAYITEM_READ) ? 'lark' : null,
                        has(PERMISSION.EMPLOYEE_READ) || has(PERMISSION.PENALTY_READ) ? 'penalties' : null,
                        has(PERMISSION.ATTENDANCE_READ) ? 'attendance' : null,
                        has(PERMISSION.PAYROLL_READ) ? 'payroll' : null,
                      ] as const
                    )
                      .filter((item): item is RecordsSubTab => Boolean(item))
                      .map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => update({ tab: 'records', records: item })}
                          className={
                            recordsSub === item
                              ? 'rounded-md bg-[#1c2030] px-2.5 py-1.5 text-xs font-medium text-[#eef0f6]'
                              : 'rounded-md px-2.5 py-1.5 text-xs text-[#9aa3b5] hover:text-[#eef0f6]'
                          }
                        >
                          {t(`employees.recordTabs.${item}`)}
                        </button>
                      ))}
                  </div>
                </div>
                <p className={`mt-3 text-xs ${textSubtle}`}>{t('source.hint')}</p>
              </div>

              {recordsSub === 'lark' && (has(PERMISSION.EMPLOYEE_READ) || has(PERMISSION.PAYITEM_READ)) ? (
                <EmployeeLarkPayItemsPanel
                  employeeId={id}
                  employeeCode={data.employeeCode}
                  period={period}
                  onClearPeriod={() => update({ period: '' })}
                />
              ) : null}
              {recordsSub === 'penalties' &&
              (has(PERMISSION.EMPLOYEE_READ) || has(PERMISSION.PENALTY_READ)) ? (
                <EmployeePenaltyPanel
                  employeeId={id}
                  employeeCode={data.employeeCode}
                  period={period}
                  openTo={listTo('/penalties')}
                  onClearPeriod={() => update({ period: '' })}
                />
              ) : null}
              {recordsSub === 'attendance' && has(PERMISSION.ATTENDANCE_READ) ? (
                <EmployeeAttendancePanel
                  employeeId={id}
                  period={period}
                  openTo={listTo('/attendance')}
                />
              ) : null}
              {recordsSub === 'payroll' && has(PERMISSION.PAYROLL_READ) ? (
                <EmployeePayrollPanel employeeId={id} period={period} openTo={listTo('/payroll')} />
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
}

function EmployeeHeroSummary({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-[#eef0f6]">{employee.fullName}</p>
          <p className={`mt-0.5 font-mono text-sm ${textSubtle}`}>{employee.employeeCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={employee.employmentStatus} ns="employment" />
          <StatusBadge value={employee.payrollProcess ?? 'INTERNAL'} ns="payrollProcess" />
          <StatusBadge value={employee.larkSyncStatus} ns="larkStatus" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('employees.department')} value={employee.departmentCode || '—'} />
        <Field label={t('employees.region')} value={employee.regionCode || '—'} />
        <Field label={t('employees.position')} value={employee.position || '—'} />
        <Field label={t('employees.hiredAt')} value={formatDay(employee.hiredAt)} />
      </div>
    </div>
  );
}

function EmployeeOverviewPanel({
  employee,
  employeeId,
  onOpenTab,
  canEdit,
  canWallet,
  canComplaints,
  canPayItems,
  canRecords,
  period,
}: {
  employee: Employee;
  employeeId: string;
  onOpenTab: (tab: EmployeeTab) => void;
  canEdit: boolean;
  canWallet: boolean;
  canComplaints: boolean;
  canPayItems: boolean;
  canRecords: boolean;
  period: string;
}) {
  const { t } = useTranslation();
  const walletAssigned = hasAssignedWallet(employee.wallet);
  const payItemTypes = useQuery({
    queryKey: ['pay-item-types'],
    queryFn: fetchPayItemTypes,
    enabled: canRecords,
  });
  const typeLabel = useMemo(() => {
    const map = new Map((payItemTypes.data?.items ?? []).map((type) => [type.code, type.label]));
    return (code: string) => map.get(code) ?? code;
  }, [payItemTypes.data?.items]);
  const larkItems = useQuery({
    queryKey: ['employee-lark-pay-items', employeeId, 'all'],
    queryFn: () => fetchEmployeeLarkPayItems(employeeId),
    enabled: Boolean(employeeId) && canRecords,
  });
  const allLark = larkItems.data?.items ?? [];
  const larkTotal = useMemo(
    () => allLark.reduce((sum, item) => sum + payItemAmountNumber(item.amount), 0),
    [allLark],
  );
  const byType = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const item of allLark) {
      const key = item.payItemTypeCode || '—';
      const current = map.get(key) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += payItemAmountNumber(item.amount);
      map.set(key, current);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [allLark]);

  return (
    <div className="space-y-4">
      {canRecords ? (
        <div className={`${cardClass} border-[#4ade80]/25 p-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#eef0f6]">{t('employees.overviewLarkTitle')}</h2>
              <p className={`mt-1 text-xs ${textSubtle}`}>{t('employees.overviewLarkHint')}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenTab('records')}>
              <FileText className="h-4 w-4" />
              {t('employees.recordTabs.lark')}
            </Button>
          </div>
          {larkItems.isError ? (
            <p className="mt-3 text-sm text-[#f87171]">{getApiErrorMessage(larkItems.error)}</p>
          ) : larkItems.isLoading ? (
            <p className={`mt-3 text-sm ${textSubtle}`}>{t('common.loading')}</p>
          ) : allLark.length === 0 ? (
            <p className={`mt-3 text-sm ${textSubtle}`}>{t('employees.larkPayItems.empty')}</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className={`text-[11px] uppercase tracking-wide ${textSubtle}`}>
                    {t('employees.overviewLarkCount')}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-[#86efac]">{allLark.length}</p>
                </div>
                <div>
                  <p className={`text-[11px] uppercase tracking-wide ${textSubtle}`}>
                    {t('payItems.amount')}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-[#86efac]">
                    {moneyText(larkTotal)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] uppercase tracking-wide ${textSubtle}`}>
                    {t('common.period')}
                  </p>
                  <p className="truncate text-sm text-[#eef0f6]">
                    {[...new Set(allLark.map((item) => item.period))].join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {byType.map(([type, stats]) => (
                  <span
                    key={type}
                    className="rounded-md border border-[#2a3040] bg-[#12151c] px-2.5 py-1 text-xs text-[#eef0f6]"
                    title={`${type} · ${moneyText(stats.amount)}`}
                  >
                    <span className="font-medium text-[#4ade80]">{typeLabel(type)}</span>
                    <span className={textSubtle}> · {stats.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className={`${cardClass} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#eef0f6]">{t('employees.tabs.overview')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('employees.workEmail')} value={employee.workEmail || '—'} />
          <Field
            label={t('employees.payrollPolicy')}
            value={employee.payrollPolicyCode || t('employees.payrollPolicyNone')}
          />
          <Field label={t('employees.terminatedAt')} value={formatDay(employee.terminatedAt)} />
          <Field
            label={t('employees.wallet')}
            value={employee.wallet.addressMasked || t('employees.walletMissing')}
          />
          <Field
            label={t('employees.portalTitle')}
            value={
              employee.portalAccount?.status
                ? t(`userStatus.${employee.portalAccount.status}`, {
                    defaultValue: employee.portalAccount.status,
                  })
                : t('employees.portalMissingShort')
            }
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-0.5">
          {canEdit ? (
            <IconActionButton
              label={t('employees.tabs.profile')}
              tone="primary"
              onClick={() => onOpenTab('profile')}
            >
              <Pencil className="h-4 w-4" />
            </IconActionButton>
          ) : null}
          {canWallet ? (
            <IconActionButton
              label={walletAssigned ? t('employees.tabs.wallet') : t('employees.assignWallet')}
              onClick={() => onOpenTab('wallet')}
            >
              <Wallet className="h-4 w-4" />
            </IconActionButton>
          ) : null}
          <IconActionButton label={t('employees.tabs.portal')} onClick={() => onOpenTab('portal')}>
            <KeyRound className="h-4 w-4" />
          </IconActionButton>
          {canRecords ? (
            <IconActionButton
              label={t('employees.tabs.records')}
              onClick={() => onOpenTab('records')}
            >
              <FileText className="h-4 w-4" />
            </IconActionButton>
          ) : null}
        </div>
      </div>

      <div className={`${cardClass} p-4`}>
        <h2 className="mb-3 text-sm font-semibold text-[#eef0f6]">{t('employees.quickLinks')}</h2>
        <div className="flex flex-col gap-2">
          {canComplaints ? (
            <Link
              to={`/complaints?employeeCode=${encodeURIComponent(employee.employeeCode)}`}
              className="rounded-lg border border-[#2a3040] px-3 py-2 text-sm text-[#eef0f6] hover:bg-[#1c2030]"
            >
              <ClipboardList className="mr-2 inline h-4 w-4 text-[#4ade80]" />
              {t('employees.viewComplaints')}
            </Link>
          ) : null}
          {canWallet ? (
            <Link
              to={`/wallet?employeeCode=${encodeURIComponent(employee.employeeCode)}`}
              className="rounded-lg border border-[#2a3040] px-3 py-2 text-sm text-[#eef0f6] hover:bg-[#1c2030]"
            >
              <CreditCard className="mr-2 inline h-4 w-4 text-[#4ade80]" />
              {t('employees.viewWallet')}
            </Link>
          ) : null}
          {canPayItems ? (
            <Link
              to={`/pay-items?employeeCode=${encodeURIComponent(employee.employeeCode)}${
                period ? `&period=${period}` : ''
              }`}
              className="rounded-lg border border-[#2a3040] px-3 py-2 text-sm text-[#eef0f6] hover:bg-[#1c2030]"
            >
              <FileText className="mr-2 inline h-4 w-4 text-[#4ade80]" />
              {t('nav.payItems')}
            </Link>
          ) : null}
          {!canComplaints && !canWallet && !canPayItems ? (
            <p className={`text-sm ${textSubtle}`}>{t('employees.quickLinksEmpty')}</p>
          ) : null}
        </div>
      </div>
      </div>
    </div>
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

function EmployeeProfileCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_UPDATE));
  const canReadUsers = useAuthStore((s) => s.hasPermission(PERMISSION.USER_READ));
  const managers = useQuery({
    queryKey: ['cms-users', 'region-managers'],
    queryFn: () => fetchUsers({ page: 1, pageSize: 200, status: 'ACTIVE' }),
    enabled: canReadUsers,
  });
  const managerNames = useMemo(
    () => managersByRegion(managers.data?.items ?? []),
    [managers.data?.items],
  );
  const savedRegion = employee.regionCode?.trim() ?? '';
  const regionOwners = savedRegion ? (managerNames.get(savedRegion) ?? []) : [];
  const [fullName, setFullName] = useState(employee.fullName);
  const [workEmail, setWorkEmail] = useState(employee.workEmail ?? '');
  const [departmentCode, setDepartmentCode] = useState(employee.departmentCode);
  const [regionCode, setRegionCode] = useState(employee.regionCode ?? '');
  const [position, setPosition] = useState(employee.position ?? '');
  const [hiredAt, setHiredAt] = useState(toDateInput(employee.hiredAt));
  const [employmentStatus, setEmploymentStatus] = useState(employee.employmentStatus);
  const [payrollProcess, setPayrollProcess] = useState<string>(employee.payrollProcess ?? 'INTERNAL');
  const [payrollPolicyCode, setPayrollPolicyCode] = useState(
    employee.payrollPolicyLocked && employee.payrollPolicyCode ? employee.payrollPolicyCode : '',
  );
  const canReadPolicies = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_READ));
  const policies = useQuery({
    queryKey: ['payroll-policies'],
    queryFn: fetchPayrollPolicies,
    enabled: canReadPolicies,
  });
  const resolvedPolicy = useQuery({
    queryKey: ['payroll-policy-resolve', employee.id],
    queryFn: () => resolvePayrollPolicy({ employeeId: employee.id }),
    enabled: canReadPolicies,
  });
  const [terminatedAt, setTerminatedAt] = useState(toDateInput(employee.terminatedAt));
  const [reason, setReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'disable' | 'enable' | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  useEffect(() => {
    setFullName(employee.fullName);
    setWorkEmail(employee.workEmail ?? '');
    setDepartmentCode(employee.departmentCode);
    setRegionCode(employee.regionCode ?? '');
    setPosition(employee.position ?? '');
    setHiredAt(toDateInput(employee.hiredAt));
    setEmploymentStatus(employee.employmentStatus);
    setPayrollProcess(employee.payrollProcess ?? 'INTERNAL');
    setPayrollPolicyCode(
      employee.payrollPolicyLocked && employee.payrollPolicyCode ? employee.payrollPolicyCode : '',
    );
    setTerminatedAt(toDateInput(employee.terminatedAt));
  }, [employee]);

  useEffect(() => {
    if (window.location.hash === '#employee-profile') {
      document.getElementById('employee-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const openDelete = () => {
      if (window.location.hash === '#delete-employee') {
        setDeleteOpen(true);
      }
    };
    openDelete();
    window.addEventListener('hashchange', openDelete);
    return () => window.removeEventListener('hashchange', openDelete);
  }, []);

  const portalStatus = employee.portalAccount?.status;
  const hiredIso = dateInputToIso(hiredAt);
  const terminatedIso = employmentStatus === 'TERMINATED' ? dateInputToIso(terminatedAt) : undefined;
  const invalidTerminatedDate =
    employmentStatus === 'TERMINATED' && Boolean(terminatedAt) && Boolean(hiredAt) && terminatedAt < hiredAt;

  const canSubmit =
    canUpdate &&
    fullName.trim().length > 0 &&
    departmentCode.trim().length > 0 &&
    hiredAt.length === 10 &&
    reason.trim().length >= 10 &&
    !invalidTerminatedDate;

  const payload = () => {
    const body: Parameters<typeof updateEmployee>[1] = {
      fullName: fullName.trim(),
      workEmail: workEmail.trim() ? workEmail.trim() : null,
      departmentCode: departmentCode.trim(),
      position: position.trim() ? position.trim() : null,
      hiredAt: hiredIso,
      employmentStatus,
      payrollProcess,
      reason: reason.trim(),
    };
    const nextPolicy = payrollPolicyCode.trim() || null;
    const currentPolicy = employee.payrollPolicyLocked ? employee.payrollPolicyCode ?? null : null;
    if (nextPolicy !== currentPolicy) {
      body.payrollPolicyCode = nextPolicy;
    }
    if (employmentStatus === 'TERMINATED') {
      if (terminatedIso) body.terminatedAt = terminatedIso;
    } else {
      body.terminatedAt = null;
    }
    const nextRegion = regionCode.trim();
    const currentRegion = employee.regionCode?.trim() ?? '';
    if (nextRegion !== currentRegion) {
      body.regionCode = nextRegion || null;
    }
    return body;
  };

  const save = useMutation({
    mutationFn: () => updateEmployee(employee.id, payload()),
    onSuccess: () => {
      setReason('');
      setConfirmKind(null);
      toast.success(t('employees.profileSaved'));
      void queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-policy-resolve', employee.id] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:update:${employee.id}`, retry: () => save.mutate() }),
      ),
  });

  const requestSave = () => {
    if (!canSubmit) return;
    const disabling =
      (employmentStatus === 'TERMINATED' || employmentStatus === 'SUSPENDED') &&
      employmentStatus !== employee.employmentStatus;
    const enabling =
      (employmentStatus === 'ACTIVE' || employmentStatus === 'ON_LEAVE') &&
      portalStatus === 'DISABLED';
    if (disabling) {
      setConfirmKind('disable');
      return;
    }
    if (enabling) {
      setConfirmKind('enable');
      return;
    }
    save.mutate();
  };

  const remove = useMutation({
    mutationFn: () => deleteEmployee(employee.id, deleteReason.trim()),
    onSuccess: () => {
      setDeleteOpen(false);
      setDeleteReason('');
      toast.success(t('employees.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.removeQueries({ queryKey: ['employee', employee.id] });
      navigate('/employees');
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:delete:${employee.id}`, retry: () => remove.mutate() }),
      ),
  });

  const closeDeleteDialog = () => {
    if (remove.isPending) return;
    setDeleteOpen(false);
    if (window.location.hash === '#delete-employee') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  return (
    <div id="employee-profile" className={`${cardClass} scroll-mt-4 p-5`}>
      <div id="delete-employee" className="sr-only" />
      <h2 className="mb-3 text-sm font-semibold text-[#eef0f6]">{t('employees.tabs.profile')}</h2>
      {!canUpdate ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('employees.code')} value={employee.employeeCode} />
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employees.region')}</p>
            <p className="text-sm">{savedRegion || '—'}</p>
            {savedRegion && canReadUsers ? (
              <p className="mt-1 text-xs text-[#9aa3b5]">
                {t('employees.managedBy')}:{' '}
                {regionOwners.length > 0 ? (
                  regionOwners.map((owner) => (
                    <Link
                      key={owner.id}
                      to={`/users/${owner.id}`}
                      className="mr-2 text-[#4ade80] hover:underline"
                    >
                      {owner.name}
                    </Link>
                  ))
                ) : (
                  <Link to="/users" className="text-[#4ade80] hover:underline">
                    {t('employees.noManager')}
                  </Link>
                )}
              </p>
            ) : null}
            <Link
              to={
                savedRegion
                  ? `/regions?region=${encodeURIComponent(savedRegion)}`
                  : '/regions?unassigned=1'
              }
              className="mt-1 inline-block text-xs text-[#4ade80] hover:underline"
            >
              {savedRegion ? t('employees.sameRegion') : t('employees.unassignedRegion')}
            </Link>
          </div>
          <Field label={t('employees.workEmail')} value={employee.workEmail || '—'} />
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employees.payrollPolicy')}</p>
            {resolvedPolicy.data?.policy ? (
              <Link
                to={`/payroll-policies/${resolvedPolicy.data.policy.id}`}
                className="text-sm text-[#4ade80] hover:underline"
              >
                {resolvedPolicy.data.policy.code} · {resolvedPolicy.data.policy.name}
              </Link>
            ) : (
              <p className="text-sm">{employee.payrollPolicyCode || t('employees.payrollPolicyNone')}</p>
            )}
          </div>
          <Field label={t('employees.hiredAt')} value={formatDay(employee.hiredAt)} />
          <Field label={t('employees.terminatedAt')} value={formatDay(employee.terminatedAt)} />
        </div>
      ) : null}
      {canUpdate ? (
        <div className="space-y-3">
          <p className={`text-xs ${textSubtle}`}>{t('employees.profileHint')}</p>
          {savedRegion && canReadUsers ? (
            <p className={`text-xs ${textSubtle}`}>
              {t('employees.managedBy')}:{' '}
              {regionOwners.length > 0
                ? regionOwners.map((owner) => owner.name).join(', ')
                : t('employees.noManager')}
            </p>
          ) : null}
          {portalStatus === 'LOCKED' ? (
            <p className="text-sm text-[#fbbf24]">{t('employees.portalLockedHint')}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('employees.name')}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.workEmail')}</Label>
              <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.department')}</Label>
              <Input value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.region')}</Label>
              <Input
                value={regionCode}
                placeholder={t('employees.regionPlaceholder')}
                onChange={(e) => setRegionCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.position')}</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.hiredAt')}</Label>
              <Input type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.status')}</Label>
              <Select value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)}>
                <option value="ACTIVE">{t('employment.ACTIVE')}</option>
                <option value="ON_LEAVE">{t('employment.ON_LEAVE')}</option>
                <option value="SUSPENDED">{t('employment.SUSPENDED')}</option>
                <option value="TERMINATED">{t('employment.TERMINATED')}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.payrollProcess')}</Label>
              <Select value={payrollProcess} onChange={(e) => setPayrollProcess(e.target.value)}>
                <option value="INTERNAL">{t('payrollProcess.INTERNAL')}</option>
                <option value="LARK">{t('payrollProcess.LARK')}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.payrollPolicy')}</Label>
              <Select value={payrollPolicyCode} onChange={(e) => setPayrollPolicyCode(e.target.value)}>
                <option value="">{t('employees.payrollPolicyFollowDept')}</option>
                {(policies.data?.items ?? [])
                  .filter((policy) => policy.enabled || policy.code === payrollPolicyCode)
                  .map((policy) => (
                    <option key={policy.code} value={policy.code}>
                      {policy.code} · {policy.name}
                    </option>
                  ))}
              </Select>
              <p className={`text-[10px] ${textSubtle}`}>{t('employees.payrollPolicyHint')}</p>
            </div>
            {employmentStatus === 'TERMINATED' ? (
              <div className="space-y-1.5">
                <Label>{t('employees.terminatedAt')}</Label>
                <Input type="date" value={terminatedAt} onChange={(e) => setTerminatedAt(e.target.value)} />
                <p className={`text-[10px] ${textSubtle}`}>{t('employees.terminatedAtHint')}</p>
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('employees.portalReason')}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          {invalidTerminatedDate ? (
            <p className="text-[10px] text-[#fbbf24]">{t('employees.terminatedBeforeHired')}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canSubmit || save.isPending} onClick={requestSave}>
              <Pencil className="h-4 w-4" />
              {t('employees.saveProfile')}
            </Button>
            <IconActionButton
              label={t('employees.deleteProfile')}
              tone="danger"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </IconActionButton>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmKind === 'disable'}
        onClose={() => setConfirmKind(null)}
        onConfirm={() => save.mutate()}
        title={t('employees.confirmDisableTitle')}
        description={t('employees.confirmDisableDescription')}
        destructive
        loading={save.isPending}
      />
      <ConfirmDialog
        open={confirmKind === 'enable'}
        onClose={() => setConfirmKind(null)}
        onConfirm={() => save.mutate()}
        title={t('employees.confirmEnableTitle')}
        description={t('employees.confirmEnableDescription')}
        loading={save.isPending}
      />
      <Dialog
        open={deleteOpen}
        onClose={closeDeleteDialog}
        title={t('employees.confirmDeleteTitle')}
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              disabled={remove.isPending}
              onClick={closeDeleteDialog}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={deleteReason.trim().length < 10 || remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2 className="h-4 w-4" />
              {t('employees.deleteProfile')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#b8bfd0]">{t('employees.confirmDeleteDescription')}</p>
          <p className={`text-xs ${textSubtle}`}>{t('employees.deleteHint')}</p>
          <div className="space-y-1.5">
            <Label>{t('employees.deleteReason')}</Label>
            <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
          </div>
        </div>
      </Dialog>
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </div>
  );
}

function isAllowedWalletImage(file: File) {
  if (file.size <= 0 || file.size > WALLET_IMAGE_MAX_BYTES) return false;
  if (/image\/(jpeg|png|webp)/i.test(file.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function WalletImagePreview({
  employeeId,
  hasImage,
  revision,
}: {
  employeeId: string;
  hasImage: boolean;
  revision?: string | null;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasImage) {
      setUrl(null);
      setFailed(false);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    void fetchEmployeeWalletImage(employeeId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [employeeId, hasImage, revision]);

  if (!hasImage) {
    return <p className="text-sm text-[#b8bfd0]">{t('employees.walletImageMissing')}</p>;
  }

  if (failed) {
    return <p className="text-sm text-[#fbbf24]">{t('employees.walletImageGone')}</p>;
  }

  if (!url) {
    return <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>;
  }

  return (
    <img
      src={url}
      alt={t('employees.walletImage')}
      className="max-h-56 w-full rounded-md border border-[#2a3040] object-contain bg-[#12151c]"
    />
  );
}

function WalletAssignCard({
  employeeId,
  employeeCode,
  wallet,
}: {
  employeeId: string;
  employeeCode: string;
  wallet: Employee['wallet'];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_WRITE));
  const canReadRequests = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_READ));
  const isAdmin = useAuthStore((s) => Boolean(s.user?.roles.includes('system_admin')));
  const assigned = hasAssignedWallet(wallet);
  const canOverride = assigned && isAdmin && canWrite;
  const canFirstAssign = !assigned && canWrite;
  const showForm = canFirstAssign || canOverride;
  const [address, setAddress] = useState('');
  const [platform, setPlatform] = useState<WalletPlatform>('BINANCE');
  const [network, setNetwork] = useState<WalletNetwork>('BEP20');
  const [ownerName, setOwnerName] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);
  const [sharedConfirm, setSharedConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash === '#employee-wallet') {
      document.getElementById('employee-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const canSubmit =
    showForm &&
    address.replace(/\s+/g, '').trim().length >= 8 &&
    reason.trim().length >= 10 &&
    Boolean(image) &&
    isAllowedWalletImage(image!);

  const save = useMutation({
    mutationFn: (confirmSharedWallet: boolean) =>
      setEmployeeWallet(employeeId, {
        address: address.replace(/\s+/g, '').trim(),
        platform,
        network,
        ownerName,
        reason: reason.trim(),
        image: image!,
        confirmSharedWallet,
      }),
    onSuccess: () => {
      setAddress('');
      setOwnerName('');
      setReason('');
      setImage(null);
      setSharedConfirm(null);
      toast.success(t('employees.walletAssigned'));
      void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
    onError: (error) => {
      if (getApiErrorCode(error) === 'SHARED_WALLET_NEEDS_CONFIRM') {
        setSharedConfirm(getApiErrorMessage(error));
        return;
      }
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:wallet:${employeeId}`, retry: () => save.mutate(false) }),
      );
    },
  });

  return (
    <div id="employee-wallet" className={`${cardClass} scroll-mt-4 p-5`}>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#eef0f6]">
        <Wallet className="h-4 w-4 text-[#4ade80]" />
        {t('employees.walletTitle')}
      </h2>
      <p className="mb-4 text-xs text-[#9aa3b5]">
        {canOverride ? t('employees.walletOverrideHint') : assigned ? t('employees.walletChangeHint') : t('employees.walletHint')}
      </p>
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('employees.wallet')} value={wallet.addressMasked || '—'} />
          <Field
            label={t('employees.walletPlatform')}
            value={wallet.platform ? t(`walletPlatform.${wallet.platform}`, { defaultValue: wallet.platform }) : '—'}
          />
          <Field
            label={t('employees.walletNetwork')}
            value={wallet.network ? t(`walletNetwork.${wallet.network}`, { defaultValue: wallet.network }) : '—'}
          />
          <Field label={t('wallet.owner')} value={wallet.ownerNameMasked || '—'} />
          <Field label={t('employees.walletEffectiveAt')} value={formatDate(wallet.effectiveAt)} />
          <Field
            label={t('employees.walletSource')}
            value={wallet.source ? t(`walletSource.${wallet.source}`, { defaultValue: wallet.source }) : '—'}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase text-[#9aa3b5]">{t('employees.walletImage')}</p>
          <WalletImagePreview
            employeeId={employeeId}
            hasImage={Boolean(wallet.hasImage)}
            revision={wallet.effectiveAt}
          />
        </div>
      </div>
      {canReadRequests ? (
        <p className="mb-4 text-sm">
          <Link to={`/wallet?employeeCode=${encodeURIComponent(employeeCode)}`} className="text-[#4ade80] hover:underline">
            {t('employees.viewWallet')}
          </Link>
        </p>
      ) : null}
      {showForm ? (
        <div className="space-y-3 border-t border-[#2a3040] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('employees.walletAddress')}</Label>
              <Input
                autoComplete="off"
                spellCheck={false}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.walletPlatform')}</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as WalletPlatform)}>
                {WALLET_PLATFORMS.map((value) => (
                  <option key={value} value={value}>
                    {t(`walletPlatform.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.walletNetwork')}</Label>
              <Select value={network} onChange={(e) => setNetwork(e.target.value as WalletNetwork)}>
                {WALLET_NETWORKS.map((value) => (
                  <option key={value} value={value}>
                    {t(`walletNetwork.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('employees.walletOwnerName')} ({t('common.optional')})
              </Label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.walletImage')}</Label>
              <Input
                type="file"
                accept={WALLET_IMAGE_ACCEPT}
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
              <p className={`text-[10px] ${textSubtle}`}>{t('employees.walletImageHint')}</p>
            </div>
          </div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={t('employees.walletImage')}
              className="max-h-40 rounded-md border border-[#2a3040] object-contain bg-[#12151c]"
            />
          ) : null}
          {image && !isAllowedWalletImage(image) ? (
            <p className="text-[10px] text-[#fbbf24]">{t('employees.walletImageHint')}</p>
          ) : null}
          <div className="space-y-1.5">
            <Label>{t('employees.portalReason')}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('employees.portalReason')}
            />
          </div>
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate(false)}>
            <Wallet className="h-4 w-4" />
            {t(canOverride ? 'employees.overrideWallet' : 'employees.assignWallet')}
          </Button>
        </div>
      ) : assigned ? null : (
        <p className="text-sm text-[#fbbf24]">{t('employees.walletWriteHint')}</p>
      )}
      <ConfirmDialog
        open={Boolean(sharedConfirm)}
        onClose={() => setSharedConfirm(null)}
        onConfirm={() => save.mutate(true)}
        title={t('employees.walletSharedConfirmTitle')}
        description={sharedConfirm ?? t('employees.walletSharedConfirmBody')}
        confirmLabel={t('employees.walletSharedConfirmSubmit')}
        loading={save.isPending}
      />
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
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
    <div id="portal-account" className={`${cardClass} scroll-mt-4 p-5`}>
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
    sortValue: (row) => t(`source.${row.source}`),
    render: (row) => t(`source.${row.source}`),
  };
}

function EmployeeLarkPayItemsPanel({
  employeeId,
  employeeCode,
  period,
  onClearPeriod,
}: {
  employeeId: string;
  employeeCode: string;
  period: string;
  onClearPeriod: () => void;
}) {
  const { t } = useTranslation();
  const openTo = `/pay-items?employeeCode=${encodeURIComponent(employeeCode)}&source=LARK_BASE`;
  const payItemTypes = useQuery({ queryKey: ['pay-item-types'], queryFn: fetchPayItemTypes });
  const typeLabel = useMemo(() => {
    const map = new Map((payItemTypes.data?.items ?? []).map((type) => [type.code, type.label]));
    return (code: string) => map.get(code) ?? code;
  }, [payItemTypes.data?.items]);
  // Luon lay tat ca ky — loc ky o client de khong bi mat don vi chon sai thang.
  const list = useQuery({
    queryKey: ['employee-lark-pay-items', employeeId, 'all'],
    queryFn: () => fetchEmployeeLarkPayItems(employeeId),
  });
  const allItems = list.data?.items ?? [];
  const filtered = period ? allItems.filter((item) => item.period === period) : allItems;
  const hiddenByPeriod = period && filtered.length === 0 && allItems.length > 0;
  const rows = hiddenByPeriod ? allItems : filtered;
  const columns: Column<PayItem>[] = [
    { key: 'period', header: t('common.period') },
    {
      key: 'payItemTypeCode',
      header: t('payItems.type'),
      render: (row) => (
        <span className="font-medium text-[#eef0f6]" title={row.payItemTypeCode}>
          {typeLabel(row.payItemTypeCode)}
        </span>
      ),
    },
    {
      key: 'occurredOn',
      header: t('payItems.occurredOn'),
      render: (row) => formatDay(row.occurredOn),
    },
    { key: 'hours', header: t('payItems.hours'), render: (row) => row.hours || '—' },
    { key: 'amount', header: t('payItems.amount'), render: (row) => moneyText(row.amount) },
    {
      key: 'reason',
      header: t('payItems.reason'),
      render: (row) => row.reason || '—',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge value={row.status} ns="payItemStatus" />,
    },
    {
      key: 'larkDataSourceName',
      header: t('employees.larkPayItems.source'),
      render: (row) => row.larkDataSourceName || '—',
    },
    {
      key: 'larkBaseRecordId',
      header: t('employees.larkPayItems.record'),
      render: (row) => <span className="font-mono text-xs">{row.larkBaseRecordId || '—'}</span>,
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader
        icon={FileText}
        title={t('employees.larkPayItems.title')}
        to={openTo}
        label={t('employees.openList')}
      />
      {list.isError ? (
        <p className="mb-2 text-sm text-[#f87171]">{getApiErrorMessage(list.error)}</p>
      ) : null}
      {hiddenByPeriod ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-3 py-2 text-sm text-[#fde68a]">
          <span>{t('employees.larkPayItems.hiddenByPeriod', { period, count: allItems.length })}</span>
          <Button type="button" size="sm" variant="outline" onClick={onClearPeriod}>
            {t('common.allPeriods')}
          </Button>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={rows}
        loading={list.isLoading}
        emptyMessage={t('employees.larkPayItems.empty')}
        count={rows.length}
      />
    </div>
  );
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
      sortValue: (row) => row.actualWorkedDays ?? row.summary?.actualWorkedDays,
      render: (row) => moneyText(row.actualWorkedDays ?? row.summary?.actualWorkedDays),
    },
    {
      key: 'periodWorkingDays',
      header: t('attendance.workingDays'),
      sortValue: (row) => row.periodWorkingDays ?? row.summary?.periodWorkingDays,
      render: (row) => moneyText(row.periodWorkingDays ?? row.summary?.periodWorkingDays),
    },
    {
      key: 'overtimeDays',
      header: t('attendance.overtime'),
      sortValue: (row) => row.overtimeDays ?? row.summary?.overtimeDays,
      render: (row) => moneyText(row.overtimeDays ?? row.summary?.overtimeDays),
    },
    {
      key: 'overtimeHours',
      header: t('attendance.overtimeHours'),
      sortValue: (row) => row.overtimeHours ?? row.summary?.overtimeHours,
      render: (row) => moneyText(row.overtimeHours ?? row.summary?.overtimeHours),
    },
    {
      key: 'unpaidLeaveDays',
      header: t('attendance.unpaidLeave'),
      sortValue: (row) => row.unpaidLeaveDays ?? row.summary?.unpaidLeaveDays,
      render: (row) => moneyText(row.unpaidLeaveDays ?? row.summary?.unpaidLeaveDays),
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

type EmployeePenaltyRow = {
  id: string;
  period: string;
  sourceLabel: string;
  amount: string | null;
  currency: string | null;
  penaltyReason: string | null;
  statusLabel: ReactNode;
  sortPeriod: string;
};

function isLarkPenaltyPayItem(item: PayItem) {
  return /PENALTY|FINE|PHAT/i.test(item.payItemTypeCode);
}

function payItemAmountNumber(amount: unknown): number {
  if (amount == null || amount === '') return 0;
  if (typeof amount === 'object' && amount && '$numberDecimal' in (amount as object)) {
    const n = Number((amount as { $numberDecimal: string }).$numberDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

function EmployeePenaltyPanel({
  employeeId,
  employeeCode,
  period,
  openTo,
  onClearPeriod,
}: {
  employeeId: string;
  employeeCode: string;
  period: string;
  openTo: string;
  onClearPeriod: () => void;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-penalties',
    fetchPenalties,
    employeeId,
    period,
  );
  const larkItems = useQuery({
    queryKey: ['employee-lark-pay-items', employeeId, 'all'],
    queryFn: () => fetchEmployeeLarkPayItems(employeeId),
  });

  const allLarkPenalties = useMemo(
    () => (larkItems.data?.items ?? []).filter(isLarkPenaltyPayItem),
    [larkItems.data?.items],
  );
  const larkPenalties = useMemo(
    () => (period ? allLarkPenalties.filter((item) => item.period === period) : allLarkPenalties),
    [allLarkPenalties, period],
  );
  const hiddenByPeriod = Boolean(period && larkPenalties.length === 0 && allLarkPenalties.length > 0);
  const larkForTable = hiddenByPeriod ? allLarkPenalties : larkPenalties;

  const rows = useMemo<EmployeePenaltyRow[]>(() => {
    const excelRows: EmployeePenaltyRow[] = items.map((row) => ({
      id: `excel-${row.id}`,
      period: row.period,
      sourceLabel: t(`source.${row.source}`),
      amount: row.amount ?? row.totalAmount ?? null,
      currency: row.currency,
      penaltyReason: row.penaltyReason,
      statusLabel: row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—',
      sortPeriod: row.period,
    }));
    const larkRows: EmployeePenaltyRow[] = larkForTable.map((item) => ({
      id: `lark-${item.id}`,
      period: item.period,
      sourceLabel: item.larkDataSourceName
        ? `${t('payItemSource.LARK_BASE')} · ${item.larkDataSourceName}`
        : t('payItemSource.LARK_BASE'),
      amount: item.amount,
      currency: item.currency,
      penaltyReason: item.reason || item.payItemTypeCode,
      statusLabel: <StatusBadge value={item.status} ns="payItemStatus" />,
      sortPeriod: item.period,
    }));
    return [...larkRows, ...excelRows].sort((a, b) => b.sortPeriod.localeCompare(a.sortPeriod));
  }, [items, larkForTable, t]);

  const columns: Column<EmployeePenaltyRow>[] = [
    { key: 'period', header: t('common.period') },
    { key: 'sourceLabel', header: t('source.label') },
    {
      key: 'amount',
      header: t('penalties.amount'),
      render: (row) => moneyText(row.amount),
    },
    { key: 'currency', header: t('penalties.currency'), render: (row) => row.currency || '—' },
    {
      key: 'penaltyReason',
      header: t('penalties.reason'),
      render: (row) => row.penaltyReason || '—',
    },
    {
      key: 'statusLabel',
      header: t('common.status'),
      render: (row) => row.statusLabel,
    },
  ];

  const loading = isLoading || larkItems.isLoading;
  const larkOpenTo = `/pay-items?employeeCode=${encodeURIComponent(employeeCode)}&source=LARK_BASE`;

  return (
    <div className="mb-4">
      <SectionHeader
        icon={ClipboardList}
        title={t('penalties.title')}
        to={openTo}
        label={t('employees.openList')}
      />
      <p className="mb-2 text-xs text-[#9aa3b5]">
        {t('employees.penaltyCombinedHint')}{' '}
        <Link to={larkOpenTo} className="text-[#4ade80] hover:underline">
          {t('employees.larkPayItems.title')}
        </Link>
      </p>
      {larkItems.isError ? (
        <p className="mb-2 text-sm text-[#f87171]">{getApiErrorMessage(larkItems.error)}</p>
      ) : null}
      {hiddenByPeriod ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-3 py-2 text-sm text-[#fde68a]">
          <span>
            {t('employees.larkPayItems.hiddenByPeriod', {
              period,
              count: allLarkPenalties.length,
            })}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={onClearPeriod}>
            {t('common.allPeriods')}
          </Button>
        </div>
      ) : null}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage={
          larkItems.isError
            ? getApiErrorMessage(larkItems.error)
            : rows.length === 0
              ? t('employees.penaltyEmpty')
              : t('employees.noPeriodData')
        }
        count={rows.length || total}
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
