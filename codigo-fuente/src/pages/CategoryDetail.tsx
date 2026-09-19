import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/permissions'
import { CodeTag, EmptyState, PageHeader, Spinner } from '../components/ui'
import { ProductList } from '../components/ProductList'
import type { Category } from '../lib/types'

export default function CategoryDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const [cat, setCat] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    supabase.from('v_category_counts').select('*').eq('id', id!).maybeSingle().then(({ data }) => {
      setCat((data as unknown as Category) ?? null)
      setLoading(false)
    })
  }, [id])

  if (loading) return <Spinner />
  if (!cat) return <EmptyState title="No se encontró la categoría" action={<Link to="/categorias" className="btn btn-primary">Volver a categorías</Link>} />

  return (
    <>
      <PageHeader
        back={{ to: '/categorias', label: 'Categorías' }}
        title={cat.name}
        subtitle={<div className="mt-1 flex items-center gap-2"><CodeTag code={cat.code} /><span>{cat.product_count ?? 0} productos activos</span></div>}
        actions={isStaff(profile?.role) && cat.active && <Link to="/productos/nuevo" className="btn btn-primary"><Plus className="h-5 w-5" />Nuevo producto</Link>}
      />
      <ProductList categoryId={cat.id} showCategoryFilter={false} />
    </>
  )
}
