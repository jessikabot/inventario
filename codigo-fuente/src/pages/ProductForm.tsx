import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, Star, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { canEditProduct, isStaff } from '../lib/permissions'
import { friendlyError } from '../lib/errors'
import { deleteProductImage, uploadProductImage } from '../lib/images'
import { num, UNIT_LABEL } from '../lib/format'
import { ConfirmDialog, EmptyState, Field, PageHeader, Spinner, Thumb } from '../components/ui'
import { ImageInputButtons } from '../components/ImageInputButtons'
import type { Category, Product, ProductImage, Unit } from '../lib/types'

interface Pending { key: string; file: File; url: string }

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const nav = useNavigate()
  const { profile } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [cats, setCats] = useState<Category[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [uploading, setUploading] = useState(false)
  const [delImg, setDelImg] = useState<ProductImage | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [qty, setQty] = useState('0')
  const [unit, setUnit] = useState<Unit>('unidad')
  const [minStock, setMinStock] = useState(String(settings.default_min_stock))
  const [label, setLabel] = useState('')
  const [link, setLink] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const minTouched = useRef(false)

  useEffect(() => {
    if (!isEdit && !minTouched.current) setMinStock(String(settings.default_min_stock))
  }, [settings.default_min_stock, isEdit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const c = await supabase.from('categories').select('id, name, code, active, created_at').order('name')
      let p: Product | null = null
      let imgs: ProductImage[] = []
      if (isEdit) {
        const r = await supabase.from('products').select('*').eq('id', id!).maybeSingle()
        p = (r.data as Product | null) ?? null
        const im = await supabase.from('product_images').select('*').eq('product_id', id!).order('created_at')
        imgs = (im.data ?? []) as ProductImage[]
      }
      if (!alive) return
      setCats((c.data ?? []) as Category[])
      if (p) {
        setProduct(p)
        setImages(imgs.sort((a, b) => Number(b.is_primary) - Number(a.is_primary)))
        setCategoryId(p.category_id)
        setTitle(p.title)
        setPrice(String(p.price))
        setUnit(p.unit)
        setMinStock(String(p.min_stock))
        setLabel(p.label ?? '')
        setLink(p.link ?? '')
        setDescription(p.description ?? '')
        setNotes(p.notes ?? '')
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [id, isEdit])

  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line

  const catOptions = useMemo(() => cats.filter((c) => c.active || c.id === product?.category_id), [cats, product])
  const selectedCat = cats.find((c) => c.id === categoryId)

  if (loading) return <Spinner />
  if (!isStaff(profile?.role)) return <EmptyState title="No tienes permiso" text="Tu usuario es de solo consulta." action={<Link to="/productos" className="btn btn-primary">Volver a productos</Link>} />
  if (isEdit && !product) return <EmptyState title="No se encontró el producto" action={<Link to="/productos" className="btn btn-primary">Volver a productos</Link>} />
  if (isEdit && product && !canEditProduct(profile!.role, product.created_by, profile!.id)) {
    return <EmptyState title="Solo puedes ver este producto" text="Los vendedores solo pueden editar los productos que ellos mismos registraron." action={<Link to={`/productos/${product.id}`} className="btn btn-primary">Ver producto</Link>} />
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!categoryId) e.category = 'Elige una categoría.'
    if (!title.trim()) e.title = 'Escribe el título del producto.'
    if (price === '' || Number(price) < 0 || Number.isNaN(Number(price))) e.price = 'Escribe un precio válido (0 o más).'
    if (!isEdit && (!Number.isInteger(Number(qty)) || Number(qty) < 0)) e.qty = 'La cantidad debe ser un número entero, 0 o más.'
    if (!Number.isInteger(Number(minStock)) || Number(minStock) < 0) e.min = 'Escribe un número entero, 0 o más.'
    if (link.trim() && !/^https?:\/\/\S+$/i.test(link.trim())) e.link = 'El link debe empezar con http:// o https://'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (imgs.length === 0) { toast.error('Elige archivos de imagen.'); return }
    if (!isEdit) {
      setPending((prev) => [...prev, ...imgs.map((file) => ({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))])
      return
    }
    setUploading(true)
    let okCount = 0
    for (const f of imgs) {
      try {
        const row = await uploadProductImage(id!, f)
        setImages((prev) => [...prev, row])
        okCount++
      } catch (err) {
        toast.error(friendlyError(err))
      }
    }
    setUploading(false)
    if (okCount) {
      toast.ok(okCount === 1 ? 'Imagen agregada' : `${okCount} imágenes agregadas`)
      const im = await supabase.from('product_images').select('*').eq('product_id', id!).order('created_at')
      setImages(((im.data ?? []) as ProductImage[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)))
    }
  }

  const makePrimary = async (img: ProductImage) => {
    const { error } = await supabase.rpc('set_primary_image', { p_image_id: img.id })
    if (error) { toast.error(friendlyError(error)); return }
    setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === img.id })).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)))
    toast.ok('Imagen principal actualizada')
  }

  const removeImage = async () => {
    if (!delImg) return
    try {
      await deleteProductImage(delImg)
      const im = await supabase.from('product_images').select('*').eq('product_id', id!).order('created_at')
      setImages(((im.data ?? []) as ProductImage[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)))
      toast.ok('Imagen eliminada')
    } catch (err) {
      toast.error(friendlyError(err))
    }
    setDelImg(null)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!validate()) { toast.error('Revisa los campos marcados en rojo.'); return }
    setSaving(true)
    try {
      if (isEdit) {
        const { data, error } = await supabase.from('products').update({
          category_id: categoryId, title: title.trim(), price: Number(price), unit, min_stock: Number(minStock),
          label: label.trim() || null, link: link.trim() || null, description: description.trim() || null, notes: notes.trim() || null,
        }).eq('id', id!).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('No tienes permiso para editar este producto.')
        toast.ok('Cambios guardados')
        nav(`/productos/${id}`)
      } else {
        const { data, error } = await supabase.rpc('create_product', {
          p_category_id: categoryId, p_title: title, p_link: link, p_description: description, p_quantity: Number(qty),
          p_unit: unit, p_label: label, p_price: Number(price), p_notes: notes, p_min_stock: Number(minStock),
        })
        if (error) throw error
        const created = data as Product
        let failed = 0
        for (let i = 0; i < pending.length; i++) {
          setProgress(`Subiendo imagen ${i + 1} de ${pending.length}…`)
          try { await uploadProductImage(created.id, pending[i].file) } catch { failed++ }
        }
        if (failed) toast.error(`El producto se creó, pero ${failed} imagen(es) no se pudieron subir. Puedes agregarlas editando el producto.`)
        else toast.ok(`Producto ${created.code} registrado`)
        nav(`/productos/${created.id}`)
      }
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setSaving(false)
      setProgress('')
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: isEdit ? `/productos/${id}` : '/productos', label: isEdit ? 'Volver al producto' : 'Productos' }}
        title={isEdit ? 'Editar producto' : 'Nuevo producto'}
        subtitle={isEdit ? <>El ID <b>{product!.code}</b> no se puede cambiar.</> : 'El ID se genera solo al elegir la categoría y guardar.'}
      />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="card space-y-4 p-5">
          <Field label="Categoría" error={errors.category} hint={!isEdit && selectedCat ? `El ID empezará con ${selectedCat.code}-` : undefined}>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Elige una categoría…</option>
              {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ' (desactivada)'}</option>)}
            </select>
          </Field>
          <Field label="Título" error={errors.title}>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Taladro inalámbrico 20V" maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio de venta" error={errors.price}>
              <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Unidad">
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
              </select>
            </Field>
            {isEdit ? (
              <Field label="Cantidad en stock" hint="Para cambiarla usa “Ingresar mercadería” o “Ajustar stock” en el producto.">
                <input className="input" value={num(product!.stock)} disabled readOnly />
              </Field>
            ) : (
              <Field label="Cantidad inicial" error={errors.qty} hint="Cuántas unidades tienes ahora.">
                <input className="input" type="number" inputMode="numeric" min={0} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
              </Field>
            )}
            <Field label="Stock mínimo" error={errors.min} hint="Avisa como “stock bajo” al llegar a esta cantidad.">
              <input className="input" type="number" inputMode="numeric" min={0} step={1} value={minStock} onChange={(e) => { minTouched.current = true; setMinStock(e.target.value) }} />
            </Field>
          </div>
          <Field label="Etiqueta (opcional)"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Marca, modelo o palabra para encontrarlo fácil" maxLength={120} /></Field>
          <Field label="Link (opcional)" error={errors.link}><input className="input" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Descripción (opcional)"><textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field label="Observaciones (opcional)"><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 text-lg font-bold">Imágenes</h2>
          <p className="mb-4 text-[15px] text-tinta-soft">La primera foto será la principal. Puedes subir varias desde tu galería o tomarlas con la cámara.</p>

          {isEdit && images.length > 0 && (
            <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((im) => (
                <li key={im.id} className="overflow-hidden rounded-xl border border-linea">
                  <div className="relative">
                    <Thumb path={im.storage_path} size={200} className="!h-auto !w-full aspect-square !rounded-none !border-0" />
                    {im.is_primary && <span className="chip absolute left-2 top-2 bg-etiqueta text-tinta">Principal</span>}
                  </div>
                  <div className="flex gap-1 p-1.5">
                    {!im.is_primary && (
                      <button type="button" onClick={() => makePrimary(im)} className="btn btn-ghost btn-sm flex-1" aria-label="Usar como imagen principal"><Star className="h-4 w-4" />Principal</button>
                    )}
                    <button type="button" onClick={() => setDelImg(im)} className="btn btn-ghost btn-sm !text-ladrillo hover:!bg-ladrillo-soft" aria-label="Eliminar imagen"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isEdit && pending.length > 0 && (
            <ul className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {pending.map((p, i) => (
                <li key={p.key} className="relative overflow-hidden rounded-xl border border-linea">
                  <img src={p.url} alt="" className="aspect-square w-full object-cover" />
                  {i === 0 && <span className="chip absolute left-1.5 top-1.5 bg-etiqueta text-tinta">Principal</span>}
                  <button type="button" aria-label="Quitar imagen" onClick={() => { URL.revokeObjectURL(p.url); setPending((prev) => prev.filter((x) => x.key !== p.key)) }} className="absolute right-1.5 top-1.5 rounded-full bg-tinta/70 p-1 text-white"><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}

          <ImageInputButtons onPick={addFiles} disabled={uploading || saving} />
          {uploading && <p className="mt-3 flex items-center gap-2 text-[15px] text-tinta-soft"><Loader2 className="h-4 w-4 animate-spin" />Subiendo imágenes…</p>}
        </div>

        <div className="sticky bottom-20 z-10 flex flex-col-reverse gap-2 rounded-xl border border-linea bg-white/95 p-3 backdrop-blur sm:flex-row sm:justify-end lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <Link to={isEdit ? `/productos/${id}` : '/productos'} className="btn btn-secondary">Cancelar</Link>
          <button className="btn btn-primary" disabled={saving || uploading}>
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            {saving && progress ? progress : isEdit ? 'Guardar cambios' : 'Registrar producto'}
          </button>
        </div>
      </form>

      <ConfirmDialog open={!!delImg} title="Eliminar imagen" message="La imagen se borrará de este producto." confirmText="Eliminar" danger onCancel={() => setDelImg(null)} onConfirm={removeImage} />
    </>
  )
}
