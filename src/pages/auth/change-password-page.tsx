import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass, textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { changePassword, completeLogin } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth-store';

const MIN_PASSWORD_LENGTH = 12;

function isPasswordStrong(password: string, username?: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 128) return false;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return false;
  if (username && password.toLowerCase().includes(username.toLowerCase())) return false;
  return true;
}

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    isPasswordStrong(newPassword, user?.username) &&
    newPassword !== currentPassword &&
    passwordsMatch &&
    !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword, confirmPassword);
      await completeLogin(result);
      toast.success(t('auth.passwordChanged'));
      navigate('/');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer variant="narrow">
      <PageHeader
        title={user?.mustChangePassword ? t('auth.mustChangeTitle') : t('nav.password')}
        description={
          user?.mustChangePassword ? t('auth.mustChangeDescription') : t('account.description')
        }
      />

      {user?.mustChangePassword ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fbbf24]" />
          <p className="text-sm text-[#fcd34d]">{t('auth.mustChangePasswordNotice')}</p>
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className={`${cardClass} space-y-4 p-6`}>
        <div className="space-y-1.5">
          <Label htmlFor="current">{t('auth.currentPassword')}</Label>
          <Input
            id="current"
            type="password"
            value={currentPassword}
            autoComplete="current-password"
            maxLength={256}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="next">{t('auth.newPassword')}</Label>
          <Input
            id="next"
            type="password"
            value={newPassword}
            autoComplete="new-password"
            maxLength={128}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <p className={cn('text-[10px]', textSubtle)}>{t('auth.passwordRule')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
          <Input
            id="confirm"
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            maxLength={128}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {confirmPassword && !passwordsMatch ? (
            <p className="text-[10px] text-[#fbbf24]">{t('auth.passwordMismatch')}</p>
          ) : null}
        </div>
        <Button type="submit" variant="create" disabled={!canSubmit}>
          <KeyRound className="h-4 w-4" />
          {loading ? t('common.processing') : t('auth.changePassword')}
        </Button>
      </form>
    </PageContainer>
  );
}
