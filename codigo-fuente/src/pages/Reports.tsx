import { useEffect, useMemo, useState } from 'react'
import { Download, Printer, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { downloadCsv } from '../lib/csv'
import { friendlyError } from '../lib/errors'
import {
  dateOnly, dateTime, endOfDayISO, money, monthStartLP, MOVEMENT_LABEL, num, PAYMENT_LABEL, saleNumber, startOfDayISO, todayLP, UNIT_LABEL,
} from '../lib/format'
import { isStaff } from '../lib/permissions'
import { CodeTag, EmptyState, Modal, PageHeader, Spinner, StockBadge } from '../components/ui'
import { DateRange } from '../components/DateRange'
import { ProductPicker, type PickerProduct } from '../components/ProductPicker'
import type { Category, GroupRow, Movement, MovementType, Profile, StockStatus, Unit } from '../lib/types'

type Tab = 'day' | 'month' | 'user' | 'category' | 'product' | 'payment' | 'stock' | 'movements'

const TABS: { v: Tab; label: string; staffOnly: boolean; adminOnly?: boolean }[] = [
  { v: 'day', label: 'Diario', staffOnly: true },
  { v: 'month', label: 'Mensual', staffOnly: true },
  { v: 'user', label: 'Por usuario', staffOnly: true },
  { v: 'category', label: 'Por categoría', staffOnly: true },
  { v: 'product', label: 'Productos vendidos', staffOnly: true },
  { v: 'payment', label: 'Por método de pago', staffOnly: true },
  { v: 'stock', label: 'Stock', staffOnly: false },
  { v: 'movements', label: 'Movimientos', staffOnly: true },
]

const PAGE_SIZE = 1000
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, cap = 10000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < cap; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const chunk = (data ?? []) as T[]
    out.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return out
}

interface StockRow {
  id: string; code: string; title: string; price: number; stock: number; min_stock: number
  unit: Unit; stock_status: StockStatus; category: { name: string } | null
}

