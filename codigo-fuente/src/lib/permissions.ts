import type { Role } from './types'

/** Administrador y vendedor pueden operar (ventas, ingresos, registrar productos) */
export const isStaff = (r?: Role | null) => r === 'admin' || r === 'vendedor'

export const canEditProduct = (r: Role | undefined, createdBy: string, uid: string | undefined) =>
  r === 'admin' || (r === 'vendedor' && createdBy === uid)
