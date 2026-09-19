import { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDebounced } from '../lib/hooks'
import { cleanTerm, money } from '../lib/format'
import { CodeTag, StockBadge, Thumb } from './ui'
import type { Unit, StockStatus } from '../lib/types'

export interface PickerProduct {
  id: string
  code: string
  title: string
  price: number
  stock: number
  min_stock: number
  unit: Unit
  stock_status: StockStatus
  active: boolean
  primary_image_path: string | null
}

const COLS = 'id, code, title, price, stock, min_stock, unit, stock_status, active, primary_image_path'

export function ProductPicker({ onSelect, requireStock = false, excludeIds = [], autoFocus = false, placeholder = 'Buscar por nombre, código o etiqueta' }: {
  onSelect: (p: PickerProduct) => void
  requireStock?: boolean
  excludeIds?: string[]
  autoFocus?: boolean
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const [rows, setRows] = useState<PickerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const req = useRef(0)

  useEffect(() => {
    const id = ++req.current
    setLoading(true)
    let query = supabase.from('products').select(COLS).eq('active', true).order('title').limit(12)
    const t = cleanTerm(dq)
    if (t) query = query.or(`title.ilike.*${t}*,code.ilike.*${t}*,label.ilike.*${t}*`)
    query.then(({ data, error: err }) => {
      if (id !== req.current) return
      setLoading(false)
      if (err) setError('No se pudo buscar. Revisa tu conexión.')
      else {
        setError('')
        setRows((data ?? []) as unknown as PickerProduct[])
      }
    })
  }, [dq])

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-soft" />
        <input
          className="input pl-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Buscar producto"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-tinta-soft" />}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-ladrillo">{error}</p>}
      <ul className="mt-2 divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-white">
        {rows.length === 0 && !loading && <li className="px-4 py-6 text-center text-[15px] text-tinta-soft">No se encontraron productos.</li>}
        {rows.map((p) => {
          const blocked = (requireStock && p.stock <= 0) || excludeIds.includes(p.id)
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={blocked}
                onClick={() => onSelect(p)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-pino-soft/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Thumb path={p.primary_image_path} size={48} />
                <div className="min-w-0 flex-1">
                  <CodeTag code={p.code} />
                  <p className="mt-0.5 truncate font-semibold">{p.title}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display font-bold">{money(p.price)}</p>
                  <StockBadge stock={p.stock} unit={p.unit} status={p.stock_status} />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
