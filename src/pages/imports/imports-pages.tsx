import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { CreateButton } from '@/components/shared/create-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION, TEMPLATE_VERSION } from '@/constants/api-endpoints';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { downloadHrExcelTemplate } from '@/lib/excel-templates';
import { formatDate, previousPeriod } from '@/lib/period';
import {
  createImport,
  fetchImport,
  fetchImportErrors,
  fetchImports,
  submitImport,
  validateImport,
} from '@/services/import.service';
import { useAuthStore } from '@/stores/auth-store';
import type { DataType, ImportRowError, ImportSessionDetail, ImportSessionListItem } from '@/types/api';

function stagingQuery(session: { id: string; period: string }) {
  return `source=staging&importSessionId=${session.id}&period=${session.period}`;
}

function stagingLinks(session: ImportSessionDetail) {
  const query = stagingQuery(session);
  if (session.dataType === 'PAYROLL') {
    return [{ to: `/payroll?${query}`, labelKey: 'imports.openPayrollStaging' as const }];
  }
  if (session.dataType === 'PENALTY') {
    return [{ to: `/penalties?${query}`, labelKey: 'imports.openPenaltyStaging' as const }];
  }
  return [
    { to: `/attendance?${query}`, labelKey: 'imports.openAttendanceStaging' as const },
    { to: `/penalties?${query}`, labelKey: 'imports.openPenaltyStaging' as const },
  ];
}

function hasBlockingFindings(session: ImportSessionDetail) {
  return (session.sessionFindings ?? []).some((finding) => finding.severity === 'ERROR');
}

