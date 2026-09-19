import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { dateOnly, ROLE_LABEL } from '../lib/format'
import { Field, PageHeader } from '../components/ui'

export default function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(profile!.full_name)
  const [savingName, setSavingName] = useState(false)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const saveName = async () => {
    setSavingName(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', profile!.id)
    setSavingName(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok('Nombre actualizado.')
    refreshProfile()
  }

  const savePass = async () => {
    if (pass.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres.'); return }
    if (pass !== pass2) { toast.error('Las contraseñas no coinciden.'); return }
    setSavingPass(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setSavingPass(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok('Contraseña cambiada.')
    setPass(''); setPass2('')
  }

  return (
    <>
      <PageHeader title="Mi perfil" />
      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-bold">Mis datos</h2>
          <div className="space-y-4">
            <Field label="Nombre completo"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <div><p className="label">Correo</p><p className="text-[15px]">{profile!.email}</p></div>
            <div><p className="label">Rol</p><p className="text-[15px]">{ROLE_LABEL[profile!.role]}</p></div>
            <div><p className="label">Usuario desde</p><p className="text-[15px]">{dateOnly(profile!.created_at)}</p></div>
            <button className="btn btn-primary" onClick={saveName} disabled={savingName || !name.trim() || name.trim() === profile!.full_name}>
              {savingName && <Loader2 className="h-4 w-4 animate-spin" />}Guardar nombre
            </button>
          </div>
        </section>

        <section className="card h-fit p-5">
          <h2 className="mb-4 text-lg font-bold">Cambiar mi contraseña</h2>
          <div className="space-y-4">
            <Field label="Nueva contraseña" hint="Mínimo 6 caracteres."><input className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
            <Field label="Repite la contraseña"><input className="input" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} /></Field>
            <button className="btn btn-primary" onClick={savePass} disabled={savingPass || !pass}>
              {savingPass && <Loader2 className="h-4 w-4 animate-spin" />}Cambiar contraseña
            </button>
          </div>
        </section>
      </div>
      <button className="btn btn-secondary mt-6 lg:hidden" onClick={signOut}>Cerrar sesión</button>
    </>
  )
}
