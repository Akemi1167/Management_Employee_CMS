import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { KeyRound, ScrollText, ShieldCheck } from 'lucide-react';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PERMISSION } from '@/constants/api-endpoints';
import { cardClass, sectionAccent, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/period';
import { fetchAuditEvents } from '@/services/audit.service';
import { disableUserMfa, enableUserMfa, resetUserPassword, setUserPassword } from '@/services/user.service';
import { useAuthStore } from '@/stores/auth-store';
import type { AdminUser, AuditEvent } from '@/types/api';

const MIN_PASSWORD_LENGTH = 12;
const ACTIVITY_PAGE_SIZE = 8;

function isPasswordStrong(password: string, username?: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) return false;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return false;
  if (username && password.toLowerCase().includes(username.toLowerCase())) return false;
  return true;
}

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

export function UserSecurityPanel({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canUpdate = useAuthStore((s) => s.hasPermission(PERMISSION.USER_UPDATE));
  const canAudit = useAuthStore((s) => s.hasPermission(PERMISSION.AUDIT_READ));
  const isSelf = currentUserId === user.id;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordReason, setPasswordReason] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [resetReason, setResetReason] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const canSetPassword =
    canUpdate &&
    !isSelf &&
    isPasswordStrong(newPassword, user.username) &&
    passwordsMatch &&
    passwordReason.trim().length >= 10;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cms-users'] });
    void queryClient.invalidateQueries({ queryKey: ['cms-user', user.id] });
    void queryClient.invalidateQueries({ queryKey: ['audit', 'user', user.id] });
  };

  const changePassword = useMutation({
    mutationFn: () =>
      setUserPassword(user.id, {
        newPassword,
        confirmPassword,
        reason: passwordReason.trim(),
        mustChangePassword,
      }),
    onSuccess: () => {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordReason('');
      toast.success(t('users.passwordChanged'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `user:update:${user.id}`, retry: () => changePassword.mutate() }),
      ),
  });

  const resetPassword = useMutation({
    mutationFn: () => resetUserPassword(user.id, resetReason.trim()),
    onSuccess: (result) => {
      setTempPassword(result.temporaryPassword);
      setResetReason('');
      toast.success(t('users.passwordReset'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `user:update:${user.id}`, retry: () => resetPassword.mutate() }),
      ),
  });

  const toggleMfa = useMutation({
    mutationFn: () =>
      user.mfaEnabled
        ? disableUserMfa(user.id, t('users.mfaToggleReason'))
        : enableUserMfa(user.id, t('users.mfaToggleReason')),
    onSuccess: () => {
      toast.success(user.mfaEnabled ? t('users.mfaDisabledNow') : t('users.mfaEnabledNow'));
      invalidate();
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `user:update:${user.id}`, retry: () => toggleMfa.mutate() }),
      ),
  });

  const activity = useQuery({
    queryKey: ['audit', 'user', user.id, activityPage],
    queryFn: () =>
      fetchAuditEvents({
        actorUserId: user.id,
        page: activityPage,
        pageSize: ACTIVITY_PAGE_SIZE,
      }),
    enabled: canAudit,
  });

  const activityColumns: Column<AuditEvent>[] = [
    { key: 'occurredAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.occurredAt) },
    { key: 'action', header: t('audit.action') },
    {
      key: 'resource',
      header: t('audit.resource'),
      render: (row) => row.resourceType || '—',
    },
    {
      key: 'result',
      header: t('audit.result'),
      render: (row) => <StatusBadge value={row.result} ns="audit" />,
    },
    { key: 'reason', header: t('common.reason'), render: (row) => row.reason || '—' },
  ];

  return (
    <div className="mt-4 space-y-4">
      <section className={`${cardClass} space-y-4 p-6`}>
        <div>
          <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]">
            <span className={sectionAccent} />
            <ShieldCheck className="h-4 w-4 text-[#4ade80]" />
            {t('users.mfa')}
          </h2>
          <p className={cn('mt-1.5 text-sm', textSubtle)}>{t('users.mfaHint')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2a3040] bg-[#1a1e28]/50 px-3 py-3">
          <div>
            <p className="text-sm font-medium text-[#eef0f6]">
              {user.mfaEnabled ? t('users.mfaOn') : t('users.mfaOff')}
            </p>
            <p className={cn('mt-1 text-xs', textSubtle)}>
              {t('users.lastLogin', { time: formatDate(user.lastLoginAt) })}
            </p>
          </div>
          {canUpdate || isSelf ? (
            <Button
              type="button"
              variant={user.mfaEnabled ? 'outline' : 'default'}
              disabled={toggleMfa.isPending}
              onClick={() => toggleMfa.mutate()}
            >
              {user.mfaEnabled ? t('users.mfaDisable') : t('users.mfaEnable')}
            </Button>
          ) : null}
        </div>
      </section>

      <section className={`${cardClass} space-y-4 p-6`}>
        <div>
          <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]">
            <span className={sectionAccent} />
            <KeyRound className="h-4 w-4 text-[#4ade80]" />
            {t('users.changePassword')}
          </h2>
          <p className={cn('mt-1.5 text-sm', textSubtle)}>
            {isSelf ? t('users.changeOwnPasswordHint') : t('users.changePasswordHint')}
          </p>
        </div>
        {isSelf ? (
          <Button variant="outline" asChild>
            <Link to="/account/password">{t('users.changeOwnPassword')}</Link>
          </Button>
        ) : canUpdate ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cms-new-password">{t('users.newPassword')}</Label>
                <Input
                  id="cms-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cms-confirm-password">{t('users.confirmPassword')}</Label>
                <Input
                  id="cms-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </div>
            <p className={cn('text-[10px]', textSubtle)}>{t('auth.passwordRule')}</p>
            {confirmPassword && !passwordsMatch ? (
              <p className="text-[10px] text-[#fbbf24]">{t('auth.passwordMismatch')}</p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="cms-password-reason">{t('users.passwordSetReason')}</Label>
              <Input
                id="cms-password-reason"
                value={passwordReason}
                onChange={(event) => setPasswordReason(event.target.value)}
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-[#2a3040] px-3 py-2.5">
              <span className="text-sm text-[#eef0f6]">{t('users.mustChangePassword')}</span>
              <Switch checked={mustChangePassword} onCheckedChange={setMustChangePassword} />
            </label>
            <Button type="button" disabled={!canSetPassword || changePassword.isPending} onClick={() => changePassword.mutate()}>
              {t('users.changePassword')}
            </Button>
          </div>
        ) : null}
        {canUpdate && !isSelf ? (
          <div className="space-y-3 border-t border-[#2a3040] pt-4">
            <Label htmlFor="cms-reset-reason">{t('users.resetReason')}</Label>
            <Input
              id="cms-reset-reason"
              value={resetReason}
              onChange={(event) => setResetReason(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={resetReason.trim().length < 10 || resetPassword.isPending}
              onClick={() => resetPassword.mutate()}
            >
              {t('users.resetPassword')}
            </Button>
          </div>
        ) : null}
        {tempPassword ? (
          <p className="rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-sm text-[#fbbf24]">
            {t('users.temporaryPassword')}: <strong>{tempPassword}</strong>
          </p>
        ) : null}
      </section>

      {canAudit ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]">
                <ScrollText className="h-4 w-4 text-[#4ade80]" />
                {t('users.activityTitle')}
              </h2>
              <p className={cn('mt-1.5 text-sm', textSubtle)}>{t('users.activityHint')}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/audit?actorUserId=${encodeURIComponent(user.id)}`}>{t('users.openAudit')}</Link>
            </Button>
          </div>
          <DataTable
            columns={activityColumns}
            data={activity.data?.items ?? []}
            loading={activity.isLoading}
            emptyMessage={t('users.activityEmpty')}
            pagination={{
              page: activityPage,
              pageSize: ACTIVITY_PAGE_SIZE,
              total: activity.data?.total ?? 0,
              onPageChange: setActivityPage,
            }}
          />
        </section>
      ) : null}

      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </div>
  );
}
