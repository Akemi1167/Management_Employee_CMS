import { useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState(false);
  const onVerifiedRef = useRef(onVerified);
  const onCloseRef = useRef(onClose);
  onVerifiedRef.current = onVerified;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !action) return;

    let cancelled = false;
    setOtp('');
    setReady(false);
    setLoading(true);

    void requestStepUp(action)
      .then((result) => {
        if (cancelled) return;
        if (result.mfaRequired === false) {
          onVerifiedRef.current();
          onCloseRef.current();
          return;
        }
        setChallengeId(result.challengeId);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(getApiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, action]);

  const verify = async () => {
    setLoading(true);
    try {
      await verifyStepUp(challengeId, otp, action);
      toast.success(t('auth.confirmOtp'));
      onVerified();
      onClose();
      setOtp('');
      setReady(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open && ready}
      onClose={onClose}
      title={t('auth.stepUpTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void verify()} disabled={loading || otp.length !== 6}>
            {loading ? t('auth.verifying') : t('auth.confirmOtp')}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-[#b8bfd0]">{t('auth.stepUpDescription')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="step-up-otp">{t('auth.otp')}</Label>
        <Input
          id="step-up-otp"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
        />
      </div>
    </Dialog>
  );
}
