import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, Pencil, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { dateOnly, ROLE_LABEL } from '../lib/format'
import { EmptyState, Field, Modal, PageHeader, Spinner } from '../components/ui'
import type { Profile, Role } from '../lib/types'

const ROLE_HELP: Record<Role, string> = {
  admin: 'Acceso total: usuarios, categorías, anulaciones, ajustes y reportes.',
  vendedor: 'Registra productos, ingresos y ventas. Solo edita lo que él mismo creó.',
  consulta: 'Solo puede mirar productos, stock y reportes de stock.',
}

function PasswordInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} hint="Mínimo 6 caracteres.">
      <div className="relative">
        <input className="input pr-12" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2 text-tinta-soft hover:bg-bruma">
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </Field>
  )
}

export default function Users() {
  const { profile: me, refreshProfile } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<null | 'new' | 'edit' | 'pass'>(null)
  const [sel, setSel] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'vendedor' as Role, active: true })

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setRows((data ?? []) as Profile[])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const close = () => { setModal(null); setSel(null) }
  const openNew = () => { setF({ name: '', email: '', password: '', role: 'vendedor', active: true }); setModal('new') }
  const openEdit = (p: Profile) => { setSel(p); setF({ name: p.full_name, email: p.email, password: '', role: p.role, active: p.active }); setModal('edit') }
  const openPass = (p: Profile) => { setSel(p); setF((x) => ({ ...x, password: '' })); setModal('pass') }

  const create = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_create_user', { p_email: f.email, p_password: f.password, p_full_name: f.name, p_role: f.role })
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok(`Usuario creado. Ya puede entrar con ${f.email.trim().toLowerCase()}.`)
    close(); load()
  }

  const save = async () => {
    if (!sel) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ full_name: f.name.trim(), role: f.role, active: f.active }).eq('id', sel.id)
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok('Cambios guardados.')
    if (sel.id === me?.id) refreshProfile()
    close(); load()
  }

  const setPass = async () => {
    if (!sel) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_password', { p_user_id: sel.id, p_password: f.password })
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok(`Contraseña de ${sel.full_name || sel.email} actualizada.`)
    close()
  }

  const isSelf = sel?.id === me?.id
  const newValid = f.name.trim() && /^\S+@\S+\.\S+$/.test(f.email.trim()) && f.password.length >= 6

  return (
    <>
      <PageHeader title="Usuarios" subtitle="Crea y administra a las personas que usan el sistema."
        actions={<button className="btn btn-primary" onClick={openNew}><UserPlus className="h-5 w-5" /> Nuevo usuario</button>} />

      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState title="No hay usuarios" /> : (
        <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-white">
          {rows.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-semibold">{u.full_name || '(sin nombre)'} {u.id === me?.id && <span className="text-sm font-normal text-tinta-soft">(tú)</span>}</p>
                <p className="truncate text-[14px] text-tinta-soft">{u.email} · desde {dateOnly(u.created_at)}</p>
              </div>
              <span className={`chip ${u.role === 'admin' ? 'bg-pino text-white' : u.role === 'vendedor' ? 'bg-pino-soft text-pino-dark' : 'bg-bruma text-tinta-soft'}`}>{ROLE_LABEL[u.role]}</span>
              <span className={`chip ${u.active ? 'bg-pino-soft text-pino-dark' : 'bg-ladrillo-soft text-ladrillo'}`}>{u.active ? 'Activo' : 'Inactivo'}</span>
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /> Editar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => openPass(u)}><KeyRound className="h-4 w-4" /> Contraseña</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal === 'new'} title="Nuevo usuario" onClose={close}
        footer={<><button className="btn btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" onClick={create} disabled={busy || !newValid}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Crear usuario</button></>}>
        <div className="space-y-4">
          <Field label="Nombre completo"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
          <Field label="Correo electrónico" hint="Con este correo entrará al sistema."><input className="input" type="email" inputMode="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <PasswordInput label="Contraseña inicial" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
          <Field label="Rol" hint={ROLE_HELP[f.role]}>
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {(['vendedor', 'consulta', 'admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
        </div>
      </Modal>

      <Modal open={modal === 'edit'} title="Editar usuario" onClose={close}
        footer={<><button className="btn btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !f.name.trim()}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</button></>}>
        <div className="space-y-4">
          <p className="text-[15px] text-tinta-soft">{sel?.email}</p>
          <Field label="Nombre completo"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Rol" hint={isSelf ? 'No puedes cambiar tu propio rol.' : ROLE_HELP[f.role]}>
            <select className="input" value={f.role} disabled={isSelf} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {(['admin', 'vendedor', 'consulta'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </Field>
          <label className={`flex items-start gap-3 rounded-lg border border-linea p-3 ${isSelf ? 'opacity-60' : ''}`}>
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#0E5A47]" checked={f.active} disabled={isSelf} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            <span><span className="block font-semibold">Usuario activo</span><span className="text-[14px] text-tinta-soft">{isSelf ? 'No puedes desactivarte a ti mismo.' : 'Si lo desactivas, no podrá iniciar sesión. Su historial se conserva.'}</span></span>
          </label>
        </div>
      </Modal>

      <Modal open={modal === 'pass'} title="Cambiar contraseña" onClose={close}
        footer={<><button className="btn btn-secondary" onClick={close} disabled={busy}>Cancelar</button>
          <button className="btn btn-primary" onClick={setPass} disabled={busy || f.password.length < 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar contraseña</button></>}>
        <div className="space-y-4">
          <p className="text-[15px]">Nueva contraseña para <b>{sel?.full_name || sel?.email}</b>. Compártela con esa persona.</p>
          <PasswordInput label="Nueva contraseña" value={f.password} onChange={(v) => setF({ ...f, password: v })} />
        </div>
      </Modal>
    </>
  )
}
