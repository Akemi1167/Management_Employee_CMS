import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  ClipboardList,
  FileUp,
  Lock,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { CreateButton } from '@/components/shared/create-button';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cardClass, sectionAccent, textSubtle } from '@/constants/theme';
import { ADMIN_ROLES, PERMISSION } from '@/constants/api-endpoints';
import {
  extraPermissionChoices,
  findPermissionConflicts,
  permissionI18nKey,
  PERMISSION_GROUPS,
  permissionsFromRoles,
  ROLE_PERMISSIONS,
  type AdminRole,
} from '@/constants/rbac';
import { getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/period';
import {
  createUser,
  disableUser,
  enableUser,
  fetchUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from '@/services/user.service';
import { useAuthStore } from '@/stores/auth-store';
import type { AdminUser } from '@/types/api';

function runOrStepUp(error: unknown, onStepUp: () => void) {
  const message = getApiErrorMessage(error);
  if (/xac thuc lai|xác thực lại/i.test(message)) {
    onStepUp();
    return;
  }
  toast.error(message);
}

export function UsersListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = useAuthStore((s) => s.hasPermission(PERMISSION.USER_CREATE));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['cms-users', query, status, role, page],
    queryFn: () =>
      fetchUsers({
        query: query || undefined,
        status: status || undefined,
        role: role || undefined,
        page,
        pageSize: 20,
      }),
  });

  const columns: Column<AdminUser>[] = [
    { key: 'username', header: t('users.username') },
    { key: 'fullName', header: t('users.fullName') },
    { key: 'email', header: t('users.email') },
    { key: 'roles', header: t('users.roles'), render: (row) => row.roles.map((role) => t(`roles.${role}`)).join(', ') },
    { key: 'status', header: t('common.status'), render: (row) => <StatusBadge value={row.status} ns="userStatus" /> },
    {
      key: 'mfaEnabled',
      header: t('users.mfa'),
      render: (row) => (row.mfaEnabled ? t('users.mfaOn') : t('users.mfaOff')),
    },
    { key: 'lastLoginAt', header: t('audit.occurredAt'), render: (row) => formatDate(row.lastLoginAt) },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={
          canCreate ? (
            <CreateButton asChild>
              <Link to="/users/create">{t('users.create')}</Link>
            </CreateButton>
          ) : null
        }
      />
      <div className={`${cardClass} mb-4 flex flex-wrap gap-2 p-4`}>
        <Input className="max-w-xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('users.username')} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('common.all')}</option>
          {['ACTIVE', 'DISABLED', 'LOCKED', 'PENDING_ACTIVATION'].map((value) => (
            <option key={value} value={value}>
              {t(`userStatus.${value}`)}
            </option>
          ))}
        </Select>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('users.roles')}</option>
          {ADMIN_ROLES.map((value) => (
            <option key={value} value={value}>
              {t(`roles.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        pagination={{ page, pageSize: 20, total: data?.total ?? 0, onPageChange: setPage }}
      />
    </PageContainer>
  );
}

const ROLE_ICONS: Record<AdminRole, typeof FileUp> = {
  data_entry: FileUp,
  approver: ShieldCheck,
  publisher: Lock,
  complaint_operator: ClipboardList,
  wallet_approver: Wallet,
  auditor: ScrollText,
  system_admin: Users,
};

function permissionLabel(t: (key: string) => string, code: string) {
  return t(`permission.${permissionI18nKey(code)}`);
}

function UserForm({ existing }: { existing?: AdminUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSelf = Boolean(existing && currentUser?.id === existing.id);
  const actorIsAdmin = Boolean(currentUser?.roles.includes('system_admin'));
  const [username, setUsername] = useState(existing?.username ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [roles, setRoles] = useState<string[]>(existing?.roles ?? ['data_entry']);
  const [extraPermissions, setExtraPermissions] = useState<string[]>(existing?.extraPermissions ?? []);
  const [allEmployees, setAllEmployees] = useState(existing?.dataScope.allEmployees ?? false);
  const [departments, setDepartments] = useState(existing?.dataScope.departmentCodes.join(', ') ?? '');
  const [mfaEnabled, setMfaEnabled] = useState(existing?.mfaEnabled ?? false);
  const [disableReason, setDisableReason] = useState('');
  const [enableReason, setEnableReason] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [showExtras, setShowExtras] = useState(() => (existing?.extraPermissions.length ?? 0) > 0);
  const [showEffective, setShowEffective] = useState(false);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const roleGranted = useMemo(() => permissionsFromRoles(roles), [roles]);
  const extraChoices = useMemo(
    () => extraPermissionChoices(roleGranted, currentUser?.permissions ?? [], extraPermissions),
    [roleGranted, currentUser?.permissions, extraPermissions],
  );
  const extraGroups = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => extraChoices.includes(permission)),
      })).filter((group) => group.permissions.length > 0),
    [extraChoices],
  );
  const extrasToSave = useMemo(
    () => extraPermissions.filter((permission) => !roleGranted.has(permission)),
    [extraPermissions, roleGranted],
  );
  const effectivePermissions = useMemo(
    () => [...new Set([...roleGranted, ...extrasToSave])],
    [roleGranted, extrasToSave],
  );
  const conflicts = useMemo(
    () => (roles.includes('system_admin') ? [] : findPermissionConflicts(effectivePermissions)),
    [roles, effectivePermissions],
  );
  const lockedBySelf = isSelf;

  const save = useMutation({
    mutationFn: async () => {
      if (existing && isSelf) {
        return updateUser(existing.id, { email, fullName });
      }
      if (roles.length === 0) {
        throw new Error(t('users.rolesRequired'));
      }
      if (conflicts.length > 0) {
        throw new Error(t('users.saveBlockedConflict'));
      }
      const body = {
        email,
        fullName,
        roles,
        extraPermissions: extrasToSave,
        mfaEnabled,
        dataScope: {
          allEmployees,
          departmentCodes: departments
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        },
      };
      if (existing) return updateUser(existing.id, body);
      return createUser({ ...body, username });
    },
    onSuccess: (result) => {
      if ('temporaryPassword' in result) {
        setTempPassword(result.temporaryPassword);
        toast.success(t('users.created'));
      } else {
        toast.success(t('users.updated'));
        navigate(`/users/${existing?.id ?? ''}`);
      }
      void queryClient.invalidateQueries({ queryKey: ['cms-users'] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: existing ? `user:update:${existing.id}` : 'user:create', retry: () => save.mutate() }),
      ),
  });

  const disable = useMutation({
    mutationFn: () => disableUser(existing!.id, disableReason),
    onSuccess: () => {
      toast.success(t('users.disabled'));
      void queryClient.invalidateQueries({ queryKey: ['cms-users'] });
      void queryClient.invalidateQueries({ queryKey: ['cms-user', existing?.id] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `user:disable:${existing?.id}`, retry: () => disable.mutate() }),
      ),
  });

  const enable = useMutation({
    mutationFn: () => enableUser(existing!.id, enableReason),
    onSuccess: () => {
      toast.success(t('users.enabled'));
      void queryClient.invalidateQueries({ queryKey: ['cms-users'] });
      void queryClient.invalidateQueries({ queryKey: ['cms-user', existing?.id] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `user:disable:${existing?.id}`, retry: () => enable.mutate() }),
      ),
  });

  const resetPassword = useMutation({
    mutationFn: () => resetUserPassword(existing!.id, resetReason),
    onSuccess: (result) => {
      setTempPassword(result.temporaryPassword);
      toast.success(t('users.passwordReset'));
      void queryClient.invalidateQueries({ queryKey: ['cms-users'] });
      void queryClient.invalidateQueries({ queryKey: ['cms-user', existing?.id] });
    },
    onError: (error) =>
      runOrStepUp(error, () =>
        setStepUp({ action: `user:update:${existing?.id}`, retry: () => resetPassword.mutate() }),
      ),
  });

  const toggleRole = (role: AdminRole) => {
    if (lockedBySelf) return;
    if (role === 'system_admin' && !actorIsAdmin) return;
    setRoles((prev) => {
      if (prev.includes(role)) return prev.filter((item) => item !== role);
      if (role === 'system_admin') return ['system_admin'];
      return [...prev.filter((item) => item !== 'system_admin'), role];
    });
  };

  const togglePermission = (permission: string) => {
    if (lockedBySelf) return;
    setExtraPermissions((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );
  };

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {lockedBySelf ? (
          <div className="flex gap-3 rounded-xl border border-[#fbbf24]/35 bg-[#fbbf24]/10 px-4 py-3 text-sm text-[#fbbf24]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{t('users.cannotEditSelfBanner')}</p>
          </div>
        ) : null}

        <section className={`${cardClass} space-y-4 p-6`}>
          <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]">
            <span className={sectionAccent} />
            {t('users.accountSection')}
          </h2>
          {!existing ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-username">{t('users.username')}</Label>
              <Input
                id="user-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-fullName">{t('users.fullName')}</Label>
              <Input
                id="user-fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email">{t('users.email')}</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-[#2a3040] bg-[#1a1e28]/50 px-3 py-3">
            <div>
              <p className="text-sm font-medium text-[#eef0f6]">{t('users.mfa')}</p>
              <p className={cn('mt-1 text-xs', textSubtle)}>{t('users.mfaHint')}</p>
            </div>
            <Switch checked={mfaEnabled} disabled={lockedBySelf} onCheckedChange={setMfaEnabled} />
          </div>
        </section>

        <section className={`${cardClass} space-y-4 p-6`}>
          <div>
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]">
              <span className={sectionAccent} />
              {t('users.accessSection')}
            </h2>
            <p className={cn('mt-1.5 text-sm', textSubtle)}>{t('users.rolesHint')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ADMIN_ROLES.map((role) => {
              const selected = roles.includes(role);
              const Icon = ROLE_ICONS[role];
              const blockedAdmin = role === 'system_admin' && !actorIsAdmin;
              const disabled = lockedBySelf || blockedAdmin;
              const highlights = ROLE_PERMISSIONS[role].slice(0, role === 'system_admin' ? 0 : 4);
              return (
                <button
                  key={role}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => toggleRole(role)}
                  className={cn(
                    'flex flex-col rounded-xl border p-4 text-left transition-colors',
                    selected
                      ? 'border-[#16a34a] bg-[#16a34a]/10'
                      : 'border-[#2a3040] bg-[#1a1e28]/50 hover:border-[#3a4154] hover:bg-[#1c2030]',
                    disabled && 'cursor-not-allowed opacity-55 hover:border-[#2a3040] hover:bg-[#1a1e28]/50',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
                        selected
                          ? 'border-[#16a34a]/40 bg-[#16a34a]/20 text-[#4ade80]'
                          : 'border-[#2a3040] text-[#9aa3b5]',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#eef0f6]">{t(`roles.${role}`)}</span>
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded-full border',
                            selected ? 'border-[#16a34a] bg-[#16a34a] text-[#f0fdf4]' : 'border-[#3a4154]',
                          )}
                        >
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                      </div>
                      <p className={cn('mt-1 text-xs leading-relaxed', textSubtle)}>{t(`rolesHint.${role}`)}</p>
                    </div>
                  </div>
                  {role === 'system_admin' ? (
                    <p className="mt-3 text-xs text-[#4ade80]">{t('users.systemAdminExclusive')}</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {highlights.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-md border border-[#2a3040] bg-[#0e1016]/60 px-1.5 py-0.5 text-[10px] text-[#b8bfd0]"
                        >
                          {permissionLabel(t, permission)}
                        </span>
                      ))}
                      {ROLE_PERMISSIONS[role].length > highlights.length ? (
                        <span className="px-1.5 py-0.5 text-[10px] text-[#9aa3b5]">
                          +{ROLE_PERMISSIONS[role].length - highlights.length}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {blockedAdmin && !lockedBySelf ? (
                    <p className="mt-2 text-[11px] text-[#fbbf24]">{t('users.assignSystemAdminDenied')}</p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {roles.length === 0 ? <p className="text-sm text-[#fbbf24]">{t('users.rolesRequired')}</p> : null}

          {conflicts.length > 0 ? (
            <div className="flex gap-3 rounded-lg border border-[#fbbf24]/35 bg-[#fbbf24]/10 px-3 py-2.5 text-sm text-[#fbbf24]">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p>{t('users.conflictWarning')}</p>
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {conflicts.map(([left, right]) => (
                    <li key={`${left}-${right}`}>
                      {permissionLabel(t, left)} ↔ {permissionLabel(t, right)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-[#2a3040] bg-[#0e1016]/40">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-[#eef0f6]"
              onClick={() => setShowEffective((open) => !open)}
            >
              <span>
                {t('users.effectiveCount', { count: effectivePermissions.length })}
              </span>
              <ChevronDown className={cn('size-4 text-[#9aa3b5] transition-transform', showEffective && 'rotate-180')} />
            </button>
            {showEffective ? (
              <div className="flex flex-wrap gap-1.5 border-t border-[#2a3040] px-3 py-3">
                {effectivePermissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-md border border-[#2a3040] bg-[#161922] px-2 py-1 text-[11px] text-[#b8bfd0]"
                  >
                    {permissionLabel(t, permission)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-[#2a3040]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              onClick={() => setShowExtras((open) => !open)}
            >
              <div>
                <p className="text-sm font-medium text-[#eef0f6]">{t('users.extraPermissions')}</p>
                <p className={cn('mt-0.5 text-xs', textSubtle)}>
                  {extrasToSave.length
                    ? t('users.extraPermissionsCount', { count: extrasToSave.length })
                    : t('users.extraPermissionsHint')}
                </p>
              </div>
              <ChevronDown className={cn('size-4 shrink-0 text-[#9aa3b5] transition-transform', showExtras && 'rotate-180')} />
            </button>
            {showExtras ? (
              <div className="space-y-4 border-t border-[#2a3040] px-3 py-3">
                {extraGroups.length === 0 ? (
                  <p className={cn('text-sm', textSubtle)}>{t('users.extraPermissionsNone')}</p>
                ) : (
                  extraGroups.map((group) => (
                    <div key={group.id}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#9aa3b5]">
                        {t(`permissionGroups.${group.id}`)}
                      </p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {group.permissions.map((permission) => {
                          const checked = extrasToSave.includes(permission);
                          return (
                            <label
                              key={permission}
                              className={cn(
                                'flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm',
                                checked
                                  ? 'border-[#16a34a]/50 bg-[#16a34a]/10 text-[#eef0f6]'
                                  : 'border-[#2a3040] text-[#b8bfd0]',
                                lockedBySelf && 'cursor-not-allowed opacity-60',
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                disabled={lockedBySelf}
                                onChange={() => togglePermission(permission)}
                              />
                              <span>{permissionLabel(t, permission)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className={`${cardClass} space-y-4 p-6`}>
          <div>
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-[#eef0f6]">
              <span className={sectionAccent} />
              {t('users.scopeSection')}
            </h2>
            <p className={cn('mt-1.5 text-sm', textSubtle)}>{t('users.scopeHint')}</p>
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-[#2a3040] bg-[#1a1e28]/50 px-3 py-3">
            <div>
              <p className="text-sm font-medium text-[#eef0f6]">{t('users.allEmployees')}</p>
              <p className={cn('mt-1 text-xs', textSubtle)}>{t('users.allEmployeesHint')}</p>
            </div>
            <Switch
              checked={allEmployees}
              disabled={lockedBySelf || !actorIsAdmin}
              onCheckedChange={setAllEmployees}
            />
          </div>
          {!allEmployees ? (
            <div className="space-y-1.5">
              <Label htmlFor="user-departments">{t('users.departments')}</Label>
              <Input
                id="user-departments"
                value={departments}
                onChange={(e) => setDepartments(e.target.value)}
                disabled={lockedBySelf}
                placeholder={t('users.departmentsPlaceholder')}
              />
            </div>
          ) : null}
        </section>

        {tempPassword ? (
          <p className="rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-sm text-[#fbbf24]">
            {t('users.temporaryPassword')}: <strong>{tempPassword}</strong>
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={save.isPending || (!lockedBySelf && (conflicts.length > 0 || roles.length === 0))}
        >
          {t('common.save')}
        </Button>
      </form>
      {existing && !isSelf ? (
        <div className={`${cardClass} mt-4 space-y-6 p-6`}>
          {existing.status !== 'ACTIVE' ? (
            <div className="space-y-3">
              <Label>{t('users.enableReason')}</Label>
              <Input value={enableReason} onChange={(e) => setEnableReason(e.target.value)} />
              <Button disabled={enableReason.length < 10 || enable.isPending} onClick={() => enable.mutate()}>
                {t('users.enable')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>{t('users.disableReason')}</Label>
              <Input value={disableReason} onChange={(e) => setDisableReason(e.target.value)} />
              <Button
                variant="destructive"
                disabled={disableReason.length < 10 || disable.isPending}
                onClick={() => disable.mutate()}
              >
                {t('users.disable')}
              </Button>
            </div>
          )}
          <div className="space-y-3">
            <Label>{t('users.resetReason')}</Label>
            <Input value={resetReason} onChange={(e) => setResetReason(e.target.value)} />
            <Button
              variant="outline"
              disabled={resetReason.length < 10 || resetPassword.isPending}
              onClick={() => resetPassword.mutate()}
            >
              {t('users.resetPassword')}
            </Button>
          </div>
        </div>
      ) : null}
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </>
  );
}

export function UserCreatePage() {
  const { t } = useTranslation();
  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={t('users.create')}
        description={t('users.createHint')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/users">{t('common.back')}</Link>
          </Button>
        }
      />
      <UserForm />
    </PageContainer>
  );
}

export function UserDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data } = useQuery({
    queryKey: ['cms-user', id],
    queryFn: () => fetchUser(id),
    enabled: Boolean(id),
  });

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={data?.username ?? t('users.title')}
        actions={
          <Button variant="outline" asChild>
            <Link to="/users">{t('common.back')}</Link>
          </Button>
        }
      />
      {data ? <UserForm existing={data} /> : <p className="text-sm text-[#b8bfd0]">{t('common.loading')}</p>}
    </PageContainer>
  );
}
