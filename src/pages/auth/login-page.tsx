import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandLogo } from '@/components/BrandLogo';
import { LoginLiveBackground } from '@/components/auth/login-live-background';
import { AppCopyright } from '@/components/AppCopyright';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { completeLogin, isMfaRequired, login, verifyMfa } from '@/services/auth.service';
import { getApiErrorMessage } from '@/lib/api-client';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [loading, setLoading] = useState(false);

  const finish = async (result: Awaited<ReturnType<typeof verifyMfa>>) => {
    const user = await completeLogin(result);
    toast.success(t('auth.loginSuccess'));
    navigate(user.mustChangePassword ? '/account/password' : '/');
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      if (isMfaRequired(result)) {
        setMfaToken(result.mfaToken);
        setStep('otp');
        toast.info(t('auth.otpHint'));
        return;
      }
      await finish(result);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('auth.login')));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await verifyMfa(mfaToken, otp.trim());
      await finish(result);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-[#eef0f6]">
      <LoginLiveBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="absolute right-4 top-4 z-20">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center">
              <BrandLogo variant="slogan" className="mb-5 text-lg" />
              {step === 'otp' ? (
                <p className="text-center text-sm text-[#9aa3b5]">{t('auth.otpSubtitle')}</p>
              ) : null}
            </div>

            <div className="login-form-card login-form-card-glitch relative mt-3 space-y-5 rounded-xl border border-[#2a3040] bg-[#161922]/92 p-6 pt-7 text-[#eef0f6] shadow-lg shadow-black/40 backdrop-blur-md">
              <span className="login-on-air-badge" aria-hidden>
                HR CMS
              </span>
              {step === 'credentials' ? (
                <form onSubmit={(e) => void handleCredentialsSubmit(e)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">{t('auth.identifier')}</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('auth.identifierPlaceholder')}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    <LogIn className="h-4 w-4" />
                    {loading ? t('auth.loggingIn') : t('auth.login')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={(e) => void handleOtpSubmit(e)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="otp">{t('auth.otp')}</Label>
                    <Input
                      id="otp"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={t('auth.otpPlaceholder')}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      maxLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    {loading ? t('auth.verifying') : t('auth.confirmOtp')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setStep('credentials');
                      setMfaToken('');
                      setOtp('');
                    }}
                  >
                    {t('common.back')}
                  </Button>
                </form>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-[#9aa3b5]">{t('auth.adminOnly')}</p>
          </div>
        </div>
        <footer className="px-4 py-4">
          <AppCopyright />
        </footer>
      </div>
    </div>
  );
}
