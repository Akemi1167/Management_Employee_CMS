import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { currentPeriod, formatPeriod, listPeriods, previousPeriod } from '@/lib/period';

export function PeriodSelect({
  value,
  onChange,
  allowAll = false,
  required = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  allowAll?: boolean;
  required?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const thisMonth = currentPeriod();
  const lastMonth = previousPeriod();
  const options = useMemo(() => listPeriods({ include: value || undefined }), [value]);

  return (
    <Select
      required={required}
      className={className}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowAll ? <option value="">{t('common.allPeriods')}</option> : null}
      {!allowAll && !value ? (
        <option value="" disabled>
          {t('common.choosePeriod')}
        </option>
      ) : null}
      {options.map((period) => {
        const hint =
          period === thisMonth ? t('common.thisMonth') : period === lastMonth ? t('common.previousPeriod') : '';
        const label = formatPeriod(period, i18n.language);
        return (
          <option key={period} value={period}>
            {hint ? `${label} · ${hint}` : label}
          </option>
        );
      })}
    </Select>
  );
}
