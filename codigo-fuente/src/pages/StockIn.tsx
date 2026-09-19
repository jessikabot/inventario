import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, PackagePlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { dateTime, num, unitText } from '../lib/format'
import { CodeTag, EmptyState, Field, PageHeader, StockBadge, Thumb } from '../components/ui'
import { ProductPicker, type PickerProduct } from '../components/ProductPicker'
import type { Movement } from '../lib/types'

export default function StockIn() {
  const toast = useToast()
  const [params] = useSearchParams()
  const [product, setProduct] = useState<PickerProduct | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<Movement[]>([])

  const loadRecent = useCallback(async () => {
    const { data } = await supabase
      .from('inventory_movements')
      .select('*, product:products(code, title), user:profiles!created_by(full_name)')
      .in('type', ['ingreso', 'inicial'])
      .order('created_at', { ascending: false })
      .limit(8)
    setRecent((data ?? []) as unknown as Movement[])
  }, [])

  useEffect(() => { loadRecent() }, [loadRecent])

  useEffect(() => {
    const pid = params.get('producto')
    if (!pid) return
    supabase.from('products')
      .select('id, code, title, price, stock, min_stock, unit, stock_status, active, primary_image_path').eq('id', pid).maybeSingle()
      .then(({ data }) => data && setProduct(data as unknown as PickerProduct))
  }, [params])

  const qtyNum = Number(qty)
  const valid = Number.isInteger(qtyNum) && qtyNum > 0

  const submit = async () => {
    if (!product || !valid) return
    setBusy(true)
    const { error } = await supabase.rpc('add_stock', { p_product_id: product.id, p_quantity: qtyNum, p_note: note })
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok(`Ingreso registrado: ${product.code} pasa de ${num(product.stock)} a ${num(product.stock + qtyNum)}`)
    setProduct(null); setQty(''); setNote('')
    loadRecent()
  }

  return (
    <>
      <PageHeader title="Ingreso de mercadería" subtitle="Busca el producto, indica cuántas unidades llegaron y confirma." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          {!product ? (
            <div>
              <h2 className="mb-2 text-lg font-bold">1. Elige el producto</h2>
              <ProductPicker onSelect={(p) => setProduct(p)} autoFocus />
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-start gap-3">
                <Thumb path={product.primary_image_path} size={64} />
                <div className="min-w-0 flex-1">
                  <CodeTag code={product.code} />
                  <p className="mt-0.5 font-semibold">{product.title}</p>
                  <div className="mt-1"><StockBadge stock={product.stock} unit={product.unit} status={product.stock_status} /></div>
                </div>
                <button onClick={() => setProduct(null)} aria-label="Cambiar producto" className="rounded-lg p-2 text-tinta-soft hover:bg-bruma"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-5 space-y-4">
                <Field label={`Cantidad que ingresa (${unitText(product.unit, 2)})`}>
                  <input className="input !min-h-[56px] !text-2xl font-display font-bold" type="number" inputMode="numeric" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                </Field>
                {valid && <p className="rounded-lg bg-pino-soft px-4 py-3 text-[15px]">Stock: <b>{num(product.stock)}</b> + <b>{num(qtyNum)}</b> = <b className="font-display text-lg">{num(product.stock + qtyNum)}</b></p>}
                <Field label="Observación (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pedido de Miami, lote 3" /></Field>
                <button className="btn btn-primary w-full" disabled={!valid || busy} onClick={submit}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackagePlus className="h-5 w-5" />}Confirmar ingreso
                </button>
              </div>
            </div>
          )}
        </div>

        <aside>
          <h2 className="mb-2 text-lg font-bold">Últimos ingresos</h2>
          {recent.length === 0 ? <EmptyState title="Sin ingresos todavía" /> : (
            <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-white">
              {recent.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/productos/${m.product_id}`} className="block truncate font-semibold hover:underline">{m.product?.code} · {m.product?.title}</Link>
                    <p className="text-[13px] text-tinta-soft">{dateTime(m.created_at)} · {m.user?.full_name}</p>
                  </div>
                  <p className="font-display text-lg font-bold text-pino tabular-nums">+{num(m.quantity)}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  )
}
