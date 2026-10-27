import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmployeeSuggestInput } from '@/components/shared/employee-suggest-input';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { formatDay } from '@/lib/period';
import { hasAssignedWallet } from '@/lib/wallet-workflow';
import { managersByRegion } from '@/lib/region-managers';
import { fetchEmployees } from '@/services/employee.service';
import { fetchUsers } from '@/services/user.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Employee } from '@/types/api';

const PAGE_SIZE = 20;

export function EmployeesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canImport = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const canUpdate = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_UPDATE));
  const canWallet = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_WRITE));
  const canWalletRead = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_READ));
  const canPortal = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const canReadUsers = useAuthStore((s) => s.hasPermission(PERMISSION.USER_READ));
  const initialUnassigned = searchParams.get('unassigned') === '1';
  const [query, setQuery] = useState(searchParams.get('query') ?? '');
  const [departmentCode, setDepartmentCode] = useState(searchParams.get('departmentCode') ?? '');
  const [regionCode, setRegionCode] = useState(initialUnassigned ? '' : (searchParams.get('regionCode') ?? ''));
  const [employmentStatus, setEmploymentStatus] = useState(searchParams.get('employmentStatus') ?? '');
  const [applied, setApplied] = useState({
    query: searchParams.get('query') ?? '',
    departmentCode: searchParams.get('departmentCode') ?? '',
    regionCode: initialUnassigned ? '' : (searchParams.get('regionCode') ?? ''),
    unassignedOnly: initialUnassigned,
    employmentStatus: searchParams.get('employmentStatus') ?? '',
  });
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', applied, page],
    queryFn: () =>
      fetchEmployees({
        page,
        pageSize: PAGE_SIZE,
        query: applied.query || undefined,
        departmentCode: applied.departmentCode || undefined,
        regionCode: applied.unassignedOnly ? undefined : applied.regionCode || undefined,
        unassignedRegion: applied.unassignedOnly || undefined,
        employmentStatus: applied.employmentStatus || undefined,
      }),
  });
  const managers = useQuery({
    queryKey: ['cms-users', 'region-managers'],
    queryFn: () => fetchUsers({ page: 1, pageSize: 200, status: 'ACTIVE' }),
    enabled: canReadUsers,
  });
  const managerNames = useMemo(
    () => managersByRegion(managers.data?.items ?? []),
    [managers.data?.items],
  );
  const publishFilters = (next: typeof applied) => {
    const params = new URLSearchParams();
    if (next.query) params.set('query', next.query);
    if (next.departmentCode) params.set('departmentCode', next.departmentCode);
    if (next.unassignedOnly) params.set('unassigned', '1');
    else if (next.regionCode) params.set('regionCode', next.regionCode);
    if (next.employmentStatus) params.set('employmentStatus', next.employmentStatus);
    setSearchParams(params, { replace: true });
    setApplied(next);
  };

  const applyFilters = (status = employmentStatus, nextQuery = query) => {
    const trimmed = nextQuery.trim();
    setPage(1);
    setQuery(trimmed);
    setEmploymentStatus(status);
    publishFilters({
      query: trimmed,
      departmentCode: departmentCode.trim(),
      regionCode: regionCode.trim(),
      unassignedOnly: false,
      employmentStatus: status,
    });
  };

  const columns: Column<Employee>[] = [
    { key: 'employeeCode', header: t('employees.code') },
    { key: 'fullName', header: t('employees.name') },
    { key: 'workEmail', header: t('employees.workEmail'), render: (row) => row.workEmail || '—' },
    { key: 'departmentCode', header: t('employees.department') },
    {
      key: 'regionCode',
      header: t('employees.region'),
      sortValue: (row) => row.regionCode ?? '',
      render: (row) => {
        const code = row.regionCode?.trim();
        if (!code) {
          return (
            <Link
              to="/regions?unassigned=1"
              className="text-[#fbbf24] hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {t('employees.unassignedRegion')}
            </Link>
          );
        }
        const owners = managerNames.get(code) ?? [];
        return (
          <span className="inline-flex flex-wrap items-center gap-x-2" onClick={(event) => event.stopPropagation()}>
            <Link to={`/regions?region=${encodeURIComponent(code)}`} className="text-[#4ade80] hover:underline">
              {code}
            </Link>
            {owners.map((owner) => (
              <Link key={owner.id} to={`/users/${owner.id}`} className="text-[#9aa3b5] hover:underline">
                {owner.name}
              </Link>
            ))}
          </span>
        );
      },
    },
    { key: 'position', header: t('employees.position'), render: (row) => row.position || '—' },
    {
      key: 'employmentStatus',
      header: t('common.status'),
      render: (row) => <StatusBadge value={row.employmentStatus} ns="employment" />,
    },
    { key: 'hiredAt', header: t('employees.hiredAt'), render: (row) => formatDay(row.hiredAt) },
    { key: 'terminatedAt', header: t('employees.terminatedAt'), render: (row) => formatDay(row.terminatedAt) },
    {
      key: 'wallet',
      header: t('employees.walletColumn'),
      sortValue: (row) => row.wallet?.addressMasked,
      render: (row) => (
        <span>
          {row.wallet?.addressMasked || '—'}
          {row.wallet?.hasImage ? (
            <span className="ml-2 text-[10px] text-[#4ade80]">{t('employees.walletHasImage')}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          {canUpdate ? (
            <Link to={`/employees/${row.id}#employee-profile`} className="text-[#4ade80] hover:underline">
              {t('common.edit')}
            </Link>
          ) : null}
          {canWallet && !hasAssignedWallet(row.wallet) ? (
            <Link to={`/employees/${row.id}#employee-wallet`} className="text-[#9aa3b5] hover:underline">
              {t('employees.assignWallet')}
            </Link>
          ) : null}
          {canWalletRead && hasAssignedWallet(row.wallet) ? (
            <Link
              to={`/wallet?employeeCode=${encodeURIComponent(row.employeeCode)}`}
              className="text-[#9aa3b5] hover:underline"
            >
              {t('employees.viewWallet')}
            </Link>
          ) : null}
          {canPortal ? (
            <Link to={`/employees/${row.id}#portal-account`} className="text-[#9aa3b5] hover:underline">
              {t('employees.setPortalPassword')}
            </Link>
          ) : null}
          {canUpdate ? (
            <Link to={`/employees/${row.id}#delete-employee`} className="text-[#f87171] hover:underline">
              {t('employees.deleteProfile')}
            </Link>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('employees.title')}
        description={t('employees.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            {canWallet ? (
              <Button variant="outline" asChild>
                <Link to="/employees/wallets/import">{t('employees.walletImportTitle')}</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/regions">{t('nav.regions')}</Link>
            </Button>
            {canImport ? (
              <Button asChild>
                <Link to="/employees/import">{t('employees.importTitle')}</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <EmployeeSuggestInput
          className="max-w-xs"
          placeholder={t('employees.searchPlaceholder')}
          value={query}
          onChange={setQuery}
          onSubmit={() => applyFilters()}
          onSelect={(employee) => applyFilters(employmentStatus, employee.fullName)}
        />
        <Input
          className="max-w-[180px]"
          placeholder={t('employees.department')}
          value={departmentCode}
          onChange={(e) => setDepartmentCode(e.target.value)}
        />
        <Input
          className="max-w-[140px]"
          placeholder={t('employees.region')}
          value={regionCode}
          onChange={(e) => setRegionCode(e.target.value)}
        />
        <Select value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="ACTIVE">{t('employment.ACTIVE')}</option>
          <option value="ON_LEAVE">{t('employment.ON_LEAVE')}</option>
          <option value="SUSPENDED">{t('employment.SUSPENDED')}</option>
          <option value="TERMINATED">{t('employment.TERMINATED')}</option>
        </Select>
        <Button onClick={() => applyFilters()}>
          <Search className="h-4 w-4" />
          {t('common.search')}
        </Button>
        <Button variant="outline" onClick={() => applyFilters('TERMINATED')}>
          {t('employees.filterTerminated')}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/employees/${row.id}`)}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageChange: setPage,
        }}
      />
    </PageContainer>
  );
}
