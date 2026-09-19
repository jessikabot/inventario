import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'
import { Field, PageHeader } from '../components/ui'

export default function SettingsPage() {
  const { settings, refresh } = useSettings()
  const toast = useToast()
  const [name, setName] = useState(settings.business_name)
  const [currency, setCurrency] = useState(settings.currency)
  const [minStock, setMinStock] = useState(String(settings.default_min_stock))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(settings.business_name); setCurrency(settings.currency); setMinStock(String(settings.default_min_stock))
  }, [settings])

  const min = Number(minStock)
  const valid = name.trim() && currency.trim() && Number.isInteger(min) && min >= 0

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('app_settings')
      .update({ business_name: name.trim(), currency: currency.trim(), default_min_stock: min }).eq('id', 1)
    setBusy(false)
    if (error) { toast.error(friendlyError(error)); return }
    toast.ok('Configuración guardada.')
    refresh()
  }

  return (
    <>
      <PageHeader title="Configuración" subtitle="Datos generales del negocio." />
      <div className="card max-w-xl space-y-4 p-5">
        <Field label="Nombre del negocio" hint="Aparece en el menú y en las ventas impresas."><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Moneda" hint="Ej.: Bs, $us"><input className="input !w-32" value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} /></Field>
        <Field label="Stock mínimo sugerido para productos nuevos" hint="Cuando el stock de un producto llegue a este número (o menos), aparecerá como stock bajo. Cada producto puede tener su propio mínimo.">
          <input className="input !w-32" type="number" inputMode="numeric" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
        </Field>
        <button className="btn btn-primary" onClick={save} disabled={busy || !valid}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</button>
      </div>
    </>
  )
}
