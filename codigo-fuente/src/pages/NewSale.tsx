import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CheckCircle2, CreditCard, Loader2, Minus, Plus, QrCode, ShoppingCart, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { money, num, PAYMENT_LABEL, saleNumber, unitText } from '../lib/format'
import { CodeTag, PageHeader, Thumb } from '../components/ui'
import { ProductPicker, type PickerProduct } from '../components/ProductPicker'
import type { PaymentMethod, Sale } from '../lib/types'

interface Line { p: PickerProduct; qty: number; discount: string }

const PAY: { v: PaymentMethod; icon: typeof Banknote }[] = [
  { v: 'efectivo', icon: Banknote },
  { v: 'qr', icon: QrCode },
  { v: 'tarjeta', icon: CreditCard },
  { v: 'otro', icon: Wallet },
]

export default function NewSale() {
  const toast = useToast()
  const [lines, setLines] = useState<Line[]>([])
  const [pay, setPay] = useState<PaymentMethod | ''>('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Sale | null>(null)

  const add = (p: PickerProduct) => {
    setLines((prev) => (prev.some((l) => l.p.id === p.id) ? prev : [...prev, { p, qty: 1, discount: '' }]))
  }
  const setQty = (id: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.p.id === id ? { ...l, qty: Math.max(1, Math.min(l.p.stock, Math.floor(qty) || 1)) } : l)))
  const setDisc = (id: string, discount: string) =>
    setLines((prev) => prev.map((l) => (l.p.id === id ? { ...l, discount } : l)))
  const remove = (id: string) => setLines((prev) => prev.filter((l) => l.p.id !== id))

  const calc = useMemo(() => {
    let subtotal = 0
    let discount = 0
    let invalid = false
    const rows = lines.map((l) => {
      const gross = l.qty * l.p.price
      const d = Number(l.discount || 0)
      if (!Number.isFinite(d) || d < 0 || d > gross) invalid = true
      const disc = Number.isFinite(d) && d >= 0 && d <= gross ? d : 0
      subtotal += gross
      discount += disc
      return { gross, disc, net: gross - disc }
    })
    return { rows, subtotal, discount, total: subtotal - discount, invalid }
  }, [lines])

  const units = lines.reduce((s, l) => s + l.qty, 0)
  const canConfirm = lines.length > 0 && !!pay && !calc.invalid && !busy

  const confirm = async () => {
    if (!canConfirm) return
    setBusy(true)
    const items = lines.map((l, i) => ({ product_id: l.p.id, quantity: l.qty, discount: calc.rows[i].disc }))
    const { data, error } = await supabase.rpc('create_sale', { p_payment_method: pay, p_notes: notes, p_items: items })
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    setDone(data as Sale)
    toast.ok('Venta registrada')
  }

  const reset = () => { setLines([]); setPay(''); setNotes(''); setDone(null) }

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-pino" />
          <h1 className="mt-3 text-2xl font-bold">¡Venta registrada!</h1>
          <p className="mt-1 text-tinta-soft">Venta {saleNumber(done.sale_number)} · {PAYMENT_LABEL[done.payment_method]}</p>
          <p className="mt-4 font-display text-4xl font-bold tabular-nums text-pino">{money(done.total)}</p>
          <p className="mt-1 text-sm text-tinta-soft">El stock ya fue descontado.</p>
          <div className="mt-6 flex flex-col gap-2">
            <button className="btn btn-accent" onClick={reset}><ShoppingCart className="h-5 w-5" /> Registrar otra venta</button>
            <Link to={`/ventas/${done.id}`} className="btn btn-secondary">Ver detalle de la venta</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Nueva venta" subtitle="Agrega los productos, elige cómo paga el cliente y confirma." />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div>
          <h2 className="mb-2 text-lg font-bold">1. Agrega productos</h2>
          <ProductPicker onSelect={add} requireStock excludeIds={lines.map((l) => l.p.id)} />
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="mb-2 text-lg font-bold">2. Detalle de la venta</h2>
          <div className="card">
            {lines.length === 0 ? (
              <p className="px-5 py-10 text-center text-[15px] text-tinta-soft">Todavía no agregaste productos.</p>
            ) : (
              <ul className="divide-y divide-linea">
                {lines.map((l, i) => (
                  <li key={l.p.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Thumb path={l.p.primary_image_path} size={48} />
                      <div className="min-w-0 flex-1">
                        <CodeTag code={l.p.code} />
                        <p className="mt-0.5 truncate font-semibold">{l.p.title}</p>
                        <p className="text-[13px] text-tinta-soft">{money(l.p.price)} c/u · disponibles: {num(l.p.stock)} {unitText(l.p.unit, l.p.stock)}</p>
                      </div>
                      <button onClick={() => remove(l.p.id)} aria-label={`Quitar ${l.p.code}`} className="rounded-lg p-2 text-ladrillo hover:bg-ladrillo-soft"><Trash2 className="h-5 w-5" /></button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-lg border border-linea">
                        <button className="flex h-11 w-11 items-center justify-center hover:bg-bruma disabled:opacity-40" onClick={() => setQty(l.p.id, l.qty - 1)} disabled={l.qty <= 1} aria-label="Menos"><Minus className="h-4 w-4" /></button>
                        <input className="h-11 w-14 border-x border-linea text-center font-display text-lg font-bold" type="number" inputMode="numeric" min={1} max={l.p.stock} value={l.qty} onChange={(e) => setQty(l.p.id, Number(e.target.value))} aria-label="Cantidad" />
                        <button className="flex h-11 w-11 items-center justify-center hover:bg-bruma disabled:opacity-40" onClick={() => setQty(l.p.id, l.qty + 1)} disabled={l.qty >= l.p.stock} aria-label="Más"><Plus className="h-4 w-4" /></button>
                      </div>
                      <label className="flex items-center gap-1.5 text-sm text-tinta-soft">
                        Descuento
                        <input className="input !w-24 !min-h-[44px]" type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" value={l.discount} onChange={(e) => setDisc(l.p.id, e.target.value)} />
                      </label>
                      <p className="ml-auto font-display text-lg font-bold tabular-nums">{money(calc.rows[i].net)}</p>
                    </div>
                    {Number(l.discount || 0) > calc.rows[i].gross && <p className="mt-1 text-[13px] font-medium text-ladrillo">El descuento no puede ser mayor al subtotal ({money(calc.rows[i].gross)}).</p>}
                  </li>
                ))}
              </ul>
            )}

            {lines.length > 0 && (
              <div className="border-t border-linea p-4">
                <dl className="space-y-1 text-[15px]">
                  <div className="flex justify-between"><dt className="text-tinta-soft">Productos ({num(units)})</dt><dd className="tabular-nums">{money(calc.subtotal)}</dd></div>
                  {calc.discount > 0 && <div className="flex justify-between"><dt className="text-tinta-soft">Descuento</dt><dd className="tabular-nums text-ladrillo">− {money(calc.discount)}</dd></div>}
                  <div className="flex items-baseline justify-between pt-1"><dt className="font-bold">Total</dt><dd className="font-display text-3xl font-bold tabular-nums text-pino">{money(calc.total)}</dd></div>
                </dl>

                <p className="label mt-5">Método de pago</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAY.map(({ v, icon: Icon }) => (
                    <button key={v} type="button" onClick={() => setPay(v)} aria-pressed={pay === v}
                      className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg border text-[15px] font-semibold transition-colors ${pay === v ? 'border-pino bg-pino text-white' : 'border-linea bg-white hover:bg-bruma'}`}>
                      <Icon className="h-5 w-5" /> {PAYMENT_LABEL[v]}
                    </button>
                  ))}
                </div>

                <label className="mt-4 block">
                  <span className="label">Observaciones (opcional)</span>
                  <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: cliente pide factura" />
                </label>

                <button className="btn btn-accent mt-5 w-full !min-h-[52px] text-base" disabled={!canConfirm} onClick={confirm}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Confirmar venta · {money(calc.total)}
                </button>
                {!pay && <p className="mt-2 text-center text-[13px] text-tinta-soft">Elige el método de pago para confirmar.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
