import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { dateTime, endOfDayISO, money, monthStartLP, PAYMENT_LABEL, saleNumber, startOfDayISO, todayLP } from '../lib/format'
import { EmptyState, PageHeader, Pagination, SaleStatusChip, Spinner } from '../components/ui'
import { DateRange } from '../components/DateRange'
import type { Profile, Sale } from '../lib/types'

const PAGE = 25

export default function Sales() {
  const { profile } = useAuth()
  const admin = profile!.role === 'admin'
  const [params, setParams] = useSearchParams()
  const status = (params.get('estado') ?? '') as '' | 'anulada' | 'completada'
  const [from, setFrom] = useState(monthStartLP())
  const [to, setTo] = useState(todayLP())
  const [user, setUser] = useState('')
  const [numQ, setNumQ] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [sum, setSum] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [staff, setStaff] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])

  useEffect(() => {
    if (!admin) return
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'vendedor']).order('full_name')
      .then(({ data }) => setStaff((data ?? []) as Pick<Profile, 'id' | 'full_name'>[]))
  }, [admin])

  useEffect(() => { setPage(0) }, [from, to, user, status, numQ])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const n = Number(numQ.replace(/\D/g, ''))
    let q = supabase.from('sales')
      .select('*, seller:profiles!created_by(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (numQ.trim() && n > 0) q = q.eq('sale_number', n)
    else q = q.gte('created_at', startOfDayISO(from)).lte('created_at', endOfDayISO(to))
    if (status) q = q.eq('status', status)
    if (admin && user) q = q.eq('created_by', user)
    q.then(({ data, count, error: err }) => {
      if (!alive) return
      setLoading(false)
      if (err) { setError('No se pudieron cargar las ventas.'); return }
      setError('')
      const list = (data ?? []) as unknown as Sale[]
      setRows(list)
      setTotal(count ?? 0)
      setSum(list.filter((s) => s.status === 'completada').reduce((a, s) => a + Number(s.total), 0))
    })
    return () => { alive = false }
  }, [page, from, to, user, status, numQ, admin])

  const title = status === 'anulada' ? 'Anulaciones' : admin ? 'Ventas' : 'Mis ventas'

  return (
    <>
      <PageHeader
        title={title}
        subtitle={status === 'anulada' ? 'Ventas que fueron anuladas. El stock ya volvió al inventario.' : admin ? 'Todas las ventas del negocio.' : 'Solo aparecen las ventas que hiciste tú.'}
        actions={<Link to="/ventas/nueva" className="btn btn-accent"><Plus className="h-5 w-5" /> Nueva venta</Link>}
      />

      <div className="card mb-4 space-y-3 p-4">
        <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div className="flex flex-wrap gap-3">
          <input className="input !w-full sm:!w-48" inputMode="numeric" placeholder="N° de venta" value={numQ} onChange={(e) => setNumQ(e.target.value)} aria-label="Buscar por número de venta" />
          {admin && (
            <select className="input !w-full sm:!w-56" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Vendedor">
              <option value="">Todos los vendedores</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          )}
          <select className="input !w-full sm:!w-48" value={status} onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) p.set('estado', e.target.value); else p.delete('estado'); setParams(p) }} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="completada">Completadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-ladrillo-soft px-4 py-3 font-medium text-ladrillo">{error}</p>}

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title="No hay ventas con estos filtros" text="Prueba con otro rango de fechas." />
      ) : (
        <>
          <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-white">
            {rows.map((s) => (
              <li key={s.id}>
                <Link to={`/ventas/${s.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-pino-soft/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold tabular-nums">{saleNumber(s.sale_number)}</span>
                      <SaleStatusChip status={s.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[14px] text-tinta-soft">{dateTime(s.created_at)} · {s.seller?.full_name} · {PAYMENT_LABEL[s.payment_method]}</p>
                  </div>
                  <p className={`font-display text-lg font-bold tabular-nums ${s.status === 'anulada' ? 'text-tinta-soft line-through' : ''}`}>{money(s.total)}</p>
                  <ChevronRight className="h-5 w-5 shrink-0 text-linea" />
                </Link>
              </li>
            ))}
          </ul>
          {sum !== null && <p className="mt-3 text-right text-[15px] text-tinta-soft">Total de esta página (sin anuladas): <b className="font-display text-tinta">{money(sum)}</b></p>}
          <Pagination page={page} pageSize={PAGE} total={total} onChange={setPage} />
        </>
      )}
    </>
  )
}
