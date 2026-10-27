import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass, textSubtle } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { managersByRegion, type RegionManager } from '@/lib/region-managers';
import { assignEmployeeRegions, fetchEmployees } from '@/services/employee.service';
import { fetchUsers } from '@/services/user.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Employee } from '@/types/api';

const PAGE_SIZE = 20;

function splitCodes(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function EmployeeRegionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_UPDATE));
  const canReadUsers = useAuthStore((s) => s.hasPermission(PERMISSION.USER_READ));
  const managedRegions = useAuthStore((s) => s.user?.dataScope.regionCodes ?? []);
  const requestedRegion = searchParams.get('region')?.trim() ?? '';
  const unassigned = searchParams.get('unassigned') === '1' || !requestedRegion;
  const activeRegion = unassigned ? '' : requestedRegion;
  const [page, setPage] = useState(1);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [assignRegion, setAssignRegion] = useState(managedRegions.length === 1 ? managedRegions[0] : '');
  const [assignReason, setAssignReason] = useState('');
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [departmentCodes, setDepartmentCodes] = useState('');
  const [departmentRegion, setDepartmentRegion] = useState(managedRegions.length === 1 ? managedRegions[0] : '');
  const [departmentReason, setDepartmentReason] = useState('');
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const managers = useQuery({
    queryKey: ['cms-users', 'region-managers'],
    queryFn: () => fetchUsers({ page: 1, pageSize: 200, status: 'ACTIVE' }),
    enabled: canReadUsers,
  });
  const managerNames = useMemo(
    () => managersByRegion(managers.data?.items ?? []),
    [managers.data?.items],
  );
  const regionRows = useMemo(() => {
    const rows = new Map(managerNames);
    for (const code of managedRegions) {
      if (code.trim() && !rows.has(code)) rows.set(code, []);
    }
    if (activeRegion && !rows.has(activeRegion)) rows.set(activeRegion, []);
    return [...rows.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [activeRegion, managerNames, managedRegions]);
  const activeManagers: RegionManager[] = activeRegion ? (managerNames.get(activeRegion) ?? []) : [];

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'regions', activeRegion, unassigned, page],
    queryFn: () =>
      fetchEmployees({
        page,
        pageSize: PAGE_SIZE,
        regionCode: unassigned ? undefined : activeRegion,
        unassignedRegion: unassigned || undefined,
      }),
  });

  const choose = (next: 'unassigned' | string) => {
    setPage(1);
    setSelectedCodes([]);
    setSearchParams(next === 'unassigned' ? { unassigned: '1' } : { region: next });
  };

  const pageEmployees = data?.items ?? [];
  const pageCodes = pageEmployees.map((row) => row.employeeCode);
  const pageSelected = pageCodes.length > 0 && pageCodes.every((code) => selectedCodes.includes(code));
  const toggleCode = (code: string) => {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };
  const togglePage = () => {
    setSelectedCodes((current) =>
      pageSelected ? current.filter((code) => !pageCodes.includes(code)) : [...new Set([...current, ...pageCodes])],
    );
  };

  const departmentTargets = splitCodes(departmentCodes);
  const canAssignSelected = assignRegion.trim().length > 0 && assignReason.trim().length >= 10 && selectedCodes.length > 0;
  const canAssignDepartment =
    departmentRegion.trim().length > 0 && departmentReason.trim().length >= 10 && departmentTargets.length > 0;

  const runOrStepUp = (error: unknown, retry: () => void) => {
    const message = getApiErrorMessage(error);
    if (/xac thuc lai|xác thực lại/i.test(message)) {
      setStepUp({ action: 'employee:update', retry });
      return;
    }
    toast.error(message);
  };

  const assignSelected = useMutation({
    mutationFn: () =>
      assignEmployeeRegions({
        regionCode: assignRegion.trim(),
        employeeCodes: selectedCodes,
        reason: assignReason.trim(),
      }),
    onSuccess: (result) => {
      toast.success(
        t('employees.assignRegionSaved', {
          region: result.regionCode,
          modified: result.modified,
          matched: result.matched,
        }),
      );
      setAssignReason('');
      setSelectedCodes([]);
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error) => runOrStepUp(error, () => assignSelected.mutate()),
  });

  const assignDepartment = useMutation({
    mutationFn: () =>
      assignEmployeeRegions({
        regionCode: departmentRegion.trim(),
        departmentCodes: departmentTargets,
        reason: departmentReason.trim(),
      }),
    onSuccess: (result) => {
      toast.success(
        t('employees.assignRegionSaved', {
          region: result.regionCode,
          modified: result.modified,
          matched: result.matched,
        }),
      );
      setDepartmentOpen(false);
      setDepartmentCodes('');
      setDepartmentReason('');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error) => runOrStepUp(error, () => assignDepartment.mutate()),
  });

  const columns: Column<Employee>[] = [
    ...(unassigned && canUpdate
      ? [
          {
            key: 'select',
            header: '',
            sortable: false,
            render: (row: Employee) => (
              <input
                type="checkbox"
                checked={selectedCodes.includes(row.employeeCode)}
                aria-label={row.employeeCode}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleCode(row.employeeCode)}
              />
            ),
          } satisfies Column<Employee>,
        ]
      : []),
    { key: 'employeeCode', header: t('employees.code') },
    { key: 'fullName', header: t('employees.name') },
    { key: 'departmentCode', header: t('employees.department') },
    {
      key: 'employmentStatus',
      header: t('common.status'),
      render: (row) => <StatusBadge value={row.employmentStatus} ns="employment" />,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('employees.regionsTitle')}
        description={t('employees.regionsDescription')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/employees">{t('employees.title')}</Link>
          </Button>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={`${cardClass} p-3`}>
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9aa3b5]">
            {t('employees.regionList')}
          </p>
          <div className="space-y-1">
            <button
              type="button"
              className={rowClass(unassigned)}
              onClick={() => choose('unassigned')}
            >
              {t('employees.unassignedRegion')}
            </button>
            {regionRows.map(([region, owners]) => (
              <button key={region} type="button" className={rowClass(activeRegion === region)} onClick={() => choose(region)}>
                <span className="block font-medium">{region}</span>
                <span className="mt-0.5 block truncate text-xs text-[#9aa3b5]">
                  {owners.length > 0 ? owners.map((owner) => owner.name).join(', ') : t('employees.noManager')}
                </span>
              </button>
            ))}
          </div>
          {canReadUsers && regionRows.length === 0 ? (
            <p className={cn('px-2 pt-3 text-xs', textSubtle)}>{t('employees.regionManagersEmpty')}</p>
          ) : null}
          {canReadUsers ? (
            <Link to="/users" className="mt-3 block px-2 text-xs text-[#4ade80] hover:underline">
              {t('employees.assignManagers')}
            </Link>
          ) : null}
        </aside>

        <section>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#eef0f6]">
                {unassigned ? t('employees.unassignedRegion') : activeRegion}
              </h2>
              {unassigned ? (
                <p className={cn('mt-1 text-sm', textSubtle)}>{t('employees.pickEmployees')}</p>
              ) : (
                <p className="mt-1 text-sm text-[#9aa3b5]">
                  {t('employees.managedBy')}:{' '}
                  {activeManagers.length > 0 ? (
                    activeManagers.map((owner) => (
                      <Link key={owner.id} to={`/users/${owner.id}`} className="mr-2 text-[#4ade80] hover:underline">
                        {owner.name}
                      </Link>
                    ))
                  ) : canReadUsers ? (
                    <Link to="/users" className="text-[#4ade80] hover:underline">
                      {t('employees.noManager')}
                    </Link>
                  ) : (
                    t('employees.noManager')
                  )}
                </p>
              )}
            </div>
            {unassigned && canUpdate ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={togglePage} disabled={pageCodes.length === 0}>
                  {t('employees.selectPage')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDepartmentOpen(true)}>
                  {t('employees.assignDepartmentAction')}
                </Button>
              </div>
            ) : null}
          </div>

          {unassigned && canUpdate && selectedCodes.length > 0 ? (
            <form
              className={`${cardClass} mb-3 flex flex-wrap items-end gap-2 p-3`}
              onSubmit={(event) => {
                event.preventDefault();
                if (canAssignSelected) assignSelected.mutate();
              }}
            >
              <p className="pb-2 text-sm text-[#eef0f6]">
                {t('employees.selectedCount', { count: selectedCodes.length })}
              </p>
              <Input
                className="w-36"
                list="region-targets"
                value={assignRegion}
                placeholder={t('employees.regionPlaceholder')}
                aria-label={t('employees.region')}
                onChange={(event) => setAssignRegion(event.target.value)}
              />
              <datalist id="region-targets">
                {regionRows.map(([region]) => (
                  <option key={region} value={region} />
                ))}
              </datalist>
              <Input
                className="min-w-48 flex-1"
                value={assignReason}
                placeholder={t('common.reason')}
                aria-label={t('common.reason')}
                onChange={(event) => setAssignReason(event.target.value)}
              />
              <Button type="submit" disabled={!canAssignSelected || assignSelected.isPending}>
                {t('employees.assignRegion')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedCodes([])}>
                {t('employees.clearSelection')}
              </Button>
            </form>
          ) : null}

          <DataTable
            columns={columns}
            data={pageEmployees}
            loading={isLoading}
            onRowClick={(row) => navigate(`/employees/${row.id}`)}
            pagination={{
              page,
              pageSize: PAGE_SIZE,
              total: data?.total ?? 0,
              onPageChange: setPage,
            }}
          />
        </section>
      </div>

      <Dialog
        open={departmentOpen}
        onClose={() => {
          if (!assignDepartment.isPending) setDepartmentOpen(false);
        }}
        title={t('employees.assignDepartmentAction')}
        footer={
          <Button
            type="button"
            disabled={!canAssignDepartment || assignDepartment.isPending}
            onClick={() => assignDepartment.mutate()}
          >
            {t('employees.assignRegion')}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className={cn('text-sm', textSubtle)}>{t('employees.assignRegionHint')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="dept-region">{t('employees.region')}</Label>
            <Input
              id="dept-region"
              list="region-targets"
              value={departmentRegion}
              placeholder={t('employees.regionPlaceholder')}
              onChange={(event) => setDepartmentRegion(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-codes">{t('employees.assignDepartments')}</Label>
            <Input
              id="dept-codes"
              value={departmentCodes}
              placeholder={t('users.departmentsPlaceholder')}
              onChange={(event) => setDepartmentCodes(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-reason">{t('common.reason')}</Label>
            <Input
              id="dept-reason"
              value={departmentReason}
              onChange={(event) => setDepartmentReason(event.target.value)}
            />
          </div>
        </div>
      </Dialog>
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}

function rowClass(active: boolean) {
  return cn(
    'w-full rounded-md px-2 py-2 text-left text-sm',
    active ? 'bg-[#16a34a]/15 text-[#eef0f6]' : 'text-[#b8bfd0] hover:bg-[#222736]',
  );
}
