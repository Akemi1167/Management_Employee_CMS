import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
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
import { PERMISSION } from '@/constants/api-endpoints';
import { cardClass, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { createPayrollPolicy, fetchPayrollPolicies } from '@/services/payroll-policy.service';
import { useAuthStore } from '@/stores/auth-store';
import type { PayrollPolicy } from '@/types/api';

export function PayrollPoliciesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.PAYITEM_WRITE));
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [cutoffDay, setCutoffDay] = useState('15');

  const list = useQuery({ queryKey: ['payroll-policies'], queryFn: fetchPayrollPolicies });

  const save = useMutation({
    mutationFn: () =>
      createPayrollPolicy({
        code: code.trim(),
        name: name.trim(),
        cutoffDay: Number(cutoffDay) || 15,
      }),
    onSuccess: (created) => {
      toast.success(t('payrollPolicies.saved'));
      setOpen(false);
      setCode('');
      setName('');
      setCutoffDay('15');
      void queryClient.invalidateQueries({ queryKey: ['payroll-policies'] });
      navigate(`/payroll-policies/${created.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Column<PayrollPolicy>[] = useMemo(
    () => [
      { key: 'code', header: t('payrollPolicies.code') },
      { key: 'name', header: t('payrollPolicies.name') },
      { key: 'cutoffDay', header: t('payrollPolicies.cutoffDay') },
      {
        key: 'fx',
        header: t('payrollPolicies.fx'),
        render: (row) => `${row.fx.source} / ${row.fx.payoutDay}`,
      },
      {
        key: 'departmentCodes',
        header: t('payrollPolicies.departments'),
        render: (row) => row.departmentCodes.join(', ') || '—',
      },
      {
        key: 'items',
        header: t('payrollPolicies.itemCount'),
        render: (row) => String(row.items.filter((item) => item.enabled).length),
      },
      {
        key: 'enabled',
        header: t('common.status'),
        render: (row) => <StatusBadge value={row.enabled ? 'ACTIVE' : 'DISABLED'} ns="employment" />,
      },
    ],
    [t],
  );

  const canSubmit = code.trim().length >= 2 && name.trim().length > 0;

  return (
    <PageContainer>
      <PageHeader
        title={t('payrollPolicies.title')}
        description={t('payrollPolicies.description')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/pay-items/types">{t('nav.payItemTypes')}</Link>
            </Button>
            {canWrite ? (
              <CreateButton onClick={() => setOpen(true)}>{t('payrollPolicies.create')}</CreateButton>
            ) : null}
          </div>
        }
      />

      <div className={`${cardClass} mb-4 space-y-2 p-4 text-sm`}>
        <p className="font-medium text-[#eef0f6]">{t('payrollPolicies.assignTitle')}</p>
        <ol className={`list-decimal space-y-1 pl-5 ${textSubtle}`}>
          <li>{t('payrollPolicies.assignStep1')}</li>
          <li>{t('payrollPolicies.assignStep2')}</li>
          <li>{t('payrollPolicies.assignStep3')}</li>
        </ol>
      </div>

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        onRowClick={(row) => navigate(`/payroll-policies/${row.id}`)}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('payrollPolicies.create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>{t('payrollPolicies.code')}</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('payrollPolicies.name')}</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('payrollPolicies.cutoffDay')}</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={cutoffDay}
              onChange={(event) => setCutoffDay(event.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </PageContainer>
  );
}
