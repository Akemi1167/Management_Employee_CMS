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
import { cardClass, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { createPayItemType, fetchPayItemTypes, updatePayItemType } from '@/services/pay-item.service';
import { useAuthStore } from '@/stores/auth-store';
import type { PayItemType, PayItemUnit, PayrollComponentCode, PayrollComponentKind } from '@/types/api';

const KINDS: PayrollComponentKind[] = ['EARNING', 'DEDUCTION'];
const UNITS: PayItemUnit[] = ['AMOUNT', 'HOURS', 'BOTH'];
const COMPONENTS: PayrollComponentCode[] = [
  'OTHER',
  'ADJUSTMENT',
  'OVERTIME',
  'PENALTY',
  'ALLOWANCE',
  'BONUS',
  'ADVANCE',
  'BASE_SALARY',
  'TAX',
  'INSURANCE',
];
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
  enabled: boolean;
}

function emptyForm(): TypeForm {
  return {
    code: '',
    label: '',
    kind: 'EARNING',
    mapsToPayrollComponent: 'OTHER',
    unit: 'AMOUNT',
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
    enabled: type.enabled,
  };
}

export function PayItemTypesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_WRITE));
  const [form, setForm] = useState<TypeForm | null>(null);

  const list = useQuery({ queryKey: ['pay-item-types'], queryFn: fetchPayItemTypes });

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('missing form');
      if (form.id) {
        return updatePayItemType(form.id, {
          label: form.label.trim(),
          kind: form.kind,
          mapsToPayrollComponent: form.mapsToPayrollComponent,
          unit: form.unit,
          enabled: form.enabled,
        });
      }
      return createPayItemType({
        code: form.code.trim(),
        label: form.label.trim(),
        kind: form.kind,
        mapsToPayrollComponent: form.mapsToPayrollComponent,
        unit: form.unit,
      });
    },
    onSuccess: () => {
      toast.success(t('payItemTypes.saved'));
      setForm(null);
      void queryClient.invalidateQueries({ queryKey: ['pay-item-types'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

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
        key: 'mapsToPayrollComponent',
        header: t('payItemTypes.component'),
        render: (row) => t(`payrollComponent.${row.mapsToPayrollComponent}`),
      },
      {
        key: 'unit',
        header: t('payItemTypes.unit'),
        render: (row) => t(`payItemUnit.${row.unit}`),
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
            {canWrite ? (
              <CreateButton onClick={() => setForm(emptyForm())}>{t('payItemTypes.create')}</CreateButton>
            ) : null}
          </div>
        }
      />

      <div className={`${cardClass} mb-4 p-4 text-sm ${textSubtle}`}>{t('payItemTypes.hint')}</div>

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        onRowClick={canWrite ? (row) => setForm(fromType(row)) : undefined}
      />

      <Dialog
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? t('payItemTypes.edit') : t('payItemTypes.create')}
        footer={
          form ? (
            <>
              <Button variant="ghost" onClick={() => setForm(null)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
                {t('common.save')}
              </Button>
            </>
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
