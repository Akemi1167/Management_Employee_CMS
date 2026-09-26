import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { EmployeeLink } from '@/components/shared/employee-link';
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
import { isSameVerifier, WALLET_REQUEST_STATUSES, walletNextStep } from '@/lib/wallet-workflow';
import {
  approveWalletException,
  approveWalletRequest,
  fetchWalletLockWindows,
  fetchWalletRequest,
  fetchWalletRequestImage,
  fetchWalletRequests,
  rejectWalletRequest,
  upsertWalletLockWindow,
  verifyWalletRequest,
} from '@/services/wallet.service';
import { useAuthStore } from '@/stores/auth-store';
import type { WalletChangeRequest, WalletLockWindow } from '@/types/api';

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

export function WalletRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canConfigure = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_LOCK_CONFIGURE));
  const canImportWallets = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_WRITE));
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [employeeCode, setEmployeeCode] = useState(searchParams.get('employeeCode') ?? '');
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState('');
  const [lockFrom, setLockFrom] = useState('');
  const [lockUntil, setLockUntil] = useState('');
  const [note, setNote] = useState('');
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const list = useQuery({
    queryKey: ['wallet-requests', status, employeeCode, page],
    queryFn: () =>
      fetchWalletRequests({
        status: status || undefined,
        employeeCode: employeeCode || undefined,
        page,
        pageSize: 20,
      }),
  });
  const windows = useQuery({
    queryKey: ['wallet-lock-windows'],
    queryFn: fetchWalletLockWindows,
  });

  const saveWindow = useMutation({
    mutationFn: () =>
      upsertWalletLockWindow({
        period,
        lockFrom: new Date(lockFrom).toISOString(),
        lockUntil: new Date(lockUntil).toISOString(),
        note: note || undefined,
      }),
    onSuccess: () => {
      toast.success(t('wallet.lockSaved'));
      void windows.refetch();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: 'wallet:lock:configure', retry: () => saveWindow.mutate() }),
      ),
  });

  const columns: Column<WalletChangeRequest>[] = [
    { key: 'code', header: t('complaints.code') },
    { key: 'employeeCode', header: t('employees.code'), render: (row) => <EmployeeLink id={row.employeeId} code={row.employeeCode} /> },
    { key: 'addressMasked', header: t('employees.wallet') },
    { key: 'platform', header: t('employees.walletPlatform') },
    { key: 'network', header: t('employees.walletNetwork') },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge value={row.status} ns="walletStatus" />,
    },
    {
      key: 'nextStep',
      header: t('wallet.nextStep'),
      render: (row) => t(`wallet.next.${walletNextStep(row)}`),
    },
    {
      key: 'requiresException',
      header: t('wallet.exception'),
      render: (row) => (row.requiresException ? t('common.yes') : t('common.no')),
    },
  ];

  const windowColumns: Column<WalletLockWindow>[] = [
    { key: 'period', header: t('common.period') },
    { key: 'lockFrom', header: t('wallet.lockFrom'), render: (row) => formatDate(row.lockFrom) },
    { key: 'lockUntil', header: t('wallet.lockUntil'), render: (row) => formatDate(row.lockUntil) },
    {
      key: 'isActive',
      header: t('common.status'),
      render: (row) => (row.isActive ? t('common.yes') : t('common.no')),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('wallet.title')}
        description={t('wallet.description')}
        actions={
          canImportWallets ? (
            <Button asChild>
              <Link to="/employees/wallets/import">{t('employees.walletImportTitle')}</Link>
            </Button>
          ) : null
        }
      />
      <p className={`${cardClass} mb-4 p-4 text-sm text-[#b8bfd0]`}>{t('wallet.flowHint')}</p>
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Input
          className="max-w-[180px]"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          placeholder={t('employees.code')}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('common.all')}</option>
          {WALLET_REQUEST_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`walletStatus.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        loading={list.isLoading}
        onRowClick={(row) => navigate(`/wallet/${row.id}`)}
        pagination={{ page, pageSize: 20, total: list.data?.total ?? 0, onPageChange: setPage }}
      />
      <div className={`${cardClass} mt-6 space-y-4 p-6`}>
        <h2 className="text-sm font-semibold">{t('wallet.lockWindows')}</h2>
        <DataTable columns={windowColumns} data={windows.data?.items ?? []} loading={windows.isLoading} />
        {canConfigure ? (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveWindow.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>{t('common.period')}</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('wallet.note')}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('wallet.lockFrom')}</Label>
              <Input type="datetime-local" value={lockFrom} onChange={(e) => setLockFrom(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t('wallet.lockUntil')}</Label>
              <Input type="datetime-local" value={lockUntil} onChange={(e) => setLockUntil(e.target.value)} required />
            </div>
            <Button type="submit" disabled={saveWindow.isPending}>
              {t('wallet.saveLock')}
            </Button>
          </form>
        ) : null}
      </div>
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </PageContainer>
  );
}

type WalletAction = 'verify' | 'approve' | 'exception' | 'reject';

export function WalletRequestDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const canVerify = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_VERIFY));
  const canApprove = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_APPROVE));
  const canException = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_EXCEPTION_APPROVE));
  const [reason, setReason] = useState('');
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const detail = useQuery({
    queryKey: ['wallet-request', id],
    queryFn: () => fetchWalletRequest(id),
    enabled: Boolean(id),
  });

  const act = useMutation({
    mutationFn: (mode: WalletAction) => {
      if (mode === 'reject') return rejectWalletRequest(id, reason);
      if (mode === 'exception') return approveWalletException(id, reason);
      if (mode === 'verify') return verifyWalletRequest(id, reason);
      return approveWalletRequest(id, reason);
    },
    onSuccess: (_data, mode) => {
      toast.success(mode === 'verify' ? t('wallet.verified') : t('wallet.updated'));
      void queryClient.invalidateQueries({ queryKey: ['wallet-request', id] });
      void queryClient.invalidateQueries({ queryKey: ['wallet-requests'] });
    },
    onError: (error, mode) => {
      if (mode === 'approve' || mode === 'exception') {
        runOrStepUp(error, () =>
          setStepUp({
            action: mode === 'exception' ? `wallet:exception:approve:${id}` : `wallet:approve:${id}`,
            retry: () => act.mutate(mode),
          }),
        );
        return;
      }
      toast.error(getApiErrorMessage(error));
    },
  });

  const row = detail.data;
  const next = row ? walletNextStep(row) : 'done';
  const verifierBlocked = isSameVerifier(userId, row?.hrVerifiedBy);
  const canAct = reason.length >= 10 && !act.isPending;
  const openStatus =
    row?.status === 'PENDING_VERIFICATION' ||
    row?.status === 'PENDING_APPROVAL' ||
    row?.status === 'PENDING_EXCEPTION_APPROVAL';

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={row?.code ?? t('wallet.title')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/wallet">{t('common.back')}</Link>
          </Button>
        }
      />
      {row ? (
        <div className={`${cardClass} space-y-4 p-6 text-sm`}>
          <p>
            {t('employees.code')}: <EmployeeLink id={row.employeeId} code={row.employeeCode} />
          </p>
          <p>
            {t('employees.wallet')}: {row.addressMasked}
          </p>
          <p>
            {t('wallet.previousWallet')}: {row.previousAddressMasked || '—'}
          </p>
          <p>
            {t('employees.walletPlatform')}: {t(`walletPlatform.${row.platform}`, { defaultValue: row.platform })}
          </p>
          <p>
            {t('employees.walletNetwork')}: {t(`walletNetwork.${row.network}`, { defaultValue: row.network })}
          </p>
          <p>
            {t('wallet.owner')}: {row.ownerNameMasked}
          </p>
          <p>
            {t('wallet.employeeReason')}: {row.reason || '—'}
          </p>
          <p>
            {t('common.status')}: <StatusBadge value={row.status} ns="walletStatus" />
          </p>
          {row.rejectionReason ? (
            <p>
              {t('common.reason')}: {row.rejectionReason}
            </p>
          ) : null}
          <p className="text-[#9aa3b5]">{t('wallet.maskedOnly')}</p>

          <div>
            <p className="mb-2 text-[11px] uppercase text-[#9aa3b5]">{t('wallet.proposedImage')}</p>
            <WalletRequestImagePreview requestId={row.id} hasImage={row.hasImage} revision={row.updatedAt} />
          </div>

          <ol className="space-y-2 border-t border-[#2a3040] pt-4 text-[#b8bfd0]">
            <li>
              1. {t('wallet.steps.verify')}
              {row.hrVerifiedAt ? ` — ${formatDate(row.hrVerifiedAt)}` : ''}
              {row.hrNote ? ` (${row.hrNote})` : ''}
            </li>
            <li>
              2. {t('wallet.steps.consent')}
              {row.employeeConsentedAt ? ` — ${formatDate(row.employeeConsentedAt)}` : ''}
            </li>
            <li>
              3. {t('wallet.steps.approve')}
              {row.appliedAt ? ` — ${formatDate(row.appliedAt)}` : ''}
            </li>
          </ol>
          <p className="text-[#fbbf24]">{t(`wallet.next.${next}`)}</p>
          {next === 'consent' ? <p className="text-[#fbbf24]">{t('wallet.waitingConsent')}</p> : null}
          {verifierBlocked && next === 'approve' ? <p className="text-[#fbbf24]">{t('wallet.sodBlocked')}</p> : null}

          {openStatus ? (
            <div className="space-y-3 border-t border-[#2a3040] pt-4">
              <Label>{t('common.reason')}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {canVerify && row.status === 'PENDING_VERIFICATION' ? (
                  <Button disabled={!canAct} onClick={() => act.mutate('verify')}>
                    {t('wallet.verifyContact')}
                  </Button>
                ) : null}
                {canApprove && row.status === 'PENDING_APPROVAL' && !row.requiresException ? (
                  <Button
                    disabled={!canAct || !row.employeeConsentedAt || verifierBlocked}
                    onClick={() => act.mutate('approve')}
                  >
                    {t('approvals.approve')}
                  </Button>
                ) : null}
                {canException && row.requiresException && row.status === 'PENDING_EXCEPTION_APPROVAL' ? (
                  <Button disabled={!canAct} onClick={() => act.mutate('exception')}>
                    {t('wallet.approveException')}
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button variant="destructive" disabled={!canAct} onClick={() => act.mutate('reject')}>
                    {t('approvals.reject')}
                  </Button>
                ) : null}
              </div>
              {canApprove && row.status === 'PENDING_APPROVAL' && !row.employeeConsentedAt ? (
                <p className="text-xs text-[#fbbf24]">{t('wallet.consentMissing')}</p>
              ) : null}
            </div>
          ) : null}
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

function WalletRequestImagePreview({
  requestId,
  hasImage,
  revision,
}: {
  requestId: string;
  hasImage: boolean;
  revision?: string | null;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasImage) {
      setUrl(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void fetchWalletRequestImage(requestId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestId, hasImage, revision]);

  if (!hasImage) {
    return <p className="text-sm text-[#b8bfd0]">{t('employees.walletImageMissing')}</p>;
  }

  if (!url) {
    return <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>;
  }

  return (
    <img
      src={url}
      alt={t('employees.walletImage')}
      className="max-h-56 w-full rounded-md border border-[#2a3040] object-contain bg-[#12151c]"
    />
  );
}
