/** Luong tam tinh theo ky — uoc luong tu ho so + don Lark / ngay cong. */

export type ProvisionalPayItemInput = {
  payItemTypeCode?: string | null;
  status?: string | null;
  duplicateOfId?: string | null;
  period?: string | null;
  amount?: string | null;
  hours?: string | null;
};

export type ProvisionalPayrollInput = {
  period: string;
  baseSalary: string | number | null | undefined;
  workHoursPerDay?: number | null;
  actualWorkedDays?: string | number | null;
  periodWorkingDays?: string | number | null;
  items: ProvisionalPayItemInput[];
};

export type ProvisionalPayrollLine = {
  code: string;
  labelKey:
    | 'base'
    | 'overtimeHour'
    | 'overtimeDay'
    | 'commission'
    | 'penalty'
    | 'otherEarning'
    | 'otherDeduction';
  amount: number;
  meta?: Record<string, number | string>;
};

export type ProvisionalPayrollEstimate = {
  period: string;
  baseSalary: number;
  workHoursPerDay: number;
  calendarDays: number;
  standardDays: number;
  workedDays: number;
  dailyRate: number;
  hourlyRate: number;
  baseProrated: number;
  overtimeHours: number;
  overtimeHourPay: number;
  overtimeDays: number;
  overtimeDayPay: number;
  commission: number;
  penalty: number;
  otherEarnings: number;
  otherDeductions: number;
  gross: number;
  lines: ProvisionalPayrollLine[];
  assumptions: {
    usedAttendanceDays: boolean;
    usedElapsedDaysInMonth: boolean;
    usedCalendarDaysAsStandard: boolean;
    overtimeRateFromBase: boolean;
  };
};