export default function Reports() {
  const { profile } = useAuth()
  const toast = useToast()
  const role = profile!.role
  const staff = isStaff(role)
  const admin = role === 'admin'
  const tabs = TABS.filter((t) => staff || !t.staffOnly)
  const [tab, setTab] = useState<Tab>(staff ? 'day' : 'stock')
  const [from, setFrom] = useState(monthStartLP())
  const [to, setTo] = useState(todayLP())
  const [user, setUser] = useState('')
  const [category, setCategory] = useState('')
  const [product, setProduct] = useState<PickerProduct | null>(null)
  const [saleStatus, setSaleStatus] = useState<'completada' | 'anulada' | 'todas'>('completada')
  const [stockFilter, setStockFilter] = useState<'todos' | 'bajo' | 'sin_stock' | 'con_stock'>('todos')
  const [moveType, setMoveType] = useState<'' | MovementType>('')
  const [pick, setPick] = useState(false)

  const [cats, setCats] = useState<Category[]>([])
  const [staffUsers, setStaffUsers] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupRows, setGroupRows] = useState<GroupRow[]>([])
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [moveRows, setMoveRows] = useState<Movement[]>([])

  useEffect(() => {
    supabase.from('categories').select('id, name').order('name').then(({ data }) => setCats((data ?? []) as Category[]))
    if (admin) supabase.from('profiles').select('id, full_name').in('role', ['admin', 'vendedor']).order('full_name')
      .then(({ data }) => setStaffUsers((data ?? []) as Pick<Profile, 'id' | 'full_name'>[]))
  }, [admin])

  const isSalesTab = !['stock', 'movements'].includes(tab)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        if (isSalesTab) {
          const { data, error: err } = await supabase.rpc('rpt_sales_group', {
            p_group: tab, p_from: from, p_to: to,
            p_user: user || null, p_category: category || null, p_product: product?.id ?? null, p_status: saleStatus,
          })
          if (err) throw err
          let rows = ((data ?? []) as any[]).map((r) => ({ ...r, sales_count: Number(r.sales_count), units: Number(r.units), total: Number(r.total) })) as GroupRow[]
          if (tab === 'payment') rows = rows.map((r) => ({ ...r, group_label: PAYMENT_LABEL[r.group_key as keyof typeof PAYMENT_LABEL] ?? r.group_label }))
          if (tab === 'product') rows.sort((a, b) => b.units - a.units)
          else if (tab === 'user' || tab === 'category' || tab === 'payment') rows.sort((a, b) => b.total - a.total)
          if (alive) setGroupRows(rows)
        } else if (tab === 'stock') {
          const rows = await fetchAll<StockRow>((f, t) => {
            let q = supabase.from('products')
              .select('id, code, title, price, stock, min_stock, unit, stock_status, category:categories(name)')
              .eq('active', true).order('code').range(f, t)
            if (category) q = q.eq('category_id', category)
            if (product) q = q.eq('id', product.id)
            if (stockFilter === 'bajo') q = q.eq('stock_status', 'bajo')
            if (stockFilter === 'sin_stock') q = q.eq('stock_status', 'sin_stock')
            if (stockFilter === 'con_stock') q = q.neq('stock_status', 'sin_stock')
            return q
          })
          if (alive) setStockRows(rows)
        } else {
          const rows = await fetchAll<Movement>((f, t) => {
            let q = supabase.from('inventory_movements')
              .select('*, product:products!inner(code, title, category_id), user:profiles!created_by(full_name), sale:sales!sale_id(sale_number)')
              .gte('created_at', startOfDayISO(from)).lte('created_at', endOfDayISO(to))
              .order('created_at', { ascending: false }).range(f, t)
            if (moveType) q = q.eq('type', moveType)
            if (user) q = q.eq('created_by', user)
            if (category) q = q.eq('product.category_id', category)
            if (product) q = q.eq('product_id', product.id)
            return q
          })
          if (alive) setMoveRows(rows)
        }
      } catch (e) {
        if (alive) setError(friendlyError(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [tab, from, to, user, category, product, saleStatus, stockFilter, moveType, isSalesTab])

  const totals = useMemo(() => ({
    sales: groupRows.reduce((s, r) => s + r.sales_count, 0),
    units: groupRows.reduce((s, r) => s + r.units, 0),
    total: groupRows.reduce((s, r) => s + r.total, 0),
  }), [groupRows])

  const stockTotals = useMemo(() => ({
    units: stockRows.reduce((s, r) => s + r.stock, 0),
    value: stockRows.reduce((s, r) => s + r.stock * Number(r.price), 0),
  }), [stockRows])

  const moveSummary = useMemo(() => {
    const m = new Map<MovementType, { count: number; units: number }>()
    moveRows.forEach((r) => {
      const c = m.get(r.type) ?? { count: 0, units: 0 }
      m.set(r.type, { count: c.count + 1, units: c.units + r.quantity })
    })
    return [...m.entries()]
  }, [moveRows])

  const tabLabel = tabs.find((t) => t.v === tab)!.label
  const groupHeader: Record<string, string> = { day: 'Día', month: 'Mes', user: 'Vendedor', category: 'Categoría', product: 'Producto', payment: 'Método de pago' }
  const fmtLabel = (r: GroupRow) => (tab === 'day' ? dateOnly(`${r.group_key}T12:00:00-04:00`) : r.group_label)

  const exportCsv = () => {
    const stamp = `${from}_a_${to}`
    if (isSalesTab) {
      downloadCsv(`reporte-${tab}-${stamp}.csv`, [
        [groupHeader[tab], 'N° de ventas', 'Unidades', 'Total'],
        ...groupRows.map((r) => [tab === 'day' ? r.group_key : r.group_label, r.sales_count, r.units, r.total.toFixed(2)]),
        ['TOTAL', '', totals.units, totals.total.toFixed(2)],
      ])
    } else if (tab === 'stock') {
      downloadCsv(`reporte-stock-${todayLP()}.csv`, [
        ['Código', 'Producto', 'Categoría', 'Stock', 'Unidad', 'Stock mínimo', 'Estado', 'Precio', 'Valor en stock'],
        ...stockRows.map((r) => [r.code, r.title, r.category?.name ?? '', r.stock, UNIT_LABEL[r.unit], r.min_stock,
          r.stock_status === 'sin_stock' ? 'Sin stock' : r.stock_status === 'bajo' ? 'Stock bajo' : 'Normal', Number(r.price).toFixed(2), (r.stock * Number(r.price)).toFixed(2)]),
      ])
    } else {
      downloadCsv(`reporte-movimientos-${stamp}.csv`, [
        ['Fecha', 'Código', 'Producto', 'Tipo', 'Cantidad', 'Stock anterior', 'Stock resultante', 'Usuario', 'Venta', 'Observación'],
        ...moveRows.map((r) => [dateTime(r.created_at), r.product?.code, r.product?.title, MOVEMENT_LABEL[r.type], r.quantity, r.stock_before, r.stock_after,
          r.user?.full_name, r.sale ? saleNumber(r.sale.sale_number) : '', r.note]),
      ])
    }
    toast.ok('Archivo descargado (se abre con Excel).')
  }

  const hasRows = isSalesTab ? groupRows.length > 0 : tab === 'stock' ? stockRows.length > 0 : moveRows.length > 0
  const usesDates = tab !== 'stock'

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Elige el reporte, ajusta los filtros y descárgalo si lo necesitas."
        actions={hasRows ? (
          <>
            <button className="btn btn-secondary" onClick={() => window.print()}><Printer className="h-5 w-5" /> Imprimir</button>
            <button className="btn btn-primary" onClick={exportCsv}><Download className="h-5 w-5" /> Descargar Excel</button>
          </>
        ) : undefined}
      />

      <div className="no-print -mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1.5">
          {tabs.map((t) => (
            <button key={t.v} onClick={() => setTab(t.v)} aria-pressed={tab === t.v}
              className={`min-h-[44px] whitespace-nowrap rounded-lg border px-4 text-[15px] font-semibold transition-colors ${tab === t.v ? 'border-pino bg-pino text-white' : 'border-linea bg-white text-tinta-soft hover:bg-bruma'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card no-print mb-5 space-y-3 p-4">
        {usesDates && <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />}
        <div className="flex flex-wrap gap-3">
          {admin && tab !== 'stock' && (
            <select className="input !w-full sm:!w-52" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Usuario">
              <option value="">Todos los usuarios</option>
              {staffUsers.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
          <select className="input !w-full sm:!w-52" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
            <option value="">Todas las categorías</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {isSalesTab && (
            <select className="input !w-full sm:!w-48" value={saleStatus} onChange={(e) => setSaleStatus(e.target.value as typeof saleStatus)} aria-label="Estado de la venta">
              <option value="completada">Ventas completadas</option>
              <option value="anulada">Ventas anuladas</option>
              <option value="todas">Todas</option>
            </select>
          )}
          {tab === 'stock' && (
            <select className="input !w-full sm:!w-48" value={stockFilter} onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)} aria-label="Estado del stock">
              <option value="todos">Todo el stock</option>
              <option value="con_stock">Con stock</option>
              <option value="bajo">Stock bajo</option>
              <option value="sin_stock">Sin stock</option>
            </select>
          )}
          {tab === 'movements' && (
            <select className="input !w-full sm:!w-48" value={moveType} onChange={(e) => setMoveType(e.target.value as '' | MovementType)} aria-label="Tipo de movimiento">
              <option value="">Todos los tipos</option>
              {(Object.keys(MOVEMENT_LABEL) as MovementType[]).map((k) => <option key={k} value={k}>{MOVEMENT_LABEL[k]}</option>)}
            </select>
          )}
          {product ? (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-pino bg-pino-soft px-3 text-[15px] font-semibold">
              <CodeTag code={product.code} /> <span className="max-w-[12rem] truncate">{product.title}</span>
              <button onClick={() => setProduct(null)} aria-label="Quitar producto" className="rounded p-1 hover:bg-white/60"><X className="h-4 w-4" /></button>
            </span>
          ) : (
            <button className="btn btn-secondary" onClick={() => setPick(true)}>Filtrar por producto</button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-ladrillo-soft px-4 py-3 font-medium text-ladrillo">{error}</p>}

      <div className="hidden print:block mb-3"><p className="font-display text-xl font-bold">Reporte: {tabLabel}</p>{usesDates && <p>{dateOnly(`${from}T12:00:00-04:00`)} al {dateOnly(`${to}T12:00:00-04:00`)}</p>}</div>

      {loading ? <Spinner /> : !hasRows ? (
        <EmptyState title="Sin datos para mostrar" text="Prueba cambiando las fechas o quitando algún filtro." />
      ) : isSalesTab ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="card p-4"><p className="text-sm font-semibold text-tinta-soft">Total vendido</p><p className="font-display text-xl font-bold tabular-nums text-pino sm:text-2xl">{money(totals.total)}</p></div>
            <div className="card p-4"><p className="text-sm font-semibold text-tinta-soft">Unidades</p><p className="font-display text-xl font-bold tabular-nums sm:text-2xl">{num(totals.units)}</p></div>
            <div className="card p-4"><p className="text-sm font-semibold text-tinta-soft">{tab === 'day' || tab === 'month' ? 'N° de ventas' : 'Ventas'}</p><p className="font-display text-xl font-bold tabular-nums sm:text-2xl">{tab === 'user' || tab === 'category' || tab === 'product' ? '—' : num(totals.sales)}</p></div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="bg-bruma text-left text-sm text-tinta-soft"><tr><th className="px-4 py-2.5">{groupHeader[tab]}</th><th className="px-4 py-2.5 text-right">Ventas</th><th className="px-4 py-2.5 text-right">Unidades</th><th className="px-4 py-2.5 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-linea">
                {groupRows.map((r) => (
                  <tr key={r.group_key}>
                    <td className="px-4 py-3 font-semibold">{tab === 'month' ? r.group_label : fmtLabel(r)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(r.sales_count)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(r.units)}</td>
                    <td className="px-4 py-3 text-right font-display font-bold tabular-nums">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-linea bg-bruma/60 font-bold"><tr><td className="px-4 py-3">Total</td><td /><td className="px-4 py-3 text-right tabular-nums">{num(totals.units)}</td><td className="px-4 py-3 text-right font-display tabular-nums">{money(totals.total)}</td></tr></tfoot>
            </table>
          </div>
          {(tab === 'user' || tab === 'category' || tab === 'product') && <p className="mt-2 text-[13px] text-tinta-soft">Una misma venta puede incluir varios {tab === 'user' ? 'vendedores' : tab === 'category' ? 'categorías' : 'productos'}, por eso no se suman las ventas.</p>}
        </>
      ) : tab === 'stock' ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="card p-4"><p className="text-sm font-semibold text-tinta-soft">Productos</p><p className="font-display text-xl font-bold tabular-nums sm:text-2xl">{num(stockRows.length)}</p></div>
            <div className="card p-4"><p className="text-sm font-semibold text-tinta-soft">Unidades en stock</p><p className="font-display text-xl font-bold tabular-nums sm:text-2xl">{num(stockTotals.units)}</p></div>
            <div className="card p-4"><p className="text-sm font-semibold text-tinta-soft">Valor a precio de venta</p><p className="font-display text-xl font-bold tabular-nums text-pino sm:text-2xl">{money(stockTotals.value)}</p></div>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="bg-bruma text-left text-sm text-tinta-soft"><tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5">Categoría</th><th className="px-4 py-2.5 text-right">Precio</th><th className="px-4 py-2.5 text-right">Stock</th></tr></thead>
              <tbody className="divide-y divide-linea">
                {stockRows.slice(0, 300).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><Link to={`/productos/${r.id}`} className="hover:underline"><CodeTag code={r.code} /><span className="block font-semibold">{r.title}</span></Link></td>
                    <td className="px-4 py-3 text-tinta-soft">{r.category?.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(r.price)}</td>
                    <td className="px-4 py-3 text-right"><StockBadge stock={r.stock} unit={r.unit} status={r.stock_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stockRows.length > 300 && <p className="mt-2 text-[13px] text-tinta-soft">Se muestran los primeros 300 productos. Descarga el Excel para ver los {num(stockRows.length)}.</p>}
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {moveSummary.map(([t, v]) => <span key={t} className="chip !px-3 !py-1.5 bg-white border border-linea text-sm">{MOVEMENT_LABEL[t]}: <b className="ml-1">{num(v.count)}</b>&nbsp;mov. · {v.units > 0 ? '+' : ''}{num(v.units)} u.</span>)}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="bg-bruma text-left text-sm text-tinta-soft"><tr><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5 text-right">Cant.</th><th className="px-4 py-2.5 text-right">Stock</th><th className="px-4 py-2.5">Usuario</th></tr></thead>
              <tbody className="divide-y divide-linea">
                {moveRows.slice(0, 200).map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-tinta-soft">{dateTime(m.created_at)}</td>
                    <td className="px-4 py-3"><CodeTag code={m.product?.code ?? '—'} /><span className="block font-semibold">{m.product?.title}</span></td>
                    <td className="whitespace-nowrap px-4 py-3">{MOVEMENT_LABEL[m.type]}</td>
                    <td className={`px-4 py-3 text-right font-display font-bold tabular-nums ${m.quantity > 0 ? 'text-pino' : 'text-ladrillo'}`}>{m.quantity > 0 ? '+' : ''}{num(m.quantity)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-tinta-soft">{num(m.stock_before)} → <b className="text-tinta">{num(m.stock_after)}</b></td>
                    <td className="px-4 py-3">{m.user?.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {moveRows.length > 200 && <p className="mt-2 text-[13px] text-tinta-soft">Se muestran los primeros 200 de {num(moveRows.length)} movimientos. Descarga el Excel para verlos todos.</p>}
        </>
      )}

      <Modal open={pick} title="Elige un producto" onClose={() => setPick(false)}>
        <ProductPicker autoFocus onSelect={(p) => { setProduct(p); setPick(false) }} />
      </Modal>
    </>
  )
}
