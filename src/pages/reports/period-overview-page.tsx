import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmployeeLink } from '@/components/shared/employee-link';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cardClass, textBody, textSubtle, textTitle } from '@/constants/theme';
import { formatDate, previousPeriod } from '@/lib/period';
import { fetchPeriodOverview } from '@/services/reports.service';
import type {
  HrDataType,
  PeriodCoverageSummary,
  PeriodEmployeeTypeStatus,
  PeriodOverviewEmployee,
  PeriodOverviewSource,
  PeriodOverviewView,
} from '@/types/api';

const PAGE_SIZE = 20;

export function PeriodOverviewPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'confirmations' ? 'confirmations' : 'coverage';
  const period = searchParams.get('period') || previousPeriod();
  const source = (searchParams.get('source') === 'published' ? 'published' : 'staging') as PeriodOverviewSource;
  const requestedView = searchParams.get('view') as PeriodOverviewView | null;
  const view: PeriodOverviewView =
    tab === 'coverage'
      ? requestedView === 'all'
        ? 'all'
        : 'missing'
      : requestedView === 'unconfirmed'
        ? 'unconfirmed'
        : 'all';
  const query = searchParams.get('query') ?? '';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const update = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete('page');
    setSearchParams(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['period-overview', period, view, source, query, page],
    queryFn: () =>
      fetchPeriodOverview({
        period,
        view,
        source,
        query: query || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: /^\d{4}-(0[1-9]|1[0-2])$/.test(period),
  });

  const summaries = data?.summaries ?? [];
  const attendance = summaries.find((item) => item.dataType === 'ATTENDANCE');
  const penalty = summaries.find((item) => item.dataType === 'PENALTY');
  const payroll = summaries.find((item) => item.dataType === 'PAYROLL');

  const columns = useMemo<Column<PeriodOverviewEmployee>[]>(() => {
    const statusCol = (
      key: HrDataType,
      field: keyof Pick<PeriodOverviewEmployee, 'attendance' | 'penalty' | 'payroll'>,
    ) => ({
      key,
      header: t(`dataType.${key}`),
      render: (row: PeriodOverviewEmployee) => (
        <TypeCell status={row[field]} tab={tab} source={source} />
      ),
    });

    return [
      {
        key: 'employeeCode',
        header: t('employees.code'),
        render: (row) => <EmployeeLink id={row.employeeId} code={row.employeeCode} />,
      },
      { key: 'fullName', header: t('employees.name') },
      { key: 'departmentCode', header: t('employees.department') },
      statusCol('ATTENDANCE', 'attendance'),
      statusCol('PENALTY', 'penalty'),
      statusCol('PAYROLL', 'payroll'),
    ];
  }, [t, tab, source]);

  return (
    <PageContainer>
      <PageHeader title={t('periodOverview.title')} description={t('periodOverview.description')} />
      <div className={`${cardClass} mb-4 p-4`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <TabButton
            active={tab === 'coverage'}
            onClick={() => update({ tab: 'coverage', view: 'missing', source: 'staging' })}
          >
            {t('periodOverview.tabs.coverage')}
          </TabButton>
          <TabButton
            active={tab === 'confirmations'}
            onClick={() => update({ tab: 'confirmations', view: 'all', source: 'published' })}
          >
            {t('periodOverview.tabs.confirmations')}
          </TabButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-[140px]"
            value={period}
            onChange={(e) => update({ period: e.target.value })}
            placeholder="YYYY-MM"
          />
          {tab === 'coverage' ? (
            <Select value={source} onChange={(e) => update({ source: e.target.value })}>
              <option value="staging">{t('source.staging')}</option>
              <option value="published">{t('source.published')}</option>
            </Select>
          ) : null}
          <Select value={view} onChange={(e) => update({ view: e.target.value })}>
            <option value="all">{t('periodOverview.views.all')}</option>
            {tab === 'coverage' ? (
              <option value="missing">{t('periodOverview.views.missing')}</option>
            ) : (
              <option value="unconfirmed">{t('periodOverview.views.unconfirmed')}</option>
            )}
          </Select>
          <Input
            className="max-w-[200px]"
            value={query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder={t('periodOverview.search')}
          />
        </div>
        <p className={`mt-3 text-xs ${textSubtle}`}>
          {tab === 'coverage' ? t('periodOverview.coverageHint') : t('periodOverview.confirmHint')}
        </p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          summary={attendance}
          tab={tab}
          source={source}
          to="/attendance"
          period={period}
        />
        <SummaryCard summary={penalty} tab={tab} source={source} to="/penalties" period={period} />
        <SummaryCard summary={payroll} tab={tab} source={source} to="/payroll" period={period} />
      </div>

      <DataTable
        title={tab === 'coverage' ? t('periodOverview.tabs.coverage') : t('periodOverview.tabs.confirmations')}
        columns={columns}
        data={(data?.items ?? []).map((row) => ({ ...row, id: row.employeeId }))}
        loading={isLoading}
        emptyMessage={t('periodOverview.empty')}
        count={data?.total}
        countLabel={t('periodOverview.filteredCount', { count: data?.total ?? 0, roster: data?.rosterCount ?? 0 })}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: data?.total ?? 0,
          onPageChange: (nextPage) => update({ page: String(nextPage) }, false),
        }}
      />
    </PageContainer>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? 'default' : 'outline'} size="sm" onClick={onClick}>
      {children}
    </Button>
  );
}

