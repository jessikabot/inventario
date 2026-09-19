export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e ?? '')
  if (!msg) return 'Ocurrió un error inesperado.'
  if (/Invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/banned/i.test(msg)) return 'Tu cuenta está desactivada. Habla con el administrador.'
  if (/categories_code_uq/.test(msg)) return 'Ya existe una categoría con ese código. Usa otro código.'
  if (/categories_name_uq/.test(msg)) return 'Ya existe una categoría con ese nombre.'
  if (/row-level security/i.test(msg)) return 'No tienes permiso para hacer esto.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
  if (/JWT expired|invalid JWT/i.test(msg)) return 'Tu sesión venció. Vuelve a iniciar sesión.'
  if (/stock_check|violates check constraint "products_stock_check"/.test(msg)) return 'El stock no puede quedar en negativo.'
  return msg
}
