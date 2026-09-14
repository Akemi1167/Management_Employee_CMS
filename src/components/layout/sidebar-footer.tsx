import { LogOut, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppCopyright } from '@/components/AppCopyright';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { cn } from '@/lib/utils';
import { logout } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth-store';

export function SidebarFooter() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const role = user?.roles?.[0];

  return (
    <div className="border-t border-[#1e2230] p-2.5">
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#12151c]/80 px-2 py-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16a34a]/20 text-xs font-semibold text-[#4ade80]">
          {(user?.username ?? 'A').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[#eef0f6]">
            {user?.fullName || user?.username || t('common.defaultAdmin')}
          </p>
          <p className="truncate text-[10px] text-[#9aa3b5]">
            {role ? t(`roles.${role}`) : t('common.defaultAdmin')}
          </p>
        </div>
        <Link
          to="/account"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9aa3b5] hover:bg-[#181c26] hover:text-[#eef0f6]"
          title={t('account.title')}
        >
          <UserRound className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9aa3b5] transition-colors hover:bg-[#181c26] hover:text-[#ef4444]"
          title={t('common.logout')}
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-2 space-y-0.5">
        <p className="px-0.5 text-[9px] font-medium uppercase tracking-wide text-[#9aa3b5]">
          {t('common.language')}
        </p>
        <LanguageSwitcher variant="sidebar" />
      </div>

      <AppCopyright variant="sidebar" className={cn('px-0.5')} />
    </div>
  );
}