function TypeCell({
  status,
  tab,
  source,
}: {
  status: PeriodEmployeeTypeStatus;
  tab: 'coverage' | 'confirmations';
  source: PeriodOverviewSource;
}) {
  if (tab === 'confirmations') {
    if (!status.published) {
      return <StatusBadge value="NOT_PUBLISHED" ns="confirmStatus" />;
    }
    return (
      <div>
        <StatusBadge value={status.confirmed ? 'CONFIRMED' : 'PENDING'} ns="confirmStatus" />
        {status.confirmedAt ? (
          <p className={`mt-1 text-[11px] ${textSubtle}`}>{formatDate(status.confirmedAt)}</p>
        ) : null}
      </div>
    );
  }

  const present = source === 'staging' ? status.staging : status.published;
  return <StatusBadge value={present ? 'PRESENT' : 'MISSING'} ns="coverageStatus" />;
}

function SummaryCard({
  summary,
  tab,
  source,
  to,
  period,
}: {
  summary?: PeriodCoverageSummary;
  tab: 'coverage' | 'confirmations';
  source: PeriodOverviewSource;
  to: string;
  period: string;
}) {
  const { t } = useTranslation();
  if (!summary) {
    return <div className={`${cardClass} p-4 text-sm ${textBody}`}>{t('common.loading')}</div>;
  }

  const missing = source === 'staging' ? summary.stagingMissing : summary.publishedMissing;
  const present = source === 'staging' ? summary.stagingPresent : summary.publishedPresent;
  const confirmRate =
    summary.publishedPresent > 0
      ? Math.round((summary.confirmed / summary.publishedPresent) * 100)
      : 0;

  return (
    <div className={`${cardClass} p-4`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className={`text-sm font-medium ${textTitle}`}>{t(`dataType.${summary.dataType}`)}</p>
        {summary.periodStatus ? <StatusBadge value={summary.periodStatus} ns="periodStatus" /> : null}
      </div>
      {tab === 'coverage' ? (
        <>
          <p className="text-2xl font-bold text-[#eef0f6]">
            {missing}
            <span className={`ml-1 text-sm font-normal ${textSubtle}`}>
              / {summary.rosterCount} {t('periodOverview.missingShort')}
            </span>
          </p>
          <p className={`mt-1 text-xs ${textBody}`}>
            {t('periodOverview.presentCount', { present, roster: summary.rosterCount })}
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-[#eef0f6]">
            {confirmRate}
            <span className="ml-1 text-sm font-normal text-[#9aa3b5]">%</span>
          </p>
          <p className={`mt-1 text-xs ${textBody}`}>
            {t('periodOverview.confirmCount', {
              confirmed: summary.confirmed,
              published: summary.publishedPresent,
              pending: summary.unconfirmed,
            })}
          </p>
        </>
      )}
      <Button variant="ghost" size="sm" className="mt-2 px-0" asChild>
        <Link to={`${to}?period=${period}&source=${source}`}>{t('employees.openList')}</Link>
      </Button>
    </div>
  );
}
