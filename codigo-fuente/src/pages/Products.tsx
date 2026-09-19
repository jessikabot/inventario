import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { ProductList } from '../components/ProductList'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/permissions'

export default function Products() {
  const { profile } = useAuth()
  return (
    <>
      <PageHeader
        title="Productos"
        subtitle="Busca por nombre, código o etiqueta."
        actions={isStaff(profile?.role) && <Link to="/productos/nuevo" className="btn btn-primary"><Plus className="h-5 w-5" />Nuevo producto</Link>}
      />
      <ProductList />
    </>
  )
}
