import { cn } from '@/lib/utils';

type PageContainerVariant = 'wide' | 'narrow' | 'full';

const variantClass: Record<PageContainerVariant, string> = {
  /** Danh sách, dashboard — tận dụng màn hình rộng (tối đa ~1680px) */
  wide: 'mx-auto w-full max-w-[1680px] px-6 py-6 lg:px-8 xl:py-8',
  /** Form, chi tiết đơn giản */
  narrow: 'mx-auto w-full max-w-4xl px-6 py-8 lg:px-8',
  /** Chi tiết phức tạp (thành viên) — full width trừ padding */
  full: 'mx-auto w-full px-6 py-6 lg:px-8 xl:px-10 2xl:px-12',
};

interface PageContainerProps {
  variant?: PageContainerVariant;
  className?: string;
  children: React.ReactNode;
}

export function PageContainer({
  variant = 'wide',
  className,
  children,
}: PageContainerProps) {
  return <div className={cn(variantClass[variant], className)}>{children}</div>;
}
