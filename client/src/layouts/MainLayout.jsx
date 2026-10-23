import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar.jsx'
import Footer from '../components/Footer.jsx'
import ScrollToTop from '../components/ScrollToTop.jsx'

export default function MainLayout() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      <ScrollToTop />
      <Navbar key={location.key} />
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none"><Outlet /></main>
      <Footer />
    </div>
  )
}
