import { BUCKET, supabase } from './supabase'
import type { ProductImage } from './types'

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Reduce la foto (máx. 1600 px) para que se suba rápido desde el celular */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob) throw new Error('blob')
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    if (OK_TYPES.includes(file.type) && file.size < 5 * 1024 * 1024) return file
    throw new Error('No se pudo procesar la imagen. Usa una foto en formato JPG o PNG.')
  }
}

export async function uploadProductImage(productId: string, original: File): Promise<ProductImage> {
  const file = await compressImage(original)
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${productId}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (up.error) throw up.error
  const ins = await supabase
    .from('product_images')
    .insert({ product_id: productId, storage_path: path })
    .select('*')
    .single()
  if (ins.error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw ins.error
  }
  return ins.data as ProductImage
}

export async function deleteProductImage(img: ProductImage): Promise<void> {
  const del = await supabase.from('product_images').delete().eq('id', img.id).select('id')
  if (del.error) throw del.error
  if (!del.data || del.data.length === 0) throw new Error('No tienes permiso para eliminar esta imagen.')
  await supabase.storage.from(BUCKET).remove([img.storage_path])
}
