import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import { PATH_PERMISSIONS } from '@/constants/navigation';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { fetchMe } from '@/services/auth.service';

function resolvePathPermission(pathname: string) {
  const match = [...PATH_PERMISSIONS]
    .sort((a, b) => b.match.length - a.match.length)
    .find((item) =>
      item.match === '/' ? pathname === '/' : pathname === item.match || pathname.startsWith(`${item.match}/`),
    );
  return match;
}

function firstAllowedPath() {
  const has = useAuthStore.getState().hasPermission;
  const hasAny = useAuthStore.getState().hasAnyPermission;
  for (const item of PATH_PERMISSIONS) {
    if (!item.permission && !item.permissions) return item.match;
    if (item.permission && has(item.permission)) return item.match;
    if (item.permissions && hasAny(item.permissions)) return item.match;
  }
  return '/';
}

export function AuthGuard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const location = useLocation();
  const [ready, setReady] = useState(!accessToken);

  useEffect(() => {
    if (!accessToken) {
      setReady(true);
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        /* 401 handled by api client */
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, setUser]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (!ready) {
    return null;
  }

  if (user?.mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) {
    return <Navigate to={firstAllowedPath()} replace />;
  }
  return <Outlet />;
}

export function CmsPageGuard() {
  const { t } = useTranslation();
  const location = useLocation();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const rule = resolvePathPermission(location.pathname);
  const allowed =
    !rule?.permission && !rule?.permissions
      ? true
      : rule.permission
        ? hasPermission(rule.permission)
        : hasAnyPermission(rule.permissions ?? []);

  if (!allowed) {
    const home = firstAllowedPath();
    if (home !== location.pathname) return <Navigate to={home} replace />;
    return (
      <PageContainer variant="narrow">
        <h1 className="text-xl font-semibold">{t('common.accessDeniedTitle')}</h1>
        <p className="mt-2 text-sm text-[#b8bfd0]">{t('common.accessDeniedDescription')}</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link to={home}>{t('common.back')}</Link>
        </Button>
      </PageContainer>
    );
  }

  return <Outlet />;
}
