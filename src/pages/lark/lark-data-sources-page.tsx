import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Eye,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { IconActionButton } from '@/components/shared/icon-action';
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
import {
  fetchLarkPayItemSyncRun,
  fetchLarkPayItemSyncRuns,
  fetchPayItemTypes,
  syncLarkPayItems,
} from '@/services/pay-item.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  LarkAppSettings,
  LarkDataSource,
  LarkDataSourceKind,
  LarkDataSourcePurpose,
  LarkInspectResult,
  LarkPayItemSyncResult,
  LarkPreviewResult,
  PayItemLarkSyncRow,
  PayItemLarkSyncRowOutcome,
  PayItemLarkSyncRun,
  PayItemType,
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
  defaultPayItemTypeCode: string;
  syncApplyTerminated: boolean;
  employeeCodeField: string;
  fullNameField: string;
  departmentCodeField: string;
  regionCodeField: string;
  hiredAtField: string;
  employmentStatusField: string;
  positionField: string;
  occurredOnField: string;
  hoursField: string;
  amountField: string;
  currencyField: string;
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
    syncApplyTerminated: false,
    employeeCodeField: '',
    fullNameField: '',
    departmentCodeField: '',
    regionCodeField: '',
    hiredAtField: '',
    employmentStatusField: '',
    positionField: '',
    occurredOnField: '',
    hoursField: '',
    amountField: '',
    currencyField: '',
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
    syncApplyTerminated: Boolean(source.syncApplyTerminated),
    employeeCodeField: source.fieldMap?.employeeCode ?? '',
    fullNameField: source.fieldMap?.fullName ?? '',
    departmentCodeField: source.fieldMap?.departmentCode ?? '',
    regionCodeField: source.fieldMap?.regionCode ?? '',
    hiredAtField: source.fieldMap?.hiredAt ?? '',
    employmentStatusField: source.fieldMap?.employmentStatus ?? '',
    positionField: source.fieldMap?.position ?? '',
    occurredOnField: source.fieldMap?.occurredOn ?? '',
    hoursField: source.fieldMap?.hours ?? '',
    amountField: source.fieldMap?.amount ?? '',
    currencyField: source.fieldMap?.currency ?? '',
    reasonField: source.fieldMap?.reason ?? '',
    approvalInstanceIdField: source.fieldMap?.approvalInstanceId ?? '',
    approvalStatusField: source.fieldMap?.approvalStatus ?? '',
  };
}

