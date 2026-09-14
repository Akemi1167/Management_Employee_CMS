import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
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
import { fetchEmployees } from '@/services/employee.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Employee } from '@/types/api';

const PAGE_SIZE = 20;

export function EmployeesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canImport = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const [query, setQuery] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [applied, setApplied] = useState({ query: '', departmentCode: '', employmentStatus: '' });
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

  const columns: Column<Employee>[] = [
    { key: 'employeeCode', header: t('employees.code') },
    { key: 'fullName', header: t('employees.name') },
    { key: 'departmentCode', header: t('employees.department') },
    { key: 'position', header: t('employees.position') },
    {
      key: 'employmentStatus',
      header: t('common.status'),
      render: (row) => <StatusBadge value={row.employmentStatus} ns="employment" />,
    },
    {
      key: 'larkSyncStatus',
      header: 'LARK',
      render: (row) => <StatusBadge value={row.larkSyncStatus} ns="larkStatus" />,
    },
    { key: 'hiredAt', header: t('employees.hiredAt'), render: (row) => formatDay(row.hiredAt) },
    {
      key: 'wallet',
      header: t('employees.wallet'),
      render: (row) => row.wallet.addressMasked || '—',
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
        <Button
          onClick={() => {
            setPage(1);
            setApplied({ query: query.trim(), departmentCode: departmentCode.trim(), employmentStatus });
          }}
        >
          <Search className="h-4 w-4" />
          {t('common.search')}
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
