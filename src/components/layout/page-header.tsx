import { textBody, textSubtle, textTitle } from '@/constants/theme';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: string[];
  actions?: React.ReactNode;
  compact?: boolean;
}

export function PageHeader({ title, description, breadcrumb, actions, compact }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between',
        compact ? 'mb-0' : 'mb-8',
      )}
    >
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className={cn('mb-1 text-xs', textSubtle)}>{breadcrumb.join(' / ')}</nav>
        )}
        <h1 className={cn(compact ? 'text-lg font-semibold' : 'text-2xl font-bold', 'tracking-tight', textTitle)}>
          {title}
        </h1>
        {description && <p className={cn('mt-0.5 text-sm', textBody)}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
