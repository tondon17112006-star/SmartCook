import AdminCatalog from '../../components/admin/AdminCatalog.jsx'

const fields = [
  { name: 'categoryName', label: 'Tên danh mục', required: true, maxLength: 150 },
  { name: 'description', label: 'Mô tả', as: 'textarea', rows: 3, maxLength: 500 },
  { name: 'imageUrl', label: 'URL hình ảnh', maxLength: 500 },
]
const columns = [{ key: 'categoryName', label: 'Danh mục' }, { key: 'description', label: 'Mô tả' }, { key: 'recipeCount', label: 'Số món ăn' }]
export default function AdminCategories() {
  return <AdminCatalog resource="categories" singular="danh mục" plural="danh mục" idField="categoryId" nameField="categoryName" fields={fields} columns={columns} description="Sắp xếp công thức theo danh mục. Danh mục có món ăn liên kết được bảo vệ khỏi thao tác xóa." deleteDescription="Chỉ danh mục chưa có món ăn liên kết mới được xóa. Thao tác này không thể hoàn tác." />
}
