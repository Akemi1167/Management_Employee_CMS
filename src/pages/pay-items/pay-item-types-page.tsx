import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { cardClass, sectionAccent, sectionHeading, textSubtle } from '@/constants/theme';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import {
  createPayItemType,
  deletePayItemType,
  fetchPayItemTypes,
  updatePayItemType,
} from '@/services/pay-item.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  PayItemIntake,
  PayItemType,
  PayItemUnit,
  PayrollComponentCode,
  PayrollComponentKind,
} from '@/types/api';

const KINDS: PayrollComponentKind[] = ['EARNING', 'DEDUCTION'];
const UNITS: PayItemUnit[] = ['AMOUNT', 'HOURS', 'BOTH'];
const INTAKES: PayItemIntake[] = ['POLICY', 'MANUAL', 'LARK'];
/** Display order for grouped sections (earnings first, then deductions). */
const COMPONENTS: PayrollComponentCode[] = [
  'BASE_SALARY',
  'ALLOWANCE',
  'BONUS',
  'OVERTIME',
  'OTHER',
  'ADJUSTMENT',
  'PENALTY',
  'ADVANCE',
  'TAX',
  'INSURANCE',
];
const INTAKE_SORT: Record<PayItemIntake, number> = { LARK: 0, MANUAL: 1, POLICY: 2 };
const REPLACES_EXCEL = new Set<PayrollComponentCode>([
  'OVERTIME',
  'PENALTY',
  'BONUS',
  'ALLOWANCE',
  'BASE_SALARY',
  'ADVANCE',
]);

interface TypeForm {
  id?: string;
  code: string;
  label: string;
  kind: PayrollComponentKind;
  mapsToPayrollComponent: PayrollComponentCode;
  unit: PayItemUnit;
  intake: PayItemIntake;
  defaultAmount: string;
  enabled: boolean;
}

function emptyForm(): TypeForm {
  return {
    code: '',
    label: '',
    kind: 'EARNING',
    mapsToPayrollComponent: 'OTHER',
    unit: 'AMOUNT',
    intake: 'MANUAL',
    defaultAmount: '',
    enabled: true,
  };
}

function fromType(type: PayItemType): TypeForm {
  return {
    id: type.id,
    code: type.code,
    label: type.label,
    kind: type.kind,
    mapsToPayrollComponent: type.mapsToPayrollComponent,
    unit: type.unit,
    intake: type.intake ?? 'MANUAL',
    defaultAmount: type.defaultAmount ?? '',
    enabled: type.enabled,
  };
}

function normalizeDefaultAmountInput(value: string): string | null {
  const trimmed = value.trim().replace(/,/g, '');
  return trimmed === '' ? null : trimmed;
}

