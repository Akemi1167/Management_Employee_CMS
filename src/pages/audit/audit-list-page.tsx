import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { AUDIT_ACTIONS } from '@/constants/api-endpoints';
import { formatDate } from '@/lib/period';
import { fetchAuditEvents } from '@/services/audit.service';
import type { AuditEvent } from '@/types/api';

function toIso(value: string, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00.000`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function AuditListPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [action, setAction] = useState('');
  const [result, setResult] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [actorUserId, setActorUserId] = useState(searchParams.get('actorUserId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action, result, resourceType, resourceId, actorUserId, from, to, page],
    queryFn: () =>
      fetchAuditEvents({
        action: action || undefined,
        result: result || undefined,
        resourceType: resourceType || undefined,
        resourceId: resourceId || undefined,
        actorUserId: actorUserId || undefined,
        from: toIso(from),
        to: toIso(to, true),
        page,
        pageSize: 20,
      }),
  });

  const columns: Column<AuditEvent>[] = [
    { key: 'occurredAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.occurredAt) },
    { key: 'action', header: t('audit.action') },
    {
      key: 'actor',
      header: t('audit.actor'),
      sortValue: (row) => row.actor ?? row.actorLabel ?? row.actorRole ?? row.actorUserId,
      render: (row) => row.actor ?? row.actorLabel ?? row.actorRole ?? row.actorUserId ?? '—',
    },
    { key: 'resourceType', header: t('audit.resource') },
    { key: 'resourceId', header: t('audit.resourceId') },
    { key: 'result', header: t('audit.result'), render: (row) => <StatusBadge value={row.result} ns="audit" /> },
    { key: 'reason', header: t('common.reason') },
    { key: 'ip', header: t('audit.ip'), render: (row) => row.ip ?? '—' },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('audit.title')} description={t('audit.description')} />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('audit.action')}</option>
          {AUDIT_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Input
          className="max-w-[160px]"
          placeholder={t('audit.resource')}
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
        />
        <Input
          className="max-w-[180px]"
          placeholder={t('audit.resourceId')}
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
        />
        <Input
          className="max-w-[180px]"
          placeholder={t('audit.actorUserId')}
          value={actorUserId}
          onChange={(e) => setActorUserId(e.target.value)}
        />
        <Select value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="">{t('common.all')}</option>
          <option value="SUCCESS">{t('audit.SUCCESS')}</option>
          <option value="FAILURE">{t('audit.FAILURE')}</option>
          <option value="DENIED">{t('audit.DENIED')}</option>
        </Select>
        <Input type="date" className="max-w-[160px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="max-w-[160px]" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={setSelected}
        pagination={{ page, pageSize: 20, total: data?.total ?? 0, onPageChange: setPage }}
      />
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={t('audit.payload')}
        className="max-w-3xl"
      >
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all text-xs text-[#d5dbe8]">
          {selected ? JSON.stringify(selected.payload ?? selected, null, 2) : ''}
        </pre>
      </Dialog>
    </PageContainer>
  );
}
