import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

type Kind = 'ok' | 'error'
interface Toast { id: number; kind: Kind; text: string }
interface ToastApi { ok: (t: string) => void; error: (t: string) => void }

const Ctx = createContext<ToastApi | null>(null)
let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const push = useCallback((kind: Kind, text: string) => {
    const id = ++counter
    setItems((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])

  const api = useMemo<ToastApi>(() => ({ ok: (t) => push('ok', t), error: (t) => push('error', t) }), [push])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="no-print fixed inset-x-0 bottom-24 lg:bottom-6 z-[80] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-lg px-4 py-3 text-[15px] font-medium shadow-lg ${
              t.kind === 'error' ? 'bg-ladrillo text-white' : 'bg-pino-deep text-white'
            }`}
          >
            {t.kind === 'error' ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-etiqueta" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))} aria-label="Cerrar" className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast fuera de ToastProvider')
  return v
}
