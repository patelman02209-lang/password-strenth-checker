import type { ReactNode } from 'react'
import { cn } from './utils'

export type Column<T> = {
  key: string
  header: ReactNode
  className?: string
  cell: (row: T) => ReactNode
}

export type DataTableProps<T> = {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  empty?: ReactNode
  className?: string
}

export function DataTable<T>({ columns, data, rowKey, empty, className }: DataTableProps<T>) {
  if (!data.length) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-8 text-center text-sm text-zinc-500">{empty ?? 'No rows.'}</div>
  }
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-white/10', className)}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-black/40 text-xs uppercase tracking-wide text-zinc-500">
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-3 font-semibold', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={rowKey(row)} className="border-b border-white/5 odd:bg-white/[0.02] hover:bg-white/[0.04]">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3 text-zinc-200', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
