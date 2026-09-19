import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Loader2, Package, X, Inbox } from 'lucide-react'
import { imageUrl } from '../lib/supabase'
import { unitText, num } from '../lib/format'
import type { MovementType, SaleStatus, StockStatus, Unit } from '../lib/types'

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-tinta-soft" role="status">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-5 no-print">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-pino hover:underline">
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-[15px] text-tinta-soft">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[13px] text-tinta-soft">{hint}</span>}
      {error && <span className="mt-1 block text-[13px] font-medium text-ladrillo">{error}</span>}
    </label>
  )
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-tinta/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-linea px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-tinta-soft hover:bg-bruma">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-linea px-5 py-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmText = 'Confirmar', danger, busy, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmText?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </>
      }
    >
      <div className="text-[15px] leading-relaxed">{message}</div>
    </Modal>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <Inbox className="mb-3 h-9 w-9 text-linea" />
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[15px] text-tinta-soft">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function CodeTag({ code, large }: { code: string; large?: boolean }) {
  return <span className={`code-tag ${large ? 'code-tag-lg' : ''}`}>{code}</span>
}

export function StockBadge({ stock, unit, status }: { stock: number; unit: Unit; status: StockStatus }) {
  if (status === 'sin_stock') return <span className="chip bg-ladrillo-soft text-ladrillo">Sin stock</span>
  const cls = status === 'bajo' ? 'bg-etiqueta-soft text-etiqueta-dark' : 'bg-pino-soft text-pino-dark'
  return (
    <span className={`chip ${cls}`}>
      {status === 'bajo' ? 'Stock bajo: ' : ''}
      {num(stock)} {unitText(unit, stock)}
    </span>
  )
}

export function SaleStatusChip({ status }: { status: SaleStatus }) {
  return status === 'anulada'
    ? <span className="chip bg-ladrillo-soft text-ladrillo">Anulada</span>
    : <span className="chip bg-pino-soft text-pino-dark">Completada</span>
}

export function MovementChip({ type }: { type: MovementType }) {
  const map: Record<MovementType, [string, string]> = {
    inicial: ['Stock inicial', 'bg-bruma text-tinta-soft'],
    ingreso: ['Ingreso', 'bg-pino-soft text-pino-dark'],
    venta: ['Venta', 'bg-etiqueta-soft text-etiqueta-dark'],
    anulacion: ['Anulación', 'bg-ladrillo-soft text-ladrillo'],
    ajuste: ['Ajuste', 'bg-bruma text-tinta'],
  }
  const [label, cls] = map[type]
  return <span className={`chip whitespace-nowrap ${cls}`}>{label}</span>
}

export function Thumb({ path, size = 56, className = '' }: { path?: string | null; size?: number; className?: string }) {
  const url = imageUrl(path)
  return (
    <div className={`shrink-0 overflow-hidden rounded-lg border border-linea bg-bruma ${className}`} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-linea">
          <Package style={{ width: size * 0.45, height: size * 0.45 }} />
        </div>
      )}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  if (total <= 0) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const last = Math.ceil(total / pageSize) - 1
  return (
    <div className="no-print mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-tinta-soft">
        {from}–{to} de {num(total)}
      </p>
      <div className="flex gap-2">
        <button className="btn btn-secondary btn-sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button className="btn btn-secondary btn-sm" disabled={page >= last} onClick={() => onChange(page + 1)}>
          Siguiente <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-white p-1 border border-linea">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 min-h-[36px] text-sm font-semibold transition-colors ${value === o.value ? 'bg-pino text-white' : 'text-tinta-soft hover:bg-bruma'}`}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
