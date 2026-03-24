import { useRef, useState, useEffect } from 'react'

interface Props {
  onPreprocessed: (blob: Blob) => void
}

interface Adjustments {
  brightness: number   // 0–200 (100 = no change)
  contrast:   number   // 0–200
  zoom:       number   // 50–200 %
  rotation:   number   // -180 to 180 degrees
}

const DEFAULTS: Adjustments = { brightness: 100, contrast: 100, zoom: 100, rotation: 0 }

export default function ImagePreprocessor({ onPreprocessed }: Props) {
  const [adj,      setAdj]      = useState<Adjustments>(DEFAULTS)
  const [imgSrc,   setImgSrc]   = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [open,     setOpen]     = useState(false)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const loadFile = (f: File) => {
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = e => setImgSrc(e.target?.result as string)
    reader.readAsDataURL(f)
    setAdj(DEFAULTS)
  }

  // Re-render canvas whenever image or adjustments change
  useEffect(() => {
    if (!imgSrc || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')!
    const img    = new Image()
    img.onload = () => {
      const zoom = adj.zoom / 100
      const w    = img.naturalWidth  * zoom
      const h    = img.naturalHeight * zoom
      canvas.width  = w
      canvas.height = h
      ctx.save()
      ctx.clearRect(0, 0, w, h)
      ctx.translate(w / 2, h / 2)
      ctx.rotate((adj.rotation * Math.PI) / 180)
      ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%)`
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
      ctx.restore()
    }
    img.src = imgSrc
  }, [imgSrc, adj])

  const applyAndSend = () => {
    canvasRef.current?.toBlob(blob => {
      if (blob) onPreprocessed(blob)
    }, 'image/jpeg', 0.95)
  }

  const set = (key: keyof Adjustments) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAdj(a => ({ ...a, [key]: Number(e.target.value) }))

  if (!open) {
    return (
      <button
        className="btn btn-ghost btn-sm preprocess-open-btn"
        onClick={() => setOpen(true)}
        id="preprocess-open-btn"
      >
        🎛 Preprocess Image
      </button>
    )
  }

  return (
    <div className="preprocess-panel glass fade-in">
      <div className="preprocess-header">
        <span>🎛 Image Preprocessing</span>
        <button className="btn btn-ghost btn-xs" onClick={() => setOpen(false)}>✕</button>
      </div>

      {/* File picker */}
      <div className="preprocess-file-row">
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.bmp,.tiff,.dcm"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])}
          id="preprocess-file-input"
        />
        <button className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} id="preprocess-pick-btn">
          📂 {fileName || 'Select Image'}
        </button>
        {imgSrc && (
          <button className="btn btn-ghost btn-xs" onClick={() => setAdj(DEFAULTS)}>Reset</button>
        )}
      </div>

      {/* Sliders */}
      {imgSrc && (
        <>
          <div className="preprocess-sliders">
            {([
              { key: 'brightness', label: '☀ Brightness', min: 0,   max: 200, unit: '%' },
              { key: 'contrast',   label: '◑ Contrast',   min: 0,   max: 200, unit: '%' },
              { key: 'zoom',       label: '🔍 Zoom',       min: 50,  max: 300, unit: '%' },
              { key: 'rotation',   label: '↻ Rotation',   min: -180,max: 180, unit: '°' },
            ] as const).map(s => (
              <div key={s.key} className="preprocess-slider-row">
                <label>{s.label}</label>
                <input type="range" min={s.min} max={s.max} value={adj[s.key]} onChange={set(s.key)} />
                <span className="preprocess-val">{adj[s.key]}{s.unit}</span>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="preprocess-preview">
            <canvas ref={canvasRef} className="preprocess-canvas" />
          </div>

          <button
            className="btn btn-primary"
            onClick={applyAndSend}
            id="preprocess-apply-btn"
          >
            ✅ Apply & Analyze
          </button>
          <p className="ann-hint text-dim">Adjustments are applied client-side; the processed image is sent to the AI model.</p>
        </>
      )}
    </div>
  )
}
