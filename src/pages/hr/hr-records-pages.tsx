import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { previousPeriod } from '@/lib/period';
import {
  fetchAttendance,
  fetchAttendanceRecord,
  fetchPayroll,
  fetchPayrollRecord,
  fetchPenalties,
  fetchPenaltyRecord,
  patchAttendance,
  patchPayroll,
  patchPenalty,
} from '@/services/hr-records.service';
import { useAuthStore } from '@/stores/auth-store';
import type { AttendanceRecord, PayrollRecord, PenaltyRecord, WorkflowStatus } from '@/types/api';

const PAGE_SIZE = 20;
const WORKFLOW_FILTERS: WorkflowStatus[] = [
  'UPLOADED',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
];

function compactFields(form: Record<string, string>) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
}

function FilterBar() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') ?? previousPeriod();
  const source = searchParams.get('source') ?? 'staging';
  const status = searchParams.get('status') ?? '';
  const importSessionId = searchParams.get('importSessionId') ?? '';

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  };

  return (
    <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
      <Input
        className="max-w-[140px]"
        value={period}
        onChange={(e) => update({ period: e.target.value })}
        placeholder="YYYY-MM"
      />
      <Select value={source} onChange={(e) => update({ source: e.target.value })}>
        <option value="staging">{t('source.staging')}</option>
        <option value="published">{t('source.published')}</option>
      </Select>
      {source === 'staging' ? (
        <Select value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">{t('common.all')}</option>
          {WORKFLOW_FILTERS.map((value) => (
            <option key={value} value={value}>
              {t(`workflow.${value}`)}
            </option>
          ))}
        </Select>
      ) : null}
      <Input
        className="max-w-[240px]"
        value={importSessionId}
        onChange={(e) => update({ importSessionId: e.target.value.trim() })}
        placeholder={t('imports.sessionId')}
      />
    </div>
  );
}

function useHrFilters() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const period = searchParams.get('period') ?? previousPeriod();
  const source = searchParams.get('source') ?? 'staging';
  const status = searchParams.get('status') ?? '';
  const importSessionId = searchParams.get('importSessionId') ?? '';
  return {
    page,
    setPage,
    period,
    source,
    query: {
      period,
      source,
      page,
      pageSize: PAGE_SIZE,
      status: source === 'staging' && status ? status : undefined,
      importSessionId: importSessionId || undefined,
    },
  };
}

