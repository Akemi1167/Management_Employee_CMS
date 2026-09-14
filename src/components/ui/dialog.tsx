import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { cardClass, textTitle } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        className={cn(
          cardClass,
          'relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden text-[#eef0f6]',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-[#2a3040] px-5 py-4">
          <h2 className={cn('text-base font-semibold', textTitle)}>{title}</h2>
          <Button variant="ghost" size="icon" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-[#2a3040] px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loading,
  destructive,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('common.processing') : (confirmLabel ?? t('common.confirm'))}
          </Button>
        </>
      }
    >
      <p className="text-sm text-[#b8bfd0]">{description}</p>
    </Dialog>
  );
}
