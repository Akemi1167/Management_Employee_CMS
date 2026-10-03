import { cn } from '@/lib/utils';
import { textLabel } from '@/constants/theme';

export function FilterGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3', className)}>
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className={textLabel}>{label}</span>
      {children}
    </label>
  );
}
