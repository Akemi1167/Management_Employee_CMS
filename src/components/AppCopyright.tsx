import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type AppCopyrightProps = {
  className?: string;
  variant?: 'sidebar' | 'page';
};

export function AppCopyright({ className, variant = 'page' }: AppCopyrightProps) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <p
      className={cn(
        'text-[#9aa3b5]',
        variant === 'sidebar'
          ? 'truncate text-center text-[9px] leading-tight'
          : 'text-xs text-center text-[#b8bfd0]',
        className,
      )}
    >
      {t(variant === 'sidebar' ? 'common.copyrightShort' : 'common.copyright', { year })}
    </p>
  );
}
