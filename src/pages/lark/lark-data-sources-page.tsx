import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { CreateButton } from '@/components/shared/create-button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PERMISSION } from '@/constants/api-endpoints';
import { cardClass, textColumnHeader, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/period';
import { cn } from '@/lib/utils';
import {
  fetchLarkAppSettings,
  testLarkAppSettings,
  updateLarkAppSettings,
} from '@/services/lark-app-settings.service';
import {
  createLarkDataSource,
  deleteLarkDataSource,
  fetchLarkDataSources,
  inspectLarkDataSource,
  previewLarkDataSource,
  testLarkDataSource,
  updateLarkDataSource,
} from '@/services/lark-data-source.service';
import { fetchPayItemTypes, syncLarkPayItems } from '@/services/pay-item.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  LarkAppSettings,
  LarkDataSource,
  LarkDataSourceKind,
  LarkDataSourcePurpose,
  LarkInspectResult,
  LarkPayItemSyncResult,
  LarkPreviewResult,
  PayItemType,
  PayrollComponentCode,
} from '@/types/api';

const KINDS: LarkDataSourceKind[] = ['BASE', 'SHEET'];
const PURPOSES: LarkDataSourcePurpose[] = ['ATTENDANCE', 'PAYROLL', 'PENALTY', 'EMPLOYEE', 'GENERIC'];
const LARK_BINDABLE_COMPONENTS = new Set<PayrollComponentCode>([
  'OVERTIME',
  'PENALTY',
  'OTHER',
  'ADJUSTMENT',
]);

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
  defaultPayItemTypeCode: string;
  employeeCodeField: string;
  occurredOnField: string;
  hoursField: string;
  amountField: string;
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
    defaultPayItemTypeCode: '',
    employeeCodeField: '',
    occurredOnField: '',
    hoursField: '',
    amountField: '',
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
    defaultPayItemTypeCode: source.defaultPayItemTypeCode ?? '',
    employeeCodeField: source.fieldMap?.employeeCode ?? '',
    occurredOnField: source.fieldMap?.occurredOn ?? '',
    hoursField: source.fieldMap?.hours ?? '',
    amountField: source.fieldMap?.amount ?? '',
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
    defaultPayItemTypeCode: form.defaultPayItemTypeCode.trim() || null,
  };
}

function isLarkBindableType(type: PayItemType) {
  return type.enabled && LARK_BINDABLE_COMPONENTS.has(type.mapsToPayrollComponent);
}

interface AppSettingsForm {
  enabled: boolean;
  baseUrl: string;
  appId: string;
  appSecret: string;
}

function appSettingsFromApi(settings: LarkAppSettings): AppSettingsForm {
  return {
    enabled: settings.enabled,
    baseUrl: settings.baseUrl || 'https://open.larksuite.com',
    appId: settings.appId ?? '',
    appSecret: '',
  };
}

