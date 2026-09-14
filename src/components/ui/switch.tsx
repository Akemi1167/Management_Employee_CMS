import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  size = 'md',
}: SwitchProps) {
  const sizeClass =
    size === 'sm'
      ? {
          track: 'h-5 w-9',
          thumb: 'h-4 w-4',
          on: 'translate-x-4',
          off: 'translate-x-0.5',
        }
      : {
          track: 'h-6 w-11',
          thumb: 'h-5 w-5',
          on: 'translate-x-5',
          off: 'translate-x-0.5',
        };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        'relative inline-flex items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/60',
        'disabled:cursor-not-allowed disabled:opacity-50',
        sizeClass.track,
        checked ? 'border-[#6366f1] bg-[#6366f1]' : 'border-[#2a3040] bg-[#0e1016]',
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-[#eef0f6] transition-transform',
          sizeClass.thumb,
          checked ? sizeClass.on : sizeClass.off,
        )}
      />
    </button>
  );
}
