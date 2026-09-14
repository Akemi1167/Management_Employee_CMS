import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-client';
import { requestStepUp, verifyStepUp } from '@/services/auth.service';

export function StepUpDialog({
  open,
  action,
  onClose,
  onVerified,
}: {
  open: boolean;
  action: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const request = async () => {
    setLoading(true);
    try {
      const result = await requestStepUp(action);
      setChallengeId(result.challengeId);
      setRequested(true);
      toast.info(t('auth.stepUpDescription'));
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    try {
      await verifyStepUp(challengeId, otp, action);
      toast.success(t('auth.confirmOtp'));
      onVerified();
      onClose();
      setOtp('');
      setRequested(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('auth.stepUpTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {requested ? (
            <Button onClick={() => void verify()} disabled={loading || otp.length !== 6}>
              {loading ? t('auth.verifying') : t('auth.confirmOtp')}
            </Button>
          ) : (
            <Button onClick={() => void request()} disabled={loading}>
              {t('auth.stepUpAction')}
            </Button>
          )}
        </>
      }
    >
      <p className="mb-4 text-sm text-[#b8bfd0]">{t('auth.stepUpDescription')}</p>
      {requested ? (
        <div className="space-y-1.5">
          <Label htmlFor="step-up-otp">{t('auth.otp')}</Label>
          <Input
            id="step-up-otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            inputMode="numeric"
          />
        </div>
      ) : null}
    </Dialog>
  );
}
