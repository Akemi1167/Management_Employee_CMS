export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const ALL_PERIODS = 'all';

export function currentPeriod() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function previousPeriod() {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function listPeriods(options?: { monthsBack?: number; monthsAhead?: number; include?: string }) {
  const monthsBack = options?.monthsBack ?? 24;
  const monthsAhead = options?.monthsAhead ?? 1;
  const now = new Date();
  const values = new Set<string>();

  for (let offset = -monthsAhead; offset <= monthsBack; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    values.add(`${date.getFullYear()}-${month}`);
  }

  if (options?.include && PERIOD_PATTERN.test(options.include)) values.add(options.include);
  return [...values].sort((a, b) => b.localeCompare(a));
}

export function periodFilterValue(param: string | null, fallback = '') {
  if (param === ALL_PERIODS) return '';
  if (param && PERIOD_PATTERN.test(param)) return param;
  return fallback;
}

export function formatPeriod(period: string, language: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (language.startsWith('vi')) return `Tháng ${month}/${year}`;
  if (language.startsWith('zh')) return `${year}年${month}月`;
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  );
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatDay(value?: string | Date | null) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date);
}

export function toDateInput(value?: string | Date | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function dateInputToIso(value: string) {
  if (!value) return undefined;
  return `${value}T00:00:00.000Z`;
}