function toPayload(form: SourceForm) {
  const fieldMap = Object.fromEntries(
    Object.entries({
      employeeCode: form.employeeCodeField,
      fullName: form.fullNameField,
      departmentCode: form.departmentCodeField,
      regionCode: form.regionCodeField,
      hiredAt: form.hiredAtField,
      employmentStatus: form.employmentStatusField,
      position: form.positionField,
      occurredOn: form.occurredOnField,
      hours: form.hoursField,
      amount: form.amountField,
      currency: form.currencyField,
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
    defaultPayItemTypeCode:
      form.purpose === 'EMPLOYEE' ? null : form.defaultPayItemTypeCode.trim() || null,
    syncApplyTerminated: form.purpose === 'EMPLOYEE' ? form.syncApplyTerminated : false,
  };
}

function isLarkBindableType(type: PayItemType) {
  return type.enabled && type.intake === 'LARK';}

/** Nguon Base khong phai roster NV — can map cot ma NV + so tien/gio de tinh luong. */
function isMoneyLarkSource(form: Pick<SourceForm, 'kind' | 'purpose'>) {
  return form.kind === 'BASE' && form.purpose !== 'EMPLOYEE';
}

function applySuggestedFieldMap(form: SourceForm, suggested?: Record<string, string> | null): SourceForm {
  if (!suggested || Object.keys(suggested).length === 0) return form;
  const pick = (current: string, key: string) => current.trim() || suggested[key]?.trim() || '';
  return {
    ...form,
    employeeCodeField: pick(form.employeeCodeField, 'employeeCode'),
    fullNameField: pick(form.fullNameField, 'fullName'),
    departmentCodeField: pick(form.departmentCodeField, 'departmentCode'),
    regionCodeField: pick(form.regionCodeField, 'regionCode'),
    hiredAtField: pick(form.hiredAtField, 'hiredAt'),
    employmentStatusField: pick(form.employmentStatusField, 'employmentStatus'),
    positionField: pick(form.positionField, 'position'),
    occurredOnField: pick(form.occurredOnField, 'occurredOn'),
    hoursField: pick(form.hoursField, 'hours'),
    amountField: pick(form.amountField, 'amount'),
    currencyField: pick(form.currencyField, 'currency'),
    reasonField: pick(form.reasonField, 'reason'),
    approvalInstanceIdField: pick(form.approvalInstanceIdField, 'approvalInstanceId'),
    approvalStatusField: pick(form.approvalStatusField, 'approvalStatus'),
  };
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
  const canReadPayItems = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_READ));
  const [form, setForm] = useState<SourceForm | null>(null);
  const [inspect, setInspect] = useState<LarkInspectResult | null>(null);
  const [preview, setPreview] = useState<LarkPreviewResult | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LarkDataSource | null>(null);
  const [appForm, setAppForm] = useState<AppSettingsForm | null>(null);
  const [syncResult, setSyncResult] = useState<LarkPayItemSyncResult | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runOutcomeFilter, setRunOutcomeFilter] = useState('');

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

  const syncRuns = useQuery({
    queryKey: ['lark-pay-item-sync-runs'],
    queryFn: () => fetchLarkPayItemSyncRuns(30),
    enabled: canReadPayItems,
  });

  const syncRunDetail = useQuery({
    queryKey: ['lark-pay-item-sync-run', selectedRunId, runOutcomeFilter],
    queryFn: () =>
      fetchLarkPayItemSyncRun(selectedRunId!, {
        outcome: runOutcomeFilter || undefined,
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(selectedRunId) && canReadPayItems,
  });

  const bindableTypes = useMemo(
    () => (payItemTypes.data?.items ?? []).filter(isLarkBindableType),
    [payItemTypes.data?.items],
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['lark-data-sources'] });
    void queryClient.invalidateQueries({ queryKey: ['lark-app-settings'] });
    void queryClient.invalidateQueries({ queryKey: ['pay-items'] });
    void queryClient.invalidateQueries({ queryKey: ['lark-pay-item-sync-runs'] });
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
        return applySuggestedFieldMap(
          {
            ...current,
            kind: result.kind,
            appToken: result.appToken ?? current.appToken,
            spreadsheetToken: result.spreadsheetToken ?? current.spreadsheetToken,
            tableId: current.tableId || result.tables[0]?.id || '',
            sheetId: current.sheetId || result.sheets[0]?.id || '',
          },
          result.suggestedFieldMap,
        );
      });
      toast.success(t('larkSources.inspected'));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('missing form');
      if (isMoneyLarkSource(form) && form.defaultPayItemTypeCode.trim()) {
        if (!form.employeeCodeField.trim()) {
          throw new Error(t('larkSources.moneyMapNeedEmployeeCode'));
        }
        if (!form.amountField.trim() && !form.hoursField.trim()) {
          const boundType = bindableTypes.find(
            (type) => type.code === form.defaultPayItemTypeCode.trim().toUpperCase(),
          );
          if (!boundType?.defaultAmount?.trim()) {
            throw new Error(t('larkSources.moneyMapNeedAmountOrHours'));
          }
        }
      }
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
    onSuccess: async (result) => {
      toast.success(result.message);
      setPreview(result.preview);
      // Sau test API co the tu dien fieldMap — nap lai form neu dang sua cung nguon.
      const refreshed = await queryClient.fetchQuery({
        queryKey: ['lark-data-sources'],
        queryFn: fetchLarkDataSources,
      });
      setForm((current) => {
        if (!current?.id) return current;
        const updated = refreshed.items.find((item) => item.id === current.id);
        return updated ? { ...fromSource(updated) } : current;
      });
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

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateLarkDataSource(id, { enabled }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.enabled ? t('larkSources.syncEnabledOn') : t('larkSources.syncEnabledOff'),
      );
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
      const roster = result.employeeSync;
      const summary = t('larkSources.syncDone', {
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        skipped: result.skipped ?? 0,
      });
      toast.success(summary, { id: 'lark-source-sync', duration: 8000 });
      if (roster?.ran) {
        toast.message(
          t('larkSources.syncRosterDone', {
            created: roster.created ?? 0,
            updated: roster.updated ?? 0,
            terminated: roster.terminated ?? 0,
          }),
          { duration: 6000 },
        );
      }
      if (roster?.errors?.length) {
        const unique = [...new Set(roster.errors.map((line) => line.replace(/^[^:]+:\s*/, '')))];
        toast.warning(
          t('larkSources.syncRosterConflicts', {
            count: roster.errors.length,
            detail: unique.slice(0, 2).join(' · '),
          }),
          { duration: 12_000 },
        );
      }
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

  const syncRunColumns: Column<PayItemLarkSyncRun>[] = useMemo(
    () => [
      { key: 'code', header: t('larkSources.syncRunCode') },
      {
        key: 'startedAt',
        header: t('larkSources.syncRunStarted'),
        render: (row) => formatDate(row.startedAt),
      },
      {
        key: 'status',
        header: t('common.status'),
        render: (row) => t(`larkSources.syncRunStatus.${row.status}`),
      },
      {
        key: 'sourceCodes',
        header: t('larkSources.syncRunSources'),
        render: (row) => row.sourceCodes.join(', ') || '—',
      },
      {
        key: 'counters',
        header: t('larkSources.syncRunCounters'),
        render: (row) =>
          `${row.counters.created}/${row.counters.updated}/${row.counters.skipped}/${row.counters.errors}`,
      },
    ],
    [t],
  );

  const syncRowColumns: Column<PayItemLarkSyncRow>[] = useMemo(
    () => [
      {
        key: 'outcome',
        header: t('larkSources.syncRowOutcome'),
        render: (row) => t(`larkSources.syncOutcomes.${row.outcome}`),
      },
      { key: 'employeeCode', header: t('employees.code'), render: (row) => row.employeeCode || '—' },
      { key: 'payItemTypeCode', header: t('payItems.type'), render: (row) => row.payItemTypeCode || '—' },
      { key: 'sourceCode', header: t('larkSources.syncRunSources') },
      {
        key: 'amount',
        header: t('payItems.amount'),
        render: (row) => row.amount || row.hours || '—',
      },
      {
        key: 'message',
        header: t('larkSources.syncRowMessage'),
        render: (row) => row.message || '—',
      },
    ],
    [t],
  );

  const columns: Column<LarkDataSource>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('larkSources.name'),
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-[#eef0f6]">{row.name}</p>
            <p className={cn('truncate text-[11px]', textSubtle)}>
              {t(`larkSources.kinds.${row.kind}`)} · {t(`larkSources.purposes.${row.purpose}`)}
              {row.defaultPayItemTypeCode ? ` · ${row.defaultPayItemTypeCode}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'mapping',
        header: t('larkSources.employeeCodeField'),
        render: (row) => (
          <span className={cn('text-xs', textSubtle)}>
            {row.fieldMap?.employeeCode || '—'}
            {row.fieldMap?.amount || row.fieldMap?.hours
              ? ` / ${row.fieldMap?.amount || row.fieldMap?.hours}`
              : ''}
          </span>
        ),
      },
      {
        key: 'enabled',
        header: t('larkSources.syncToggle'),
        render: (row) => (
          <div
            className="flex items-center"
            title={row.enabled ? t('larkSources.status.ACTIVE') : t('larkSources.status.DISABLED')}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Switch
              size="sm"
              checked={row.enabled}
              disabled={!canWrite || toggleEnabledMutation.isPending}
              onCheckedChange={(checked) =>
                toggleEnabledMutation.mutate({ id: row.id, enabled: checked })
              }
            />
          </div>
        ),
      },
      {
        key: 'lastTest',
        header: t('larkSources.lastTest'),
        render: (row) =>
          row.lastTestedAt ? (
            <span
              className={cn('text-xs', row.lastTestOk ? 'text-[#4ade80]' : 'text-[#f87171]')}
              title={formatDate(row.lastTestedAt)}
            >
              {row.lastTestOk ? t('larkSources.testOk') : t('larkSources.testFail')}
            </span>
          ) : (
            <span className={cn('text-xs', textSubtle)}>—</span>
          ),
      },
      {
        key: 'actions',
        header: t('common.actions'),
        render: (row) => (
          <div
            className="flex items-center gap-0.5"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <IconActionButton
              label={t('larkSources.edit')}
              tone="primary"
              onClick={() => {
                setForm(fromSource(row));
                setInspect(null);
              }}
            >
              <Pencil className="h-4 w-4" />
            </IconActionButton>
            <IconActionButton
              label={t('larkSources.test')}
              disabled={testMutation.isPending}
              onClick={() => testMutation.mutate(row.id)}
            >
              <PlugZap className="h-4 w-4" />
            </IconActionButton>
            <IconActionButton
              label={t('larkSources.preview')}
              disabled={previewMutation.isPending}
              onClick={() => previewMutation.mutate(row.id)}
            >
              <Eye className="h-4 w-4" />
            </IconActionButton>
            {row.kind === 'BASE' && row.defaultPayItemTypeCode && canWrite ? (
              <IconActionButton
                label={
                  syncSourceMutation.isPending
                    ? t('larkSources.syncPending')
                    : t('larkSources.syncSource')
                }
                tone="primary"
                disabled={syncSourceMutation.isPending}
                onClick={() => {
                  if (!canSyncPayItems) {
                    toast.error(t('larkSources.syncNeedPayItemWrite'));
                    return;
                  }
                  syncSourceMutation.mutate(row.id);
                }}
              >
                <RefreshCw
                  className={cn('h-4 w-4', syncSourceMutation.isPending && 'animate-spin')}
                />
              </IconActionButton>
            ) : null}
            {canWrite ? (
              <IconActionButton
                label={t('common.delete')}
                tone="danger"
                onClick={() => setPendingDelete(row)}
              >
                <Trash2 className="h-4 w-4" />
              </IconActionButton>
            ) : null}
          </div>
        ),
      },
    ],
    [
      canSyncPayItems,
      canWrite,
      previewMutation,
      syncSourceMutation,
      t,
      testMutation,
      toggleEnabledMutation,
    ],
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
            <Button
              variant="create"
              size="icon"
              title={t('larkSources.create')}
              aria-label={t('larkSources.create')}
              onClick={() => {
                setForm(emptyForm());
                setInspect(null);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null
        }
      />

      <div className={cn(cardClass, 'mb-4 space-y-3 p-3')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">{t('larkSources.appTitle')}</p>
            <p className={cn('text-xs', textSubtle)}>{t('larkSources.appHint')}</p>
          </div>
          {canWrite && syncedAppForm ? (
            <div className="flex items-center gap-0.5">
              <IconActionButton
                label={t('common.save')}
                tone="primary"
                disabled={saveAppMutation.isPending}
                onClick={() => saveAppMutation.mutate()}
              >
                <Save className="h-3.5 w-3.5" />
              </IconActionButton>
              <IconActionButton
                label={t('larkSources.appTest')}
                disabled={testAppMutation.isPending}
                onClick={() => testAppMutation.mutate()}
              >
                <PlugZap className="h-4 w-4" />
              </IconActionButton>
            </div>
          ) : null}
        </div>

        {syncedAppForm ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                size="sm"
                checked={syncedAppForm.enabled}
                disabled={!canWrite}
                onCheckedChange={(checked) =>
                  setAppForm({ ...syncedAppForm, enabled: checked })
                }
              />
              {t('larkSources.appEnabled')}
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
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
            </div>
          </div>
        ) : appSettings.isLoading ? (
          <p className={cn('text-sm', textSubtle)}>{t('common.loading')}</p>
        ) : null}

        <p className={cn('border-t border-[#2a3040] pt-2 text-xs', textSubtle)}>
          {bot?.configured
            ? t('larkSources.botStatusOn', {
                source: t(`larkSources.credentialSource.${bot.source ?? 'none'}`),
                url: bot.baseUrl,
                appId: bot.appId || '—',
              })
            : t('larkSources.botMissing')}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        onRowClick={(row) => { setForm(fromSource(row)); setInspect(null); }}
      />

      {canReadPayItems ? (
        <div className={cn(cardClass, 'mt-4 space-y-2 p-3')}>
          <div>
            <p className="text-sm font-medium">{t('larkSources.syncHistoryTitle')}</p>
            <p className={cn('text-xs', textSubtle)}>{t('larkSources.syncHistoryHint')}</p>
          </div>
          <DataTable
            columns={syncRunColumns}
            data={syncRuns.data?.items ?? []}
            loading={syncRuns.isLoading}
            emptyMessage={t('larkSources.syncHistoryEmpty')}
            onRowClick={(row) => {
              setRunOutcomeFilter('');
              setSelectedRunId(row.id);
            }}
          />
        </div>
      ) : null}

      <Dialog
        open={Boolean(form)}
        onClose={() => { setForm(null); setInspect(null); }}
        title={form?.id ? t('larkSources.edit') : t('larkSources.create')}
        className="max-w-2xl"
        footer={
          form ? (
            <div className="flex w-full flex-wrap items-center gap-1">
              {form.id && canWrite ? (
                <IconActionButton
                  className="mr-auto"
                  label={t('common.delete')}
                  tone="danger"
                  onClick={() => {
                    const current = list.data?.items.find((item) => item.id === form.id);
                    if (current) setPendingDelete(current);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconActionButton>
              ) : (
                <span className="mr-auto" />
              )}
              <Button variant="ghost" onClick={() => { setForm(null); setInspect(null); }}>
                {t('common.cancel')}
              </Button>
              {canWrite ? (
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !form.name.trim()}
                >
                  <Save className="h-4 w-4" />
                  {t('common.save')}
                </Button>
              ) : null}
            </div>
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
            {form.kind === 'BASE' && form.purpose !== 'EMPLOYEE' ? (
              <Field label={t('larkSources.payItemType')}>
                <Select
                  value={form.defaultPayItemTypeCode}
                  onChange={(event) => setForm({ ...form, defaultPayItemTypeCode: event.target.value })}
                >
                  <option value="">{t('larkSources.payItemTypeNone')}</option>
                  {bindableTypes.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.label} ({type.code} · {t(`payItemIntake.${type.intake ?? 'LARK'}`)} ·{' '}
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
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#2a3040] bg-[#0f1218] px-2.5 py-2">
              <IconActionButton
                label={t('larkSources.inspect')}
                className="h-10 w-10"
                disabled={inspectMutation.isPending}
                onClick={() => inspectMutation.mutate()}
              >
                <Search className="h-5 w-5" />
              </IconActionButton>
              {form.id ? (
                <>
                  <IconActionButton
                    label={t('larkSources.test')}
                    className="h-10 w-10"
                    disabled={testMutation.isPending}
                    onClick={() => testMutation.mutate(form.id!)}
                  >
                    <PlugZap className="h-5 w-5" />
                  </IconActionButton>
                  <IconActionButton
                    label={t('larkSources.preview')}
                    className="h-10 w-10"
                    disabled={previewMutation.isPending}
                    onClick={() => previewMutation.mutate(form.id!)}
                  >
                    <Eye className="h-5 w-5" />
                  </IconActionButton>
                  {form.kind === 'BASE' && form.defaultPayItemTypeCode && canWrite ? (
                    <IconActionButton
                      label={
                        syncSourceMutation.isPending
                          ? t('larkSources.syncPending')
                          : t('larkSources.syncSource')
                      }
                      tone="primary"
                      className="h-10 w-10"
                      disabled={syncSourceMutation.isPending}
                      onClick={() => {
                        if (!canSyncPayItems) {
                          toast.error(t('larkSources.syncNeedPayItemWrite'));
                          return;
                        }
                        syncSourceMutation.mutate(form.id!);
                      }}
                    >
                      <RefreshCw
                        className={cn(
                          'h-5 w-5',
                          syncSourceMutation.isPending && 'animate-spin',
                        )}
                      />
                    </IconActionButton>
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
            {isMoneyLarkSource(form) ? (
              <div className="space-y-3 rounded-lg border border-[#2a3040] bg-[#1a1e28]/50 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#e8eaed]">{t('larkSources.moneyMapTitle')}</p>
                  <p className={cn('text-xs', textSubtle)}>{t('larkSources.moneyMapHint')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('larkSources.employeeCodeField')}>
                    <FieldMapInput
                      value={form.employeeCodeField}
                      names={fieldNames}
                      required
                      placeholder={t('larkSources.employeeCodePlaceholder')}
                      onChange={(value) => setForm({ ...form, employeeCodeField: value })}
                    />
                  </Field>
                  <Field label={t('larkSources.fieldMap.amount')}>
                    <FieldMapInput
                      value={form.amountField}
                      names={fieldNames}
                      required={!form.hoursField.trim()}
                      placeholder={t('larkSources.amountPlaceholder')}
                      onChange={(value) => setForm({ ...form, amountField: value })}
                    />
                  </Field>
                  {(
                    [
                      ['hoursField', 'hours'],
                      ['currencyField', 'currency'],
                      ['occurredOnField', 'occurredOn'],
                      ['reasonField', 'reason'],
                      ['approvalStatusField', 'approvalStatus'],
                      ['approvalInstanceIdField', 'approvalInstanceId'],
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
              </div>
            ) : form.purpose === 'EMPLOYEE' ? (
              <div className="space-y-3 rounded-lg border border-[#2a3040] bg-[#1a1e28]/50 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#e8eaed]">{t('larkSources.employeeMapTitle')}</p>
                  <p className={cn('text-xs', textSubtle)}>{t('larkSources.employeeMapHint')}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('larkSources.employeeCodeField')}>
                    <FieldMapInput
                      value={form.employeeCodeField}
                      names={fieldNames}
                      required
                      placeholder={t('larkSources.employeeCodePlaceholder')}
                      onChange={(value) => setForm({ ...form, employeeCodeField: value })}
                    />
                  </Field>
                  {(
                    [
                      ['fullNameField', 'fullName'],
                      ['departmentCodeField', 'departmentCode'],
                      ['regionCodeField', 'regionCode'],
                      ['hiredAtField', 'hiredAt'],
                      ['employmentStatusField', 'employmentStatus'],
                      ['positionField', 'position'],
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
                <label className="flex items-start gap-3 text-sm">
                  <Switch
                    className="mt-0.5"
                    checked={form.syncApplyTerminated}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, syncApplyTerminated: checked })
                    }
                  />
                  <span>
                    <span className="block font-medium text-[#eef0f6]">
                      {t('larkSources.syncApplyTerminated')}
                    </span>
                    <span className={cn('mt-0.5 block text-xs', textSubtle)}>
                      {t('larkSources.syncApplyTerminatedHint')}
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <Field label={t('larkSources.employeeCodeField')}>
                <FieldMapInput
                  value={form.employeeCodeField}
                  names={fieldNames}
                  required
                  placeholder={t('larkSources.employeeCodePlaceholder')}
                  onChange={(value) => setForm({ ...form, employeeCodeField: value })}
                />
              </Field>
            )}
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
          <div className="flex flex-wrap gap-2">
            {syncResult?.runId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedRunId(syncResult.runId!);
                  setSyncResult(null);
                }}
              >
                {t('larkSources.openSyncRun')}
              </Button>
            ) : null}
            <Button type="button" onClick={() => setSyncResult(null)}>
              {t('common.close')}
            </Button>
          </div>
        }
      >
        {syncResult ? <LarkSyncResultView result={syncResult} /> : null}
      </Dialog>

      <Dialog
        open={Boolean(selectedRunId)}
        onClose={() => setSelectedRunId(null)}
        title={t('larkSources.syncRunDetailTitle')}
        className="max-w-4xl"
        footer={
          <Button type="button" onClick={() => setSelectedRunId(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {syncRunDetail.data ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className={textSubtle}>{t('larkSources.syncRunCode')}: </span>
                {syncRunDetail.data.run.code}
              </p>
              <p>
                <span className={textSubtle}>{t('common.status')}: </span>
                {t(`larkSources.syncRunStatus.${syncRunDetail.data.run.status}`)}
              </p>
              <p>
                <span className={textSubtle}>{t('larkSources.syncRunStarted')}: </span>
                {formatDate(syncRunDetail.data.run.startedAt)}
              </p>
              <p>
                <span className={textSubtle}>{t('larkSources.syncRunCounters')}: </span>
                {`${syncRunDetail.data.run.counters.created}/${syncRunDetail.data.run.counters.updated}/${syncRunDetail.data.run.counters.skipped}/${syncRunDetail.data.run.counters.errors}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label>{t('larkSources.syncRowOutcome')}</Label>
              <Select
                value={runOutcomeFilter}
                onChange={(event) => setRunOutcomeFilter(event.target.value)}
              >
                <option value="">{t('common.all')}</option>
                {(['created', 'updated', 'unchanged', 'skipped', 'error'] as PayItemLarkSyncRowOutcome[]).map(
                  (outcome) => (
                    <option key={outcome} value={outcome}>
                      {t(`larkSources.syncOutcomes.${outcome}`)}
                    </option>
                  ),
                )}
              </Select>
            </div>
            <DataTable
              columns={syncRowColumns}
              data={syncRunDetail.data.rows.items}
              loading={syncRunDetail.isLoading}
              emptyMessage={t('common.noData')}
              count={syncRunDetail.data.rows.total}
            />
          </div>
        ) : (
          <p className={cn('text-sm', textSubtle)}>{t('common.loading')}</p>
        )}
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
  const roster = result.employeeSync;
  const rosterCards = roster
    ? ([
        { key: 'created', value: roster.created ?? 0, tone: 'text-[#34d399]' },
        { key: 'updated', value: roster.updated ?? 0, tone: 'text-[#4ade80]' },
        { key: 'unchanged', value: roster.unchanged ?? 0, tone: 'text-[#9aa3b5]' },
        { key: 'skipped', value: roster.skipped ?? 0, tone: 'text-[#fbbf24]' },
      ] as const)
    : [];

  return (
    <div className="space-y-4">
      <p className={cn('text-sm', textSubtle)}>{t('larkSources.syncResultHint')}</p>
      {roster ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#e8eaed]">{t('larkSources.syncRosterSection')}</p>
          {roster.ran ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {rosterCards.map((card) => (
                <div
                  key={`roster-${card.key}`}
                  className="rounded-lg border border-[#2a3040] bg-[#1a1e28]/60 px-3 py-3 text-center"
                >
                  <p className={cn('text-xl font-semibold tabular-nums', card.tone)}>{card.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-[#9aa3b5]">
                    {t(`larkSources.syncStats.${card.key}`)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className={cn('text-sm', textSubtle)}>
              {t('larkSources.syncRosterSkipped', { reason: roster.reason ?? '—' })}
            </p>
          )}
          {roster.errors?.length ? (
            <ul className="max-h-24 space-y-1 overflow-auto text-xs text-[#fecaca]/90">
              {roster.errors.slice(0, 5).map((error, index) => (
                <li key={`roster-err-${index}`} className="break-words font-mono">
                  {error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {result.runId || result.code || result.status ? (
        <div className="rounded-lg border border-[#2a3040] bg-[#1a1e28]/60 px-3 py-2 text-sm">
          {result.code ? (
            <p>
              <span className={textSubtle}>{t('larkSources.syncRunCode')}: </span>
              <span className="font-mono">{result.code}</span>
            </p>
          ) : null}
          {result.status ? (
            <p>
              <span className={textSubtle}>{t('common.status')}: </span>
              {t(`larkSources.syncRunStatus.${result.status}`)}
            </p>
          ) : null}
          {result.runId ? (
            <p className="font-mono text-xs text-[#9aa3b5]">{result.runId}</p>
          ) : null}
        </div>
      ) : null}
      <p className="text-sm font-medium text-[#e8eaed]">{t('larkSources.syncPayItemsSection')}</p>
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
  required,
  onChange,
}: {
  value: string;
  names: string[];
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  if (names.length > 0) {
    const options = value && !names.includes(value) ? [value, ...names] : names;
    return (
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">
          {required ? t('larkSources.chooseColumn') : t('common.optional')}
        </option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Select>
    );
  }
  return <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}
