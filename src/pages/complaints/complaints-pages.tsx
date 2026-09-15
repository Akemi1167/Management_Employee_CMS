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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/period';
import { fetchComplaint, fetchComplaints, updateComplaint } from '@/services/complaint.service';
import { fetchUsers } from '@/services/user.service';
import { useAuthStore } from '@/stores/auth-store';
import type { Complaint } from '@/types/api';

export function ComplaintsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [subjectType, setSubjectType] = useState('');
  const [period, setPeriod] = useState('');
  const [employeeCode, setEmployeeCode] = useState(searchParams.get('employeeCode') ?? '');
  const [assignedToMe, setAssignedToMe] = useState(false);
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
    { key: 'employeeCode', header: t('employees.code'), render: (row) => <EmployeeLink id={row.employeeId} code={row.employeeCode} /> },
    { key: 'employeeName', header: t('employees.name') },
    { key: 'subjectType', header: t('common.dataType'), render: (row) => t(`dataType.${row.subjectType}`) },
    { key: 'period', header: t('common.period') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="complaintStatus" /> },
    { key: 'createdAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.createdAt) },
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
        <Input className="max-w-[160px]" placeholder={t('employees.code')} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} />
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
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <PageContainer variant="narrow">
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
            <p>{t('common.dataType')}: {t(`dataType.${data.subjectType}`)} / {data.period}</p>
            <p>{t('common.status')}: <StatusBadge value={data.status} ns="complaintStatus" /></p>
            <p>{t('complaints.dataVersion')}: {data.dataVersion}</p>
            <p>{t('complaints.assignee')}: {data.assigneeId ?? '—'}</p>
            <p className="sm:col-span-2">{t('complaints.reason')}: {data.reason}</p>
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
          <div className={`${cardClass} space-y-3 p-5`}>
            <h2 className="text-sm font-semibold">{t('complaints.history')}</h2>
            {(data.messages ?? []).map((item) => (
              <div key={item.id} className="rounded-md border border-[#2a3040] p-3 text-sm">
                <p className="text-xs text-[#9aa3b5]">
                  {item.authorType} · {formatDate(item.createdAt)} {item.internalOnly ? '(OA)' : ''}
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
                save.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>{t('common.status')}</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">{t('common.optional')}</option>
                  {['IN_PROGRESS', 'WAITING_INFO', 'ADJUSTED', 'REJECTED', 'CLOSED'].map((value) => (
                    <option key={value} value={value}>
                      {t(`complaintStatus.${value}`)}
                    </option>
                  ))}
                </Select>
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
              <div className="space-y-1.5">
                <Label>{t('complaints.message')}</Label>
                <Input value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('complaints.internalNote')}</Label>
                <Input value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('complaints.resolution')}</Label>
                <Input value={resolution} onChange={(e) => setResolution(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('complaints.adjustmentSession')}</Label>
                <Input value={adjustmentImportSessionId} onChange={(e) => setAdjustmentImportSessionId(e.target.value)} />
              </div>
              <Button type="submit" disabled={save.isPending}>
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
