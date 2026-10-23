import LoadingSpinner from '../LoadingSpinner.jsx'
import ErrorState from '../ErrorState.jsx'
import EmptyState from '../EmptyState.jsx'

export default function DataTable({ columns, rows = [], rowKey = 'id', caption, emptyTitle = 'Chưa có dữ liệu', emptyDescription = 'Thử đổi từ khóa hoặc điều chỉnh bộ lọc.', loading, error, onRetry }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  if (loading) return <LoadingSpinner />
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return <div className="max-w-full overflow-x-auto rounded-2xl border border-forest/10 bg-white" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full min-w-[640px] text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="bg-forest/5 text-dark-green"><tr>{columns.map((column) => <th scope="col" key={column.key} className="whitespace-nowrap px-4 py-4 font-semibold">{column.label}</th>)}</tr></thead><tbody className="divide-y divide-forest/8">{rows.map((row) => <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]} className="hover:bg-cream/50">{columns.map((column) => <td key={column.key} className="max-w-sm break-words px-4 py-4 align-top">{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table>
  </div>
}
