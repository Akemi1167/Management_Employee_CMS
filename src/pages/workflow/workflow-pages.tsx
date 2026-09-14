import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { formatDate } from '@/lib/period';
import { fetchImports } from '@/services/import.service';
import {
  approveSession,
  fetchPendingApprovals,
  fetchPeriods,
  lockPeriod,
  publishSession,
  rejectSession,
} from '@/services/workflow.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DataPeriod, PendingApproval } from '@/types/api';

export function ApprovalsListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dataType, setDataType] = useState('');
  const [period, setPeriod] = useState('');
  const [selected, setSelected] = useState<PendingApproval | null>(null);
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [expectedRecordCount, setExpectedRecordCount] = useState('');
  const [expectedTotalAmount, setExpectedTotalAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', dataType, period],
    queryFn: () =>
      fetchPendingApprovals({
        dataType: dataType || undefined,
        period: period || undefined,
        limit: 50,
      }),
  });

  const mutate = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      if (mode === 'reject') return rejectSession(selected.sessionId, reason);
      return approveSession(selected.sessionId, {
        reason: reason || undefined,
        expectedRecordCount: expectedRecordCount ? Number(expectedRecordCount) : undefined,
        expectedTotalAmount: expectedTotalAmount || undefined,
      });
    },
    onSuccess: () => {
      toast.success(mode === 'reject' ? t('approvals.rejected') : t('approvals.approved'));
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<PendingApproval>[] = [
    {
      key: 'code',
      header: t('imports.code'),
      render: (row) => (
        <Link className="text-[#4ade80] hover:underline" to={`/imports/${row.sessionId}`} onClick={(e) => e.stopPropagation()}>
          {row.code}
        </Link>
      ),
    },
    { key: 'dataType', header: t('common.dataType'), render: (row) => t(`dataType.${row.dataType}`) },
    { key: 'period', header: t('common.period') },
    { key: 'validRows', header: t('imports.validRows'), render: (row) => row.totals.validRows },
    { key: 'totalAmount', header: t('imports.totalAmount'), render: (row) => moneyText(row.totals.totalAmount) },
    { key: 'submittedAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.submittedAt) },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            onClick={() => {
              setSelected(row);
              setMode('approve');
              setReason('');
              setExpectedRecordCount(String(row.totals.validRows ?? ''));
              setExpectedTotalAmount(row.totals.totalAmount ?? '');
            }}
          >
            {t('approvals.approve')}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setSelected(row);
              setMode('reject');
              setReason('');
            }}
          >
            {t('approvals.reject')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('approvals.title')} description={t('approvals.description')} />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Select value={dataType} onChange={(e) => setDataType(e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="ATTENDANCE">{t('dataType.ATTENDANCE')}</option>
          <option value="PENALTY">{t('dataType.PENALTY')}</option>
          <option value="PAYROLL">{t('dataType.PAYROLL')}</option>
        </Select>
        <Input className="max-w-[140px]" placeholder="YYYY-MM" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </div>
      <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} />
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={mode === 'reject' ? t('approvals.reject') : t('approvals.approve')}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={mode === 'reject' ? 'destructive' : 'default'}
              disabled={(mode === 'reject' && reason.length < 10) || mutate.isPending}
              onClick={() => mutate.mutate()}
            >
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        {mode === 'approve' ? (
          <>
            <div className="mb-3 space-y-1.5">
              <Label>{t('approvals.expectedCount')}</Label>
              <Input value={expectedRecordCount} onChange={(e) => setExpectedRecordCount(e.target.value)} />
            </div>
            <div className="mb-3 space-y-1.5">
              <Label>{t('approvals.expectedAmount')}</Label>
              <Input value={expectedTotalAmount} onChange={(e) => setExpectedTotalAmount(e.target.value)} />
            </div>
          </>
        ) : null}
        <div className="space-y-1.5">
          <Label>{mode === 'reject' ? t('approvals.rejectReason') : t('common.reason')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </PageContainer>
  );
}

