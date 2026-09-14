import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cardClass } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { changePassword, completeLogin } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth-store';

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
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
        title={user?.mustChangePassword ? t('auth.mustChangeTitle') : t('account.title')}
        description={user?.mustChangePassword ? t('auth.mustChangeDescription') : t('account.description')}
      />
      <form onSubmit={(e) => void submit(e)} className={`${cardClass} space-y-4 p-6`}>
        <div className="space-y-1.5">
          <Label htmlFor="current">{t('auth.currentPassword')}</Label>
          <Input
            id="current"
            type="password"
            value={currentPassword}
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
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? t('common.processing') : t('auth.changePassword')}
        </Button>
      </form>
    </PageContainer>
  );
}
