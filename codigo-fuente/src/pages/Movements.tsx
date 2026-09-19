import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dateTime, endOfDayISO, monthStartLP, num, saleNumber, startOfDayISO, todayLP } from '../lib/format'
import { CodeTag, EmptyState, MovementChip, PageHeader, Pagination, Spinner } from '../components/ui'
import { DateRange } from '../components/DateRange'
import type { Movement, MovementType, Profile } from '../lib/types'

const PAGE = 30
const TYPES: { v: '' | MovementType; l: string }[] = [
  { v: '', l: 'Todos los tipos' }, { v: 'inicial', l: 'Stock inicial' }, { v: 'ingreso', l: 'Ingresos' },
  { v: 'venta', l: 'Ventas' }, { v: 'anulacion', l: 'Anulaciones' }, { v: 'ajuste', l: 'Ajustes' },
]

export default function Movements() {
  const { profile } = useAuth()
  const admin = profile!.role === 'admin'
  const [from, setFrom] = useState(monthStartLP())
  const [to, setTo] = useState(todayLP())
  const [type, setType] = useState<'' | MovementType>('')
  const [user, setUser] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Movement[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])

  useEffect(() => {
    if (!admin) return
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'vendedor']).order('full_name')
      .then(({ data }) => setStaff((data ?? []) as Pick<Profile, 'id' | 'full_name'>[]))
  }, [admin])

  useEffect(() => { setPage(0) }, [from, to, type, user])

  useEffect(() => {
    let alive = true
    setLoading(true)
    let q = supabase.from('inventory_movements')
      .select('*, product:products(code, title), user:profiles!created_by(full_name), sale:sales!sale_id(sale_number)', { count: 'exact' })
      .gte('created_at', startOfDayISO(from)).lte('created_at', endOfDayISO(to))
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (type) q = q.eq('type', type)
    if (admin && user) q = q.eq('created_by', user)
    q.then(({ data, count, error: err }) => {
      if (!alive) return
      setLoading(false)
      if (err) { setError('No se pudieron cargar los movimientos.'); return }
      setError('')
      setRows((data ?? []) as unknown as Movement[])
      setTotal(count ?? 0)
    })
    return () => { alive = false }
  }, [page, from, to, type, user, admin])

  return (
    <>
      <PageHeader title="Movimientos de inventario" subtitle={admin ? 'Todo lo que entró y salió del stock, y quién lo hizo.' : 'Los movimientos que hiciste tú.'} />
      <div className="card mb-4 space-y-3 p-4">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div className="flex flex-wrap gap-3">
          <select className="input !w-full sm:!w-56" value={type} onChange={(e) => setType(e.target.value as '' | MovementType)} aria-label="Tipo de movimiento">
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          {admin && (
            <select className="input !w-full sm:!w-56" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Usuario">
              <option value="">Todos los usuarios</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-ladrillo-soft px-4 py-3 font-medium text-ladrillo">{error}</p>}

      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState title="Sin movimientos" text="No hay movimientos con estos filtros." /> : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-linea bg-white md:block">
            <table className="w-full text-[15px]">
              <thead className="bg-bruma text-left text-sm text-tinta-soft">
                <tr><th className="px-4 py-2.5">Fecha</th><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5">Tipo</th><th className="px-4 py-2.5 text-right">Cantidad</th><th className="px-4 py-2.5 text-right">Stock</th><th className="px-4 py-2.5">Usuario</th></tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {rows.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-tinta-soft">{dateTime(m.created_at)}</td>
                    <td className="px-4 py-3"><Link to={`/productos/${m.product_id}`} className="hover:underline"><CodeTag code={m.product?.code ?? '—'} /><span className="mt-0.5 block font-semibold">{m.product?.title}</span></Link>{m.note && <span className="block text-[13px] text-tinta-soft">{m.note}</span>}</td>
                    <td className="px-4 py-3"><MovementChip type={m.type} />{m.sale && m.sale_id && <Link to={`/ventas/${m.sale_id}`} className="mt-1 block text-[13px] font-semibold text-pino hover:underline">Venta {saleNumber(m.sale.sale_number)}</Link>}</td>
                    <td className={`px-4 py-3 text-right font-display text-lg font-bold tabular-nums ${m.quantity > 0 ? 'text-pino' : 'text-ladrillo'}`}>{m.quantity > 0 ? '+' : ''}{num(m.quantity)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-tinta-soft">{num(m.stock_before)} → <b className="text-tinta">{num(m.stock_after)}</b></td>
                    <td className="px-4 py-3">{m.user?.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {rows.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/productos/${m.product_id}`}><CodeTag code={m.product?.code ?? '—'} /><p className="mt-0.5 truncate font-semibold">{m.product?.title}</p></Link>
                  </div>
                  <p className={`font-display text-2xl font-bold tabular-nums ${m.quantity > 0 ? 'text-pino' : 'text-ladrillo'}`}>{m.quantity > 0 ? '+' : ''}{num(m.quantity)}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-tinta-soft">
                  <MovementChip type={m.type} />
                  <span>{num(m.stock_before)} → <b className="text-tinta">{num(m.stock_after)}</b></span>
                </div>
                <p className="mt-1 text-[13px] text-tinta-soft">{dateTime(m.created_at)} · {m.user?.full_name}</p>
                {m.note && <p className="mt-1 text-[14px]">{m.note}</p>}
                {m.sale && m.sale_id && <Link to={`/ventas/${m.sale_id}`} className="mt-1 inline-block text-[14px] font-semibold text-pino">Ver venta {saleNumber(m.sale.sale_number)}</Link>}
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE} total={total} onChange={setPage} />
        </>
      )}
    </>
  )
}
