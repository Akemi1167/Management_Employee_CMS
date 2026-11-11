import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { CreateButton } from '@/components/shared/create-button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PERMISSION } from '@/constants/api-endpoints';
import { cardClass, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/period';
import { cn } from '@/lib/utils';
import {
  createLarkDataSource,
  deleteLarkDataSource,
  fetchLarkDataSources,
  inspectLarkDataSource,
  previewLarkDataSource,
  testLarkDataSource,
  updateLarkDataSource,
} from '@/services/lark-data-source.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  LarkDataSource,
  LarkDataSourceKind,
  LarkDataSourcePurpose,
  LarkInspectResult,
  LarkPreviewResult,
} from '@/types/api';

const KINDS: LarkDataSourceKind[] = ['BASE', 'SHEET'];
const PURPOSES: LarkDataSourcePurpose[] = ['ATTENDANCE', 'PAYROLL', 'PENALTY', 'EMPLOYEE', 'GENERIC'];

interface SourceForm {
  id?: string;
  name: string;
  kind: LarkDataSourceKind;
  purpose: LarkDataSourcePurpose;
  enabled: boolean;
  sourceUrl: string;
  appToken: string;
  tableId: string;
  viewId: string;
  spreadsheetToken: string;
  sheetId: string;
  range: string;
  employeeCodeField: string;
  occurredOnField: string;
  hoursField: string;
  amountField: string;
  typeField: string;
  reasonField: string;
  approvalInstanceIdField: string;
  approvalStatusField: string;
}

function emptyForm(): SourceForm {
  return {
    name: '',
    kind: 'BASE',
    purpose: 'GENERIC',
    enabled: true,
    sourceUrl: '',
    appToken: '',
    tableId: '',
    viewId: '',
    spreadsheetToken: '',
    sheetId: '',
    range: '',
    employeeCodeField: '',
    occurredOnField: '',
    hoursField: '',
    amountField: '',
    typeField: '',
    reasonField: '',
    approvalInstanceIdField: '',
    approvalStatusField: '',
  };
}

function fromSource(source: LarkDataSource): SourceForm {
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    purpose: source.purpose,
    enabled: source.enabled,
    sourceUrl: source.sourceUrl ?? '',
    appToken: source.appToken ?? '',
    tableId: source.tableId ?? '',
    viewId: source.viewId ?? '',
    spreadsheetToken: source.spreadsheetToken ?? '',
    sheetId: source.sheetId ?? '',
    range: source.range ?? '',
    employeeCodeField: source.fieldMap?.employeeCode ?? '',
    occurredOnField: source.fieldMap?.occurredOn ?? '',
    hoursField: source.fieldMap?.hours ?? '',
    amountField: source.fieldMap?.amount ?? '',
    typeField: source.fieldMap?.type ?? '',
    reasonField: source.fieldMap?.reason ?? '',
    approvalInstanceIdField: source.fieldMap?.approvalInstanceId ?? '',
    approvalStatusField: source.fieldMap?.approvalStatus ?? '',
  };
}

function toPayload(form: SourceForm) {
  const fieldMap = Object.fromEntries(
    Object.entries({
      employeeCode: form.employeeCodeField,
      occurredOn: form.occurredOnField,
      hours: form.hoursField,
      amount: form.amountField,
      type: form.typeField,
      reason: form.reasonField,
      approvalInstanceId: form.approvalInstanceIdField,
      approvalStatus: form.approvalStatusField,
    })
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value),
  );
  return {
    name: form.name.trim(),
    kind: form.kind,
    purpose: form.purpose,
    enabled: form.enabled,
    sourceUrl: form.sourceUrl.trim() || undefined,
    appToken: form.appToken.trim() || undefined,
    tableId: form.tableId.trim() || undefined,
    viewId: form.viewId.trim() || undefined,
    spreadsheetToken: form.spreadsheetToken.trim() || undefined,
    sheetId: form.sheetId.trim() || undefined,
    range: form.range.trim() || undefined,
    fieldMap: Object.keys(fieldMap).length > 0 ? fieldMap : undefined,
  };
}

