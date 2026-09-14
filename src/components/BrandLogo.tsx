import { cn } from '@/lib/utils';

type BrandLogoProps = {
  className?: string;
  variant?: 'slogan' | 'mark';
};

export function BrandLogo({ className, variant = 'slogan' }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16a34a] text-sm font-extrabold text-[#f0fdf4]">
        HR
      </span>
      {variant === 'slogan' ? (
        <span className="text-sm font-semibold tracking-tight text-[#eef0f6]">
          CMS Nhân sự
        </span>
      ) : null}
    </div>
  );
}