export function PayItemTypesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_WRITE));
  const [form, setForm] = useState<TypeForm | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TypeForm | null>(null);
  const [search, setSearch] = useState('');
  const [intakeFilter, setIntakeFilter] = useState<PayItemIntake | ''>('');
  const [showDisabled, setShowDisabled] = useState(false);

  const list = useQuery({ queryKey: ['pay-item-types'], queryFn: fetchPayItemTypes });

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('missing form');
      const defaultAmount = normalizeDefaultAmountInput(form.defaultAmount);
      if (form.id) {
        return updatePayItemType(form.id, {
          label: form.label.trim(),
          kind: form.kind,
          mapsToPayrollComponent: form.mapsToPayrollComponent,
          unit: form.unit,
          intake: form.intake,
          defaultAmount,
          enabled: form.enabled,
        });
      }
      return createPayItemType({
        code: form.code.trim(),
        label: form.label.trim(),
        kind: form.kind,
        mapsToPayrollComponent: form.mapsToPayrollComponent,
        unit: form.unit,
        intake: form.intake,
        defaultAmount,
      });
    },
    onSuccess: () => {
      toast.success(t('payItemTypes.saved'));
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ['pay-item-types'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => {
      if (!pendingDelete?.id) throw new Error('missing id');
      return deletePayItemType(pendingDelete.id);
    },
    onSuccess: () => {
      toast.success(t('payItemTypes.deleted'));
      setPendingDelete(null);
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ['pay-item-types'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data?.items ?? []).filter((item) => {
      if (!showDisabled && !item.enabled) return false;
      if (intakeFilter && (item.intake ?? 'MANUAL') !== intakeFilter) return false;
      if (!q) return true;
      return (
        item.code.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        t(`payrollComponent.${item.mapsToPayrollComponent}`).toLowerCase().includes(q) ||
        t(`payItemIntake.${item.intake ?? 'MANUAL'}`).toLowerCase().includes(q)
      );
    });
  }, [intakeFilter, list.data?.items, search, showDisabled, t]);

  const grouped = useMemo(() => {
    const byComponent = new Map<PayrollComponentCode, PayItemType[]>();
    for (const item of filtered) {
      const key = item.mapsToPayrollComponent;
      const bucket = byComponent.get(key) ?? [];
      bucket.push(item);
      byComponent.set(key, bucket);
    }
    for (const bucket of byComponent.values()) {
      bucket.sort((a, b) => {
        const intakeDiff =
          (INTAKE_SORT[a.intake ?? 'MANUAL'] ?? 9) - (INTAKE_SORT[b.intake ?? 'MANUAL'] ?? 9);
        if (intakeDiff !== 0) return intakeDiff;
        return a.code.localeCompare(b.code);
      });
    }
    const ordered = COMPONENTS.filter((code) => (byComponent.get(code)?.length ?? 0) > 0).map(
      (code) => ({ code, items: byComponent.get(code)! }),
    );
    const extras = [...byComponent.keys()]
      .filter((code) => !COMPONENTS.includes(code))
      .sort()
      .map((code) => ({ code, items: byComponent.get(code)! }));
    return [...ordered, ...extras];
  }, [filtered]);

  const columns: Column<PayItemType>[] = useMemo(
    () => [
      { key: 'code', header: t('payItemTypes.code') },
      { key: 'label', header: t('payItemTypes.label') },
      {
        key: 'kind',
        header: t('payItemTypes.kind'),
        render: (row) => t(`payItemKind.${row.kind}`),
      },
      {
        key: 'unit',
        header: t('payItemTypes.unit'),
        render: (row) => t(`payItemUnit.${row.unit}`),
      },
      {
        key: 'intake',
        header: t('payItemTypes.intake'),
        render: (row) => t(`payItemIntake.${row.intake ?? 'MANUAL'}`),
      },
      {
        key: 'defaultAmount',
        header: t('payItemTypes.defaultAmount'),
        render: (row) => (row.defaultAmount ? moneyText(row.defaultAmount) : '—'),
      },
      {
        key: 'enabled',
        header: t('common.status'),
        render: (row) => <StatusBadge value={row.enabled ? 'ACTIVE' : 'DISABLED'} ns="employment" />,
      },
    ],
    [t],
  );

  const canSubmit = Boolean(form && form.label.trim() && (form.id || form.code.trim().length >= 2));

  return (
    <PageContainer>
      <PageHeader
        title={t('payItemTypes.title')}
        description={t('payItemTypes.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/pay-items">{t('nav.payItems')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/payroll-policies">{t('nav.payrollPolicies')}</Link>
            </Button>
            {canWrite ? (
              <CreateButton onClick={() => setForm(emptyForm())}>{t('payItemTypes.create')}</CreateButton>
            ) : null}
          </div>
        }
      />

      <div className={`${cardClass} mb-4 space-y-2 p-4 text-sm ${textSubtle}`}>
        <p>{t('payItemTypes.hint')}</p>
        <p>{t('payItemTypes.larkBindHint')}</p>
      </div>

      <div className={`${cardClass} mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]`}>
        <Field label={t('common.search')}>
          <Input
            value={search}
            placeholder={t('payItemTypes.searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label={t('payItemTypes.intake')}>
          <Select
            value={intakeFilter}
            onChange={(event) => setIntakeFilter(event.target.value as PayItemIntake | '')}
          >
            <option value="">{t('common.all')}</option>
            {INTAKES.map((intake) => (
              <option key={intake} value={intake}>
                {t(`payItemIntake.${intake}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('payItemTypes.showDisabled')}>
          <div className="flex h-10 items-center">
            <Switch checked={showDisabled} onCheckedChange={setShowDisabled} />
          </div>
        </Field>
      </div>

      {list.isLoading ? (
        <div className={`${cardClass} p-4 text-sm ${textSubtle}`}>{t('common.loading')}</div>
      ) : grouped.length === 0 ? (
        <div className={`${cardClass} p-4 text-sm ${textSubtle}`}>{t('payItemTypes.emptyFiltered')}</div>
      ) : (
        <div className="space-y-4">
          {grouped.map((block) => (
            <div key={block.code} className={`${cardClass} space-y-3 p-4`}>
              <h3 className={`${sectionHeading} mb-0`}>
                <span className={sectionAccent} />
                {t(`payrollComponent.${block.code}`)}
                <span className={`text-xs font-normal ${textSubtle}`}>
                  {t('payItemTypes.groupCount', { count: block.items.length })}
                </span>
              </h3>
              <DataTable
                columns={columns}
                data={block.items}
                onRowClick={canWrite ? (row) => setForm(fromType(row)) : undefined}
                count={block.items.length}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? t('payItemTypes.edit') : t('payItemTypes.create')}
        footer={
          form ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              {form.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setPendingDelete(form)}
                  disabled={save.isPending || remove.isPending}
                >
                  {t('common.delete')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setForm(null)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {form ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('payItemTypes.code')}>
              <Input
                value={form.code}
                disabled={Boolean(form.id)}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
            </Field>
            <Field label={t('payItemTypes.label')}>
              <Input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
            </Field>
            <Field label={t('payItemTypes.kind')}>
              <Select
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as PayrollComponentKind })}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`payItemKind.${kind}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('payItemTypes.component')}>
              <Select
                value={form.mapsToPayrollComponent}
                onChange={(event) =>
                  setForm({ ...form, mapsToPayrollComponent: event.target.value as PayrollComponentCode })
                }
              >
                {COMPONENTS.map((code) => (
                  <option key={code} value={code}>
                    {t(`payrollComponent.${code}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('payItemTypes.unit')}>
              <Select
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value as PayItemUnit })}
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`payItemUnit.${unit}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('payItemTypes.intake')}>
              <Select
                value={form.intake}
                onChange={(event) => setForm({ ...form, intake: event.target.value as PayItemIntake })}
              >
                {INTAKES.map((intake) => (
                  <option key={intake} value={intake}>
                    {t(`payItemIntake.${intake}`)}
                  </option>
                ))}
              </Select>
              <p className={`text-xs ${textSubtle}`}>{t(`payItemTypes.intakeHint.${form.intake}`)}</p>
            </Field>
            <Field label={t('payItemTypes.defaultAmount')}>
              <Input
                inputMode="decimal"
                value={form.defaultAmount}
                placeholder={t('payItemTypes.defaultAmountPlaceholder')}
                onChange={(event) => setForm({ ...form, defaultAmount: event.target.value })}
              />
              <p className={`text-xs ${textSubtle}`}>{t('payItemTypes.defaultAmountHint')}</p>
            </Field>
            {form.id ? (
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <Switch checked={form.enabled} onCheckedChange={(checked) => setForm({ ...form, enabled: checked })} />
                {t('payItemTypes.enabled')}
              </label>
            ) : null}
            {REPLACES_EXCEL.has(form.mapsToPayrollComponent) ? (
              <p className="text-sm text-[#fbbf24] sm:col-span-2">{t('payItemTypes.replaceWarning')}</p>
            ) : (
              <p className={`text-sm sm:col-span-2 ${textSubtle}`}>{t('payItemTypes.otherHint')}</p>
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={t('payItemTypes.confirmDelete')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {t('payItemTypes.confirmDeleteDescription', {
            code: pendingDelete?.code ?? '',
            label: pendingDelete?.label ?? '',
          })}
        </p>
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
