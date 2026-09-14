import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { cardClass } from '@/constants/theme';
import { ADMIN_ROLES, ALL_PERMISSIONS, PERMISSION } from '@/constants/api-endpoints';
import { getApiErrorMessage } from '@/lib/api-client';
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

function UserForm({ existing }: { existing?: AdminUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSelf = Boolean(existing && currentUserId === existing.id);
  const [username, setUsername] = useState(existing?.username ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [roles, setRoles] = useState<string[]>(existing?.roles ?? ['data_entry']);
  const [extraPermissions, setExtraPermissions] = useState<string[]>(existing?.extraPermissions ?? []);
  const [allEmployees, setAllEmployees] = useState(existing?.dataScope.allEmployees ?? false);
  const [departments, setDepartments] = useState(existing?.dataScope.departmentCodes.join(', ') ?? '');
  const [disableReason, setDisableReason] = useState('');
  const [enableReason, setEnableReason] = useState('');
  const [resetReason, setResetReason] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (existing && isSelf) {
        return updateUser(existing.id, { email, fullName });
      }
      const body = {
        email,
        fullName,
        roles,
        extraPermissions,
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

  const toggleRole = (role: string) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]));
  };

  const togglePermission = (permission: string) => {
    setExtraPermissions((prev) =>
      prev.includes(permission) ? prev.filter((item) => item !== permission) : [...prev, permission],
    );
  };

  return (
    <>
      <form
        className={`${cardClass} space-y-4 p-6`}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {!existing ? (
          <div className="space-y-1.5">
            <Label>{t('users.username')}</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>{t('users.fullName')}</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t('users.email')}</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>{t('users.roles')}</Label>
          {isSelf ? <p className="text-xs text-[#fbbf24]">{t('users.cannotEditSelf')}</p> : null}
          <div className="flex flex-wrap gap-2">
            {ADMIN_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  disabled={isSelf}
                  onChange={() => toggleRole(role)}
                />
                {t(`roles.${role}`)}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('users.extraPermissions')}</Label>
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-[#2a3040] p-3 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={extraPermissions.includes(permission)}
                  disabled={isSelf}
                  onChange={() => togglePermission(permission)}
                />
                {permission}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allEmployees}
            disabled={isSelf}
            onChange={(e) => setAllEmployees(e.target.checked)}
          />
          {t('users.allEmployees')}
        </label>
        <div className="space-y-1.5">
          <Label>{t('users.departments')}</Label>
          <Input value={departments} onChange={(e) => setDepartments(e.target.value)} disabled={isSelf} />
        </div>
        {tempPassword ? (
          <p className="rounded-md border border-[#fbbf24]/40 bg-[#fbbf24]/10 p-3 text-sm text-[#fbbf24]">
            {t('users.temporaryPassword')}: <strong>{tempPassword}</strong>
          </p>
        ) : null}
        <Button type="submit" disabled={save.isPending}>
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
