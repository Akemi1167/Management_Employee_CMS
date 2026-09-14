import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#16a34a] text-[#f8f9ff]',
        secondary: 'border-transparent bg-[#1e2230] text-[#eef0f6]',
        destructive: 'border-transparent bg-[#ef4444] text-white',
        outline: 'text-[#b8bfd0] border-[#2a3040]',
        success: 'border-[#34d399]/40 text-[#34d399] bg-[#34d399]/10',
        live: 'border-[#ef4444]/50 bg-[#ef4444]/15 text-[#fecaca] font-semibold',
        upcoming: 'border-[#16a34a]/50 bg-[#16a34a]/15 text-[#bbf7d0] font-medium',
        finished: 'border-[#3a4050] bg-[#1a1e28] text-[#9aa3b5]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
