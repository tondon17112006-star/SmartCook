import AdminDialog from './AdminDialog.jsx'

export default function ConfirmDialog({ open = true, title = 'Xác nhận xóa', description, pending = false, error, onCancel, onConfirm, confirmLabel = 'Xác nhận xóa' }) {
  if (!open) return null
  return <AdminDialog title={title} description={description} onClose={onCancel} pending={pending}>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap justify-end gap-3"><button data-autofocus type="button" className="button-secondary" disabled={pending} onClick={onCancel}>Hủy</button><button type="button" className="min-h-12 rounded-xl bg-red-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} onClick={onConfirm}>{pending ? 'Đang xóa…' : confirmLabel}</button></div>
  </AdminDialog>
}
