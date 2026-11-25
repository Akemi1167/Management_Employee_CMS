import type { PayrollPolicyItem } from '@/types/api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function formatPayrollMoney(amount: string, currency?: string | null): string {
  const n = Number(amount);
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
    : amount;
  if (!currency || currency === 'VND') {
    return `${formatted} ₫`;
  }
  if (currency === 'PCT' || currency === '%') {
    return `${formatted}%`;
  }
  return `${formatted} ${currency}`;
}

export function describeWhen(
  item: PayrollPolicyItem,
  cutoffDay: number,
  t: Translate,
): string {
  const anchor = item.anchorKey ? t(`payrollAnchor.${item.anchorKey}`) : t('payrollPolicies.eventDay');
  const mode = item.cutoffMode ?? 'NONE';
  if (mode === 'DELAY_NEXT_MONTH' && item.milestoneMonths) {
    return t('payrollPolicies.whenDelayMonths', {
      months: item.milestoneMonths,
      cutoffDay,
      anchor,
    });
  }
  if (mode === 'DELAY_NEXT_MONTH' && item.milestoneDays) {
    return t('payrollPolicies.whenDelayDays', {
      days: item.milestoneDays,
      cutoffDay,
      anchor,
    });
  }
  if (mode === 'DELAY_NEXT_MONTH') {
    return t('payrollPolicies.whenDelayEvent', { cutoffDay, anchor });
  }
  if (mode === 'PRORATE_100_50') {
    return t('payrollPolicies.whenProrate', { cutoffDay, anchor });
  }
  if (mode === 'SAME_MONTH') {
    return t('payrollPolicies.whenSameMonth', { cutoffDay, anchor });
  }
  if (mode === 'FROM_EVENT_DAY') {
    return t('payrollPolicies.whenFromEvent', { anchor });
  }
  if (mode === 'SKIP_FIRST_MONTH') {
    return t('payrollPolicies.whenSkipFirst', { anchor });
  }
  return t('payrollPolicies.whenNone', { cutoffDay });
}

export function describeAmount(item: PayrollPolicyItem, t: Translate): string[] {
  const lines: string[] = [];
  const formula = item.formulaKind ?? 'FLAT';
  const divisor = item.rateDivisorDays ?? 183;

  if (formula === 'DAYS_IN_MONTH' && item.rateAmount) {
    lines.push(
      t('payrollPolicies.formulaDaysInMonth', {
        amount: formatPayrollMoney(item.rateAmount, item.rateCurrency),
      }),
    );
  } else if (formula === 'PER_DAY_DIVISOR') {
    for (const row of item.rateTable ?? []) {
      lines.push(
        t('payrollPolicies.formulaPerDay', {
          label: row.label || row.key,
          amount: formatPayrollMoney(row.amount, row.currency),
          days: divisor,
        }),
      );
    }
  } else if (formula === 'PERCENT_BASE' && item.rateAmount) {
    lines.push(
      t('payrollPolicies.formulaPercent', {
        percent: formatPayrollMoney(item.rateAmount, item.rateCurrency ?? 'PCT'),
      }),
    );
  } else if (formula === 'PER_MONTH' && item.rateAmount) {
    lines.push(
      t('payrollPolicies.formulaPerMonth', {
        amount: formatPayrollMoney(item.rateAmount, item.rateCurrency),
      }),
    );
  } else if (item.rateAmount) {
    lines.push(formatPayrollMoney(item.rateAmount, item.rateCurrency));
  }

  if (formula !== 'PER_DAY_DIVISOR') {
    for (const row of item.rateTable ?? []) {
      const amount =
        row.currency === 'PCT'
          ? t('payrollPolicies.formulaPercent', {
              percent: formatPayrollMoney(row.amount, 'PCT'),
            })
          : formula === 'PER_MONTH'
            ? t('payrollPolicies.formulaPerMonth', {
                amount: formatPayrollMoney(row.amount, row.currency),
              })
            : formatPayrollMoney(row.amount, row.currency);
      lines.push(`${row.label || row.key}: ${amount}`);
    }
  }

  if (item.ruleKind === 'CAP' && item.capAmount) {
    lines.push(
      t('payrollPolicies.formulaCap', {
        amount: formatPayrollMoney(item.capAmount, item.capCurrency),
      }),
    );
  }

  return lines;
}

export function describeWho(item: PayrollPolicyItem, t: Translate): string | null {
  if (!item.eligibilityKey) {
    return null;
  }
  const key = `payrollEligibility.${item.eligibilityKey}`;
  const label = t(key);
  return label === key ? item.eligibilityKey : label;
}
