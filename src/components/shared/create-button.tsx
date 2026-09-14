import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CreateButton({ className, variant = 'create', ...props }: ButtonProps) {
  return <Button variant={variant} className={cn('gap-2', className)} {...props} />;
}
