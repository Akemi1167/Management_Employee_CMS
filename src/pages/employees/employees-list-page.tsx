import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { formatDay } from '@/lib/period';
import { hasAssignedWallet } from '@/lib/wallet-workflow';
import { fetchEmployees } from '@/services/employee.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Employee } from '@/types/api';

const PAGE_SIZE = 20;

export function EmployeesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canImport = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const canUpdate = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_UPDATE));
  const canWallet = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_WRITE));
  const canWalletRead = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_READ));
  const canPortal = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const [query, setQuery] = useState(searchParams.get('query') ?? '');
  const [departmentCode, setDepartmentCode] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState(searchParams.get('employmentStatus') ?? '');
  const [applied, setApplied] = useState({
    query: searchParams.get('query') ?? '',
    departmentCode: '',
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
        employmentStatus: applied.employmentStatus || undefined,
      }),
  });

  const applyFilters = (status = employmentStatus) => {
    setPage(1);
    setEmploymentStatus(status);
    setApplied({
      query: query.trim(),
      departmentCode: departmentCode.trim(),
      employmentStatus: status,
    });
  };

  const columns: Column<Employee>[] = [
    { key: 'employeeCode', header: t('employees.code') },
    { key: 'fullName', header: t('employees.name') },
    { key: 'workEmail', header: t('employees.workEmail'), render: (row) => row.workEmail || '—' },
    { key: 'departmentCode', header: t('employees.department') },
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
          canImport ? (
            <Button asChild>
              <Link to="/employees/import">{t('employees.importTitle')}</Link>
            </Button>
          ) : null
        }
      />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Input
          className="max-w-xs"
          placeholder={t('employees.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Input
          className="max-w-[180px]"
          placeholder={t('employees.department')}
          value={departmentCode}
          onChange={(e) => setDepartmentCode(e.target.value)}
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