export function LarkDataSourcesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.LARK_DATASOURCE_WRITE));
  const [form, setForm] = useState<SourceForm | null>(null);
  const [inspect, setInspect] = useState<LarkInspectResult | null>(null);
  const [preview, setPreview] = useState<LarkPreviewResult | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LarkDataSource | null>(null);

  const list = useQuery({
    queryKey: ['lark-data-sources'],
    queryFn: fetchLarkDataSources,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['lark-data-sources'] });
  };

  const inspectMutation = useMutation({
    mutationFn: () =>
      inspectLarkDataSource({
        kind: form?.kind,
        sourceUrl: form?.sourceUrl || undefined,
        appToken: form?.appToken || undefined,
        tableId: form?.tableId || undefined,
        spreadsheetToken: form?.spreadsheetToken || undefined,
      }),
    onSuccess: (result) => {
      setInspect(result);
      setForm((current) => {
        if (!current) return current;
        return {
          ...current,
          kind: result.kind,
          appToken: result.appToken ?? current.appToken,
          spreadsheetToken: result.spreadsheetToken ?? current.spreadsheetToken,
          tableId: current.tableId || result.tables[0]?.id || '',
          sheetId: current.sheetId || result.sheets[0]?.id || '',
        };
      });
      toast.success(t('larkSources.inspected'));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('missing form');
      const body = toPayload(form);
      return form.id ? updateLarkDataSource(form.id, body) : createLarkDataSource(body);
    },
    onSuccess: () => {
      toast.success(t('larkSources.saved'));
      setForm(null);
      setInspect(null);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => testLarkDataSource(id),
    onSuccess: (result) => {
      toast.success(result.message);
      setPreview(result.preview);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const previewMutation = useMutation({
    mutationFn: (id: string) => previewLarkDataSource(id),
    onSuccess: setPreview,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLarkDataSource(id),
    onSuccess: () => {
      toast.success(t('larkSources.deleted'));
      setPendingDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<LarkDataSource>[] = useMemo(
    () => [
      { key: 'name', header: t('larkSources.name') },
      {
        key: 'kind',
        header: t('larkSources.kind'),
        render: (row) => t(`larkSources.kinds.${row.kind}`),
      },
      {
        key: 'purpose',
        header: t('larkSources.purpose'),
        render: (row) => t(`larkSources.purposes.${row.purpose}`),
      },
      {
        key: 'enabled',
        header: t('common.status'),
        render: (row) => (
          <StatusBadge value={row.enabled ? 'ACTIVE' : 'DISABLED'} ns="larkSources.status" />
        ),
      },
      {
        key: 'lastTest',
        header: t('larkSources.lastTest'),
        render: (row) =>
          row.lastTestedAt
            ? `${row.lastTestOk ? t('larkSources.testOk') : t('larkSources.testFail')} · ${formatDate(row.lastTestedAt)}`
            : '—',
      },
    ],
    [t],
  );

  const bot = list.data?.bot;
  const tables = inspect?.tables ?? [];
  const sheets = inspect?.sheets ?? [];
  const fieldNames = inspect?.fields.map((field) => field.name).filter(Boolean) ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={t('larkSources.title')}
        description={t('larkSources.description')}
        actions={
          canWrite ? (
            <CreateButton onClick={() => { setForm(emptyForm()); setInspect(null); }}>
              {t('larkSources.create')}
            </CreateButton>
          ) : null
        }
      />

      <div className={cn(cardClass, 'mb-6 space-y-2 p-4')}>
        <p className="text-sm font-medium">{t('larkSources.botTitle')}</p>
        <p className={cn('text-sm', textSubtle)}>
          {bot?.enabled
            ? t('larkSources.botOn', { url: bot.baseUrl })
            : t('larkSources.botOff')}
        </p>
        {bot && !bot.configured ? <p className="text-sm text-[#fbbf24]">{t('larkSources.botMissing')}</p> : null}
      </div>

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        onRowClick={(row) => { setForm(fromSource(row)); setInspect(null); }}
      />

      <Dialog
        open={Boolean(form)}
        onClose={() => { setForm(null); setInspect(null); }}
        title={form?.id ? t('larkSources.edit') : t('larkSources.create')}
        className="max-w-2xl"
        footer={
          form ? (
            <>
              {form.id && canWrite ? (
                <Button variant="ghost" className="mr-auto text-[#f87171]" onClick={() => {
                  const current = list.data?.items.find((item) => item.id === form.id);
                  if (current) setPendingDelete(current);
                }}>
                  {t('common.delete')}
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => { setForm(null); setInspect(null); }}>
                {t('common.cancel')}
              </Button>
              {canWrite ? (
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>
                  {t('common.save')}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {form ? (
          <div className="space-y-4">
            <Field label={t('larkSources.name')}>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('larkSources.kind')}>
                <Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as LarkDataSourceKind })}>
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>{t(`larkSources.kinds.${kind}`)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t('larkSources.purpose')}>
                <Select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as LarkDataSourcePurpose })}>
                  {PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>{t(`larkSources.purposes.${purpose}`)}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t('larkSources.sourceUrl')}>
              <Input
                value={form.sourceUrl}
                placeholder={t('larkSources.sourceUrlPlaceholder')}
                onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
              />
            </Field>
            {form.kind === 'BASE' ? (
              <Field label={t('larkSources.appToken')}>
                <Input value={form.appToken} onChange={(event) => setForm({ ...form, appToken: event.target.value })} />
              </Field>
            ) : (
              <Field label={t('larkSources.spreadsheetToken')}>
                <Input value={form.spreadsheetToken} onChange={(event) => setForm({ ...form, spreadsheetToken: event.target.value })} />
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => inspectMutation.mutate()} disabled={inspectMutation.isPending}>
                {t('larkSources.inspect')}
              </Button>
              {form.id ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => testMutation.mutate(form.id!)} disabled={testMutation.isPending}>
                    {t('larkSources.test')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => previewMutation.mutate(form.id!)} disabled={previewMutation.isPending}>
                    {t('larkSources.preview')}
                  </Button>
                </>
              ) : null}
            </div>
            {form.kind === 'BASE' ? (
              <Field label={tables.length > 0 ? t('larkSources.table') : t('larkSources.tableId')}>
                {tables.length > 0 ? (
                  <Select value={form.tableId} onChange={(event) => setForm({ ...form, tableId: event.target.value })}>
                    <option value="">{t('larkSources.chooseTable')}</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>{table.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input value={form.tableId} onChange={(event) => setForm({ ...form, tableId: event.target.value })} />
                )}
              </Field>
            ) : null}
            {form.kind === 'SHEET' && sheets.length > 0 ? (
              <Field label={t('larkSources.sheet')}>
                <Select value={form.sheetId} onChange={(event) => setForm({ ...form, sheetId: event.target.value })}>
                  <option value="">{t('larkSources.chooseSheet')}</option>
                  {sheets.map((sheet) => (
                    <option key={sheet.id} value={sheet.id}>{sheet.title}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {form.kind === 'SHEET' ? (
              <Field label={t('larkSources.range')}>
                <Input
                  value={form.range}
                  placeholder="A1:Z200"
                  onChange={(event) => setForm({ ...form, range: event.target.value })}
                />
              </Field>
            ) : null}
            <Field label={t('larkSources.employeeCodeField')}>
              <FieldMapInput
                value={form.employeeCodeField}
                names={fieldNames}
                placeholder={t('larkSources.employeeCodePlaceholder')}
                onChange={(value) => setForm({ ...form, employeeCodeField: value })}
              />
            </Field>
            {form.purpose === 'ATTENDANCE' || form.purpose === 'PENALTY' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['occurredOnField', 'occurredOn'],
                    ['hoursField', 'hours'],
                    ['amountField', 'amount'],
                    ['typeField', 'type'],
                    ['reasonField', 'reason'],
                    ['approvalInstanceIdField', 'approvalInstanceId'],
                    ['approvalStatusField', 'approvalStatus'],
                  ] as const
                ).map(([formKey, labelKey]) => (
                  <Field key={formKey} label={t(`larkSources.fieldMap.${labelKey}`)}>
                    <FieldMapInput
                      value={form[formKey]}
                      names={fieldNames}
                      onChange={(value) => setForm({ ...form, [formKey]: value })}
                    />
                  </Field>
                ))}
              </div>
            ) : null}
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
              {t('larkSources.enabled')}
            </label>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={t('larkSources.previewTitle', { title: preview?.title || '' })}
        className="max-w-4xl"
      >
        {preview ? (
          <div className="overflow-auto">
            {preview.truncated ? <p className={cn('mb-2 text-xs', textSubtle)}>{t('larkSources.previewTruncated')}</p> : null}
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr>
                  {preview.columns.map((column) => (
                    <th key={column} className="border-b border-[#2a3040] px-2 py-1 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={index}>
                    {preview.columns.map((column) => (
                      <td key={column} className="border-b border-[#2a3040] px-2 py-1">{row[column] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length === 0 ? <p className={cn('mt-3 text-sm', textSubtle)}>{t('common.noData')}</p> : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={t('larkSources.confirmDelete')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm">{t('larkSources.confirmDeleteDescription', { name: pendingDelete?.name ?? '' })}</p>
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

function FieldMapInput({
  value,
  names,
  placeholder,
  onChange,
}: {
  value: string;
  names: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  if (names.length > 0) {
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{t('common.optional')}</option>
        {names.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
    );
  }
  return <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}
