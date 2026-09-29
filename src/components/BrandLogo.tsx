import { cn } from '@/lib/utils';

const LOGO_SRC = '/yf-global-logo.png';

type BrandLogoProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
};

const sizeClass = {
  sm: 'max-h-9 w-auto max-w-[7.5rem]',
  md: 'max-h-16 w-auto',
  lg: 'max-h-44 w-auto max-w-full',
  full: 'h-auto w-full',
} as const;

export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="YF GLOBAL"
      className={cn('object-contain', sizeClass[size], className)}
    />
  );
}