export function PublishingPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canPublish = useAuthStore((s) => s.hasPermission(PERMISSION.DATA_PUBLISH));
  const canLock = useAuthStore((s) => s.hasPermission(PERMISSION.DATA_LOCK));
  const [sessionId, setSessionId] = useState('');
  const [expectedRecordCount, setExpectedRecordCount] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [lockTarget, setLockTarget] = useState<DataPeriod | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['periods', periodFilter, statusFilter],
    queryFn: () =>
      fetchPeriods({
        limit: 50,
        period: periodFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const approved = useQuery({
    queryKey: ['imports', 'APPROVED'],
    queryFn: () => fetchImports({ status: 'APPROVED', limit: 50 }),
    enabled: canPublish,
  });

  const runSensitive = async (action: string, fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      void queryClient.invalidateQueries({ queryKey: ['periods'] });
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (/xac thuc lai|xác thực lại/i.test(message)) {
        setStepUp({ action, retry: () => void runSensitive(action, fn, success) });
        return;
      }
      toast.error(message);
    }
  };

  const columns: Column<DataPeriod>[] = [
    { key: 'dataType', header: t('common.dataType'), render: (row) => t(`dataType.${row.dataType}`) },
    { key: 'period', header: t('common.period') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="periodStatus" /> },
    { key: 'currentVersion', header: t('publishing.version') },
    { key: 'recordCount', header: t('publishing.records') },
    { key: 'publishedAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.publishedAt) },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) =>
        canLock && row.status === 'PUBLISHED' ? (
          <Button size="sm" variant="destructive" onClick={() => setLockTarget(row)}>
            {t('publishing.lock')}
          </Button>
        ) : null,
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('publishing.title')} description={t('publishing.description')} />
      {canPublish ? (
        <div className={`${cardClass} mb-4 flex flex-wrap items-end gap-2 p-4`}>
          <div className="space-y-1.5">
            <Label>{t('publishing.approvedSessions')}</Label>
            <Select
              className="w-80"
              value={sessionId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSessionId(nextId);
                const session = approved.data?.items.find((item) => item.id === nextId);
                setExpectedRecordCount(session ? String(session.totals.validRows) : '');
              }}
            >
              <option value="">{t('publishing.selectSession')}</option>
              {(approved.data?.items ?? []).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.code} · {t(`dataType.${session.dataType}`)} · {session.period} · {session.totals.validRows}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('publishing.expectedCount')}</Label>
            <Input
              className="w-36"
              value={expectedRecordCount}
              onChange={(e) => setExpectedRecordCount(e.target.value)}
            />
          </div>
          <Button
            disabled={!sessionId}
            onClick={() =>
              void runSensitive(
                `publish:${sessionId}`,
                () =>
                  publishSession(sessionId, {
                    expectedRecordCount: expectedRecordCount ? Number(expectedRecordCount) : undefined,
                  }),
                t('publishing.published'),
              )
            }
          >
            {t('publishing.publish')}
          </Button>
        </div>
      ) : null}
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Input
          className="max-w-[140px]"
          placeholder="YYYY-MM"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'LOCKED', 'CANCELLED'].map((value) => (
            <option key={value} value={value}>
              {t(`periodStatus.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} loading={isLoading} />
      <Dialog
        open={Boolean(lockTarget)}
        onClose={() => setLockTarget(null)}
        title={t('publishing.lock')}
        footer={
          <>
            <Button variant="outline" onClick={() => setLockTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={lockReason.length < 10}
              onClick={() => {
                if (!lockTarget) return;
                void runSensitive(
                  `lock:${lockTarget.id}`,
                  () => lockPeriod(lockTarget.id, lockReason),
                  t('publishing.locked'),
                );
                setLockTarget(null);
                setLockReason('');
              }}
            >
              {t('publishing.lock')}
            </Button>
          </>
        }
      >
        <Label>{t('publishing.lockReason')}</Label>
        <Input className="mt-2" value={lockReason} onChange={(e) => setLockReason(e.target.value)} />
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
