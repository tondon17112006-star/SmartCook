import { LayoutDashboard, CookingPot, Tags, Carrot, Users, MessageSquare } from 'lucide-react'

export const adminNavigation = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/recipes', label: 'Quản lý món ăn', icon: CookingPot },
  { to: '/admin/categories', label: 'Danh mục', icon: Tags },
  { to: '/admin/ingredients', label: 'Nguyên liệu', icon: Carrot },
  { to: '/admin/users', label: 'Người dùng', icon: Users },
  { to: '/admin/reviews', label: 'Đánh giá', icon: MessageSquare },
]