export function LarkDataSourcesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.LARK_DATASOURCE_WRITE));
  const canSyncPayItems = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_WRITE));
  const [form, setForm] = useState<SourceForm | null>(null);
  const [inspect, setInspect] = useState<LarkInspectResult | null>(null);
  const [preview, setPreview] = useState<LarkPreviewResult | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LarkDataSource | null>(null);
  const [appForm, setAppForm] = useState<AppSettingsForm | null>(null);
  const [syncResult, setSyncResult] = useState<LarkPayItemSyncResult | null>(null);

  const list = useQuery({
    queryKey: ['lark-data-sources'],
    queryFn: fetchLarkDataSources,
  });

  const appSettings = useQuery({
    queryKey: ['lark-app-settings'],
    queryFn: fetchLarkAppSettings,
  });

  const payItemTypes = useQuery({
    queryKey: ['pay-item-types'],
    queryFn: fetchPayItemTypes,
  });

  const bindableTypes = useMemo(
    () => (payItemTypes.data?.items ?? []).filter(isLarkBindableType),
    [payItemTypes.data?.items],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['lark-data-sources'] });
    void queryClient.invalidateQueries({ queryKey: ['lark-app-settings'] });
    void queryClient.invalidateQueries({ queryKey: ['pay-items'] });
  };

  const syncedAppForm =
    appForm ?? (appSettings.data ? appSettingsFromApi(appSettings.data) : null);

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
      // PATCH UpdateLarkDataSourceDto khong cho `kind` — chi gui khi tao moi.
      if (form.id) {
        const { kind: _kind, ...updateBody } = body;
        return updateLarkDataSource(form.id, updateBody);
      }
      return createLarkDataSource(body);
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

  const saveAppMutation = useMutation({
    mutationFn: () => {
      if (!syncedAppForm) throw new Error('missing app form');
      return updateLarkAppSettings({
        enabled: syncedAppForm.enabled,
        baseUrl: syncedAppForm.baseUrl.trim() || undefined,
        appId: syncedAppForm.appId.trim() || undefined,
        appSecret: syncedAppForm.appSecret.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      toast.success(t('larkSources.appSaved'));
      setAppForm(appSettingsFromApi(result));
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const testAppMutation = useMutation({
    mutationFn: () => testLarkAppSettings(),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message || t('larkSources.appTestOk'));
      else toast.error(result.message || t('larkSources.appTestFail'));
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const syncSourceMutation = useMutation({
    mutationFn: (sourceId: string) => {
      toast.loading(t('larkSources.syncPending'), { id: 'lark-source-sync' });
      return syncLarkPayItems(sourceId);
    },
    onSuccess: (result) => {
      const summary = t('larkSources.syncDone', {
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        skipped: result.skipped ?? 0,
      });
      toast.success(summary, { id: 'lark-source-sync', duration: 8000 });
      if (result.errors?.length) {
        toast.error(result.errors.slice(0, 3).join('; '), { duration: 10_000 });
      }
      setSyncResult(result);
      invalidate();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error), { id: 'lark-source-sync', duration: 10_000 });
    },
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
        key: 'defaultPayItemTypeCode',
        header: t('larkSources.payItemType'),
        render: (row) => row.defaultPayItemTypeCode || '—',
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

      <div className={cn(cardClass, 'mb-6 space-y-4 p-4')}>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('larkSources.appTitle')}</p>
          <p className={cn('text-sm', textSubtle)}>{t('larkSources.appHint')}</p>
        </div>

        {syncedAppForm ? (
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={syncedAppForm.enabled}
                disabled={!canWrite}
                onCheckedChange={(checked) =>
                  setAppForm({ ...syncedAppForm, enabled: checked })
                }
              />
              {t('larkSources.appEnabled')}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('larkSources.appBaseUrl')}>
                <Input
                  value={syncedAppForm.baseUrl}
                  disabled={!canWrite}
                  placeholder="https://open.larksuite.com"
                  onChange={(event) =>
                    setAppForm({ ...syncedAppForm, baseUrl: event.target.value })
                  }
                />
              </Field>
              <Field label={t('larkSources.appId')}>
                <Input
                  value={syncedAppForm.appId}
                  disabled={!canWrite}
                  autoComplete="off"
                  onChange={(event) =>
                    setAppForm({ ...syncedAppForm, appId: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label={t('larkSources.appSecret')}>
              <Input
                type="password"
                value={syncedAppForm.appSecret}
                disabled={!canWrite}
                autoComplete="new-password"
                placeholder={
                  appSettings.data?.appSecretConfigured
                    ? t('larkSources.appSecretConfigured')
                    : t('larkSources.appSecretPlaceholder')
                }
                onChange={(event) =>
                  setAppForm({ ...syncedAppForm, appSecret: event.target.value })
                }
              />
            </Field>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => saveAppMutation.mutate()}
                  disabled={saveAppMutation.isPending}
                >
                  {t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => testAppMutation.mutate()}
                  disabled={testAppMutation.isPending}
                >
                  {t('larkSources.appTest')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : appSettings.isLoading ? (
          <p className={cn('text-sm', textSubtle)}>{t('common.loading')}</p>
        ) : null}

        <div className={cn('border-t border-[#2a3040] pt-3 text-sm', textSubtle)}>
          {bot?.configured
            ? t('larkSources.botStatusOn', {
                source: t(`larkSources.credentialSource.${bot.source ?? 'none'}`),
                url: bot.baseUrl,
                appId: bot.appId || '—',
              })
            : t('larkSources.botMissing')}
        </div>
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
                <Select
                  value={form.kind}
                  disabled={Boolean(form.id)}
                  onChange={(event) => setForm({ ...form, kind: event.target.value as LarkDataSourceKind })}
                >
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
            {form.kind === 'BASE' ? (
              <Field label={t('larkSources.payItemType')}>
                <Select
                  value={form.defaultPayItemTypeCode}
                  onChange={(event) => setForm({ ...form, defaultPayItemTypeCode: event.target.value })}
                >
                  <option value="">{t('larkSources.payItemTypeNone')}</option>
                  {bindableTypes.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.label} ({type.code} · {t(`payItemKind.${type.kind}`)} ·{' '}
                      {t(`payrollComponent.${type.mapsToPayrollComponent}`)})
                    </option>
                  ))}
                </Select>
                <p className={cn('text-xs', textSubtle)}>{t('larkSources.payItemTypeHint')}</p>
              </Field>
            ) : null}
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
                  {form.kind === 'BASE' && form.defaultPayItemTypeCode && canWrite ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (!canSyncPayItems) {
                          toast.error(t('larkSources.syncNeedPayItemWrite'));
                          return;
                        }
                        syncSourceMutation.mutate(form.id!);
                      }}
                      disabled={syncSourceMutation.isPending}
                    >
                      {syncSourceMutation.isPending
                        ? t('larkSources.syncPending')
                        : t('larkSources.syncSource')}
                    </Button>
                  ) : null}
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
            {form.kind === 'BASE' && form.defaultPayItemTypeCode ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['occurredOnField', 'occurredOn'],
                    ['hoursField', 'hours'],
                    ['amountField', 'amount'],
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
        className="max-w-6xl"
      >
        {preview ? (
          <LarkPreviewTable preview={preview} />
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(syncResult)}
        onClose={() => setSyncResult(null)}
        title={t('larkSources.syncResultTitle')}
        className="max-w-lg"
        footer={
          <Button type="button" onClick={() => setSyncResult(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {syncResult ? <LarkSyncResultView result={syncResult} /> : null}
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

function LarkSyncResultView({ result }: { result: LarkPayItemSyncResult }) {
  const { t } = useTranslation();
  const cards = [
    { key: 'created', value: result.created ?? 0, tone: 'text-[#34d399]' },
    { key: 'updated', value: result.updated ?? 0, tone: 'text-[#4ade80]' },
    { key: 'unchanged', value: result.unchanged ?? 0, tone: 'text-[#9aa3b5]' },
    { key: 'skipped', value: result.skipped ?? 0, tone: 'text-[#fbbf24]' },
  ] as const;

  return (
    <div className="space-y-4">
      <p className={cn('text-sm', textSubtle)}>{t('larkSources.syncResultHint')}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-lg border border-[#2a3040] bg-[#1a1e28]/60 px-3 py-3 text-center"
          >
            <p className={cn('text-2xl font-semibold tabular-nums', card.tone)}>{card.value}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[#9aa3b5]">
              {t(`larkSources.syncStats.${card.key}`)}
            </p>
          </div>
        ))}
      </div>
      {result.errors?.length ? (
        <div className="space-y-2 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-3">
          <p className="text-sm font-medium text-[#fecaca]">
            {t('larkSources.syncErrors', { count: result.errors.length })}
          </p>
          <ul className="max-h-48 space-y-1 overflow-auto text-xs text-[#fecaca]/90">
            {result.errors.slice(0, 20).map((error, index) => (
              <li key={`${index}-${error}`} className="break-words font-mono">
                {error}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[#34d399]">{t('larkSources.syncNoErrors')}</p>
      )}
    </div>
  );
}

function LarkPreviewTable({ preview }: { preview: LarkPreviewResult }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-xs', textSubtle)}>
          {preview.truncated
            ? t('larkSources.previewTruncated')
            : t('larkSources.previewRowCount', { count: preview.rows.length })}
        </p>
        <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wide">
          {preview.kind}
        </Badge>
      </div>

      {preview.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a3040] bg-[#1a1e28]/50 px-4 py-10 text-center text-sm text-[#9aa3b5]">
          {t('common.noData')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#2a3040] bg-[#12151d]">
          <div className="max-h-[min(60vh,32rem)] overflow-auto">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#1a1e28]/95 backdrop-blur-sm">
                <tr>
                  <th className={cn(textColumnHeader, 'whitespace-nowrap px-3 py-2.5 text-right')}>#</th>
                  {preview.columns.map((column) => (
                    <th
                      key={column}
                      className={cn(textColumnHeader, 'whitespace-nowrap px-3 py-2.5')}
                      title={column}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-t border-[#2a3040]/80 transition-colors hover:bg-[#1c2030]/70"
                  >
                    <td className="px-3 py-2.5 text-right font-mono text-[11px] text-[#6b7280]">
                      {index + 1}
                    </td>
                    {preview.columns.map((column) => (
                      <td key={column} className="max-w-[14rem] px-3 py-2.5 align-top">
                        <PreviewCell column={column} value={row[column]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewCell({ column, value }: { column: string; value?: string }) {
  const raw = (value ?? '').trim();
  if (!raw) {
    return <span className="text-[#6b7280]">—</span>;
  }

  if (isStatusColumn(column)) {
    const tone = statusTone(raw);
    return (
      <Badge variant={tone} className="max-w-full truncate" title={raw}>
        {raw}
      </Badge>
    );
  }

  const asDate = formatPreviewTimestamp(raw);
  if (asDate) {
    return (
      <span className="whitespace-nowrap font-mono text-xs text-[#eef0f6]" title={raw}>
        {asDate}
      </span>
    );
  }

  return (
    <span className="line-clamp-2 break-words text-[#eef0f6]" title={raw}>
      {raw}
    </span>
  );
}

function isStatusColumn(column: string) {
  return /status|trạng thái|状态/i.test(column);
}

function statusTone(value: string): 'success' | 'destructive' | 'upcoming' | 'secondary' {
  const normalized = value.trim().toLowerCase();
  if (/approved|approve|đã duyệt|通过|同意|completed|done|success/.test(normalized)) {
    return 'success';
  }
  if (/reject|denied|từ chối|拒绝|fail|error|cancel/.test(normalized)) {
    return 'destructive';
  }
  if (/pending|waiting|chờ|待|in progress|processing/.test(normalized)) {
    return 'upcoming';
  }
  return 'secondary';
}

/** Chuyen ms/s Unix hoac ISO thanh ngay gio doc duoc. */
function formatPreviewTimestamp(raw: string): string | null {
  if (/^\d{13}$/.test(raw)) {
    return formatDate(new Date(Number(raw)));
  }
  if (/^\d{10}$/.test(raw)) {
    return formatDate(new Date(Number(raw) * 1000));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw) || raw.includes('T')) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return formatDate(date);
  }
  return null;
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
