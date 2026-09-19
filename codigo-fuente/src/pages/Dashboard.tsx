import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/permissions'
import { money, monthStartLP, num, todayLP, TZ } from '../lib/format'
import { CodeTag, PageHeader, Spinner, StockBadge, Thumb } from '../components/ui'
import { BarList } from '../components/BarList'
import { DateRange } from '../components/DateRange'
import type { GroupRow, ProductRow } from '../lib/types'

const norm = (r: any): GroupRow => ({ ...r, sales_count: Number(r.sales_count), units: Number(r.units), total: Number(r.total) })

async function group(g: string, from: string, to: string): Promise<GroupRow[]> {
  const { data, error } = await supabase.rpc('rpt_sales_group', { p_group: g, p_from: from, p_to: to })
  if (error) throw error
  return ((data ?? []) as any[]).map(norm)
}

function Kpi({ title, value, lines, tone = 'plain' }: { title: string; value: string; lines: string[]; tone?: 'plain' | 'primary' }) {
  return (
    <div className={`rounded-xl p-5 ${tone === 'primary' ? 'bg-pino text-white' : 'card'}`}>
      <p className={`text-[15px] font-semibold ${tone === 'primary' ? 'text-white/80' : 'text-tinta-soft'}`}>{title}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl">{value}</p>
      {lines.map((l) => <p key={l} className={`mt-0.5 text-[15px] ${tone === 'primary' ? 'text-white/80' : 'text-tinta-soft'}`}>{l}</p>)}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-ladrillo' : tone === 'warn' ? 'text-etiqueta-dark' : 'text-tinta'
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-tinta-soft">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold tabular-nums ${color}`}>{num(value)}</p>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const role = profile!.role
  const staff = isStaff(role)
  const admin = role === 'admin'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [today, setToday] = useState<GroupRow | null>(null)
  const [month, setMonth] = useState<GroupRow | null>(null)
  const [inv, setInv] = useState({ total: 0, withStock: 0, low: 0, out: 0 })
  const [alerts, setAlerts] = useState<ProductRow[]>([])
  const [from, setFrom] = useState(monthStartLP())
  const [to, setTo] = useState(todayLP())
  const [byUser, setByUser] = useState<GroupRow[]>([])
  const [byProduct, setByProduct] = useState<GroupRow[]>([])
  const [byCat, setByCat] = useState<GroupRow[]>([])
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const count = (q: any) => q.then((r: any) => r.count ?? 0)
        const base = () => supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true)
        const [t, m, total, withStock, low, out, alertRows] = await Promise.all([
          staff ? group('all', todayLP(), todayLP()) : Promise.resolve([]),
          staff ? group('all', monthStartLP(), todayLP()) : Promise.resolve([]),
          count(base()),
          count(base().neq('stock_status', 'sin_stock')),
          count(base().eq('stock_status', 'bajo')),
          count(base().eq('stock_status', 'sin_stock')),
          supabase.from('products')
            .select('id, code, title, price, stock, min_stock, unit, stock_status, active, primary_image_path, category:categories(name)')
            .eq('active', true).in('stock_status', ['bajo', 'sin_stock']).order('stock').order('code').limit(8),
        ])
        if (!alive) return
        setToday(t[0] ?? null)
        setMonth(m[0] ?? null)
        setInv({ total, withStock, low, out })
        setAlerts((alertRows.data ?? []) as unknown as ProductRow[])
      } catch {
        if (alive) setError('No se pudo cargar el resumen. Revisa tu conexión.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [staff])

  useEffect(() => {
    if (!staff) return
    let alive = true
    setLoadingPeriod(true)
    Promise.all([
      admin ? group('user', from, to) : Promise.resolve([]),
      group('product', from, to),
      group('category', from, to),
    ]).then(([u, p, c]) => {
      if (!alive) return
      setByUser(u.sort((a, b) => b.total - a.total))
      setByProduct(p.sort((a, b) => b.units - a.units).slice(0, 8))
      setByCat(c.sort((a, b) => b.total - a.total))
    }).catch(() => alive && setError('No se pudo cargar el detalle de ventas.'))
      .finally(() => alive && setLoadingPeriod(false))
    return () => { alive = false }
  }, [from, to, staff, admin])

  const first = (profile!.full_name || '').split(' ')[0]
  const dateText = new Date().toLocaleDateString('es-BO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
  const who = admin ? '' : 'tus '

  if (loading) return <Spinner />

  return (
    <>
      <PageHeader title={first ? `Hola, ${first}` : 'Inicio'} subtitle={<span className="capitalize">{dateText}</span>} />
      {error && <p className="mb-4 rounded-lg bg-ladrillo-soft px-4 py-3 text-sm font-medium text-ladrillo" role="alert">{error}</p>}

      {staff && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Ventas">
          <Kpi tone="primary" title={admin ? 'Ventas de hoy' : 'Tus ventas de hoy'} value={money(today?.total ?? 0)}
            lines={[`${num(today?.sales_count ?? 0)} ventas`, `${num(today?.units ?? 0)} productos vendidos`]} />
          <Kpi title={admin ? 'Ventas del mes' : 'Tus ventas del mes'} value={money(month?.total ?? 0)}
            lines={[`${num(month?.sales_count ?? 0)} ventas`, `${num(month?.units ?? 0)} productos vendidos`]} />
        </section>
      )}

      <section className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${staff ? 'mt-4' : ''}`} aria-label="Inventario">
        <Stat label="Productos" value={inv.total} />
        <Stat label="Con stock" value={inv.withStock} />
        <Stat label="Stock bajo" value={inv.low} tone="warn" />
        <Stat label="Sin stock" value={inv.out} tone="bad" />
      </section>

      <section className="card mt-4" aria-label="Productos por reponer">
        <div className="flex items-center gap-2 border-b border-linea px-5 py-4">
          <AlertTriangle className="h-5 w-5 text-etiqueta-dark" />
          <h2 className="text-lg font-bold">Productos por reponer</h2>
        </div>
        {alerts.length === 0 ? (
          <p className="px-5 py-8 text-center text-[15px] text-tinta-soft">Todo el inventario está con buen stock.</p>
        ) : (
          <ul className="divide-y divide-linea">
            {alerts.map((p) => (
              <li key={p.id}>
                <Link to={`/productos/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-pino-soft/40">
                  <Thumb path={p.primary_image_path} size={44} />
                  <div className="min-w-0 flex-1">
                    <CodeTag code={p.code} />
                    <p className="truncate font-semibold">{p.title}</p>
                  </div>
                  <StockBadge stock={p.stock} unit={p.unit} status={p.stock_status} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-tinta-soft" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {inv.low + inv.out > alerts.length && (
          <div className="border-t border-linea px-5 py-3 text-sm">
            <Link to="/reportes" className="font-semibold text-pino hover:underline">Ver todos en el reporte de stock</Link>
          </div>
        )}
      </section>

      {staff && (
        <section className="mt-8" aria-label="Detalle de ventas">
          <h2 className="mb-3 text-xl font-bold">Detalle de {who}ventas</h2>
          <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          <div className={`mt-4 grid gap-4 ${admin ? 'lg:grid-cols-2' : 'lg:grid-cols-2'} ${loadingPeriod ? 'opacity-60' : ''}`}>
            {admin && (
              <div className="card p-5">
                <h3 className="mb-4 text-lg font-bold">Ventas por usuario</h3>
                <BarList rows={byUser.map((r) => ({ label: r.group_label, value: r.total, text: money(r.total), sub: `${num(r.sales_count)} ventas` }))} />
              </div>
            )}
            <div className="card p-5">
              <h3 className="mb-4 text-lg font-bold">Productos más vendidos</h3>
              <BarList rows={byProduct.map((r) => ({ label: r.group_label.replace(/\s{2,}/, ' · '), value: r.units, text: `${num(r.units)} unid.`, sub: money(r.total) }))} />
            </div>
            <div className={`card p-5 ${admin ? 'lg:col-span-2' : ''}`}>
              <h3 className="mb-4 text-lg font-bold">Ventas por categoría</h3>
              <BarList rows={byCat.map((r) => ({ label: r.group_label, value: r.total, text: money(r.total), sub: `${num(r.units)} unidades` }))} />
            </div>
          </div>
        </section>
      )}
    </>
  )
}
