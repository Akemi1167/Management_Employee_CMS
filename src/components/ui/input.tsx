import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-[#2a3040] bg-[#1a1e28] px-3 py-1 text-sm text-[#eef0f6] shadow-xs outline-none',
        'placeholder:text-[#9aa3b5]',
        'focus-visible:border-[#16a34a] focus-visible:ring-[3px] focus-visible:ring-[#16a34a]/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
