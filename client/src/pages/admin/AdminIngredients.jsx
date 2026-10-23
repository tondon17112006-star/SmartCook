import AdminCatalog from '../../components/admin/AdminCatalog.jsx'

const fields = [
  { name: 'ingredientName', label: 'Tên nguyên liệu', required: true, maxLength: 150 },
  { name: 'ingredientCategory', label: 'Nhóm nguyên liệu', required: true, maxLength: 100 },
  { name: 'defaultUnit', label: 'Đơn vị mặc định', required: true, maxLength: 30 },
  { name: 'imageUrl', label: 'URL hình ảnh', maxLength: 500 },
]
const columns = [{ key: 'ingredientName', label: 'Nguyên liệu' }, { key: 'ingredientCategory', label: 'Nhóm' }, { key: 'defaultUnit', label: 'Đơn vị mặc định' }]
export default function AdminIngredients() {
  return <AdminCatalog resource="ingredients" singular="nguyên liệu" plural="nguyên liệu" idField="ingredientId" nameField="ingredientName" fields={fields} columns={columns} groupFilter description="Quản lý danh mục nguyên liệu dùng chung cho công thức và tủ cá nhân. Đổi đơn vị mặc định không thay đổi định lượng công thức đã lưu." deleteDescription="Nguyên liệu đang được công thức hoặc tủ cá nhân tham chiếu sẽ không thể xóa. Thao tác này không thể hoàn tác." />
}
