import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarCheck, ClipboardList, CreditCard, KeyRound, Pencil, Trash2, Wallet } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cardClass, textSubtle } from '@/constants/theme';
import { PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage, moneyText } from '@/lib/api-client';
import { dateInputToIso, formatDate, formatDay, toDateInput } from '@/lib/period';
import { hasAssignedWallet } from '@/lib/wallet-workflow';
import {
  deleteEmployee,
  fetchEmployee,
  fetchEmployeeWalletImage,
  provisionEmployeePortal,
  resetEmployeePortalPassword,
  setEmployeePortalPassword,
  setEmployeeWallet,
  updateEmployee,
  WALLET_IMAGE_ACCEPT,
  WALLET_IMAGE_MAX_BYTES,
  WALLET_NETWORKS,
  WALLET_PLATFORMS,
  type WalletNetwork,
  type WalletPlatform,
} from '@/services/employee.service';
import { fetchAttendance, fetchPayroll, fetchPenalties } from '@/services/hr-records.service';
import { useAuthStore } from '@/stores/auth-store';
import type {
  AttendanceRecord,
  Employee,
  EmployeePortalAccount,
  Paginated,
  PayrollRecord,
  PenaltyRecord,
} from '@/types/api';

const PAGE_SIZE = 12;

function mergeByPeriod<T extends { id: string; period: string; source: string }>(
  staging: T[] | undefined,
  published: T[] | undefined,
): T[] {
  return [...(staging ?? []), ...(published ?? [])].sort((a, b) => {
    const periodCmp = b.period.localeCompare(a.period);
    if (periodCmp !== 0) return periodCmp;
    if (a.source !== b.source) return a.source === 'published' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

function useEmployeeHrRecords<T extends { id: string; period: string; source: string }>(
  key: string,
  fetcher: (params: Record<string, unknown>) => Promise<Paginated<T>>,
  employeeId: string,
  period: string,
) {
  const base = {
    employeeId: employeeId || undefined,
    period: period || undefined,
    page: 1,
    pageSize: PAGE_SIZE,
  };
  const staging = useQuery({
    queryKey: [key, 'staging', employeeId, period],
    queryFn: () => fetcher({ ...base, source: 'staging' }),
    enabled: Boolean(employeeId),
  });
  const published = useQuery({
    queryKey: [key, 'published', employeeId, period],
    queryFn: () => fetcher({ ...base, source: 'published' }),
    enabled: Boolean(employeeId),
  });
  return {
    items: mergeByPeriod(staging.data?.items, published.data?.items),
    isLoading: staging.isLoading || published.isLoading,
    total: (staging.data?.total ?? 0) + (published.data?.total ?? 0),
  };
}

export function EmployeeDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') ?? '';
  const has = useAuthStore((s) => s.hasPermission);
  const isAdmin = useAuthStore((s) => Boolean(s.user?.roles.includes('system_admin')));

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => fetchEmployee(id),
    enabled: Boolean(id),
  });

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  };

  const listTo = (path: string) =>
    `${path}?source=staging&employeeId=${id}${period ? `&period=${period}` : ''}`;

  return (
    <PageContainer>
      <PageHeader
        title={data?.fullName ?? t('employees.detail')}
        description={data?.employeeCode}
        actions={
          <div className="flex flex-wrap gap-2">
            {has(PERMISSION.EMPLOYEE_UPDATE) ? (
              <Button variant="outline" asChild>
                <a href="#employee-profile">
                  <Pencil className="h-4 w-4" />
                  {t('common.edit')}
                </a>
              </Button>
            ) : null}
            {has(PERMISSION.EMPLOYEE_UPDATE) ? (
              <Button variant="destructive" asChild>
                <a href="#delete-employee">
                  <Trash2 className="h-4 w-4" />
                  {t('employees.deleteProfile')}
                </a>
              </Button>
            ) : null}
            {has(PERMISSION.WALLET_WRITE) && (!hasAssignedWallet(data?.wallet) || isAdmin) ? (
              <Button variant="outline" asChild>
                <a href="#employee-wallet">
                  <Wallet className="h-4 w-4" />
                  {t(hasAssignedWallet(data?.wallet) ? 'employees.overrideWallet' : 'employees.assignWallet')}
                </a>
              </Button>
            ) : null}
            {has(PERMISSION.EMPLOYEE_WRITE) ? (
              <Button variant="outline" asChild>
                <a href="#portal-account">
                  <KeyRound className="h-4 w-4" />
                  {t('employees.setPortalPassword')}
                </a>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link to="/employees">{t('common.back')}</Link>
            </Button>
          </div>
        }
      />
      {isLoading || !data ? (
        <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>
      ) : (
        <>
          <EmployeeProfileCard employee={data} />

          <WalletAssignCard employeeId={id} employeeCode={data.employeeCode} wallet={data.wallet} />

          <PortalAccountCard employeeId={id} account={data.portalAccount ?? null} />

          <div className={`${cardClass} mb-4 p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-[140px]"
                value={period}
                onChange={(e) => update({ period: e.target.value })}
                placeholder="YYYY-MM"
              />
              {has(PERMISSION.COMPLAINT_READ) ? (
                <Button variant="outline" asChild>
                  <Link to={`/complaints?employeeCode=${encodeURIComponent(data.employeeCode)}`}>
                    <ClipboardList className="h-4 w-4" />
                    {t('employees.viewComplaints')}
                  </Link>
                </Button>
              ) : null}
              {has(PERMISSION.WALLET_READ) ? (
                <Button variant="outline" asChild>
                  <Link to={`/wallet?employeeCode=${encodeURIComponent(data.employeeCode)}`}>
                    <CreditCard className="h-4 w-4" />
                    {t('employees.viewWallet')}
                  </Link>
                </Button>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-[#9aa3b5]">{t('source.hint')}</p>
          </div>

          {has(PERMISSION.ATTENDANCE_READ) ? (
            <EmployeeAttendancePanel employeeId={id} period={period} openTo={listTo('/attendance')} />
          ) : null}
          {has(PERMISSION.PENALTY_READ) ? (
            <EmployeePenaltyPanel employeeId={id} period={period} openTo={listTo('/penalties')} />
          ) : null}
          {has(PERMISSION.PAYROLL_READ) ? (
            <EmployeePayrollPanel employeeId={id} period={period} openTo={listTo('/payroll')} />
          ) : null}
        </>
      )}
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-[#9aa3b5]">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function EmployeeProfileCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_UPDATE));
  const [fullName, setFullName] = useState(employee.fullName);
  const [workEmail, setWorkEmail] = useState(employee.workEmail ?? '');
  const [departmentCode, setDepartmentCode] = useState(employee.departmentCode);
  const [position, setPosition] = useState(employee.position ?? '');
  const [hiredAt, setHiredAt] = useState(toDateInput(employee.hiredAt));
  const [employmentStatus, setEmploymentStatus] = useState(employee.employmentStatus);
  const [terminatedAt, setTerminatedAt] = useState(toDateInput(employee.terminatedAt));
  const [reason, setReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'disable' | 'enable' | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  useEffect(() => {
    setFullName(employee.fullName);
    setWorkEmail(employee.workEmail ?? '');
    setDepartmentCode(employee.departmentCode);
    setPosition(employee.position ?? '');
    setHiredAt(toDateInput(employee.hiredAt));
    setEmploymentStatus(employee.employmentStatus);
    setTerminatedAt(toDateInput(employee.terminatedAt));
  }, [employee]);

  useEffect(() => {
    if (window.location.hash === '#employee-profile') {
      document.getElementById('employee-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    const openDelete = () => {
      if (window.location.hash === '#delete-employee') {
        setDeleteOpen(true);
      }
    };
    openDelete();
    window.addEventListener('hashchange', openDelete);
    return () => window.removeEventListener('hashchange', openDelete);
  }, []);

  const portalStatus = employee.portalAccount?.status;
  const hiredIso = dateInputToIso(hiredAt);
  const terminatedIso = employmentStatus === 'TERMINATED' ? dateInputToIso(terminatedAt) : undefined;
  const invalidTerminatedDate =
    employmentStatus === 'TERMINATED' && Boolean(terminatedAt) && Boolean(hiredAt) && terminatedAt < hiredAt;

  const canSubmit =
    canUpdate &&
    fullName.trim().length > 0 &&
    departmentCode.trim().length > 0 &&
    hiredAt.length === 10 &&
    reason.trim().length >= 10 &&
    !invalidTerminatedDate;

  const payload = () => {
    const body: Parameters<typeof updateEmployee>[1] = {
      fullName: fullName.trim(),
      workEmail: workEmail.trim() ? workEmail.trim() : null,
      departmentCode: departmentCode.trim(),
      position: position.trim() ? position.trim() : null,
      hiredAt: hiredIso,
      employmentStatus,
      reason: reason.trim(),
    };
    if (employmentStatus === 'TERMINATED') {
      if (terminatedIso) body.terminatedAt = terminatedIso;
    } else {
      body.terminatedAt = null;
    }
    return body;
  };

  const save = useMutation({
    mutationFn: () => updateEmployee(employee.id, payload()),
    onSuccess: () => {
      setReason('');
      setConfirmKind(null);
      toast.success(t('employees.profileSaved'));
      void queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:update:${employee.id}`, retry: () => save.mutate() }),
      ),
  });

  const requestSave = () => {
    if (!canSubmit) return;
    const disabling =
      (employmentStatus === 'TERMINATED' || employmentStatus === 'SUSPENDED') &&
      employmentStatus !== employee.employmentStatus;
    const enabling =
      (employmentStatus === 'ACTIVE' || employmentStatus === 'ON_LEAVE') &&
      portalStatus === 'DISABLED';
    if (disabling) {
      setConfirmKind('disable');
      return;
    }
    if (enabling) {
      setConfirmKind('enable');
      return;
    }
    save.mutate();
  };

  const remove = useMutation({
    mutationFn: () => deleteEmployee(employee.id, deleteReason.trim()),
    onSuccess: () => {
      setDeleteOpen(false);
      setDeleteReason('');
      toast.success(t('employees.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      void queryClient.removeQueries({ queryKey: ['employee', employee.id] });
      navigate('/employees');
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:delete:${employee.id}`, retry: () => remove.mutate() }),
      ),
  });

  const closeDeleteDialog = () => {
    if (remove.isPending) return;
    setDeleteOpen(false);
    if (window.location.hash === '#delete-employee') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  return (
    <div id="employee-profile" className={`${cardClass} mb-4 scroll-mt-4 p-5`}>
      <div id="delete-employee" className="sr-only" />
      <h2 className="mb-3 text-sm font-semibold text-[#eef0f6]">{t('employees.detail')}</h2>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('employees.code')} value={employee.employeeCode} />
        <Field label={t('employees.workEmail')} value={employee.workEmail || '—'} />
        <div>
          <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.status')}</p>
          <StatusBadge value={employee.employmentStatus} ns="employment" />
        </div>
        <div>
          <p className="text-[11px] uppercase text-[#9aa3b5]">LARK</p>
          <StatusBadge value={employee.larkSyncStatus} ns="larkStatus" />
        </div>
        <Field label={t('employees.hiredAt')} value={formatDay(employee.hiredAt)} />
        <Field label={t('employees.terminatedAt')} value={formatDay(employee.terminatedAt)} />
      </div>
      {canUpdate ? (
        <div className="space-y-3 border-t border-[#2a3040] pt-4">
          <p className={`text-xs ${textSubtle}`}>{t('employees.profileHint')}</p>
          {portalStatus === 'LOCKED' ? (
            <p className="text-sm text-[#fbbf24]">{t('employees.portalLockedHint')}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('employees.name')}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.workEmail')}</Label>
              <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.department')}</Label>
              <Input value={departmentCode} onChange={(e) => setDepartmentCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.position')}</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.hiredAt')}</Label>
              <Input type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('common.status')}</Label>
              <Select value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)}>
                <option value="ACTIVE">{t('employment.ACTIVE')}</option>
                <option value="ON_LEAVE">{t('employment.ON_LEAVE')}</option>
                <option value="SUSPENDED">{t('employment.SUSPENDED')}</option>
                <option value="TERMINATED">{t('employment.TERMINATED')}</option>
              </Select>
            </div>
            {employmentStatus === 'TERMINATED' ? (
              <div className="space-y-1.5">
                <Label>{t('employees.terminatedAt')}</Label>
                <Input type="date" value={terminatedAt} onChange={(e) => setTerminatedAt(e.target.value)} />
                <p className={`text-[10px] ${textSubtle}`}>{t('employees.terminatedAtHint')}</p>
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('employees.portalReason')}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          {invalidTerminatedDate ? (
            <p className="text-[10px] text-[#fbbf24]">{t('employees.terminatedBeforeHired')}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!canSubmit || save.isPending} onClick={requestSave}>
              <Pencil className="h-4 w-4" />
              {t('employees.saveProfile')}
            </Button>
            <Button variant="destructive" type="button" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              {t('employees.deleteProfile')}
            </Button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmKind === 'disable'}
        onClose={() => setConfirmKind(null)}
        onConfirm={() => save.mutate()}
        title={t('employees.confirmDisableTitle')}
        description={t('employees.confirmDisableDescription')}
        destructive
        loading={save.isPending}
      />
      <ConfirmDialog
        open={confirmKind === 'enable'}
        onClose={() => setConfirmKind(null)}
        onConfirm={() => save.mutate()}
        title={t('employees.confirmEnableTitle')}
        description={t('employees.confirmEnableDescription')}
        loading={save.isPending}
      />
      <Dialog
        open={deleteOpen}
        onClose={closeDeleteDialog}
        title={t('employees.confirmDeleteTitle')}
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              disabled={remove.isPending}
              onClick={closeDeleteDialog}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={deleteReason.trim().length < 10 || remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2 className="h-4 w-4" />
              {t('employees.deleteProfile')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#b8bfd0]">{t('employees.confirmDeleteDescription')}</p>
          <p className={`text-xs ${textSubtle}`}>{t('employees.deleteHint')}</p>
          <div className="space-y-1.5">
            <Label>{t('employees.deleteReason')}</Label>
            <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
          </div>
        </div>
      </Dialog>
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </div>
  );
}

function isAllowedWalletImage(file: File) {
  if (file.size <= 0 || file.size > WALLET_IMAGE_MAX_BYTES) return false;
  if (/image\/(jpeg|png|webp)/i.test(file.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

function WalletImagePreview({
  employeeId,
  hasImage,
  revision,
}: {
  employeeId: string;
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
    void fetchEmployeeWalletImage(employeeId)
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
  }, [employeeId, hasImage, revision]);

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

function WalletAssignCard({
  employeeId,
  employeeCode,
  wallet,
}: {
  employeeId: string;
  employeeCode: string;
  wallet: Employee['wallet'];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_WRITE));
  const canReadRequests = useAuthStore((s) => s.hasPermission(PERMISSION.WALLET_READ));
  const isAdmin = useAuthStore((s) => Boolean(s.user?.roles.includes('system_admin')));
  const assigned = hasAssignedWallet(wallet);
  const canOverride = assigned && isAdmin && canWrite;
  const canFirstAssign = !assigned && canWrite;
  const showForm = canFirstAssign || canOverride;
  const [address, setAddress] = useState('');
  const [platform, setPlatform] = useState<WalletPlatform>('BINANCE');
  const [network, setNetwork] = useState<WalletNetwork>('BEP20');
  const [ownerName, setOwnerName] = useState('');
  const [reason, setReason] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  useEffect(() => {
    if (window.location.hash === '#employee-wallet') {
      document.getElementById('employee-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const canSubmit =
    showForm &&
    address.replace(/\s+/g, '').trim().length >= 8 &&
    reason.trim().length >= 10 &&
    Boolean(image) &&
    isAllowedWalletImage(image!);

  const save = useMutation({
    mutationFn: () =>
      setEmployeeWallet(employeeId, {
        address: address.replace(/\s+/g, '').trim(),
        platform,
        network,
        ownerName,
        reason: reason.trim(),
        image: image!,
      }),
    onSuccess: () => {
      setAddress('');
      setOwnerName('');
      setReason('');
      setImage(null);
      toast.success(t('employees.walletAssigned'));
      void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:wallet:${employeeId}`, retry: () => save.mutate() }),
      ),
  });

  return (
    <div id="employee-wallet" className={`${cardClass} mb-4 scroll-mt-4 p-5`}>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#eef0f6]">
        <Wallet className="h-4 w-4 text-[#4ade80]" />
        {t('employees.walletTitle')}
      </h2>
      <p className="mb-4 text-xs text-[#9aa3b5]">
        {canOverride ? t('employees.walletOverrideHint') : assigned ? t('employees.walletChangeHint') : t('employees.walletHint')}
      </p>
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('employees.wallet')} value={wallet.addressMasked || '—'} />
          <Field
            label={t('employees.walletPlatform')}
            value={wallet.platform ? t(`walletPlatform.${wallet.platform}`, { defaultValue: wallet.platform }) : '—'}
          />
          <Field
            label={t('employees.walletNetwork')}
            value={wallet.network ? t(`walletNetwork.${wallet.network}`, { defaultValue: wallet.network }) : '—'}
          />
          <Field label={t('wallet.owner')} value={wallet.ownerNameMasked || '—'} />
          <Field label={t('employees.walletEffectiveAt')} value={formatDate(wallet.effectiveAt)} />
          <Field
            label={t('employees.walletSource')}
            value={wallet.source ? t(`walletSource.${wallet.source}`, { defaultValue: wallet.source }) : '—'}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase text-[#9aa3b5]">{t('employees.walletImage')}</p>
          <WalletImagePreview
            employeeId={employeeId}
            hasImage={Boolean(wallet.hasImage)}
            revision={wallet.effectiveAt}
          />
        </div>
      </div>
      {canReadRequests ? (
        <p className="mb-4 text-sm">
          <Link to={`/wallet?employeeCode=${encodeURIComponent(employeeCode)}`} className="text-[#4ade80] hover:underline">
            {t('employees.viewWallet')}
          </Link>
        </p>
      ) : null}
      {showForm ? (
        <div className="space-y-3 border-t border-[#2a3040] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('employees.walletAddress')}</Label>
              <Input
                autoComplete="off"
                spellCheck={false}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.walletPlatform')}</Label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as WalletPlatform)}>
                {WALLET_PLATFORMS.map((value) => (
                  <option key={value} value={value}>
                    {t(`walletPlatform.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.walletNetwork')}</Label>
              <Select value={network} onChange={(e) => setNetwork(e.target.value as WalletNetwork)}>
                {WALLET_NETWORKS.map((value) => (
                  <option key={value} value={value}>
                    {t(`walletNetwork.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('employees.walletOwnerName')} ({t('common.optional')})
              </Label>
              <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.walletImage')}</Label>
              <Input
                type="file"
                accept={WALLET_IMAGE_ACCEPT}
                onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              />
              <p className={`text-[10px] ${textSubtle}`}>{t('employees.walletImageHint')}</p>
            </div>
          </div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={t('employees.walletImage')}
              className="max-h-40 rounded-md border border-[#2a3040] object-contain bg-[#12151c]"
            />
          ) : null}
          {image && !isAllowedWalletImage(image) ? (
            <p className="text-[10px] text-[#fbbf24]">{t('employees.walletImageHint')}</p>
          ) : null}
          <div className="space-y-1.5">
            <Label>{t('employees.portalReason')}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('employees.portalReason')}
            />
          </div>
          <Button disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>
            <Wallet className="h-4 w-4" />
            {t(canOverride ? 'employees.overrideWallet' : 'employees.assignWallet')}
          </Button>
        </div>
      ) : assigned ? null : (
        <p className="text-sm text-[#fbbf24]">{t('employees.walletWriteHint')}</p>
      )}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </div>
  );
}

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

function PortalAccountCard({
  employeeId,
  account,
}: {
  employeeId: string;
  account: EmployeePortalAccount | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canWrite = useAuthStore((s) => s.hasPermission(PERMISSION.EMPLOYEE_WRITE));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [mustChangeOnLogin, setMustChangeOnLogin] = useState(true);
  const [tempPassword, setTempPassword] = useState('');
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  useEffect(() => {
    if (window.location.hash === '#portal-account') {
      document.getElementById('portal-account')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
  };

  const passwordsMatch = newPassword === confirmPassword;
  const canSetPassword =
    canWrite &&
    newPassword.length >= 12 &&
    passwordsMatch &&
    reason.trim().length >= 10;

  const provision = useMutation({
    mutationFn: () => provisionEmployeePortal(employeeId, reason),
    onSuccess: (result) => {
      setTempPassword(result.temporaryPassword);
      setReason('');
      toast.success(t('employees.portalProvisioned'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:portal:${employeeId}`, retry: () => provision.mutate() }),
      ),
  });

  const resetPassword = useMutation({
    mutationFn: () => resetEmployeePortalPassword(employeeId, reason),
    onSuccess: (result) => {
      setTempPassword(result.temporaryPassword);
      setReason('');
      toast.success(t('employees.portalPasswordReset'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:portal:${employeeId}`, retry: () => resetPassword.mutate() }),
      ),
  });

  const setPassword = useMutation({
    mutationFn: () =>
      setEmployeePortalPassword(employeeId, {
        newPassword,
        confirmPassword,
        mustChangePassword: mustChangeOnLogin,
        reason: reason.trim(),
      }),
    onSuccess: (result) => {
      setNewPassword('');
      setConfirmPassword('');
      setReason('');
      toast.success(result.created ? t('employees.portalPasswordCreated') : t('employees.portalPasswordSet'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `employee:portal:${employeeId}`, retry: () => setPassword.mutate() }),
      ),
  });

  return (
    <div id="portal-account" className={`${cardClass} mb-4 scroll-mt-4 p-5`}>
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#eef0f6]">
        <KeyRound className="h-4 w-4 text-[#4ade80]" />
        {t('employees.portalTitle')}
      </h2>
      <p className="mb-4 text-xs text-[#9aa3b5]">{t('employees.portalHint')}</p>
      {account ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('users.username')} value={account.username} />
          <Field label={t('users.email')} value={account.email || '—'} />
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('common.status')}</p>
            <StatusBadge value={account.status} ns="userStatus" />
          </div>
          <div>
            <p className="text-[11px] uppercase text-[#9aa3b5]">{t('employees.mustChangePassword')}</p>
            <StatusBadge
              value={account.mustChangePassword ? 'REQUIRED' : 'DONE'}
              ns="passwordChange"
            />
          </div>
          <Field label={t('employees.lastLoginAt')} value={formatDate(account.lastLoginAt)} />
          <Field
            label={t('employees.passwordChangedAt')}
            value={formatDate(account.passwordChangedAt)}
          />
        </div>
      ) : (
        <p className="mb-4 text-sm text-[#b8bfd0]">{t('employees.portalMissing')}</p>
      )}
      {tempPassword ? (
        <p className="mb-4 rounded-md border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-sm text-[#fbbf24]">
          {t('users.temporaryPassword')}: <strong>{tempPassword}</strong>
        </p>
      ) : null}
      {canWrite ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('employees.newPassword')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className={`text-[10px] ${textSubtle}`}>{t('auth.passwordRule')}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t('employees.confirmPassword')}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          {confirmPassword && !passwordsMatch ? (
            <p className="text-[10px] text-[#fbbf24]">{t('auth.passwordMismatch')}</p>
          ) : null}
          <div className="space-y-1.5">
            <Label>{t('employees.portalReason')}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('employees.portalReason')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#eef0f6]">
            <input
              type="checkbox"
              checked={mustChangeOnLogin}
              onChange={(e) => setMustChangeOnLogin(e.target.checked)}
            />
            {t('employees.mustChangeOnLogin')}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canSetPassword || setPassword.isPending}
              onClick={() => setPassword.mutate()}
            >
              <KeyRound className="h-4 w-4" />
              {t('employees.setPortalPassword')}
            </Button>
            {account ? (
              <Button
                variant="outline"
                disabled={reason.trim().length < 10 || resetPassword.isPending}
                onClick={() => resetPassword.mutate()}
              >
                {t('employees.resetPortalPassword')}
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={reason.trim().length < 10 || provision.isPending}
                onClick={() => provision.mutate()}
              >
                {t('employees.provisionPortal')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#fbbf24]">{t('employees.portalWriteHint')}</p>
      )}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </div>
  );
}

function sourceColumn<T extends { source: 'staging' | 'published' }>(
  t: (key: string) => string,
): Column<T> {
  return {
    key: 'source',
    header: t('source.label'),
    render: (row) => t(`source.${row.source}`),
  };
}

function EmployeeAttendancePanel({
  employeeId,
  period,
  openTo,
}: {
  employeeId: string;
  period: string;
  openTo: string;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-attendance',
    fetchAttendance,
    employeeId,
    period,
  );
  const columns: Column<AttendanceRecord>[] = [
    { key: 'period', header: t('common.period') },
    sourceColumn<AttendanceRecord>(t),
    {
      key: 'actualWorkedDays',
      header: t('attendance.actualDays'),
      render: (row) => moneyText(row.actualWorkedDays ?? row.summary?.actualWorkedDays),
    },
    {
      key: 'periodWorkingDays',
      header: t('attendance.workingDays'),
      render: (row) => moneyText(row.periodWorkingDays ?? row.summary?.periodWorkingDays),
    },
    {
      key: 'overtimeDays',
      header: t('attendance.overtime'),
      render: (row) => moneyText(row.overtimeDays ?? row.summary?.overtimeDays),
    },
    {
      key: 'overtimeHours',
      header: t('attendance.overtimeHours'),
      render: (row) => moneyText(row.overtimeHours ?? row.summary?.overtimeHours),
    },
    {
      key: 'unpaidLeaveDays',
      header: t('attendance.unpaidLeave'),
      render: (row) => moneyText(row.unpaidLeaveDays ?? row.summary?.unpaidLeaveDays),
    },
    {
      key: 'penaltyAmount',
      header: t('attendance.penaltyAmount'),
      render: (row) => moneyText(row.penaltyAmount),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—'),
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader
        icon={CalendarCheck}
        title={t('attendance.title')}
        to={openTo}
        label={t('employees.openList')}
      />
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('employees.noPeriodData')}
        count={total}
      />
    </div>
  );
}

function EmployeePenaltyPanel({
  employeeId,
  period,
  openTo,
}: {
  employeeId: string;
  period: string;
  openTo: string;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-penalties',
    fetchPenalties,
    employeeId,
    period,
  );
  const columns: Column<PenaltyRecord>[] = [
    { key: 'period', header: t('common.period') },
    sourceColumn<PenaltyRecord>(t),
    { key: 'amount', header: t('penalties.amount'), render: (row) => moneyText(row.amount ?? row.totalAmount) },
    { key: 'currency', header: t('penalties.currency') },
    { key: 'penaltyReason', header: t('penalties.reason') },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—'),
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader
        icon={ClipboardList}
        title={t('penalties.title')}
        to={openTo}
        label={t('employees.openList')}
      />
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('employees.noPeriodData')}
        count={total}
      />
    </div>
  );
}

