import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { num, suggestCode } from '../lib/format'
import { CodeTag, EmptyState, Field, Modal, PageHeader, Spinner } from '../components/ui'
import type { Category } from '../lib/types'

export default function Categories() {
  const { profile } = useAuth()
  const toast = useToast()
  const admin = profile?.role === 'admin'
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Category | 'new' | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [codeTouched, setCodeTouched] = useState(false)
  const [active, setActive] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('v_category_counts').select('*').order('name')
    setRows((data ?? []) as unknown as Category[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const open = (c: Category | 'new') => {
    setEdit(c)
    if (c === 'new') { setName(''); setCode(''); setCodeTouched(false); setActive(true) }
    else { setName(c.name); setCode(c.code); setCodeTouched(true); setActive(c.active) }
  }

  const save = async () => {
    if (!name.trim()) { toast.error('Escribe el nombre de la categoría.'); return }
    if (!/^[A-Z0-9]{2,6}$/.test(code)) { toast.error('El código debe tener de 2 a 6 letras o números, sin espacios.'); return }
    setBusy(true)
    const res = edit === 'new'
      ? await supabase.from('categories').insert({ name: name.trim(), code })
      : await supabase.from('categories').update({ name: name.trim(), code, active }).eq('id', (edit as Category).id)
    setBusy(false)
    if (res.error) { toast.error(friendlyError(res.error)); return }
    toast.ok(edit === 'new' ? 'Categoría creada' : 'Categoría actualizada')
    setEdit(null)
    load()
  }

  const visible = admin ? rows : rows.filter((r) => r.active)
  const editing = edit && edit !== 'new' ? edit : null
  const codeLocked = !!editing && (editing.product_count ?? 0) > 0

  return (
    <>
      <PageHeader
        title="Categorías"
        subtitle="Toca una categoría para ver sus productos."
        actions={admin && <button className="btn btn-primary" onClick={() => open('new')}><Plus className="h-5 w-5" />Nueva categoría</button>}
      />
      {loading ? <Spinner /> : visible.length === 0 ? (
        <EmptyState title="Todavía no hay categorías" text={admin ? 'Crea la primera para poder registrar productos.' : 'El administrador aún no creó categorías.'}
          action={admin ? <button className="btn btn-primary" onClick={() => open('new')}><Plus className="h-5 w-5" />Nueva categoría</button> : undefined} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <li key={c.id} className={`card relative flex items-stretch ${c.active ? '' : 'opacity-70'}`}>
              <Link to={`/categorias/${c.id}`} className="min-w-0 flex-1 p-4 hover:bg-pino-soft/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <CodeTag code={c.code} />
                  {!c.active && <span className="chip bg-bruma text-tinta-soft">Desactivada</span>}
                </div>
                <p className="mt-2 truncate font-display text-xl font-bold">{c.name}</p>
                <p className="text-[15px] text-tinta-soft">{num(c.product_count ?? 0)} {(c.product_count ?? 0) === 1 ? 'producto' : 'productos'}</p>
              </Link>
              {admin && (
                <button onClick={() => open(c)} aria-label={`Editar ${c.name}`} className="m-2 self-start rounded-lg p-2 text-tinta-soft hover:bg-bruma"><Pencil className="h-5 w-5" /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={edit !== null}
        title={edit === 'new' ? 'Nueva categoría' : 'Editar categoría'}
        onClose={() => setEdit(null)}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setEdit(null)} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Nombre">
            <input className="input" value={name} autoFocus maxLength={80}
              onChange={(e) => { setName(e.target.value); if (!codeTouched) setCode(suggestCode(e.target.value)) }} placeholder="Ej.: Herramientas" />
          </Field>
          <Field label="Código para el ID de los productos" hint={codeLocked ? 'No se puede cambiar porque la categoría ya tiene productos.' : 'Ej.: HERRA genera HERRA-0001, HERRA-0002… Se propone solo, pero puedes cambiarlo (2 a 6 letras o números).'}>
            <input className="input font-semibold tabular-nums" value={code} disabled={codeLocked} maxLength={6}
              onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')) }} />
          </Field>
          {editing && (
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input type="checkbox" className="h-5 w-5 accent-pino" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Categoría activa (se puede elegir al registrar productos)
            </label>
          )}
        </div>
      </Modal>
    </>
  )
}
