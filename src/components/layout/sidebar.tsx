import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';
import { SidebarFooter } from '@/components/layout/sidebar-footer';
import { NAVIGATION, type NavItem } from '@/constants/navigation';
import { useAuthStore } from '@/stores/auth-store';

function itemAllowed(
  item: NavItem,
  hasPermission: (permission: string) => boolean,
  hasAnyPermission: (permissions: readonly string[]) => boolean,
) {
  if (item.permission) return hasPermission(item.permission);
  if (item.permissions) return hasAnyPermission(item.permissions);
  return true;
}

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-[#1e2230] bg-[#0a0c10] text-[#c8cdd8]">
      <div className="border-b border-[#1e2230] px-3 pb-3 pt-4">
        <BrandLogo variant="slogan" className="mb-2" />
        <p className="px-1 text-[10px] font-medium tracking-tight text-[#b8bfd0]">
          {t('common.adminConsole')}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAVIGATION.map((group) => (
          <div key={group.titleKey} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#b8bfd0]">
              {t(group.titleKey)}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const allowed = itemAllowed(item, hasPermission, hasAnyPermission);
                const matchBase = item.match ?? item.to;
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname === matchBase || location.pathname.startsWith(`${matchBase}/`);

                if (!allowed) {
                  return (
                    <li key={`${item.labelKey}-${item.to}`}>
                      <span
                        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#6b7280]"
                        title={t('nav.needPermission')}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-[#3f4454]" />
                        {t(item.labelKey)}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={`${item.labelKey}-${item.to}`}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-150',
                        isActive
                          ? 'bg-[#16a34a] font-medium text-[#f0fdf4]'
                          : 'text-[#c8cdd8] hover:bg-[#181c26]/60 hover:text-[#eef0f6]',
                      )}
                    >
                      <item.icon
                        className={cn('h-4 w-4 shrink-0', isActive ? 'text-[#f0fdf4]' : 'text-[#4ade80]')}
                      />
                      {t(item.labelKey)}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <SidebarFooter />
    </aside>
  );
}
