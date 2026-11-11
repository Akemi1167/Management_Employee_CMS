import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { CreateButton } from '@/components/shared/create-button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmployeeLink } from '@/components/shared/employee-link';
import { PeriodSelect } from '@/components/shared/period-select';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PERMISSION } from '@/constants/api-endpoints';
import { cardClass, textSubtle } from '@/constants/theme';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { downloadPayItemTemplate } from '@/lib/excel-templates';
import { currentPeriod, formatDay } from '@/lib/period';
import {
  approvePayItem,
  createPayItem,
  fetchPayItemReconcile,
  fetchPayItemTypes,
  fetchPayItems,
  importPayItems,
  rejectPayItem,
  submitPayItem,
  syncLarkPayItems,
} from '@/services/pay-item.service';
import { useAuthStore } from '@/stores/auth-store';
import type { PayItem, PayItemSource, PayItemStatus } from '@/types/api';

const PAGE_SIZE = 20;
const STATUSES: PayItemStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'INCLUDED'];
const SOURCES: PayItemSource[] = ['MANUAL', 'FILE_IMPORT', 'LARK_BASE'];

export function PayItemsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_WRITE));
  const canApprove = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_APPROVE));
  const [searchParams] = useSearchParams();
  const [period, setPeriod] = useState(searchParams.get('period') || currentPeriod());
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [employeeCode, setEmployeeCode] = useState(searchParams.get('employeeCode') ?? '');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [decision, setDecision] = useState<{ id: string; kind: 'approve' | 'reject' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [form, setForm] = useState({
    employeeCode: '',
    occurredOn: '',
    payItemTypeCode: 'OVERTIME',
    hours: '',
    amount: '',
    reason: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const list = useQuery({
    queryKey: ['pay-items', period, status, source, employeeCode, page],
    queryFn: () =>
      fetchPayItems({
        period: period || undefined,
        status: status || undefined,
        source: source || undefined,
        employeeCode: employeeCode.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });
  const types = useQuery({ queryKey: ['pay-item-types'], queryFn: fetchPayItemTypes });
  const reconcile = useQuery({
    queryKey: ['pay-items-reconcile', period],
    queryFn: () => fetchPayItemReconcile(period),
    enabled: Boolean(period),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['pay-items'] });
    void queryClient.invalidateQueries({ queryKey: ['pay-items-reconcile'] });
  };

  const create = useMutation({
    mutationFn: () =>
      createPayItem({
        employeeCode: form.employeeCode.trim(),
        occurredOn: form.occurredOn,
        payItemTypeCode: form.payItemTypeCode,
        hours: form.hours.trim() || undefined,
        amount: form.amount.trim() || undefined,
        reason: form.reason.trim() || null,
      }),
    onSuccess: () => {
      toast.success(t('payItems.created'));
      setCreateOpen(false);
      setForm({ employeeCode: '', occurredOn: '', payItemTypeCode: 'OVERTIME', hours: '', amount: '', reason: '' });
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const importFile = useMutation({
    mutationFn: () => {
      if (!file) throw new Error(t('imports.file'));
      return importPayItems(file);
    },
    onSuccess: (result) => {
      toast.success(t('payItems.imported', { count: result.created }));
      setImportOpen(false);
      setFile(null);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const larkSync = useMutation({
    mutationFn: () => syncLarkPayItems(),
    onSuccess: (result) => {
      toast.success(
        t('payItems.synced', {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
        }),
      );
      if (result.errors.length > 0) toast.error(result.errors.slice(0, 3).join('\n'));
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const submit = useMutation({
    mutationFn: (id: string) => submitPayItem(id),
    onSuccess: () => {
      toast.success(t('payItems.submitted'));
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const decide = useMutation({
    mutationFn: () => {
      if (!decision) throw new Error('missing');
      return decision.kind === 'approve'
        ? approvePayItem(decision.id, decisionReason.trim() || null)
        : rejectPayItem(decision.id, decisionReason.trim());
    },
    onSuccess: () => {
      toast.success(decision?.kind === 'approve' ? t('payItems.approved') : t('payItems.rejected'));
      setDecision(null);
      setDecisionReason('');
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<PayItem>[] = useMemo(
    () => [
      { key: 'code', header: t('payItems.code') },
      {
        key: 'employeeCode',
        header: t('employees.code'),
        render: (row) => <EmployeeLink id={row.employeeId} code={row.employeeCode} />,
      },
      { key: 'occurredOn', header: t('payItems.occurredOn'), render: (row) => formatDay(row.occurredOn) },
      { key: 'payItemTypeCode', header: t('payItems.type') },
      { key: 'hours', header: t('payItems.hours'), render: (row) => row.hours || '—' },
      { key: 'amount', header: t('payItems.amount'), render: (row) => moneyText(row.amount) },
      {
        key: 'source',
        header: t('payItems.source'),
        render: (row) => t(`payItemSource.${row.source}`),
      },
      {
        key: 'status',
        header: t('common.status'),
        render: (row) => <StatusBadge value={row.status} ns="payItemStatus" />,
      },
      {
        key: 'duplicateOfId',
        header: t('payItems.duplicate'),
        render: (row) => (row.duplicateOfId ? t('common.yes') : '—'),
      },
      {
        key: 'actions',
        header: t('common.actions'),
        render: (row) => (
          <div className="flex flex-col gap-1" onClick={(event) => event.stopPropagation()}>
            {canWrite && row.status === 'DRAFT' && row.source !== 'LARK_BASE' ? (
              <button type="button" className="text-left text-[#4ade80] hover:underline" onClick={() => submit.mutate(row.id)}>
                {t('payItems.submit')}
              </button>
            ) : null}
            {canApprove && row.status === 'PENDING_APPROVAL' ? (
              <>
                <button
                  type="button"
                  className="text-left text-[#4ade80] hover:underline"
                  onClick={() => setDecision({ id: row.id, kind: 'approve' })}
                >
                  {t('payItems.approve')}
                </button>
                <button
                  type="button"
                  className="text-left text-[#f87171] hover:underline"
                  onClick={() => setDecision({ id: row.id, kind: 'reject' })}
                >
                  {t('payItems.reject')}
                </button>
              </>
            ) : null}
          </div>
        ),
      },
    ],
    [canApprove, canWrite, submit, t],
  );

  return (
    <PageContainer>
      <PageHeader
        title={t('payItems.title')}
        description={t('payItems.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/pay-items/types">{t('nav.payItemTypes')}</Link>
            </Button>
            {canWrite ? (
              <>
                <Button variant="outline" onClick={() => larkSync.mutate()} disabled={larkSync.isPending}>
                  {t('payItems.larkSync')}
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  {t('payItems.import')}
                </Button>
                <CreateButton onClick={() => setCreateOpen(true)}>{t('payItems.create')}</CreateButton>
              </>
            ) : null}
          </div>
        }
      />

      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <PeriodSelect value={period} onChange={(value) => { setPeriod(value); setPage(1); }} />
        <Input
          className="max-w-[140px]"
          placeholder={t('employees.code')}
          value={employeeCode}
          onChange={(event) => { setEmployeeCode(event.target.value); setPage(1); }}
        />
        <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">{t('common.all')}</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {t(`payItemStatus.${item}`)}
            </option>
          ))}
        </Select>
        <Select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
          <option value="">{t('common.all')}</option>
          {SOURCES.map((item) => (
            <option key={item} value={item}>
              {t(`payItemSource.${item}`)}
            </option>
          ))}
        </Select>
      </div>

      {reconcile.data ? (
        <div className={`${cardClass} mb-4 grid gap-3 p-4 text-sm sm:grid-cols-3`}>
          {Object.entries(reconcile.data.bySource).map(([key, bucket]) => (
            <div key={key}>
              <p className={`text-[11px] uppercase ${textSubtle}`}>{t(`payItemSource.${key}`, { defaultValue: key })}</p>
              <p>
                {bucket.count} · {moneyText(bucket.amount)}
              </p>
            </div>
          ))}
          <div>
            <p className={`text-[11px] uppercase ${textSubtle}`}>{t('payItems.duplicates')}</p>
            <p>{reconcile.data.duplicates.length}</p>
          </div>
          <div>
            <p className={`text-[11px] uppercase ${textSubtle}`}>{t('payItems.missing')}</p>
            <p>{reconcile.data.missingItems.count}</p>
            {reconcile.data.missingItems.sample.length > 0 ? (
              <p className={`mt-1 text-xs ${textSubtle}`}>
                {reconcile.data.missingItems.sample.map((item) => item.employeeCode).join(', ')}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: list.data?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('payItems.create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !form.employeeCode.trim() ||
                !form.occurredOn ||
                (!form.hours.trim() && !form.amount.trim())
              }
            >
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('employees.code')}>
            <Input value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} />
          </Field>
          <Field label={t('payItems.occurredOn')}>
            <Input type="date" value={form.occurredOn} onChange={(event) => setForm({ ...form, occurredOn: event.target.value })} />
          </Field>
          <Field label={t('payItems.type')}>
            <Select value={form.payItemTypeCode} onChange={(event) => setForm({ ...form, payItemTypeCode: event.target.value })}>
              {(types.data?.items ?? [])
                .filter((item) => item.enabled)
                .map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label={t('payItems.hours')}>
            <Input value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
          </Field>
          <Field label={t('payItems.amount')}>
            <Input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </Field>
          <Field label={t('common.reason')}>
            <Input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('payItems.import')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => importFile.mutate()} disabled={!file || importFile.isPending}>
              {t('payItems.importSubmit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className={`text-sm ${textSubtle}`}>{t('payItems.importHint')}</p>
          <Input type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <Button type="button" variant="outline" onClick={() => downloadPayItemTemplate()}>
            <Download className="h-4 w-4" />
            {t('imports.downloadTemplate')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.kind === 'approve' ? t('payItems.approve') : t('payItems.reject')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={decision?.kind === 'reject' ? 'destructive' : 'default'}
              onClick={() => decide.mutate()}
              disabled={decide.isPending || (decision?.kind === 'reject' && decisionReason.trim().length < 3)}
            >
              {decision?.kind === 'approve' ? t('payItems.approve') : t('payItems.reject')}
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className={`text-sm ${textSubtle}`}>{t('payItems.sodHint')}</p>
          <Label>{t('common.reason')}</Label>
          <Input value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
        </div>
      </Dialog>
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
