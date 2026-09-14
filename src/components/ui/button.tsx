import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-[#16a34a]/50',
  {
    variants: {
      variant: {
        default: 'bg-[#16a34a] text-[#f0fdf4] hover:bg-[#15803d]',
        create:
          'bg-gradient-to-b from-[#22c55e] to-[#15803d] text-[#f0fdf4] font-semibold shadow-[0_0_0_1px_rgba(74,222,128,0.4),0_4px_16px_rgba(22,163,74,0.5),0_0_32px_rgba(34,197,94,0.35)] hover:from-[#4ade80] hover:to-[#16a34a] hover:shadow-[0_0_0_1px_rgba(134,239,172,0.55),0_8px_24px_rgba(22,163,74,0.6),0_0_44px_rgba(74,222,128,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_12px_rgba(22,163,74,0.45)]',
        destructive: 'bg-[#ef4444] text-white hover:bg-[#dc2626]',
        outline:
          'border border-[#2a3040] bg-transparent text-[#eef0f6] shadow-xs hover:bg-[#222736]',
        secondary: 'bg-[#1e2230] text-[#eef0f6] hover:bg-[#252a3a]',
        ghost: 'text-[#b8bfd0] hover:bg-[#222736] hover:text-[#eef0f6]',
        link: 'text-[#4ade80] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  },
);

Button.displayName = 'Button';

export { buttonVariants };
