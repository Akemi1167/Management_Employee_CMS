import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
  /** Sidebar: full width, no icon. */
  variant?: 'default' | 'sidebar';
}

export function LanguageSwitcher({ className, compact, variant = 'default' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language)
    ? i18n.language
    : 'vi') as SupportedLanguage;

  const isSidebar = variant === 'sidebar';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {!compact && !isSidebar ? <Globe className="h-4 w-4 shrink-0 text-[#9aa3b5]" /> : null}
      <Select
        className={cn(
          'text-xs',
          isSidebar ? 'h-7 w-full min-w-0 px-2' : compact ? 'h-8 w-[110px]' : 'h-9 w-full',
        )}
        value={current}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label={t('common.language')}
      >
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}
