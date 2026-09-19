import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink, PackagePlus, Pencil, Power, SlidersHorizontal, Loader2 } from 'lucide-react'
import { supabase, imageUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { canEditProduct, isStaff } from '../lib/permissions'
import { friendlyError } from '../lib/errors'
import { dateTime, money, num, saleNumber, unitText, UNIT_LABEL } from '../lib/format'
import { CodeTag, ConfirmDialog, EmptyState, Field, Modal, MovementChip, PageHeader, Spinner, StockBadge, Thumb } from '../components/ui'
import type { Movement, Product, ProductImage } from '../lib/types'

interface Detail extends Product {
  category: { id: string; name: string; code: string } | null
  creator: { full_name: string } | null
  images: ProductImage[]
}

export default function ProductDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const toast = useToast()
  const [p, setP] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [moves, setMoves] = useState<Movement[]>([])
  const [sel, setSel] = useState(0)
  const [modal, setModal] = useState<'ingreso' | 'ajuste' | 'estado' | null>(null)
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const role = profile!.role
  const staff = isStaff(role)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(id, name, code), creator:profiles!created_by(full_name), images:product_images(id, product_id, storage_path, is_primary, created_at)')
      .eq('id', id!)
      .maybeSingle()
    if (!data) { setNotFound(true); setLoading(false); return }
    const d = data as unknown as Detail
    d.images = [...(d.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.created_at.localeCompare(b.created_at))
    setP(d)
    setLoading(false)
    if (staff) {
      const m = await supabase
        .from('inventory_movements')
        .select('*, user:profiles!created_by(full_name), sale:sales(sale_number)')
        .eq('product_id', id!)
        .order('created_at', { ascending: false })
        .limit(15)
      setMoves((m.data ?? []) as unknown as Movement[])
    }
  }, [id, staff])

  useEffect(() => { setLoading(true); setNotFound(false); load() }, [load])

  const close = () => { setModal(null); setQty(''); setNote('') }

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, okMsg: string) => {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok(okMsg)
    close()
    load()
  }

  if (loading) return <Spinner />
  if (notFound || !p) return <EmptyState title="No se encontró el producto" text="Puede que el enlace sea incorrecto." action={<Link to="/productos" className="btn btn-primary">Volver a productos</Link>} />

  const canEdit = canEditProduct(role, p.created_by, profile!.id)
  const main = p.images[sel] ?? p.images[0]
  const mainUrl = imageUrl(main?.storage_path)
  const validLink = p.link && /^https?:\/\//i.test(p.link)
  const qtyNum = Number(qty)

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-linea py-2.5 last:border-0 sm:grid-cols-[170px_1fr]">
      <dt className="text-[15px] text-tinta-soft">{k}</dt>
      <dd className="min-w-0 break-words text-[15px] font-medium">{v}</dd>
    </div>
  )

  return (
    <>
      <PageHeader
        back={{ to: '/productos', label: 'Productos' }}
        title={p.title}
        subtitle={<div className="mt-1 flex flex-wrap items-center gap-2"><CodeTag code={p.code} large />{!p.active && <span className="chip bg-bruma text-tinta-soft">Desactivado</span>}</div>}
        actions={
          <>
            {staff && p.active && <button className="btn btn-accent" onClick={() => setModal('ingreso')}><PackagePlus className="h-5 w-5" />Ingresar mercadería</button>}
            {canEdit && <Link to={`/productos/${p.id}/editar`} className="btn btn-secondary"><Pencil className="h-5 w-5" />Editar</Link>}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <div className="card overflow-hidden">
            {mainUrl ? (
              <a href={mainUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir imagen en tamaño completo">
                <img src={mainUrl} alt={p.title} className="aspect-square w-full bg-bruma object-contain" />
              </a>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-bruma text-linea"><Thumb path={null} size={120} className="!border-0 !bg-transparent" /></div>
            )}
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {p.images.map((im, i) => (
                <button key={im.id} onClick={() => setSel(i)} aria-label={`Ver imagen ${i + 1}`} className={`rounded-lg ${i === sel ? 'ring-2 ring-pino ring-offset-2' : ''}`}>
                  <Thumb path={im.storage_path} size={64} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[15px] text-tinta-soft">Precio</p>
                <p className="font-display text-4xl font-bold tabular-nums">{money(p.price)}</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] text-tinta-soft">Stock actual</p>
                <p className="font-display text-4xl font-bold tabular-nums">{num(p.stock)} <span className="text-lg font-semibold text-tinta-soft">{unitText(p.unit, p.stock)}</span></p>
                <div className="mt-1"><StockBadge stock={p.stock} unit={p.unit} status={p.stock_status} /></div>
              </div>
            </div>
            {role === 'admin' && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-linea pt-4">
                <button className="btn btn-secondary btn-sm" onClick={() => setModal('ajuste')}><SlidersHorizontal className="h-4 w-4" />Ajustar stock</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setModal('estado')}><Power className="h-4 w-4" />{p.active ? 'Desactivar producto' : 'Activar producto'}</button>
              </div>
            )}
          </div>

          <dl className="card px-5 py-2">
            <Row k="Categoría" v={p.category ? <Link to={`/categorias/${p.category.id}`} className="text-pino hover:underline">{p.category.name}</Link> : '—'} />
            <Row k="Unidad" v={UNIT_LABEL[p.unit]} />
            <Row k="Stock mínimo" v={p.min_stock > 0 ? num(p.min_stock) : 'No definido'} />
            <Row k="Etiqueta" v={p.label || '—'} />
            <Row k="Link" v={validLink ? <a href={p.link!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-pino hover:underline">{p.link}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a> : (p.link || '—')} />
            <Row k="Descripción" v={p.description ? <span className="whitespace-pre-line">{p.description}</span> : '—'} />
            <Row k="Observaciones" v={p.notes ? <span className="whitespace-pre-line">{p.notes}</span> : '—'} />
            <Row k="Registrado por" v={`${p.creator?.full_name || '—'} · ${dateTime(p.created_at)}`} />
            <Row k="Última modificación" v={dateTime(p.updated_at)} />
          </dl>
        </div>
      </div>

      {staff && (
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold">Movimientos de este producto</h2>
          {moves.length === 0 ? (
            <EmptyState title="Sin movimientos" text="Aquí aparecerán los ingresos, ventas y ajustes." />
          ) : (
            <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-white">
              {moves.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <MovementChip type={m.type} />
                      {m.sale && m.sale_id && <Link to={`/ventas/${m.sale_id}`} className="text-sm font-semibold text-pino hover:underline">Venta {saleNumber(m.sale.sale_number)}</Link>}
                    </div>
                    <p className="mt-0.5 text-sm text-tinta-soft">{dateTime(m.created_at)} · {m.user?.full_name ?? '—'}</p>
                    {m.note && <p className="text-sm">{m.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-lg font-bold tabular-nums ${m.quantity < 0 ? 'text-ladrillo' : 'text-pino'}`}>{m.quantity > 0 ? '+' : ''}{num(m.quantity)}</p>
                    <p className="text-[13px] text-tinta-soft">{num(m.stock_before)} → {num(m.stock_after)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-tinta-soft">{role === 'admin' ? 'Se muestran los últimos 15 movimientos. ' : 'Solo ves los movimientos que tú registraste. '}<Link to="/movimientos" className="font-semibold text-pino hover:underline">Ver todos</Link></p>
        </section>
      )}

      <Modal
        open={modal === 'ingreso'}
        title="Ingresar mercadería"
        onClose={close}
        footer={<>
          <button className="btn btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !Number.isInteger(qtyNum) || qtyNum <= 0}
            onClick={() => run(() => supabase.rpc('add_stock', { p_product_id: p.id, p_quantity: qtyNum, p_note: note }), `Ingreso registrado: +${qtyNum}`)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Confirmar ingreso
          </button>
        </>}
      >
        <p className="mb-4 text-[15px]">Stock actual de <b>{p.code}</b>: <b>{num(p.stock)}</b>. {Number.isInteger(qtyNum) && qtyNum > 0 && <>Quedará en <b>{num(p.stock + qtyNum)}</b>.</>}</p>
        <div className="space-y-4">
          <Field label="Cantidad que ingresa"><input className="input" type="number" inputMode="numeric" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
          <Field label="Observación (opcional)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: pedido de Miami, lote 3" /></Field>
        </div>
      </Modal>

      <Modal
        open={modal === 'ajuste'}
        title="Ajustar stock"
        onClose={close}
        footer={<>
          <button className="btn btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !Number.isInteger(qtyNum) || qty === '' || qtyNum < 0 || !note.trim()}
            onClick={() => run(() => supabase.rpc('adjust_stock', { p_product_id: p.id, p_new_stock: qtyNum, p_reason: note }), 'Ajuste registrado')}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar ajuste
          </button>
        </>}
      >
        <p className="mb-4 text-[15px]">Usa el ajuste cuando el conteo físico no coincide con el sistema. Stock actual: <b>{num(p.stock)}</b>.</p>
        <div className="space-y-4">
          <Field label="Stock correcto"><input className="input" type="number" inputMode="numeric" min={0} step={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
          <Field label="Motivo del ajuste"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: conteo físico, producto dañado" /></Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={modal === 'estado'}
        title={p.active ? 'Desactivar producto' : 'Activar producto'}
        message={p.active
          ? 'El producto dejará de aparecer para vender y para ingresar mercadería. Su historial se conserva.'
          : 'El producto volverá a estar disponible para vender.'}
        confirmText={p.active ? 'Desactivar' : 'Activar'}
        danger={p.active}
        busy={busy}
        onCancel={close}
        onConfirm={() => run(() => supabase.from('products').update({ active: !p.active }).eq('id', p.id), p.active ? 'Producto desactivado' : 'Producto activado')}
      />
    </>
  )
}
