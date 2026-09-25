import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmployeeLink } from '@/components/shared/employee-link';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { isPeriodLocked, nextComplaintStatuses } from '@/lib/complaint-workflow';
import { formatDate } from '@/lib/period';
import { fetchComplaint, fetchComplaints, updateComplaint } from '@/services/complaint.service';
import {
  fetchAttendance,
  fetchPayroll,
  fetchPenalties,
  patchAttendance,
  patchPayroll,
  patchPenalty,
} from '@/services/hr-records.service';
import { fetchUsers } from '@/services/user.service';
import { fetchPeriods } from '@/services/workflow.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AttendanceRecord,
  Complaint,
  DataType,
  Paginated,
  PayrollRecord,
  PenaltyRecord,
} from '@/types/api';

function compactFields(form: Record<string, string>) {
  return Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ''));
}

export function ComplaintsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canHandle = useAuthStore((s) => s.hasPermission(PERMISSION.COMPLAINT_HANDLE));
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [subjectType, setSubjectType] = useState(searchParams.get('subjectType') ?? '');
  const [period, setPeriod] = useState(searchParams.get('period') ?? '');
  const [employeeCode, setEmployeeCode] = useState(searchParams.get('employeeCode') ?? '');
  const [assignedToMe, setAssignedToMe] = useState(searchParams.get('assignedToMe') === '1');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['complaints', status, subjectType, period, employeeCode, assignedToMe, page],
    queryFn: () =>
      fetchComplaints({
        status: status || undefined,
        subjectType: subjectType || undefined,
        period: period || undefined,
        employeeCode: employeeCode || undefined,
        assignedToMe: assignedToMe || undefined,
        page,
        pageSize: 20,
      }),
  });

  const columns: Column<Complaint>[] = [
    { key: 'code', header: t('complaints.code') },
    {
      key: 'employeeCode',
      header: t('employees.code'),
      render: (row) => <EmployeeLink id={row.employeeId} code={row.employeeCode} />,
    },
    { key: 'employeeName', header: t('employees.name') },
    { key: 'subjectType', header: t('common.dataType'), render: (row) => t(`dataType.${row.subjectType}`) },
    { key: 'period', header: t('common.period') },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge value={row.status} ns="complaintStatus" />,
    },
    { key: 'createdAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.createdAt) },
    ...(canHandle
      ? [
          {
            key: 'actions',
            header: t('common.actions'),
            render: (row: Complaint) => (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/complaints/${row.id}`);
                }}
              >
                {t('complaints.handle')}
              </Button>
            ),
          } satisfies Column<Complaint>,
        ]
      : []),
  ];

  return (
    <PageContainer>
      <PageHeader title={t('complaints.title')} description={t('complaints.description')} />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['NEW', 'IN_PROGRESS', 'WAITING_INFO', 'ADJUSTED', 'REJECTED', 'CLOSED'].map((value) => (
            <option key={value} value={value}>
              {t(`complaintStatus.${value}`)}
            </option>
          ))}
        </Select>
        <Select value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="ATTENDANCE">{t('dataType.ATTENDANCE')}</option>
          <option value="PENALTY">{t('dataType.PENALTY')}</option>
          <option value="PAYROLL">{t('dataType.PAYROLL')}</option>
        </Select>
        <Input className="max-w-[140px]" placeholder="YYYY-MM" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <Input
          className="max-w-[160px]"
          placeholder={t('employees.code')}
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-[#b8bfd0]">
          <input type="checkbox" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} />
          {t('complaints.assignedToMe')}
        </label>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/complaints/${row.id}`)}
        pagination={{ page, pageSize: 20, total: data?.total ?? 0, onPageChange: setPage }}
      />
    </PageContainer>
  );
}

export function ComplaintDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const canHandle = useAuthStore((s) => s.hasPermission(PERMISSION.COMPLAINT_HANDLE));
  const canReadImports = useAuthStore((s) => s.hasPermission(PERMISSION.IMPORT_READ));
  const canReadUsers = useAuthStore((s) => s.hasPermission(PERMISSION.USER_READ));
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [status, setStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [message, setMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [adjustmentImportSessionId, setAdjustmentImportSessionId] = useState('');

  const { data } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => fetchComplaint(id),
    enabled: Boolean(id),
  });

  const operators = useQuery({
    queryKey: ['cms-users', 'complaint-assignees'],
    queryFn: () => fetchUsers({ page: 1, pageSize: 50, status: 'ACTIVE' }),
    enabled: canReadUsers && canHandle,
  });

  const periods = useQuery({
    queryKey: ['publishing-periods', data?.period, data?.subjectType],
    queryFn: () => fetchPeriods({ period: data!.period, dataType: data!.subjectType, limit: 20 }),
    enabled: canReadImports && Boolean(data?.period),
  });
  const attendancePeriods = useQuery({
    queryKey: ['publishing-periods', data?.period, 'ATTENDANCE'],
    queryFn: () => fetchPeriods({ period: data!.period, dataType: 'ATTENDANCE', limit: 20 }),
    enabled: canReadImports && data?.subjectType === 'PENALTY',
  });
  const periodLocked = [...(periods.data?.items ?? []), ...(attendancePeriods.data?.items ?? [])].some(
    (item) => isPeriodLocked(item),
  );

  const nextStatuses = data ? nextComplaintStatuses(data.status) : [];
  const effectiveStatus = status || (data?.status === 'NEW' ? 'IN_PROGRESS' : data?.status ?? '');
  const needsMessage = effectiveStatus === 'WAITING_INFO';
  const needsResolution = effectiveStatus === 'REJECTED' || effectiveStatus === 'ADJUSTED';
  const needsInternalNote = data?.status === 'NEW' && effectiveStatus === 'IN_PROGRESS';
  const needsAdjustmentSession = periodLocked && effectiveStatus === 'ADJUSTED';

  const save = useMutation({
    mutationFn: () =>
      updateComplaint(id, {
        status: status || undefined,
        assigneeId: assigneeId || undefined,
        message: message.trim().length >= 10 ? message.trim() : undefined,
        internalNote: internalNote.trim().length >= 10 ? internalNote.trim() : undefined,
        resolution: resolution.trim().length >= 10 ? resolution.trim() : undefined,
        adjustmentImportSessionId: adjustmentImportSessionId || undefined,
      }),
    onSuccess: () => {
      toast.success(t('complaints.updated'));
      void queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      setMessage('');
      setInternalNote('');
      setResolution('');
      setStatus('');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const canSubmit =
    Boolean(data) &&
    data!.status !== 'CLOSED' &&
    (!needsMessage || message.trim().length >= 10) &&
    (!needsResolution || resolution.trim().length >= 10) &&
    (!needsInternalNote || internalNote.trim().length >= 10) &&
    (!needsAdjustmentSession || adjustmentImportSessionId.trim().length >= 1);

  return (
    <PageContainer>
      <PageHeader
        title={data?.code ?? t('complaints.title')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/complaints">{t('common.back')}</Link>
          </Button>
        }
      />
      {data ? (
        <div className="space-y-4">
          <div className={`${cardClass} grid gap-3 p-5 sm:grid-cols-2`}>
            <p>
              {t('employees.code')}: <EmployeeLink id={data.employeeId} code={data.employeeCode} /> — {data.employeeName}
            </p>
            <p>
              {t('common.dataType')}: {t(`dataType.${data.subjectType}`)} / {data.period}
            </p>
            <p>
              {t('common.status')}: <StatusBadge value={data.status} ns="complaintStatus" />
            </p>
            <p>
              {t('complaints.dataVersion')}: {data.dataVersion}
            </p>
            <p>
              {t('complaints.assignee')}: {data.assigneeId ?? '—'}
            </p>
            <p className="sm:col-span-2">
              {t('complaints.reason')}: {data.reason}
            </p>
            {data.resolution ? (
              <p className="sm:col-span-2">
                {t('complaints.resolution')}: {data.resolution}
              </p>
            ) : null}
            {data.attachments?.length ? (
              <div className="sm:col-span-2">
                <p className="mb-1">{t('complaints.attachments')}</p>
                {data.attachments.map((file) => (
                  <p key={`${file.originalFilename}-${file.sizeBytes}`} className="text-sm text-[#b8bfd0]">
                    {file.originalFilename} ({file.mimeType}, {file.sizeBytes} B)
                    {file.malwareScanned ? ` · ${t('complaints.scanned')}` : ''}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          <CorrectionPanel complaint={data} periodLocked={periodLocked} lockedSessionId={adjustmentImportSessionId} onSessionId={setAdjustmentImportSessionId} />

          <div className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-sm font-semibold">{t('complaints.history')}</h2>
            {(data.messages ?? []).map((item) => (
              <div key={item.id} className="rounded-md border border-[#2a3040] p-3 text-sm">
                <p className="text-xs text-[#9aa3b5]">
                  {item.authorType} · {formatDate(item.createdAt)} {item.internalOnly ? t('complaints.internalOnly') : ''}
                </p>
                <p>{item.content}</p>
              </div>
            ))}
          </div>

          {canHandle && data.status !== 'CLOSED' ? (
            <form
              className={`${cardClass} space-y-3 p-5`}
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                save.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>{t('common.status')}</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">{data.status === 'NEW' ? t('complaints.keepTakeIn') : t('common.optional')}</option>
                  {nextStatuses.map((value) => (
                    <option key={value} value={value}>
                      {t(`complaintStatus.${value}`)}
                    </option>
                  ))}
                </Select>
                {data.status === 'NEW' ? <p className="text-xs text-[#9aa3b5]">{t('complaints.newHint')}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>{t('complaints.assignee')}</Label>
                {canReadUsers ? (
                  <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                    <option value="">{t('common.optional')}</option>
                    {(operators.data?.items ?? []).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName} ({user.username})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} />
                )}
                {currentUserId ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setAssigneeId(currentUserId)}>
                    {t('complaints.assignToMe')}
                  </Button>
                ) : null}
              </div>
              {needsInternalNote || data.status === 'NEW' ? (
                <div className="space-y-1.5">
                  <Label>{t('complaints.internalNote')}</Label>
                  <Input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
                  <p className="text-xs text-[#9aa3b5]">{t('complaints.internalNoteHint')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t('complaints.internalNote')}</Label>
                  <Input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
                </div>
              )}
              {needsMessage || message ? (
                <div className="space-y-1.5">
                  <Label>{t('complaints.message')}</Label>
                  <Input value={message} onChange={(e) => setMessage(e.target.value)} />
                  {needsMessage ? <p className="text-xs text-[#fbbf24]">{t('complaints.messageRequired')}</p> : null}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t('complaints.message')}</Label>
                  <Input value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
              )}
              {needsResolution || nextStatuses.includes('REJECTED') || nextStatuses.includes('ADJUSTED') ? (
                <div className="space-y-1.5">
                  <Label>{t('complaints.resolution')}</Label>
                  <Input value={resolution} onChange={(e) => setResolution(e.target.value)} />
                  {needsResolution ? <p className="text-xs text-[#fbbf24]">{t('complaints.resolutionRequired')}</p> : null}
                </div>
              ) : null}
              {needsAdjustmentSession ? (
                <div className="space-y-1.5">
                  <Label>{t('complaints.adjustmentSession')}</Label>
                  <Input value={adjustmentImportSessionId} onChange={(e) => setAdjustmentImportSessionId(e.target.value)} />
                  <p className="text-xs text-[#fbbf24]">{t('complaints.adjustmentSessionHint')}</p>
                </div>
              ) : null}
              <Button type="submit" disabled={!canSubmit || save.isPending}>
                {t('common.save')}
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      )}
    </PageContainer>
  );
}

function CorrectionPanel({
  complaint,
  periodLocked,
  lockedSessionId,
  onSessionId,
}: {
  complaint: Complaint;
  periodLocked: boolean;
  lockedSessionId: string;
  onSessionId: (value: string) => void;
}) {
  const { t } = useTranslation();
  const has = useAuthStore((s) => s.hasPermission);
  const correction = complaint.correction;
  const canPatch = Boolean(correction && has(correction.patchPermission));
  const canImport = has(PERMISSION.IMPORT_CREATE);
  const canApprove = has(PERMISSION.DATA_APPROVE);
  const canPublish = has(PERMISSION.DATA_PUBLISH);
  const canUpdateEmployee = has(PERMISSION.EMPLOYEE_UPDATE);
  const canHandle = has(PERMISSION.COMPLAINT_HANDLE);
  const locked = periodLocked;
  const stagingPath = correction
    ? `${correction.listPath}?source=${correction.query.source}&period=${correction.query.period}&employeeId=${correction.query.employeeId}`
    : '';
  const importPath = `/imports/create?dataType=${complaint.subjectType}&period=${complaint.period}`;

  return (
    <div className={`${cardClass} space-y-3 p-5`}>
      <h2 className="text-sm font-semibold">{t('complaints.correctionTitle')}</h2>
      <p className="text-xs text-[#9aa3b5]">{correction?.instruction ?? t('complaints.correctionFallback')}</p>
      {locked ? <p className="text-sm text-[#fbbf24]">{t('complaints.periodLocked')}</p> : null}
      <div className="flex flex-wrap gap-2">
        {correction ? (
          <Button variant="outline" asChild>
            <Link to={stagingPath}>{t('complaints.openStaging')}</Link>
          </Button>
        ) : null}
        {canUpdateEmployee ? (
          <Button variant="outline" asChild>
            <Link to={`/employees/${complaint.employeeId}#employee-profile`}>{t('complaints.fixProfile')}</Link>
          </Button>
        ) : (
          <p className="text-xs text-[#9aa3b5]">{t('complaints.fixProfileHint')}</p>
        )}
        {locked && canImport ? (
          <Button variant="outline" asChild>
            <Link to={importPath}>{t('complaints.openImport')}</Link>
          </Button>
        ) : null}
        {canApprove ? (
          <Button variant="outline" asChild>
            <Link to="/approvals">{t('complaints.openApprovals')}</Link>
          </Button>
        ) : null}
        {canPublish ? (
          <Button variant="outline" asChild>
            <Link to="/publishing">{t('complaints.openPublishing')}</Link>
          </Button>
        ) : null}
      </div>
      {!canPatch && !locked ? <p className="text-sm text-[#fbbf24]">{t('complaints.waitStaging')}</p> : null}
      {locked && !canImport ? <p className="text-sm text-[#fbbf24]">{t('complaints.waitImport')}</p> : null}
      {canPatch && !canHandle ? <p className="text-sm text-[#9aa3b5]">{t('complaints.waitOperator')}</p> : null}
      {canHandle && !canPatch && !locked ? <p className="text-sm text-[#9aa3b5]">{t('complaints.waitDataEntry')}</p> : null}
      {locked && canHandle ? (
        <div className="space-y-1.5">
          <Label>{t('complaints.adjustmentSession')}</Label>
          <Input value={lockedSessionId} onChange={(e) => onSessionId(e.target.value)} />
          <p className="text-xs text-[#9aa3b5]">{t('complaints.adjustmentSessionHint')}</p>
        </div>
      ) : null}
      {canPatch && !locked && correction ? (
        <StagingCorrectionEditor complaint={complaint} />
      ) : null}
      {canPatch && locked ? <p className="text-sm text-[#fbbf24]">{t('complaints.noPatchWhenLocked')}</p> : null}
    </div>
  );
}

function StagingCorrectionEditor({ complaint }: { complaint: Complaint }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const query = {
    source: 'staging' as const,
    period: complaint.period,
    employeeId: complaint.employeeId,
    page: 1,
    pageSize: 20,
  };

  const records = useQuery({
    queryKey: ['complaint-staging', complaint.subjectType, query],
    queryFn: () => fetchStagingByType(complaint.subjectType, query),
  });

  const save = useMutation({
    mutationFn: () => patchStagingByType(complaint.subjectType, editingId!, { reason, ...compactFields(form) }),
    onSuccess: () => {
      toast.success(t('complaints.stagingSaved'));
      setEditingId(null);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['complaint-staging'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const items = records.data?.items ?? [];

  return (
    <div className="space-y-3 border-t border-[#2a3040] pt-4">
      <h3 className="text-sm font-medium">{t('complaints.stagingEditor')}</h3>
      {items.length === 0 ? <p className="text-sm text-[#b8bfd0]">{t('complaints.noStaging')}</p> : null}
      {items.map((row) => (
        <div key={row.id} className="rounded-md border border-[#2a3040] p-3 text-sm">
          <p className="mb-2 text-[#9aa3b5]">
            {row.employeeCode ?? row.employeeId} · {row.period} · {t(`workflow.${row.status ?? 'UPLOADED'}`)}
          </p>
          <StagingSummary type={complaint.subjectType} row={row} />
          <Button
            className="mt-2"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingId(row.id);
              setReason('');
              setForm(stagingForm(complaint.subjectType, row));
            }}
          >
            {t('common.edit')}
          </Button>
        </div>
      ))}
      <Dialog
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title={t('complaints.stagingEditor')}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={reason.length < 10 || save.isPending} onClick={() => save.mutate()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {Object.keys(form).map((key) => (
          <div key={key} className="mb-3 space-y-1.5">
            <Label>{key}</Label>
            <Input value={form[key] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>{t('common.reason')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Dialog>
    </div>
  );
}

function StagingSummary({
  type,
  row,
}: {
  type: DataType;
  row: AttendanceRecord | PenaltyRecord | PayrollRecord;
}) {
  if (type === 'PENALTY') {
    const record = row as PenaltyRecord;
    return <p>{moneyText(record.amount ?? record.totalAmount)}</p>;
  }
  if (type === 'PAYROLL') {
    const record = row as PayrollRecord;
    return (
      <p>
        {moneyText(record.netAmount)} / {moneyText(record.usdtAmount)}
      </p>
    );
  }
  const record = row as AttendanceRecord;
  return (
    <p>
      {moneyText(record.actualWorkedDays ?? record.summary?.actualWorkedDays)} /{' '}
      {moneyText(record.periodWorkingDays ?? record.summary?.periodWorkingDays)}
    </p>
  );
}

function stagingForm(type: DataType, row: AttendanceRecord | PenaltyRecord | PayrollRecord): Record<string, string> {
  if (type === 'PENALTY') {
    const record = row as PenaltyRecord;
    return { amount: record.amount ?? '', penaltyReason: record.penaltyReason ?? '' };
  }
  if (type === 'PAYROLL') {
    const record = row as PayrollRecord;
    return {
      baseSalary: record.baseSalary ?? '',
      totalBaseSalary: record.totalBaseSalary ?? '',
      periodSalary: record.periodSalary ?? '',
      payableDays: record.payableDays ?? '',
      overtimeHours: record.overtimeHours ?? '',
      grossAmount: record.grossAmount ?? '',
      totalDeduction: record.totalDeduction ?? '',
      netAmount: record.netAmount ?? '',
      usdtAmount: record.usdtAmount ?? '',
      note: record.note ?? '',
    };
  }
  const record = row as AttendanceRecord;
  return {
    periodWorkingDays: record.periodWorkingDays ?? '',
    actualWorkedDays: record.actualWorkedDays ?? '',
    overtimeDays: record.overtimeDays ?? '',
    overtimeHours: record.overtimeHours ?? '',
    specialLeaveDays: record.specialLeaveDays ?? '',
    unpaidLeaveDays: record.unpaidLeaveDays ?? '',
    employedDays: record.employedDays ?? '',
    penaltyAmount: record.penaltyAmount ?? '',
    note: record.note ?? '',
  };
}

function fetchStagingByType(
  type: DataType,
  params: Record<string, unknown>,
): Promise<Paginated<AttendanceRecord | PenaltyRecord | PayrollRecord>> {
  if (type === 'PENALTY') return fetchPenalties(params);
  if (type === 'PAYROLL') return fetchPayroll(params);
  return fetchAttendance(params);
}

function patchStagingByType(type: DataType, id: string, body: Record<string, unknown>) {
  if (type === 'PENALTY') return patchPenalty(id, body);
  if (type === 'PAYROLL') return patchPayroll(id, body);
  return patchAttendance(id, body);
}