export function ImportsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dataType, setDataType] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['imports', dataType, period, status],
    queryFn: () =>
      fetchImports({
        dataType: dataType || undefined,
        period: period || undefined,
        status: status || undefined,
        limit: 50,
      }),
  });

  const columns: Column<ImportSessionListItem>[] = [
    { key: 'code', header: t('imports.code') },
    { key: 'dataType', header: t('common.dataType'), render: (row) => t(`dataType.${row.dataType}`) },
    { key: 'period', header: t('common.period') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="workflow" /> },
    { key: 'validRows', header: t('imports.validRows'), render: (row) => row.totals.validRows },
    { key: 'errorRows', header: t('imports.errorRows'), render: (row) => row.totals.errorRows },
    { key: 'totalAmount', header: t('imports.totalAmount'), render: (row) => moneyText(row.totals.totalAmount) },
    { key: 'uploadedAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.uploadedAt) },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('imports.title')}
        description={t('imports.description')}
        actions={
          <CreateButton asChild>
            <Link to="/imports/create">{t('imports.create')}</Link>
          </CreateButton>
        }
      />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Select value={dataType} onChange={(e) => setDataType(e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="ATTENDANCE">{t('dataType.ATTENDANCE')}</option>
          <option value="PENALTY">{t('dataType.PENALTY')}</option>
          <option value="PAYROLL">{t('dataType.PAYROLL')}</option>
        </Select>
        <Input className="max-w-[140px]" placeholder="YYYY-MM" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['UPLOADED', 'VALIDATED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'REJECTED'].map((value) => (
            <option key={value} value={value}>
              {t(`workflow.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/imports/${row.id}`)}
      />
    </PageContainer>
  );
}

export function ImportCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dataType, setDataType] = useState<DataType>('ATTENDANCE');
  const [period, setPeriod] = useState(previousPeriod());
  const [file, setFile] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t('imports.file'));
      return createImport({
        dataType,
        period,
        templateVersion: TEMPLATE_VERSION[dataType],
        file,
      });
    },
    onSuccess: (result) => {
      toast.success(t('imports.uploaded'));
      navigate(`/imports/${result.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <PageContainer variant="narrow">
      <PageHeader title={t('imports.create')} description={t('imports.description')} />
      <form
        className={`${cardClass} space-y-4 p-6`}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label>{t('common.dataType')}</Label>
          <Select value={dataType} onChange={(e) => setDataType(e.target.value as DataType)}>
            <option value="ATTENDANCE">{t('dataType.ATTENDANCE')}</option>
            <option value="PENALTY">{t('dataType.PENALTY')}</option>
            <option value="PAYROLL">{t('dataType.PAYROLL')}</option>
          </Select>
          <p className="text-xs text-[#9aa3b5]">{t(`imports.typeHint.${dataType}`)}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('common.period')}</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" required />
        </div>
        <div className="space-y-1.5">
          <Label>{t('imports.template')}</Label>
          <p className="text-sm text-[#b8bfd0]">{TEMPLATE_VERSION[dataType]}</p>
          <Button type="button" variant="outline" onClick={() => downloadHrExcelTemplate()}>
            <Download className="h-4 w-4" />
            {t('imports.downloadTemplate')}
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label>{t('imports.file')}</Label>
          <Input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <p className="text-xs text-[#9aa3b5]">{t('imports.fileHint')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!file || create.isPending}>
            {create.isPending ? t('common.processing') : t('imports.create')}
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link to="/imports">{t('common.back')}</Link>
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

export function ImportDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const canValidate = useAuthStore((s) => s.hasPermission(PERMISSION.IMPORT_VALIDATE));
  const canSubmit = useAuthStore((s) => s.hasPermission(PERMISSION.IMPORT_SUBMIT));
  const [errorPage, setErrorPage] = useState(1);
  const [severity, setSeverity] = useState('');

  const detail = useQuery({
    queryKey: ['import', id],
    queryFn: () => fetchImport(id),
    enabled: Boolean(id),
  });
  const errors = useQuery({
    queryKey: ['import-errors', id, errorPage, severity],
    queryFn: () =>
      fetchImportErrors(id, {
        page: errorPage,
        pageSize: 50,
        severity: severity || undefined,
      }),
    enabled: Boolean(id),
  });

  const validate = useMutation({
    mutationFn: () => validateImport(id),
    onSuccess: () => {
      toast.success(t('imports.validated'));
      void queryClient.invalidateQueries({ queryKey: ['import', id] });
      void queryClient.invalidateQueries({ queryKey: ['import-errors', id] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const submit = useMutation({
    mutationFn: () => submitImport(id),
    onSuccess: () => {
      toast.success(t('imports.submitted'));
      void queryClient.invalidateQueries({ queryKey: ['import', id] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const session = detail.data;
  const errorColumns: Column<ImportRowError>[] = [
    { key: 'rowNumber', header: t('imports.row') },
    { key: 'columnName', header: t('imports.column') },
    { key: 'code', header: t('imports.code') },
    { key: 'severity', header: t('imports.severity'), render: (row) => <StatusBadge value={row.severity} /> },
    { key: 'message', header: t('complaints.reason') },
    {
      key: 'employeeCode',
      header: t('employees.code'),
      render: (row) =>
        row.employeeCode ? (
          <Link
            to={`/employees?query=${encodeURIComponent(row.employeeCode)}`}
            className="text-[#4ade80] hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.employeeCode}
          </Link>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={session?.code ?? t('imports.title')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/imports">{t('common.back')}</Link>
          </Button>
        }
      />
      {session ? (
        <>
          <div className={`${cardClass} mb-4 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4`}>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.status')}</p>
              <StatusBadge value={session.status} ns="workflow" />
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.dataType')}</p>
              <p>{t(`dataType.${session.dataType}`)}</p>
              <p className="text-xs text-[#9aa3b5]">{session.templateVersion}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">{t('imports.validRows')}</p>
              <p>
                {session.totals.validRows}/{session.totals.totalRows}
              </p>
              <p className="text-xs text-[#9aa3b5]">
                {t('imports.errorRows')} {session.totals.errorRows} · {t('imports.warningRows')}{' '}
                {session.totals.warningRows}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-[#9aa3b5]">
                {session.dataType === 'PAYROLL' ? t('imports.totalAmount') : t('imports.totalPenaltyAmount')}
              </p>
              <p>{moneyText(session.totals.totalAmount)}</p>
            </div>
          </div>
          {session.sessionFindings?.length ? (
            <div className={`${cardClass} mb-4 space-y-2 p-5`}>
              <h2 className="text-sm font-semibold">{t('imports.findings')}</h2>
              {session.sessionFindings.map((finding) => (
                <p key={`${finding.code}-${finding.message}`} className="text-sm text-[#b8bfd0]">
                  <StatusBadge value={finding.severity} /> {finding.message} ({finding.affectedCount})
                  {finding.sampleEmployeeCodes?.length
                    ? ` · ${finding.sampleEmployeeCodes.join(', ')}`
                    : null}
                </p>
              ))}
            </div>
          ) : null}
          <div className="mb-4 flex flex-wrap gap-2">
            {canValidate && (session.status === 'UPLOADED' || session.status === 'VALIDATED') ? (
              <Button onClick={() => validate.mutate()} disabled={validate.isPending}>
                {t('imports.validate')}
              </Button>
            ) : null}
            {canSubmit && session.status === 'VALIDATED' ? (
              <Button
                onClick={() => submit.mutate()}
                disabled={
                  submit.isPending ||
                  session.totals.errorRows > 0 ||
                  session.totals.validRows < 1 ||
                  hasBlockingFindings(session)
                }
              >
                {t('imports.submit')}
              </Button>
            ) : null}
            {stagingLinks(session).map((link) => (
              <Button key={link.to} variant="outline" asChild>
                <Link to={link.to}>{t(link.labelKey)}</Link>
              </Button>
            ))}
          </div>
          <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
            <Select
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setErrorPage(1);
              }}
            >
              <option value="">{t('common.all')}</option>
              <option value="ERROR">{t('imports.severityError')}</option>
              <option value="WARNING">{t('imports.severityWarning')}</option>
            </Select>
          </div>
          <DataTable
            title={t('imports.errors')}
            columns={errorColumns}
            data={errors.data?.items ?? []}
            loading={errors.isLoading}
            pagination={{
              page: errorPage,
              pageSize: 50,
              total: errors.data?.total ?? 0,
              onPageChange: setErrorPage,
            }}
          />
        </>
      ) : (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      )}
    </PageContainer>
  );
}
