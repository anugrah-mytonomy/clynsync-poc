import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface CardTableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T) => ReactNode;
  className?: string;
}

interface CardTableProps<T> {
  title: string;
  headerAction?: ReactNode;
  columns: CardTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
}

const alignClasses: Record<NonNullable<CardTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function CardTable<T>({ title, headerAction, columns, data, getRowKey }: CardTableProps<T>) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-5">
      <div className="flex items-center justify-between gap-sm">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {headerAction}
      </div>
      <div className="mt-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F4F6F9]">
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    'whitespace-nowrap px-3 py-2.5 text-xs font-bold tracking-wide text-[#475569]',
                    index === 0 && 'rounded-l-md',
                    index === columns.length - 1 && 'rounded-r-md',
                    alignClasses[column.align ?? 'left'],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-border last:border-0">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-3 align-middle',
                      alignClasses[column.align ?? 'left'],
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CardTable;