const SALARY_PROFILE = new Set([
  'BASE_SALARY',
  'PROBATION_SALARY',
  'CONFIRMATION',
  'RAISE_6M',
]);

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'object' && value && '$numberDecimal' in (value as object)) {
    const n = Number((value as { $numberDecimal: string }).$numberDecimal);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function calendarDaysInPeriod(period: string): number {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return 30;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** So ngay da qua trong ky (UTC). Ky hien tai → ngay hom nay; ky qua → du thang; ky tuong lai → 0. */
export function elapsedDaysInPeriod(period: string, now = new Date()): number {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const calendarDays = calendarDaysInPeriod(period);
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth() + 1;
  if (year < nowYear || (year === nowYear && month < nowMonth)) {
    return calendarDays;
  }
  if (year > nowYear || (year === nowYear && month > nowMonth)) {
    return 0;
  }
  const day = now.getUTCDate();
  return Math.min(Math.max(day, 0), calendarDays);
}

function isActiveItem(item: ProvisionalPayItemInput) {
  if (item.duplicateOfId) return false;
  const status = (item.status || '').toUpperCase();
  if (status === 'REJECTED') return false;
  return true;
}

function isOvertimeHour(code: string) {
  return code === 'OVERTIME' || code === 'OVERTIME_HOUR';
}

function isOvertimeDay(code: string) {
  return code === 'OVERTIME_DAY';
}

function isCommission(code: string) {
  return /COMMISSION|HOA.?HONG|BONUS/i.test(code);
}

function isPenalty(code: string) {
  return /PENALTY|FINE|PHAT/i.test(code);
}

/**
 * Uoc luong tam tinh:
 * - Luong CB theo ngay = base × (ngay cong / ngay chuan)
 * - Don gia gio = base / ngay chuan / workHoursPerDay (chua nhan he so 1.5 neu policy chua cau hinh)
 * - OT gio / OT ngay + hoa hong − phat tu don Lark ky hien tai
 */
export function estimateProvisionalPayroll(
  input: ProvisionalPayrollInput,
): ProvisionalPayrollEstimate | null {
  const baseSalary = toNumber(input.baseSalary);
  if (!input.period || baseSalary <= 0) {
    return null;
  }

  const calendarDays = calendarDaysInPeriod(input.period);
  const attendanceWorking = toNumber(input.periodWorkingDays);
  const attendanceActual = toNumber(input.actualWorkedDays);
  const usedAttendanceDays = attendanceActual > 0 || attendanceWorking > 0;
  const usedCalendarDaysAsStandard = !(attendanceWorking > 0);
  const standardDays = attendanceWorking > 0 ? attendanceWorking : calendarDays;
  // Chua co cham cong: ky dang chay chi dem den ngay hom nay (vd. 27), khong lay du 30.
  const elapsedDays = elapsedDaysInPeriod(input.period);
  const usedElapsedDaysInMonth = !usedAttendanceDays && elapsedDays < calendarDays;
  const workedDays = attendanceActual > 0 ? attendanceActual : elapsedDays;
  const workHoursPerDay =
    input.workHoursPerDay && input.workHoursPerDay > 0 ? input.workHoursPerDay : 9;

  const dailyRate = standardDays > 0 ? baseSalary / standardDays : 0;
  const hourlyRate = workHoursPerDay > 0 ? dailyRate / workHoursPerDay : 0;
  const baseProrated = dailyRate * workedDays;

  let overtimeHours = 0;
  let overtimeDays = 0;
  let commission = 0;
  let penalty = 0;
  let otherEarnings = 0;
  let otherDeductions = 0;

  for (const item of input.items) {
    if (!isActiveItem(item)) continue;
    if (item.period && item.period !== input.period) continue;
    const code = (item.payItemTypeCode || '').toUpperCase();
    if (SALARY_PROFILE.has(code)) continue;

    if (isOvertimeHour(code)) {
      overtimeHours += toNumber(item.hours);
      continue;
    }
    if (isOvertimeDay(code)) {
      // Neu co hours, quy doi theo workHoursPerDay; neu khong, coi amount/hours rong → 1 ngay neu amount/hours thieu?
      const hours = toNumber(item.hours);
      if (hours > 0 && workHoursPerDay > 0) {
        overtimeDays += hours / workHoursPerDay;
      } else {
        overtimeDays += 1;
      }
      continue;
    }
    if (isCommission(code)) {
      commission += toNumber(item.amount);
      continue;
    }
    if (isPenalty(code)) {
      penalty += toNumber(item.amount);
      continue;
    }
    const amount = toNumber(item.amount);
    if (amount > 0) otherEarnings += amount;
    else if (amount < 0) otherDeductions += Math.abs(amount);
  }

  const overtimeHourPay = overtimeHours * hourlyRate;
  const overtimeDayPay = overtimeDays * dailyRate;
  const gross =
    baseProrated +
    overtimeHourPay +
    overtimeDayPay +
    commission +
    otherEarnings -
    penalty -
    otherDeductions;

  const lines: ProvisionalPayrollLine[] = [
    {
      code: 'BASE_SALARY',
      labelKey: 'base',
      amount: baseProrated,
      meta: { workedDays, standardDays },
    },
  ];
  if (overtimeHourPay !== 0 || overtimeHours > 0) {
    lines.push({
      code: 'OVERTIME_HOUR',
      labelKey: 'overtimeHour',
      amount: overtimeHourPay,
      meta: { hours: overtimeHours, hourlyRate },
    });
  }
  if (overtimeDayPay !== 0 || overtimeDays > 0) {
    lines.push({
      code: 'OVERTIME_DAY',
      labelKey: 'overtimeDay',
      amount: overtimeDayPay,
      meta: { days: overtimeDays, dailyRate },
    });
  }
  if (commission !== 0) {
    lines.push({ code: 'COMMISSION', labelKey: 'commission', amount: commission });
  }
  if (penalty !== 0) {
    lines.push({ code: 'PENALTY', labelKey: 'penalty', amount: -penalty });
  }
  if (otherEarnings !== 0) {
    lines.push({ code: 'OTHER_EARNING', labelKey: 'otherEarning', amount: otherEarnings });
  }
  if (otherDeductions !== 0) {
    lines.push({ code: 'OTHER_DEDUCTION', labelKey: 'otherDeduction', amount: -otherDeductions });
  }

  return {
    period: input.period,
    baseSalary,
    workHoursPerDay,
    calendarDays,
    standardDays,
    workedDays,
    dailyRate,
    hourlyRate,
    baseProrated,
    overtimeHours,
    overtimeHourPay,
    overtimeDays,
    overtimeDayPay,
    commission,
    penalty,
    otherEarnings,
    otherDeductions,
    gross,
    lines,
    assumptions: {
      usedAttendanceDays,
      usedElapsedDaysInMonth,
      usedCalendarDaysAsStandard,
      overtimeRateFromBase: true,
    },
  };
}
