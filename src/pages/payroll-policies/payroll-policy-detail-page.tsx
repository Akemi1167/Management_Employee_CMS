import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PERMISSION } from '@/constants/api-endpoints';
import { cardClass, sectionAccent, sectionHeading, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import {
  describeAmount,
  describeWhen,
  describeWho,
} from '@/lib/payroll-policy-explain';
import { fetchPayItemTypes } from '@/services/pay-item.service';
import {
  deletePayrollPolicy,
  fetchPayrollPolicy,
  updatePayrollPolicy,
} from '@/services/payroll-policy.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  PayrollPolicyAnchor,
  PayrollPolicyCutoffMode,
  PayrollPolicyItem,
  PayrollPolicyItemGroup,
  PayrollPolicyRuleKind,
} from '@/types/api';

const GROUPS: PayrollPolicyItemGroup[] = ['SALARY', 'BENEFIT', 'RELOCATION', 'DEDUCTION'];
const RULES: PayrollPolicyRuleKind[] = ['NONE', 'CUTOFF', 'CAP', 'FACT', 'FX'];
const ANCHORS: PayrollPolicyAnchor[] = [
  'HIRED_AT',
  'DEMOTION_OR_HIRED',
  'RELOCATED_AT',
  'CONFIRMATION',
  'PROMOTION',
  'DEMOTION',
  'FORM',
  'BIRTHDAY',
  'JOB',
  'CALENDAR',
];
const CUTOFF_MODES: PayrollPolicyCutoffMode[] = [
  'NONE',
  'DELAY_NEXT_MONTH',
  'PRORATE_100_50',
  'SAME_MONTH',
  'FROM_EVENT_DAY',
  'SKIP_FIRST_MONTH',
];

