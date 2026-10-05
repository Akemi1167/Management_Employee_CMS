import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cardClass, textBody, textColumnHeader, textSubtle, textTitle } from '@/constants/theme';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination } from '@/components/shared/table-pagination';

export type SortValue = string | number | boolean | null | undefined;

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  /** Set false for columns that should not be sorted, such as action menus. */
  sortable?: boolean;
  /** Server sort asks the API to order the full result set. */
  sortMode?: 'client' | 'server';
  /** Value used when the visible cell is not the raw field. */
  sortValue?: (row: T) => SortValue;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  countLabel?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  /** Active sort owned by the API. Client sort of other columns stays local. */
  serverSort?: SortState | null;
  onServerSortChange?: (sort: SortState | null) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: string;
  direction: SortDirection;
}

const NON_DATA_KEYS = new Set(['actions', 'select']);

function cycleSort(current: SortState | null, key: string): SortState | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

function isColumnSortable<T>(column: Column<T>, data: T[]): boolean {
  if (column.sortable != null) return column.sortable;
  if (column.sortMode === 'server') return true;
  if (NON_DATA_KEYS.has(column.key)) return false;
  if (column.sortValue) return true;

  for (const row of data) {
    const value = (row as Record<string, unknown>)[column.key];
    if (value == null || value === '') continue;
    return typeof value !== 'object';
  }

  return true;
}

function readSortValue<T>(row: T, column: Column<T>): SortValue {
  if (column.sortValue) return column.sortValue(row);
  const value = (row as Record<string, unknown>)[column.key];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value == null) {
    return value as SortValue;
  }
  return null;
}

function normalizeSortValue(value: SortValue): { empty: true } | { empty: false; text: string; number: number | null } {
  if (typeof value === 'boolean') {
    return { empty: false, text: value ? 'true' : 'false', number: value ? 1 : 0 };
  }
  if (value == null || value === '') return { empty: true };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { empty: false, text: String(value), number: value } : { empty: true };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === '–') return { empty: true };
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    const amount = Number(trimmed);
    if (Number.isFinite(amount)) return { empty: false, text: trimmed, number: amount };
  }
  return { empty: false, text: trimmed, number: null };
}

function compareSortValues(left: SortValue, right: SortValue, direction: SortDirection): number {
  const a = normalizeSortValue(left);
  const b = normalizeSortValue(right);
  if (a.empty && b.empty) return 0;
  if (a.empty) return 1;
  if (b.empty) return -1;

  const factor = direction === 'asc' ? 1 : -1;
  if (a.number != null && b.number != null) return (a.number - b.number) * factor;
  return a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: 'base' }) * factor;
}

export function DataTable<T extends object>({
  columns,
  data,
  loading,
  emptyMessage,
  onRowClick,
  title,
  icon: Icon,
  count,
  countLabel,
  pagination,
  serverSort,
  onServerSortChange,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const noDataMessage = emptyMessage ?? t('common.noData');
  const [sort, setSort] = useState<SortState | null>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const column = columns.find((item) => item.key === sort.key && isColumnSortable(item, data));
    if (!column) return data;
    return data
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const compared = compareSortValues(
          readSortValue(left.row, column),
          readSortValue(right.row, column),
          sort.direction,
        );
        return compared === 0 ? left.index - right.index : compared;
      })
      .map((item) => item.row);
  }, [columns, data, sort]);

  const toggleSort = (column: Column<T>) => {
    if (column.sortMode === 'server' && onServerSortChange) {
      setSort(null);
      onServerSortChange(cycleSort(serverSort?.key === column.key ? serverSort : null, column.key));
      return;
    }

    if (serverSort) onServerSortChange?.(null);
    setSort((current) => cycleSort(current, column.key));
  };

  if (loading) {
    return (
      <div className={cn(cardClass, 'overflow-hidden')}>
        {title && (
          <div className="border-b border-[#2a3040] px-5 py-4">
            <Skeleton className="h-4 w-32" />
          </div>
        )}
        <div className="p-5">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(cardClass, 'overflow-hidden text-[#eef0f6]')}>
      {title && (
        <div className="flex items-center gap-2 border-b border-[#2a3040] px-5 py-4">
          {Icon && <Icon className="h-4 w-4 text-[#4ade80]" />}
          <h2 className={cn('text-sm font-semibold', textTitle)}>{title}</h2>
          {count !== undefined && (
            <span className={cn('ml-auto text-xs', textSubtle)}>
              {countLabel ?? count}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <p className={cn('p-5 text-sm', textBody)}>{noDataMessage}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a3040] bg-[#1a1e28]/60">
                {columns.map((col) => {
                  const sortable = isColumnSortable(col, data);
                  const serverActive = col.sortMode === 'server' && !sort && serverSort?.key === col.key;
                  const direction = sort?.key === col.key ? sort.direction : serverActive ? serverSort?.direction : null;
                  const ariaSort = !sortable ? undefined : direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
                  const sortLabel = !direction
                    ? t('common.sortBy', { column: col.header })
                    : direction === 'asc'
                      ? t('common.sortedAsc', { column: col.header })
                      : t('common.sortedDesc', { column: col.header });

                  return (
                    <th
                      key={col.key}
                      aria-sort={ariaSort}
                      className={cn('text-left', textColumnHeader, col.className)}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className={cn(
                            'inline-flex w-full cursor-pointer items-center gap-1.5 px-5 py-3 text-left font-semibold uppercase tracking-wider',
                            direction ? 'text-[#86efac]' : 'text-inherit hover:text-[#86efac]',
                          )}
                          aria-label={sortLabel}
                          title={sortLabel}
                          onClick={() => toggleSort(col)}
                        >
                          <span>{col.header}</span>
                          {direction === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
                          ) : direction === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-[#9aa3b5]" />
                          )}
                        </button>
                      ) : (
                        <span className="block px-5 py-3">{col.header}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3040]">
              {sortedData.map((row, idx) => {
                const interactive = Boolean(onRowClick);
                return (
                <tr
                  key={
                    'id' in row && row.id != null
                      ? String(row.id)
                      : 'uuid' in row && row.uuid != null
                        ? String(row.uuid)
                        : idx
                  }
                  className={cn(
                    'group relative border-l-2 border-l-transparent text-[#eef0f6]',
                    'transition-[background-color,border-color,box-shadow] duration-150 ease-out',
                    interactive
                      ? [
                          'cursor-pointer',
                          'hover:border-l-[#16a34a] hover:bg-[#16a34a]/[0.08]',
                          'hover:shadow-[inset_0_1px_0_0_rgba(22,163,74,0.08)]',
                          'active:bg-[#16a34a]/[0.12]',
                        ]
                      : 'hover:bg-[#1a1e28]/70',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-5 py-3 transition-colors duration-150',
                        interactive && 'group-hover:text-[#f4f5fa]',
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </div>
      {pagination && !loading ? (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
        />
      ) : null}
    </div>
  );
}
