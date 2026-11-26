import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

const toneClass = {
  default: 'text-[#9aa3b5] hover:bg-[#1c2030] hover:text-[#eef0f6]',
  primary: 'text-[#4ade80] hover:bg-[#16a34a]/15 hover:text-[#86efac]',
  danger: 'text-[#f87171] hover:bg-[#ef4444]/15 hover:text-[#fecaca]',
} as const;

type Tone = keyof typeof toneClass;

const baseClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40';

export function IconActionButton({
  label,
  tone = 'default',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(baseClass, toneClass[tone], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconActionLink({
  label,
  tone = 'default',
  className,
  children,
  ...props
}: Omit<LinkProps, 'children'> & {
  label: string;
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      title={label}
      aria-label={label}
      className={cn(baseClass, toneClass[tone], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