function EmployeePayrollPanel({
  employeeId,
  period,
  openTo,
}: {
  employeeId: string;
  period: string;
  openTo: string;
}) {
  const { t } = useTranslation();
  const { items, isLoading, total } = useEmployeeHrRecords(
    'employee-payroll',
    fetchPayroll,
    employeeId,
    period,
  );
  const columns: Column<PayrollRecord>[] = [
    { key: 'period', header: t('common.period') },
    sourceColumn<PayrollRecord>(t),
    { key: 'periodSalary', header: t('payroll.periodSalary'), render: (row) => moneyText(row.periodSalary) },
    { key: 'netAmount', header: t('payroll.net'), render: (row) => moneyText(row.netAmount) },
    { key: 'usdtAmount', header: t('payroll.usdt'), render: (row) => moneyText(row.usdtAmount) },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (row.status ? <StatusBadge value={row.status} ns="workflow" /> : '—'),
    },
  ];

  return (
    <div className="mb-4">
      <SectionHeader icon={Wallet} title={t('payroll.title')} to={openTo} label={t('employees.openList')} />
      <DataTable
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('employees.noPeriodData')}
        count={total}
      />
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  to,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  to: string;
  label: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#eef0f6]">
        <Icon className="h-4 w-4 text-[#4ade80]" />
        {title}
      </h2>
      <Button variant="ghost" size="sm" asChild>
        <Link to={to}>{label}</Link>
      </Button>
    </div>
  );
}
