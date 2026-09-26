import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { StepUpDialog } from '@/components/shared/step-up-dialog';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { textSubtle } from '@/constants/theme';
import { getApiErrorMessage } from '@/lib/api-client';
import { wipePeriod } from '@/services/workflow.service';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function WipePeriodButton({ period, className }: { period: string; className?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmPeriod, setConfirmPeriod] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [stepUp, setStepUp] = useState<{ action: string; retry: () => void } | null>(null);
  const validPeriod = PERIOD_PATTERN.test(period);
  const canSubmit = confirmPeriod.trim() === period && reason.trim().length >= 10 && !pending;

  const close = () => {
    if (pending) return;
    setOpen(false);
    setConfirmPeriod('');
    setReason('');
  };

  const runWipe = async () => {
    setPending(true);
    try {
      await wipePeriod(period, { confirmPeriod: confirmPeriod.trim(), reason: reason.trim() });
      toast.success(t('publishing.wiped', { period }));
      setOpen(false);
      setConfirmPeriod('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['period-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['periods'] });
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['penalties'] });
      void queryClient.invalidateQueries({ queryKey: ['payroll'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['complaints'] });
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (/xac thuc lai|xác thực lại/i.test(message)) {
        setStepUp({ action: `period:wipe:${period}`, retry: () => void runWipe() });
        return;
      }
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className={className}
        disabled={!validPeriod}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        {t('publishing.wipe')}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t('publishing.wipeTitle', { period })}
        footer={
          <>
            <Button variant="outline" type="button" disabled={pending} onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" type="button" disabled={!canSubmit} onClick={() => void runWipe()}>
              <Trash2 className="h-4 w-4" />
              {t('publishing.wipe')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#b8bfd0]">{t('publishing.wipeDescription')}</p>
          <p className={`text-xs ${textSubtle}`}>{t('publishing.wipeHint')}</p>
          <div className="space-y-1.5">
            <Label>{t('publishing.wipeConfirmPeriod')}</Label>
            <Input
              value={confirmPeriod}
              onChange={(e) => setConfirmPeriod(e.target.value)}
              placeholder={period}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('publishing.wipeReason')}</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      </Dialog>
      <StepUpDialog
        open={Boolean(stepUp)}
        action={stepUp?.action ?? ''}
        onClose={() => setStepUp(null)}
        onVerified={() => stepUp?.retry()}
      />
    </>
  );
}
