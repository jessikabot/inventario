import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import type { Role } from './lib/types'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import ProductDetail from './pages/ProductDetail'
import Categories from './pages/Categories'
import CategoryDetail from './pages/CategoryDetail'
import StockIn from './pages/StockIn'
import Movements from './pages/Movements'
import Sales from './pages/Sales'
import NewSale from './pages/NewSale'
import SaleDetail from './pages/SaleDetail'
import Reports from './pages/Reports'
import Users from './pages/Users'
import ProfilePage from './pages/Profile'
import SettingsPage from './pages/Settings'

function Protected() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="pt-24"><Spinner /></div>
  if (!profile) return <Navigate to="/login" replace />
  return <Layout />
}

function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

const STAFF: Role[] = ['admin', 'vendedor']
const ADMIN: Role[] = ['admin']

export default function App() {
  const { loading } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={loading ? <div className="pt-24"><Spinner /></div> : <Login />} />
      <Route element={<Protected />}>
        <Route index element={<Dashboard />} />
        <Route path="productos" element={<Products />} />
        <Route path="productos/nuevo" element={<Only roles={STAFF}><ProductForm /></Only>} />
        <Route path="productos/:id" element={<ProductDetail />} />
        <Route path="productos/:id/editar" element={<Only roles={STAFF}><ProductForm /></Only>} />
        <Route path="categorias" element={<Categories />} />
        <Route path="categorias/:id" element={<CategoryDetail />} />
        <Route path="ingreso" element={<Only roles={STAFF}><StockIn /></Only>} />
        <Route path="movimientos" element={<Only roles={STAFF}><Movements /></Only>} />
        <Route path="ventas" element={<Only roles={STAFF}><Sales /></Only>} />
        <Route path="ventas/nueva" element={<Only roles={STAFF}><NewSale /></Only>} />
        <Route path="ventas/:id" element={<Only roles={STAFF}><SaleDetail /></Only>} />
        <Route path="reportes" element={<Reports />} />
        <Route path="usuarios" element={<Only roles={ADMIN}><Users /></Only>} />
        <Route path="configuracion" element={<Only roles={ADMIN}><SettingsPage /></Only>} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
