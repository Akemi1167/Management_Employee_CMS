import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { cardClass, textBody, textColumnHeader, textSubtle, textTitle } from '@/constants/theme';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination } from '@/components/shared/table-pagination';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
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
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const noDataMessage = emptyMessage ?? t('common.noData');

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
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn('px-5 py-3 text-left', textColumnHeader, col.className)}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3040]">
              {data.map((row, idx) => {
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
