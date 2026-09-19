import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Ban, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'
import { friendlyError } from '../lib/errors'
import { dateTime, money, num, PAYMENT_LABEL, saleNumber } from '../lib/format'
import { ConfirmDialog, EmptyState, Field, PageHeader, SaleStatusChip, Spinner } from '../components/ui'
import type { Sale, SaleItem } from '../lib/types'

export default function SaleDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()
  const admin = profile!.role === 'admin'
  const [sale, setSale] = useState<Sale | null>(null)
  const [items, setItems] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [askCancel, setAskCancel] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, i] = await Promise.all([
      supabase.from('sales')
        .select('*, seller:profiles!created_by(full_name), canceller:profiles!cancelled_by(full_name)')
        .eq('id', id!).maybeSingle(),
      supabase.from('sale_items').select('*').eq('sale_id', id!).order('product_code'),
    ])
    setSale((s.data as unknown as Sale) ?? null)
    setItems((i.data ?? []) as SaleItem[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const cancel = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('cancel_sale', { p_sale_id: id, p_reason: reason })
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok('Venta anulada. El stock fue devuelto al inventario.')
    setAskCancel(false); setReason('')
    load()
  }

  if (loading) return <Spinner />
  if (!sale) return <EmptyState title="No encontramos esta venta" text="Puede que no exista o que no tengas permiso para verla." action={<Link to="/ventas" className="btn btn-primary">Volver a ventas</Link>} />

  const units = items.reduce((s, i) => s + i.quantity, 0)

  return (
    <>
      <PageHeader
        back={{ to: '/ventas', label: 'Ventas' }}
        title={`Venta ${saleNumber(sale.sale_number)}`}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><SaleStatusChip status={sale.status} />{dateTime(sale.created_at)}</span>}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => window.print()}><Printer className="h-5 w-5" /> Imprimir</button>
            {admin && sale.status === 'completada' && <button className="btn btn-danger" onClick={() => setAskCancel(true)}><Ban className="h-5 w-5" /> Anular venta</button>}
          </>
        }
      />

      <div className="hidden print:block mb-4"><p className="font-display text-xl font-bold">{settings.business_name}</p></div>

      {sale.status === 'anulada' && (
        <div className="mb-4 rounded-xl border border-ladrillo/30 bg-ladrillo-soft p-4 text-[15px]">
          <p className="font-bold text-ladrillo">Esta venta fue anulada</p>
          <p className="mt-1">{dateTime(sale.cancelled_at)} · por {sale.canceller?.full_name ?? '—'}</p>
          {sale.cancel_reason && <p className="mt-1">Motivo: {sale.cancel_reason}</p>}
          <p className="mt-1 text-tinta-soft">Las cantidades ya volvieron al stock. El registro se conserva como historial.</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <ul className="divide-y divide-linea">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link to={`/productos/${i.product_id}`} className="code-tag">{i.product_code}</Link>
                  <p className="mt-0.5 font-semibold">{i.product_title}</p>
                  <p className="text-[14px] text-tinta-soft">{num(i.quantity)} × {money(i.unit_price)}{Number(i.discount) > 0 && <span className="text-ladrillo"> · descuento − {money(i.discount)}</span>}</p>
                </div>
                <p className="font-display text-lg font-bold tabular-nums">{money(i.line_total)}</p>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-linea bg-bruma/60 px-4 py-4">
            <span className="font-bold">Total</span>
            <span className={`font-display text-3xl font-bold tabular-nums ${sale.status === 'anulada' ? 'text-tinta-soft line-through' : 'text-pino'}`}>{money(sale.total)}</span>
          </div>
        </div>

        <aside className="card h-fit p-5">
          <dl className="space-y-3 text-[15px]">
            <div><dt className="text-sm text-tinta-soft">Vendedor</dt><dd className="font-semibold">{sale.seller?.full_name ?? '—'}</dd></div>
            <div><dt className="text-sm text-tinta-soft">Método de pago</dt><dd className="font-semibold">{PAYMENT_LABEL[sale.payment_method]}</dd></div>
            <div><dt className="text-sm text-tinta-soft">Productos</dt><dd className="font-semibold">{items.length} ({num(units)} en total)</dd></div>
            {Number(sale.discount_total) > 0 && <div><dt className="text-sm text-tinta-soft">Descuento total</dt><dd className="font-semibold">{money(sale.discount_total)}</dd></div>}
            {sale.notes && <div><dt className="text-sm text-tinta-soft">Observaciones</dt><dd>{sale.notes}</dd></div>}
          </dl>
        </aside>
      </div>

      <ConfirmDialog
        open={askCancel}
        danger
        busy={busy}
        title="¿Anular esta venta?"
        confirmText="Sí, anular venta"
        onCancel={() => setAskCancel(false)}
        onConfirm={cancel}
        message={
          <div className="space-y-3">
            <p>La venta {saleNumber(sale.sale_number)} quedará como <b>anulada</b> y las {num(units)} unidades volverán al stock. Esta acción no se puede deshacer.</p>
            <Field label="Motivo (opcional)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: el cliente devolvió los productos" /></Field>
          </div>
        }
      />
    </>
  )
}
