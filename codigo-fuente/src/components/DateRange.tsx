import { monthEndLP, monthStartLP, todayLP, yearStartLP } from '../lib/format'

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const t = todayLP()
  const quick = [
    { label: 'Hoy', f: t, t },
    { label: 'Este mes', f: monthStartLP(), t },
    { label: 'Mes pasado', f: monthStartLP(-1), t: monthEndLP(-1) },
    { label: 'Este año', f: yearStartLP(), t },
  ]
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quick.map((q) => {
          const on = q.f === from && q.t === to
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.f, q.t)}
              aria-pressed={on}
              className={`min-h-[40px] rounded-lg border px-3 text-sm font-semibold transition-colors ${on ? 'border-pino bg-pino text-white' : 'border-linea bg-white text-tinta-soft hover:bg-bruma'}`}
            >
              {q.label}
            </button>
          )
        })}
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        Desde
        <input type="date" className="input !w-auto" value={from} max={to} onChange={(e) => e.target.value && onChange(e.target.value, to)} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        Hasta
        <input type="date" className="input !w-auto" value={to} min={from} onChange={(e) => e.target.value && onChange(from, e.target.value)} />
      </label>
    </div>
  )
}
