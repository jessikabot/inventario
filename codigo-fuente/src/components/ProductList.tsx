import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDebounced } from '../lib/hooks'
import { cleanTerm, money } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/permissions'
import { CodeTag, EmptyState, Pagination, Spinner, StockBadge, Thumb } from './ui'
import type { Category, ProductRow } from '../lib/types'

const PAGE_SIZE = 30
type StatusFilter = 'todos' | 'con_stock' | 'bajo' | 'sin_stock'

export function ProductList({ categoryId, showCategoryFilter = true }: { categoryId?: string; showCategoryFilter?: boolean }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState<StatusFilter>('todos')
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<ProductRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cats, setCats] = useState<Category[]>([])
  const req = useRef(0)

  useEffect(() => {
    if (!showCategoryFilter) return
    supabase.from('categories').select('id, name, code, active, created_at').eq('active', true).order('name').then(({ data }) => setCats((data ?? []) as Category[]))
  }, [showCategoryFilter])

  useEffect(() => { setPage(0) }, [dq, cat, status, showInactive, categoryId])

  useEffect(() => {
    const id = ++req.current
    setLoading(true)
    let query = supabase
      .from('products')
      .select('id, code, title, price, stock, min_stock, unit, stock_status, active, primary_image_path, category:categories(name)', { count: 'exact' })
    const catId = categoryId || cat
    if (catId) query = query.eq('category_id', catId)
    if (!(isAdmin && showInactive)) query = query.eq('active', true)
    if (status === 'con_stock') query = query.neq('stock_status', 'sin_stock')
    if (status === 'bajo') query = query.eq('stock_status', 'bajo')
    if (status === 'sin_stock') query = query.eq('stock_status', 'sin_stock')
    const t = cleanTerm(dq)
    if (t) query = query.or(`title.ilike.*${t}*,code.ilike.*${t}*,label.ilike.*${t}*`)
    query.order('code').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1).then(({ data, count, error: err }) => {
      if (id !== req.current) return
      setLoading(false)
      if (err) { setError('No se pudieron cargar los productos.'); return }
      setError('')
      setRows((data ?? []) as unknown as ProductRow[])
      setTotal(count ?? 0)
    })
  }, [dq, cat, status, showInactive, page, categoryId, isAdmin])

  return (
    <div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-soft" />
          <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, código o etiqueta" aria-label="Buscar producto" />
        </div>
        {showCategoryFilter && (
          <select className="input lg:w-56" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select className="input lg:w-48" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Estado del stock">
          <option value="todos">Todo el stock</option>
          <option value="con_stock">Con stock</option>
          <option value="bajo">Stock bajo</option>
          <option value="sin_stock">Sin stock</option>
        </select>
      </div>
      {isAdmin && (
        <label className="mb-3 inline-flex items-center gap-2 text-sm text-tinta-soft">
          <input type="checkbox" className="h-4 w-4 accent-pino" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar también los productos desactivados
        </label>
      )}

      {error && <p className="mb-3 rounded-lg bg-ladrillo-soft px-4 py-3 text-sm font-medium text-ladrillo">{error}</p>}

      {loading && rows.length === 0 ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No hay productos para mostrar"
          text={dq || cat || status !== 'todos' ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Todavía no se registró ningún producto.'}
          action={isStaff(profile?.role) && !dq ? <Link to="/productos/nuevo" className="btn btn-primary"><Plus className="h-5 w-5" />Nuevo producto</Link> : undefined}
        />
      ) : (
        <ul className={`divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-white transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {rows.map((p) => (
            <li key={p.id}>
              <Link to={`/productos/${p.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-pino-soft/40 sm:gap-4 sm:px-4">
                <Thumb path={p.primary_image_path} size={60} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CodeTag code={p.code} />
                    {!p.active && <span className="chip bg-bruma text-tinta-soft">Desactivado</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[16px] font-semibold">{p.title}</p>
                  <p className="truncate text-sm text-tinta-soft">{p.category?.name ?? 'Sin categoría'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="font-display text-lg font-bold">{money(p.price)}</p>
                  <StockBadge stock={p.stock} unit={p.unit} status={p.stock_status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </div>
  )
}