export function AttendanceListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(PERMISSION.ATTENDANCE_STAGING_UPDATE));
  const { page, setPage, source, query } = useHrFilters();
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', query],
    queryFn: () => fetchAttendance(query),
  });

  const save = useMutation({
    mutationFn: () => patchAttendance(editing!.id, { reason, ...compactFields(form) }),
    onSuccess: () => {
      toast.success(t('attendance.saved'));
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEdit = async (row: AttendanceRecord) => {
    try {
      const detail = await fetchAttendanceRecord(row.id, source);
      setEditing(detail);
      setReason('');
      setForm({
        periodWorkingDays: detail.periodWorkingDays ?? '',
        actualWorkedDays: detail.actualWorkedDays ?? '',
        overtimeDays: detail.overtimeDays ?? '',
        specialLeaveDays: detail.specialLeaveDays ?? '',
        unpaidLeaveDays: detail.unpaidLeaveDays ?? '',
        employedDays: detail.employedDays ?? '',
        note: detail.note ?? '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const columns: Column<AttendanceRecord>[] = [
    { key: 'employeeCode', header: t('employees.code'), render: (row) => row.employeeCode ?? row.employeeId ?? '—' },
    { key: 'period', header: t('common.period') },
    { key: 'periodWorkingDays', header: t('attendance.workingDays'), render: (row) => moneyText(row.periodWorkingDays ?? row.summary?.periodWorkingDays) },
    { key: 'actualWorkedDays', header: t('attendance.actualDays'), render: (row) => moneyText(row.actualWorkedDays ?? row.summary?.actualWorkedDays) },
    { key: 'overtimeDays', header: t('attendance.overtime'), render: (row) => moneyText(row.overtimeDays ?? row.summary?.overtimeDays) },
    { key: 'specialLeaveDays', header: t('attendance.specialLeave'), render: (row) => moneyText(row.specialLeaveDays ?? row.summary?.specialLeaveDays) },
    { key: 'unpaidLeaveDays', header: t('attendance.unpaidLeave'), render: (row) => moneyText(row.unpaidLeaveDays ?? row.summary?.unpaidLeaveDays) },
    { key: 'employedDays', header: t('attendance.employedDays'), render: (row) => moneyText(row.employedDays) },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="workflow" /> },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('attendance.title')} description={t('attendance.description')} />
      <FilterBar />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={canEdit && source === 'staging' ? (row) => void openEdit(row) : undefined}
        pagination={{ page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onPageChange: setPage }}
      />
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t('attendance.edit')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={reason.length < 10 || save.isPending} onClick={() => save.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {(
          [
            ['periodWorkingDays', 'workingDays'],
            ['actualWorkedDays', 'actualDays'],
            ['overtimeDays', 'overtime'],
            ['specialLeaveDays', 'specialLeave'],
            ['unpaidLeaveDays', 'unpaidLeave'],
            ['employedDays', 'employedDays'],
            ['note', 'note'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="mb-3 space-y-1.5">
            <Label>{key === 'note' ? t('common.note') : t(`attendance.${label}`)}</Label>
            <Input value={form[key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>{t('common.reason')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </PageContainer>
  );
}

export function PenaltiesListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(PERMISSION.PENALTY_STAGING_UPDATE));
  const { page, setPage, source, query } = useHrFilters();
  const [editing, setEditing] = useState<PenaltyRecord | null>(null);
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['penalties', query],
    queryFn: () => fetchPenalties(query),
  });

  const save = useMutation({
    mutationFn: () =>
      patchPenalty(editing!.id, {
        reason,
        ...compactFields({ amount, penaltyReason }),
      }),
    onSuccess: () => {
      toast.success(t('penalties.saved'));
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['penalties'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEdit = async (row: PenaltyRecord) => {
    try {
      const detail = await fetchPenaltyRecord(row.id, source);
      setEditing(detail);
      setReason('');
      setAmount(detail.amount ?? '');
      setPenaltyReason(detail.penaltyReason ?? '');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const columns: Column<PenaltyRecord>[] = [
    { key: 'employeeCode', header: t('employees.code'), render: (row) => row.employeeCode ?? row.employeeId ?? '—' },
    { key: 'period', header: t('common.period') },
    { key: 'amount', header: t('penalties.amount'), render: (row) => moneyText(row.amount ?? row.totalAmount) },
    { key: 'currency', header: t('penalties.currency') },
    { key: 'penaltyReason', header: t('penalties.reason') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="workflow" /> },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('penalties.title')} description={t('penalties.description')} />
      <FilterBar />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={canEdit && source === 'staging' ? (row) => void openEdit(row) : undefined}
        pagination={{ page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onPageChange: setPage }}
      />
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t('penalties.edit')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={reason.length < 10 || save.isPending} onClick={() => save.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="mb-3 space-y-1.5">
          <Label>{t('penalties.amount')}</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="mb-3 space-y-1.5">
          <Label>{t('penalties.reason')}</Label>
          <Input value={penaltyReason} onChange={(e) => setPenaltyReason(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('common.reason')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </PageContainer>
  );
}

export function PayrollListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.hasPermission(PERMISSION.PAYROLL_STAGING_UPDATE));
  const { page, setPage, source, query } = useHrFilters();
  const [editing, setEditing] = useState<PayrollRecord | null>(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', query],
    queryFn: () => fetchPayroll(query),
  });

  const save = useMutation({
    mutationFn: () => patchPayroll(editing!.id, { reason, ...compactFields(form) }),
    onSuccess: () => {
      toast.success(t('payroll.saved'));
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const openEdit = async (row: PayrollRecord) => {
    try {
      const detail = await fetchPayrollRecord(row.id, source);
      setEditing(detail);
      setReason('');
      setForm({
        baseSalary: detail.baseSalary ?? '',
        totalBaseSalary: detail.totalBaseSalary ?? '',
        periodSalary: detail.periodSalary ?? '',
        payableDays: detail.payableDays ?? '',
        overtimeHours: detail.overtimeHours ?? '',
        grossAmount: detail.grossAmount ?? '',
        totalDeduction: detail.totalDeduction ?? '',
        netAmount: detail.netAmount ?? '',
        usdtAmount: detail.usdtAmount ?? '',
        note: detail.note ?? '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const columns: Column<PayrollRecord>[] = [
    { key: 'employeeCode', header: t('employees.code'), render: (row) => row.employeeCode ?? row.employeeId ?? '—' },
    { key: 'period', header: t('common.period') },
    { key: 'baseSalary', header: t('payroll.baseSalary'), render: (row) => moneyText(row.baseSalary) },
    { key: 'periodSalary', header: t('payroll.periodSalary'), render: (row) => moneyText(row.periodSalary) },
    { key: 'grossAmount', header: t('payroll.gross'), render: (row) => moneyText(row.grossAmount) },
    { key: 'totalDeduction', header: t('payroll.deduction'), render: (row) => moneyText(row.totalDeduction) },
    { key: 'netAmount', header: t('payroll.net'), render: (row) => moneyText(row.netAmount) },
    { key: 'usdtAmount', header: t('payroll.usdt'), render: (row) => moneyText(row.usdtAmount) },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="workflow" /> },
  ];

  const fieldLabels: Record<string, string> = {
    baseSalary: t('payroll.baseSalary'),
    totalBaseSalary: t('payroll.totalBase'),
    periodSalary: t('payroll.periodSalary'),
    payableDays: t('payroll.payableDays'),
    overtimeHours: t('payroll.overtimeHours'),
    grossAmount: t('payroll.gross'),
    totalDeduction: t('payroll.deduction'),
    netAmount: t('payroll.net'),
    usdtAmount: t('payroll.usdt'),
    note: t('common.note'),
  };

  return (
    <PageContainer>
      <PageHeader title={t('payroll.title')} description={t('payroll.description')} />
      <FilterBar />
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={canEdit && source === 'staging' ? (row) => void openEdit(row) : undefined}
        pagination={{ page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onPageChange: setPage }}
      />
      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t('payroll.edit')}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={reason.length < 10 || save.isPending} onClick={() => save.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {editing?.components?.length ? (
          <div className="mb-4 text-sm text-[#b8bfd0]">
            <p className="mb-1 font-medium text-[#eef0f6]">{t('payroll.components')}</p>
            {editing.components.map((item) => (
              <p key={`${item.code}-${item.label}`}>
                {item.label ?? item.code}: {moneyText(item.amount == null ? null : String(item.amount))}
              </p>
            ))}
          </div>
        ) : null}
        {Object.keys(fieldLabels).map((key) => (
          <div key={key} className="mb-3 space-y-1.5">
            <Label>{fieldLabels[key]}</Label>
            <Input value={form[key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>{t('common.reason')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </PageContainer>
  );
}
