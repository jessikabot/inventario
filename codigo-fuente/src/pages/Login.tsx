import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isConfigured } from '../lib/supabase'
import { CodeTag } from '../components/ui'

const SAMPLE = ['HERRA-0001', 'COCIN-0014', 'ELEC-0032', 'JUGUE-0007', 'HERRA-0002', 'DEPOR-0021', 'COCIN-0015', 'ELEC-0033']

export default function Login() {
  const { signIn, notice, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (profile) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const err = await signIn(email, password)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-pino-deep p-12 lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="font-display text-4xl font-bold leading-tight text-white">Inventario<br />y ventas</p>
          <p className="mt-3 max-w-sm text-[17px] text-white/70">Cada producto con su etiqueta, cada movimiento con su historia.</p>
        </div>
        <div className="flex flex-wrap gap-3 opacity-90" aria-hidden="true">
          {SAMPLE.map((c, i) => (
            <span key={c} style={{ transform: `rotate(${(i % 3) - 1}deg)` }}><CodeTag code={c} large /></span>
          ))}
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-5 py-10 lg:min-h-0">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-display text-3xl font-bold text-pino">Inventario y ventas</p>
          </div>
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
          <p className="mt-1 text-[15px] text-tinta-soft">Ingresa con el correo y la contraseña que te dio el administrador.</p>

          {!isConfigured && (
            <div className="mt-5 rounded-xl border border-etiqueta bg-etiqueta-soft p-4 text-[15px] leading-relaxed" role="alert">
              <p className="font-bold">Falta conectar la base de datos</p>
              <p className="mt-1">Abre el archivo <b>config.js</b> y pega la URL de tu proyecto de Supabase y la clave pública. Los pasos están en el archivo LEEME.</p>
            </div>
          )}
          {notice && <p className="mt-5 rounded-lg bg-ladrillo-soft px-4 py-3 text-[15px] font-medium text-ladrillo" role="alert">{notice}</p>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Correo electrónico</span>
              <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" />
            </label>
            <label className="block">
              <span className="label">Contraseña</span>
              <div className="relative">
                <input className="input pr-12" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-tinta-soft hover:bg-bruma">
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>
            {error && <p className="rounded-lg bg-ladrillo-soft px-4 py-3 text-[15px] font-medium text-ladrillo" role="alert">{error}</p>}
            <button className="btn btn-primary w-full" disabled={busy || loading || !isConfigured}>
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
