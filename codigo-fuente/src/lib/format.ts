import type { MovementType, PaymentMethod, Role, Unit } from './types'

export const TZ = 'America/La_Paz'
let currency = 'Bs'
export function setCurrency(c: string) {
  currency = c || 'Bs'
}

export function money(n: number | string | null | undefined): string {
  const v = Number(n ?? 0)
  return `${currency} ${v.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function num(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString('es-BO')
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Fecha de hoy en Bolivia, formato AAAA-MM-DD */
export function todayLP(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

export function monthStartLP(offsetMonths = 0): string {
  const [y, m] = todayLP().split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1))
  return d.toISOString().slice(0, 10)
}

export function monthEndLP(offsetMonths = 0): string {
  const [y, m] = todayLP().split('-').map(Number)
  const d = new Date(Date.UTC(y, m + offsetMonths, 0))
  return d.toISOString().slice(0, 10)
}

export function yearStartLP(): string {
  return `${todayLP().slice(0, 4)}-01-01`
}

/** Bolivia no usa horario de verano: siempre UTC-4 */
export const startOfDayISO = (d: string) => new Date(`${d}T00:00:00-04:00`).toISOString()
export const endOfDayISO = (d: string) => new Date(`${d}T23:59:59.999-04:00`).toISOString()

export const saleNumber = (n: number) => `#${String(n).padStart(6, '0')}`

export const UNIT_LABEL: Record<Unit, string> = { unidad: 'Unidad', par: 'Par', set: 'Set' }
export function unitText(unit: Unit, qty: number): string {
  const one = qty === 1
  if (unit === 'par') return one ? 'par' : 'pares'
  if (unit === 'set') return one ? 'set' : 'sets'
  return one ? 'unidad' : 'unidades'
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo', qr: 'QR', tarjeta: 'Tarjeta', otro: 'Otro',
}
export const MOVEMENT_LABEL: Record<MovementType, string> = {
  inicial: 'Stock inicial', ingreso: 'Ingreso de mercadería', venta: 'Venta',
  anulacion: 'Anulación de venta', ajuste: 'Ajuste de inventario',
}
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador', vendedor: 'Vendedor', consulta: 'Solo consulta',
}

/** Quita caracteres que rompen los filtros de búsqueda */
export const cleanTerm = (s: string) => s.replace(/[,()*%\\":]/g, ' ').trim()

/** Sugiere el código de una categoría a partir de su nombre (hasta 5 letras) */
export function suggestCode(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
}
