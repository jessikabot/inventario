import { useRef } from 'react'
import { Camera, ImagePlus } from 'lucide-react'

export function ImageInputButtons({ onPick, disabled }: { onPick: (files: File[]) => void; disabled?: boolean }) {
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length) onPick(files)
    e.target.value = ''
  }
  return (
    <div className="flex flex-wrap gap-2">
      <input ref={gallery} type="file" accept="image/*" multiple className="hidden" onChange={handle} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => gallery.current?.click()}>
        <ImagePlus className="h-5 w-5" /> Elegir fotos
      </button>
      <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => camera.current?.click()}>
        <Camera className="h-5 w-5" /> Tomar foto
      </button>
    </div>
  )
}
