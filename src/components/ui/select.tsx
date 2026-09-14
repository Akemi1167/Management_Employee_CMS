import * as React from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-[#2a3040] bg-[#1a1e28] px-3 py-1 text-sm text-[#eef0f6] shadow-xs outline-none focus-visible:border-[#16a34a] focus-visible:ring-[3px] focus-visible:ring-[#16a34a]/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {children}
    </select>
  ),
);

Select.displayName = 'Select';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectGroup {
  title: string;
  options: MultiSelectOption[];
}

interface MultiSelectProps {
  options?: MultiSelectOption[];
  groups?: MultiSelectGroup[];
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

function OptionRow({
  option,
  checked,
  onToggle,
}: {
  option: MultiSelectOption;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-[#eef0f6] hover:bg-[#222736]">
      <Switch size="sm" checked={checked} onCheckedChange={onToggle} />
      {option.label}
    </label>
  );
}

export function MultiSelect({ options = [], groups, value, onChange, className }: MultiSelectProps) {
  const individualValues = groups?.length
    ? groups.flatMap((group) => group.options.map((option) => option.value))
    : options.filter((option) => option.value !== '*').map((option) => option.value);

  const toggle = (optionValue: string) => {
    if (optionValue === '*') {
      onChange(value.includes('*') ? [] : ['*']);
      return;
    }

    // Khi đang chọn "*", item hiện ON — click = bỏ item đó (mở rộng * → danh sách trừ item).
    if (value.includes('*')) {
      onChange(individualValues.filter((v) => v !== optionValue));
      return;
    }

    const withoutAll = value.filter((v) => v !== '*');
    if (withoutAll.includes(optionValue)) {
      onChange(withoutAll.filter((v) => v !== optionValue));
      return;
    }

    const next = [...withoutAll, optionValue];
    // Đã chọn đủ mọi page → gộp lại thành "*"
    if (
      individualValues.length > 0 &&
      individualValues.every((v) => next.includes(v))
    ) {
      onChange(['*']);
      return;
    }
    onChange(next);
  };

  if (groups?.length) {
    const allOption = options.find((o) => o.value === '*');
    return (
      <div
        className={cn(
          'max-h-[32rem] overflow-y-auto rounded-md border border-[#2a3040] bg-[#1a1e28] p-3',
          className,
        )}
      >
        {allOption ? (
          <div className="mb-4 border-b border-[#2a3040] pb-3">
            <OptionRow
              option={allOption}
              checked={value.includes(allOption.value)}
              onToggle={() => toggle(allOption.value)}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} className="space-y-1.5">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b5]">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.options.map((option) => (
                  <OptionRow
                    key={option.value}
                    option={option}
                    checked={value.includes(option.value) || value.includes('*')}
                    onToggle={() => toggle(option.value)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'max-h-80 overflow-y-auto rounded-md border border-[#2a3040] bg-[#1a1e28] p-3',
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <OptionRow
            key={option.value}
            option={option}
            checked={
              option.value === '*'
                ? value.includes('*')
                : value.includes(option.value) || value.includes('*')
            }
            onToggle={() => toggle(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
