import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/period';
import {
  approveDecryptRequest,
  approveVaultRecovery,
  createDecryptRequest,
  createVaultRecovery,
  fetchDecryptRequests,
  fetchDecryptRequest,
  fetchVaultRecoveries,
  fetchVaultRecovery,
  rejectDecryptRequest,
  rejectVaultRecovery,
} from '@/services/vault.service';
import { useAuthStore } from '@/stores/auth-store';
import type { ControlledDecryptRequest, VaultRecoveryRequest } from '@/types/api';

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

export function VaultPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canRequestRecovery = useAuthStore((s) => s.hasPermission(PERMISSION.VAULT_RECOVERY_REQUEST));
  const canApproveRecovery = useAuthStore((s) => s.hasPermission(PERMISSION.VAULT_RECOVERY_APPROVE));
  const canRequestDecrypt = useAuthStore((s) => s.hasPermission(PERMISSION.VAULT_DECRYPT_REQUEST));
  const canApproveDecrypt = useAuthStore((s) => s.hasPermission(PERMISSION.VAULT_DECRYPT_APPROVE));
  const canReadRecovery = canRequestRecovery || canApproveRecovery;
  const canReadDecrypt = canRequestDecrypt || canApproveDecrypt;
  const [page, setPage] = useState(1);
  const [decryptPage, setDecryptPage] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [scopes, setScopes] = useState('WALLET_ADDRESS');
  const [justification, setJustification] = useState('');
  const [decryptEmployeeIds, setDecryptEmployeeIds] = useState('');
  const [fieldScopes, setFieldScopes] = useState('WALLET_ADDRESS');
  const [purpose, setPurpose] = useState('PAYROLL_PAYOUT');

  const recoveries = useQuery({
    queryKey: ['vault-recoveries', page],
    queryFn: () => fetchVaultRecoveries({ page, pageSize: 20 }),
    enabled: canReadRecovery,
  });
  const decrypts = useQuery({
    queryKey: ['vault-decrypts', decryptPage],
    queryFn: () => fetchDecryptRequests({ page: decryptPage, pageSize: 20 }),
    enabled: canReadDecrypt,
  });

  const createRecovery = useMutation({
    mutationFn: () =>
      createVaultRecovery({
        employeeId,
        reason,
        scopes: scopes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success(t('vault.recoveryCreated'));
      void recoveries.refetch();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const createDecrypt = useMutation({
    mutationFn: () =>
      createDecryptRequest({
        purpose,
        justification,
        employeeIds: decryptEmployeeIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        fieldScopes: fieldScopes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success(t('vault.decryptCreated'));
      void decrypts.refetch();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const recoveryColumns: Column<VaultRecoveryRequest>[] = [
    { key: 'code', header: t('complaints.code') },
    { key: 'employeeCode', header: t('employees.code') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="vaultStatus" /> },
    { key: 'expiresAt', header: t('vault.expiresAt'), render: (row) => formatDate(row.expiresAt) },
    {
      key: 'approvals',
      header: t('vault.approvals'),
      render: (row) => `${row.approvals.length}/${row.requiredApprovals}`,
    },
  ];

  const decryptColumns: Column<ControlledDecryptRequest>[] = [
    { key: 'code', header: t('complaints.code') },
    { key: 'purpose', header: t('vault.purpose') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="vaultStatus" /> },
    { key: 'expiresAt', header: t('vault.expiresAt'), render: (row) => formatDate(row.expiresAt) },
    {
      key: 'approvals',
      header: t('vault.approvals'),
      render: (row) => `${row.approvals.length}/${row.requiredApprovals}`,
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t('vault.title')} description={t('vault.description')} />
      <p className={`${cardClass} mb-4 p-4 text-sm text-[#b8bfd0]`}>{t('vault.noPlaintext')}</p>
      <h2 className="mb-3 text-sm font-semibold">{t('vault.recovery')}</h2>
      <DataTable
        columns={recoveryColumns}
        data={recoveries.data?.items ?? []}
        loading={recoveries.isLoading}
        onRowClick={(row) => navigate(`/vault/recovery/${row.id}`)}
        pagination={{ page, pageSize: 20, total: recoveries.data?.total ?? 0, onPageChange: setPage }}
      />
      {canRequestRecovery ? (
        <form
          className={`${cardClass} mb-8 mt-4 grid gap-3 p-6 sm:grid-cols-2`}
          onSubmit={(e) => {
            e.preventDefault();
            createRecovery.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>{t('vault.employeeId')}</Label>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{t('vault.scopes')}</Label>
            <Input value={scopes} onChange={(e) => setScopes(e.target.value)} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('common.reason')}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} />
          </div>
          <Button type="submit" disabled={createRecovery.isPending}>
            {t('vault.createRecovery')}
          </Button>
        </form>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold">{t('vault.decrypt')}</h2>
      <DataTable
        columns={decryptColumns}
        data={decrypts.data?.items ?? []}
        loading={decrypts.isLoading}
        onRowClick={(row) => navigate(`/vault/decrypt/${row.id}`)}
        pagination={{
          page: decryptPage,
          pageSize: 20,
          total: decrypts.data?.total ?? 0,
          onPageChange: setDecryptPage,
        }}
      />
      {canRequestDecrypt ? (
        <form
          className={`${cardClass} mt-4 grid gap-3 p-6 sm:grid-cols-2`}
          onSubmit={(e) => {
            e.preventDefault();
            createDecrypt.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>{t('vault.purpose')}</Label>
            <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="PAYROLL_PAYOUT">PAYROLL_PAYOUT</option>
              <option value="INCIDENT_INVESTIGATION">INCIDENT_INVESTIGATION</option>
              <option value="LEGAL_REQUEST">LEGAL_REQUEST</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('vault.fieldScopes')}</Label>
            <Input value={fieldScopes} onChange={(e) => setFieldScopes(e.target.value)} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('vault.employeeIds')}</Label>
            <Input value={decryptEmployeeIds} onChange={(e) => setDecryptEmployeeIds(e.target.value)} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('vault.justification')}</Label>
            <Input value={justification} onChange={(e) => setJustification(e.target.value)} required minLength={10} />
          </div>
          <Button type="submit" disabled={createDecrypt.isPending}>
            {t('vault.createDecrypt')}
          </Button>
        </form>
      ) : null}
    </PageContainer>
  );
}

function DecisionPanel({
  open,
  onApprove,
  onReject,
  pending,
}: {
  open: boolean;
  onApprove: (reason: string) => void;
  onReject: (reason: string) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <div className="space-y-3 pt-2">
      <Label>{t('common.reason')}</Label>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button disabled={reason.length < 10 || pending} onClick={() => onApprove(reason)}>
          {t('approvals.approve')}
        </Button>
        <Button
          variant="destructive"
          disabled={reason.length < 10 || pending}
          onClick={() => onReject(reason)}
        >
          {t('approvals.reject')}
        </Button>
      </div>
    </div>
  );
}

export function VaultRecoveryDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const canApprove = useAuthStore((s) => s.hasPermission(PERMISSION.VAULT_RECOVERY_APPROVE));
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const detail = useQuery({
    queryKey: ['vault-recovery', id],
    queryFn: () => fetchVaultRecovery(id),
    enabled: Boolean(id),
  });

  const act = useMutation({
    mutationFn: ({ mode, reason }: { mode: 'approve' | 'reject'; reason: string }) =>
      mode === 'approve' ? approveVaultRecovery(id, reason) : rejectVaultRecovery(id, reason),
    onSuccess: () => {
      toast.success(t('vault.updated'));
      void queryClient.invalidateQueries({ queryKey: ['vault-recovery', id] });
    },
    onError: (error, variables) =>
      runOrStepUp(error, () =>
        setStepUp({
          action: `vault:recovery:approve:${id}`,
          retry: () => act.mutate(variables),
        }),
      ),
  });

  const row = detail.data;
  const open = row?.status === 'REQUESTED' || row?.status === 'PENDING_APPROVAL';

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={row?.code ?? t('vault.recovery')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/vault">{t('common.back')}</Link>
          </Button>
        }
      />
      {row ? (
        <div className={`${cardClass} space-y-3 p-6 text-sm`}>
          <p>
            {t('employees.code')}: {row.employeeCode ?? row.employeeId}
          </p>
          <p>
            {t('common.reason')}: {row.reason}
          </p>
          <p>
            {t('vault.scopes')}: {row.scopes.join(', ')}
          </p>
          <p>
            {t('common.status')}: <StatusBadge value={row.status} ns="vaultStatus" />
          </p>
          <p>
            {t('vault.approvals')}: {row.approvals.length}/{row.requiredApprovals}
          </p>
          <p className="text-[#9aa3b5]">{t('vault.noPlaintext')}</p>
          <DecisionPanel
            open={Boolean(canApprove && open)}
            pending={act.isPending}
            onApprove={(reason) => act.mutate({ mode: 'approve', reason })}
            onReject={(reason) => act.mutate({ mode: 'reject', reason })}
          />
        </div>
      ) : (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      )}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}

export function VaultDecryptDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const canApprove = useAuthStore((s) => s.hasPermission(PERMISSION.VAULT_DECRYPT_APPROVE));
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const detail = useQuery({
    queryKey: ['vault-decrypt', id],
    queryFn: () => fetchDecryptRequest(id),
    enabled: Boolean(id),
  });

  const act = useMutation({
    mutationFn: ({ mode, reason }: { mode: 'approve' | 'reject'; reason: string }) =>
      mode === 'approve' ? approveDecryptRequest(id, reason) : rejectDecryptRequest(id, reason),
    onSuccess: () => {
      toast.success(t('vault.updated'));
      void queryClient.invalidateQueries({ queryKey: ['vault-decrypt', id] });
    },
    onError: (error, variables) =>
      runOrStepUp(error, () =>
        setStepUp({
          action: `vault:decrypt:approve:${id}`,
          retry: () => act.mutate(variables),
        }),
      ),
  });

  const row = detail.data;
  const open = row?.status === 'REQUESTED' || row?.status === 'PENDING_APPROVAL';

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={row?.code ?? t('vault.decrypt')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/vault">{t('common.back')}</Link>
          </Button>
        }
      />
      {row ? (
        <div className={`${cardClass} space-y-3 p-6 text-sm`}>
          <p>
            {t('vault.purpose')}: {row.purpose}
          </p>
          <p>
            {t('vault.justification')}: {row.justification}
          </p>
          <p>
            {t('vault.fieldScopes')}: {row.fieldScopes.join(', ')}
          </p>
          <p>
            {t('common.status')}: <StatusBadge value={row.status} ns="vaultStatus" />
          </p>
          <p className="text-[#9aa3b5]">{t('vault.noPlaintext')}</p>
          <DecisionPanel
            open={Boolean(canApprove && open)}
            pending={act.isPending}
            onApprove={(reason) => act.mutate({ mode: 'approve', reason })}
            onReject={(reason) => act.mutate({ mode: 'reject', reason })}
          />
        </div>
      ) : (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      )}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}