function parseDepartments(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

export function PayrollPolicyDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_WRITE));
  const [tab, setTab] = useState<'guide' | 'edit'>('guide');

  const policyQuery = useQuery({
    queryKey: ['payroll-policy', id],
    queryFn: () => fetchPayrollPolicy(id),
    enabled: Boolean(id),
  });
  const typesQuery = useQuery({ queryKey: ['pay-item-types'], queryFn: fetchPayItemTypes });
  const policy = policyQuery.data;

  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [cutoffDay, setCutoffDay] = useState('15');
  const [workHoursPerDay, setWorkHoursPerDay] = useState('9');
  const [fxSource, setFxSource] = useState('TAI');
  const [payoutDay, setPayoutDay] = useState('11');
  const [departments, setDepartments] = useState('');
  const [items, setItems] = useState<PayrollPolicyItem[]>([]);
  const [addCode, setAddCode] = useState('');

  useEffect(() => {
    if (!policy) return;
    setName(policy.name);
    setEnabled(policy.enabled);
    setCutoffDay(String(policy.cutoffDay));
    setWorkHoursPerDay(String(policy.workHoursPerDay ?? 9));
    setFxSource(policy.fx.source);
    setPayoutDay(String(policy.fx.payoutDay));
    setDepartments(policy.departmentCodes.join(', '));
    setItems(policy.items);
  }, [policy]);

  const typeLabel = useMemo(() => {
    const map = new Map((typesQuery.data?.items ?? []).map((type) => [type.code, type.label]));
    return (code: string) => map.get(code) ?? code;
  }, [typesQuery.data]);

  const unusedTypes = (typesQuery.data?.items ?? []).filter(
    (type) => type.enabled && !items.some((item) => item.payItemTypeCode === type.code),
  );

  const cutoff = Number(cutoffDay) || 15;
  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        group,
        items: items.filter((item) => item.group === group),
      })).filter((block) => block.items.length > 0),
    [items],
  );

  const save = useMutation({
    mutationFn: () =>
      updatePayrollPolicy(id, {
        name: name.trim(),
        enabled,
        cutoffDay: cutoff,
        workHoursPerDay: Number(workHoursPerDay) || 9,
        fx: { source: fxSource.trim() || 'TAI', payoutDay: Number(payoutDay) || 11 },
        departmentCodes: parseDepartments(departments),
        items,
      }),
    onSuccess: () => {
      toast.success(t('payrollPolicies.saved'));
      void queryClient.invalidateQueries({ queryKey: ['payroll-policy', id] });
      void queryClient.invalidateQueries({ queryKey: ['payroll-policies'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: () => deletePayrollPolicy(id),
    onSuccess: () => {
      toast.success(t('payrollPolicies.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['payroll-policies'] });
      navigate('/payroll-policies');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const addItem = () => {
    if (!addCode) return;
    setItems((current) => [
      ...current,
      {
        payItemTypeCode: addCode,
        group: 'SALARY',
        enabled: true,
        ruleKind: 'NONE',
        capAmount: null,
        capCurrency: null,
        factKey: null,
        anchorKey: null,
        cutoffMode: 'NONE',
        milestoneMonths: null,
        milestoneDays: null,
        eligibilityKey: null,
        rateAmount: null,
        rateCurrency: null,
        formulaKind: 'FLAT',
        rateDivisorDays: null,
        rateTable: [],
        note: null,
      },
    ]);
    setAddCode('');
  };

  const patchItem = (code: string, patch: Partial<PayrollPolicyItem>) => {
    setItems((current) =>
      current.map((item) => (item.payItemTypeCode === code ? { ...item, ...patch } : item)),
    );
  };

  if (!policy && !policyQuery.isLoading) {
    return (
      <PageContainer>
        <p className={textSubtle}>{t('payrollPolicies.notFound')}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={policy ? `${policy.code} · ${policy.name}` : t('payrollPolicies.title')}
        description={t('payrollPolicies.detailHint')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/payroll-policies">{t('common.back')}</Link>
            </Button>
            {canWrite ? (
              <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
                {t('common.save')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className={`${cardClass} mb-4 space-y-4 p-4`}>
        <h2 className={sectionHeading}>
          <span className={sectionAccent} />
          {t('payrollPolicies.assignTitle')}
        </h2>
        <ol className={`list-decimal space-y-2 pl-5 text-sm ${textSubtle}`}>
          <li>{t('payrollPolicies.assignStep1')}</li>
          <li>{t('payrollPolicies.assignStep2')}</li>
          <li>{t('payrollPolicies.assignStep3')}</li>
        </ol>
        <DepartmentChips
          value={departments}
          disabled={!canWrite}
          onChange={setDepartments}
          addLabel={t('payrollPolicies.addDepartment')}
          placeholder={t('payrollPolicies.departmentsPlaceholder')}
        />
        <p className={`text-[11px] ${textSubtle}`}>{t('payrollPolicies.departmentsHint')}</p>
      </div>

      <div className={`${cardClass} mb-4 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3`}>
        <Field label={t('payrollPolicies.name')}>
          <Input value={name} disabled={!canWrite} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Readout
          label={t('payrollPolicies.periodRule')}
          value={t('payrollPolicies.periodRuleValue', { cutoffDay: cutoff })}
        />
        <Readout
          label={t('payrollPolicies.workHoursPerDay')}
          value={t('payrollPolicies.workHoursValue', { hours: workHoursPerDay })}
        />
        <Readout
          label={t('payrollPolicies.fx')}
          value={t('payrollPolicies.fxValue', { source: fxSource, payoutDay })}
        />
        {canWrite ? (
          <>
            <Field label={t('payrollPolicies.cutoffDay')}>
              <Input
                type="number"
                min={1}
                max={28}
                value={cutoffDay}
                onChange={(event) => setCutoffDay(event.target.value)}
              />
            </Field>
            <Field label={t('payrollPolicies.workHoursPerDay')}>
              <Input
                type="number"
                min={1}
                max={24}
                value={workHoursPerDay}
                onChange={(event) => setWorkHoursPerDay(event.target.value)}
              />
            </Field>
            <Field label={t('payrollPolicies.fxSource')}>
              <Input
                value={fxSource}
                onChange={(event) => setFxSource(event.target.value.toUpperCase())}
              />
            </Field>
            <Field label={t('payrollPolicies.payoutDay')}>
              <Input
                type="number"
                min={1}
                max={28}
                value={payoutDay}
                onChange={(event) => setPayoutDay(event.target.value)}
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              {t('payrollPolicies.enabled')}
            </label>
          </>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant={tab === 'guide' ? 'default' : 'outline'} size="sm" onClick={() => setTab('guide')}>
          {t('payrollPolicies.tabGuide')}
        </Button>
        <Button variant={tab === 'edit' ? 'default' : 'outline'} size="sm" onClick={() => setTab('edit')}>
          {t('payrollPolicies.tabEdit')}
        </Button>
      </div>

      {tab === 'guide' ? (
        <div className="space-y-4">
          <div className={`${cardClass} space-y-2 p-4 text-sm`}>
            <h2 className={sectionHeading}>
              <span className={sectionAccent} />
              {t('payrollPolicies.calcTitle')}
            </h2>
            <p className={textSubtle}>{t('payrollPolicies.calcSummary')}</p>
            <ol className={`list-decimal space-y-1 pl-5 ${textSubtle}`}>
              <li>{t('payrollPolicies.calcStep1')}</li>
              <li>{t('payrollPolicies.calcStep2')}</li>
              <li>{t('payrollPolicies.calcStep3')}</li>
              <li>{t('payrollPolicies.calcStep4', { cutoffDay: cutoff })}</li>
              <li>{t('payrollPolicies.calcStep5', { source: fxSource, payoutDay })}</li>
            </ol>
          </div>

          {grouped.map((block) => (
            <div key={block.group} className={`${cardClass} space-y-3 p-4`}>
              <h3 className={sectionHeading}>
                <span className={sectionAccent} />
                {t(`payrollPolicyGroup.${block.group}`)}
                <span className={`text-xs font-normal ${textSubtle}`}>
                  {t('payrollPolicies.itemCountValue', { count: block.items.length })}
                </span>
              </h3>
              <div className="grid gap-3">
                {block.items.map((item) => {
                  const who = describeWho(item, t);
                  const amounts = describeAmount(item, t);
                  return (
                    <article
                      key={item.payItemTypeCode}
                      className={`rounded-lg border border-[#2a3040] bg-[#1a1e28]/60 p-3 ${
                        item.enabled ? '' : 'opacity-50'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-sm font-medium text-[#eef0f6]">
                          {typeLabel(item.payItemTypeCode)}
                        </h4>
                        {!item.enabled ? (
                          <span className={`text-[11px] ${textSubtle}`}>{t('payrollPolicies.itemOff')}</span>
                        ) : null}
                      </div>
                      <p className={`mt-1 text-[13px] ${textSubtle}`}>{describeWhen(item, cutoff, t)}</p>
                      {who ? (
                        <p className={`mt-1 text-[13px] ${textSubtle}`}>
                          {t('payrollPolicies.whoLabel')}: {who}
                        </p>
                      ) : null}
                      {amounts.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-[#eef0f6]">
                          {amounts.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className={`mt-2 text-[13px] ${textSubtle}`}>{t('payrollPolicies.amountFromForm')}</p>
                      )}
                      {item.note ? <p className={`mt-2 text-[12px] ${textSubtle}`}>{item.note}</p> : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${cardClass} space-y-3 p-4`}>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label>{t('payrollPolicies.addItem')}</Label>
              <Select value={addCode} disabled={!canWrite} onChange={(event) => setAddCode(event.target.value)}>
                <option value="">{t('payrollPolicies.selectType')}</option>
                {unusedTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.code} · {type.label}
                  </option>
                ))}
              </Select>
            </div>
            {canWrite ? (
              <Button variant="outline" onClick={addItem} disabled={!addCode}>
                {t('payrollPolicies.addItem')}
              </Button>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className={`text-[11px] uppercase ${textSubtle}`}>
                <tr>
                  <th className="py-2 pr-3">{t('payItemTypes.code')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.group')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.ruleKind')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.cutoffMode')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.anchorKey')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.capAmount')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.rate')}</th>
                  <th className="py-2 pr-3">{t('payrollPolicies.factKey')}</th>
                  <th className="py-2 pr-3">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.payItemTypeCode} className="border-t border-[#2a3040]">
                    <td className="py-2 pr-3">
                      {item.payItemTypeCode}
                      <div className={`text-[11px] ${textSubtle}`}>{typeLabel(item.payItemTypeCode)}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={item.group}
                        disabled={!canWrite}
                        onChange={(event) =>
                          patchItem(item.payItemTypeCode, {
                            group: event.target.value as PayrollPolicyItemGroup,
                          })
                        }
                      >
                        {GROUPS.map((group) => (
                          <option key={group} value={group}>
                            {t(`payrollPolicyGroup.${group}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={item.ruleKind}
                        disabled={!canWrite}
                        onChange={(event) =>
                          patchItem(item.payItemTypeCode, {
                            ruleKind: event.target.value as PayrollPolicyRuleKind,
                          })
                        }
                      >
                        {RULES.map((rule) => (
                          <option key={rule} value={rule}>
                            {t(`payrollPolicyRule.${rule}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={item.cutoffMode ?? 'NONE'}
                        disabled={!canWrite}
                        onChange={(event) =>
                          patchItem(item.payItemTypeCode, {
                            cutoffMode: event.target.value as PayrollPolicyCutoffMode,
                          })
                        }
                      >
                        {CUTOFF_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {t(`payrollCutoffMode.${mode}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        value={item.anchorKey ?? ''}
                        disabled={!canWrite}
                        onChange={(event) =>
                          patchItem(item.payItemTypeCode, {
                            anchorKey: (event.target.value || null) as PayrollPolicyAnchor | null,
                          })
                        }
                      >
                        <option value="">{t('common.no')}</option>
                        {ANCHORS.map((anchor) => (
                          <option key={anchor} value={anchor}>
                            {t(`payrollAnchor.${anchor}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={item.capAmount ?? ''}
                        disabled={!canWrite || item.ruleKind !== 'CAP'}
                        placeholder={item.ruleKind === 'CAP' ? '50' : ''}
                        onChange={(event) =>
                          patchItem(item.payItemTypeCode, {
                            capAmount: event.target.value || null,
                            capCurrency: event.target.value ? item.capCurrency ?? 'USD' : null,
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <RateCell item={item} />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={item.factKey ?? ''}
                        disabled={!canWrite || item.ruleKind !== 'FACT'}
                        onChange={(event) =>
                          patchItem(item.payItemTypeCode, { factKey: event.target.value || null })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Switch
                        checked={item.enabled}
                        disabled={!canWrite}
                        onCheckedChange={(checked) => patchItem(item.payItemTypeCode, { enabled: checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canWrite && policy && !policy.enabled ? (
        <div className="mt-4">
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
            {t('payrollPolicies.delete')}
          </Button>
        </div>
      ) : null}
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

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-[#9aa3b5]">{label}</p>
      <p className="text-sm text-[#eef0f6]">{value}</p>
    </div>
  );
}

function DepartmentChips({
  value,
  disabled,
  onChange,
  addLabel,
  placeholder,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
  addLabel: string;
  placeholder: string;
}) {
  const codes = parseDepartments(value);
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = parseDepartments(`${value} ${draft}`);
    onChange(next.join(', '));
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {codes.length === 0 ? (
          <span className={`text-sm ${textSubtle}`}>{placeholder}</span>
        ) : (
          codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full border border-[#2a3040] bg-[#1a1e28] px-2.5 py-1 text-xs text-[#eef0f6]"
            >
              {code}
              {disabled ? null : (
                <button
                  type="button"
                  className="text-[#9aa3b5] hover:text-[#f87171]"
                  onClick={() => onChange(codes.filter((item) => item !== code).join(', '))}
                  aria-label={code}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {disabled ? null : (
        <div className="flex max-w-md gap-2">
          <Input
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

function RateCell({ item }: { item: PayrollPolicyItem }) {
  const rows = item.rateTable ?? [];
  const flat =
    item.rateAmount != null && item.rateAmount !== ''
      ? `${item.rateAmount} ${item.rateCurrency ?? ''}`.trim()
      : null;
  if (!flat && rows.length === 0) {
    return <span className={textSubtle}>—</span>;
  }
  return (
    <div className={`max-w-[220px] text-[11px] leading-snug ${textSubtle}`}>
      {flat ? <div>{flat}</div> : null}
      {rows.slice(0, 4).map((row) => (
        <div key={row.key}>
          {row.label || row.key}: {row.amount}
          {row.currency && row.currency !== 'VND' ? ` ${row.currency}` : ''}
        </div>
      ))}
      {rows.length > 4 ? <div>+{rows.length - 4}</div> : null}
    </div>
  );
}
