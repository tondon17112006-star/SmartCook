import { lazy, Suspense } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RecipesPage from './pages/RecipesPage.jsx'
import RecipeDetailPage from './pages/RecipeDetailPage.jsx'
import Favorites from './pages/Favorites.jsx'
import MyPantry from './pages/MyPantry.jsx'
import FavoriteProvider from './context/FavoriteProvider.jsx'
import IngredientFinder from './pages/IngredientFinder.jsx'
import Suggestions from './pages/Suggestions.jsx'
import PantryProvider from './context/PantryProvider.jsx'
import AuthProvider from './context/AuthProvider.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import LoadingSpinner from './components/LoadingSpinner.jsx'

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'))
const AdminRecipes = lazy(() => import('./pages/admin/AdminRecipes.jsx'))
const AdminRecipeForm = lazy(() => import('./pages/admin/AdminRecipeForm.jsx'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories.jsx'))
const AdminIngredients = lazy(() => import('./pages/admin/AdminIngredients.jsx'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'))
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews.jsx'))

function AdminPage({ component: Page }) {
  return <Suspense fallback={<LoadingSpinner label="Đang mở trang quản trị…" />}><Page /></Suspense>
}

export default function App() {
  return (
    <AuthProvider><FavoriteProvider><Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/:id" element={<RecipeDetailPage />} />
        <Route element={<PantryProvider><Outlet /></PantryProvider>}>
          <Route path="ingredients" element={<IngredientFinder />} />
          <Route path="suggestions" element={<Suggestions />} />
          <Route element={<ProtectedRoute />}>
            <Route path="pantry" element={<MyPantry />} />
          </Route>
        </Route>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="favorites" element={<Favorites />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminPage component={AdminDashboard} />} />
          <Route path="recipes" element={<AdminPage component={AdminRecipes} />} />
          <Route path="recipes/new" element={<AdminPage component={AdminRecipeForm} />} />
          <Route path="recipes/:id/edit" element={<AdminPage component={AdminRecipeForm} />} />
          <Route path="categories" element={<AdminPage component={AdminCategories} />} />
          <Route path="ingredients" element={<AdminPage component={AdminIngredients} />} />
          <Route path="users" element={<AdminPage component={AdminUsers} />} />
          <Route path="reviews" element={<AdminPage component={AdminReviews} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes></FavoriteProvider></AuthProvider>
  )
}
