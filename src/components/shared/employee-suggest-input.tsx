import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fetchEmployees } from '@/services/employee.service';
import type { Employee } from '@/types/api';

const SUGGEST_LIMIT = 8;

function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

function highlight(text: string, query: string) {
  const needle = fold(query.trim());
  if (!needle) return text;

  const foldedChars: string[] = [];
  const indexMap: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    for (const ch of fold(text[i] ?? '')) {
      foldedChars.push(ch);
      indexMap.push(i);
    }
  }

  const at = foldedChars.join('').indexOf(needle);
  if (at < 0) return text;

  const start = indexMap[at] ?? 0;
  const end = (indexMap[at + needle.length - 1] ?? start) + 1;
  return (
    <>
      {text.slice(0, start)}
      <span className="text-[#4ade80]">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function EmployeeSuggestInput({
  value,
  onChange,
  onSelect,
  onSubmit,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (employee: Employee) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const typed = value.trim();
  const debounced = useDebounced(typed, 200);
  const inSync = typed === debounced;

  const { data, isFetching, isError } = useQuery({
    queryKey: ['employee-suggest', debounced],
    queryFn: () => fetchEmployees({ page: 1, pageSize: SUGGEST_LIMIT, query: debounced }),
    enabled: open && debounced.length > 0,
    staleTime: 30_000,
  });

  const items = open && inSync && !isError ? (data?.items ?? []) : [];
  const activeIndex = active != null && active >= 0 && active < items.length ? active : -1;
  const showPanel = open && typed.length > 0;

  useEffect(() => {
    setActive(null);
  }, [debounced]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const pick = (employee: Employee) => {
    onChange(employee.fullName);
    onSelect?.(employee);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn('relative w-full min-w-0', className)}>
      <Input
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (typed) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            if (items.length > 0) {
              setActive((index) => (index == null ? 0 : Math.min(index + 1, items.length - 1)));
            }
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (items.length > 0) {
              setActive((index) => (index == null ? items.length - 1 : Math.max(index - 1, 0)));
            }
            return;
          }
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (event.key === 'Enter') {
            const selected = activeIndex >= 0 ? items[activeIndex] : undefined;
            if (showPanel && inSync && selected) {
              event.preventDefault();
              pick(selected);
              return;
            }
            if (onSubmit) {
              event.preventDefault();
              setOpen(false);
              onSubmit();
            }
          }
        }}
      />
      {showPanel ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full min-w-[16rem] overflow-auto rounded-md border border-[#2a3040] bg-[#161922] py-1 shadow-lg"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#9aa3b5]">
              {!inSync || isFetching ? t('common.loading') : t('employees.suggestEmpty')}
            </li>
          ) : (
            items.map((employee, index) => (
              <li
                key={employee.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm',
                    index === activeIndex ? 'bg-[#1c2030]' : 'hover:bg-[#1c2030]',
                  )}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(employee);
                  }}
                >
                  <span className="min-w-0 truncate font-medium text-[#eef0f6]">
                    {highlight(employee.fullName, debounced)}
                  </span>
                  <span className="shrink-0 text-xs text-[#9aa3b5]">
                    {highlight(employee.employeeCode, debounced)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
