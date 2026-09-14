import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { CreateButton } from '@/components/shared/create-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass } from '@/constants/theme';
import { PERMISSION, DESTRUCTIVE_SYNC_TYPES } from '@/constants/api-endpoints';
import { formatDate } from '@/lib/period';
import { changeId, getApiErrorMessage } from '@/lib/api-client';
import {
  applyEmployeeSync,
  discardEmployeeSync,
  fetchEmployeeSync,
  fetchEmployeeSyncSessions,
  previewEmployeeSync,
} from '@/services/employee-sync.service';
import { useAuthStore } from '@/stores/auth-store';
import type { EmployeeSyncSession, SyncChange } from '@/types/api';

export function EmployeeSyncListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employee-sync'],
    queryFn: () => fetchEmployeeSyncSessions(30),
  });

  const preview = useMutation({
    mutationFn: previewEmployeeSync,
    onSuccess: (session) => {
      toast.success(t('employeeSync.previewed'));
      void refetch();
      navigate(`/employee-sync/${session.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<Omit<EmployeeSyncSession, 'changes'>>[] = [
    { key: 'code', header: t('imports.code') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="workflow" /> },
    { key: 'larkFetchedAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.larkFetchedAt) },
    { key: 'toCreate', header: t('syncChange.CREATE'), render: (row) => row.counters.toCreate },
    { key: 'toUpdate', header: t('syncChange.UPDATE_PROFILE'), render: (row) => row.counters.toUpdate },
    { key: 'needsConfirmation', header: t('employeeSync.needsConfirmation'), render: (row) => row.counters.needsConfirmation },
    { key: 'conflicts', header: t('syncChange.CONFLICT'), render: (row) => row.counters.conflicts },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('employeeSync.title')}
        description={t('employeeSync.description')}
        actions={
          canWrite ? (
            <CreateButton onClick={() => preview.mutate()} disabled={preview.isPending}>
              {t('employeeSync.preview')}
            </CreateButton>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/employee-sync/${row.id}`)}
      />
    </PageContainer>
  );
}

export function EmployeeSyncDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const [selected, setSelected] = useState<string[]>([]);
  const [discardReason, setDiscardReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['employee-sync', id],
    queryFn: () => fetchEmployeeSync(id),
    enabled: Boolean(id),
  });

  const destructive = useMemo(
    () => (data?.changes ?? []).filter((change) => change.requiresConfirmation || DESTRUCTIVE_SYNC_TYPES.has(change.changeType)),
    [data],
  );

  const apply = useMutation({
    mutationFn: () => applyEmployeeSync(id, selected),
    onSuccess: () => {
      toast.success(t('employeeSync.applied'));
      void queryClient.invalidateQueries({ queryKey: ['employee-sync'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const discard = useMutation({
    mutationFn: () => discardEmployeeSync(id, discardReason),
    onSuccess: () => {
      toast.success(t('employeeSync.discarded'));
      void queryClient.invalidateQueries({ queryKey: ['employee-sync'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<SyncChange>[] = [
    {
      key: 'select',
      header: t('employeeSync.requiresConfirm'),
      render: (row) => {
        const id = changeId(row);
        if (!row.requiresConfirmation || !id) return '—';
        return (
          <input
            type="checkbox"
            checked={selected.includes(id)}
            onChange={(e) => {
              setSelected((prev) =>
                e.target.checked ? [...prev, id] : prev.filter((value) => value !== id),
              );
            }}
          />
        );
      },
    },
    { key: 'changeType', header: t('common.dataType'), render: (row) => t(`syncChange.${row.changeType}`) },
    { key: 'employeeCode', header: t('employees.code') },
    {
      key: 'fields',
      header: t('employeeSync.changes'),
      render: (row) =>
        row.fields.length
          ? row.fields.map((field) => `${field.field}: ${field.before ?? '—'} → ${field.after ?? '—'}`).join('; ')
          : row.note ?? '—',
    },
  ];

  const pending = data?.status === 'DRAFT' || data?.status === 'VALIDATED';

  return (
    <PageContainer>
      <PageHeader
        title={data?.code ?? t('employeeSync.title')}
        description={t('employeeSync.description')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/employee-sync">{t('common.back')}</Link>
          </Button>
        }
      />
      {isLoading || !data ? (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      ) : (
        <>
          <div className={`${cardClass} mb-4 grid gap-3 p-5 sm:grid-cols-4`}>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.status')}</p>
              <StatusBadge value={data.status} ns="workflow" />
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employeeSync.larkTotal')}</p>
              <p>{data.counters.larkTotal}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('syncChange.CREATE')}</p>
              <p>{data.counters.toCreate}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('syncChange.UPDATE_PROFILE')}</p>
              <p>{data.counters.toUpdate}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employeeSync.needsConfirmation')}</p>
              <p>{data.counters.needsConfirmation}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('syncChange.MISSING_IN_LARK')}</p>
              <p>{data.counters.missingInLark}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('syncChange.CONFLICT')}</p>
              <p>{data.counters.conflicts}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employeeSync.unchanged')}</p>
              <p>{data.counters.unchanged}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employeeSync.skippedWithoutUnionId')}</p>
              <p>{data.counters.skippedWithoutUnionId}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employeeSync.requiresConfirm')}</p>
              <p>{destructive.length}</p>
            </div>
          </div>
          <DataTable columns={columns} data={data.changes ?? []} />
          {canWrite && pending ? (
            <div className={`${cardClass} mt-4 space-y-4 p-5`}>
              <p className="text-sm text-[#b8bfd0]">{t('employeeSync.confirmDestructive')}</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
                  {t('employeeSync.apply')}
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>{t('employeeSync.discardReason')}</Label>
                <Input value={discardReason} onChange={(e) => setDiscardReason(e.target.value)} />
                <Button
                  variant="destructive"
                  disabled={discardReason.length < 10 || discard.isPending}
                  onClick={() => discard.mutate()}
                >
                  {t('employeeSync.discard')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
