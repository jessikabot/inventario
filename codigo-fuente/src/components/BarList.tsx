export function BarList({ rows, empty = 'Sin datos en este período.' }: { rows: { label: string; value: number; text: string; sub?: string }[]; empty?: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-[15px] text-tinta-soft">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[15px] font-semibold">{r.label}</span>
            <span className="shrink-0 font-display text-[15px] font-bold tabular-nums">{r.text}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-bruma">
            <div className="h-full rounded-full bg-pino" style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </div>
          {r.sub && <p className="mt-0.5 text-[13px] text-tinta-soft">{r.sub}</p>}
        </li>
      ))}
    </ul>
  )
}
