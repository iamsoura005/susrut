import { useEffect, useRef, useState } from 'react'

interface Props {
  imageB64: string       // base64 PNG from Grad-CAM
  alt?: string
}

type Tool = 'freehand' | 'rect' | 'circle' | 'arrow'
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ffffff']

export default function AnnotationCanvas({ imageB64, alt = 'Grad-CAM overlay' }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement>(null)
  const [tool,     setTool]     = useState<Tool>('freehand')
  const [color,    setColor]    = useState('#ef4444')
  const [size,     setSize]     = useState(3)
  const [drawing,  setDrawing]  = useState(false)
  const [startPt,  setStartPt]  = useState({ x: 0, y: 0 })
  const [snapshot, setSnapshot] = useState<ImageData | null>(null)
  const [history,  setHistory]  = useState<ImageData[]>([])
  const [loaded,   setLoaded]   = useState(false)

  const getCanvas = () => canvasRef.current!
  const getCtx    = () => getCanvas().getContext('2d')!

  // Draw background image onto canvas once loaded
  const initCanvas = () => {
    const img    = imgRef.current!
    const canvas = getCanvas()
    canvas.width  = img.naturalWidth  || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = getCtx()
    ctx.drawImage(img, 0, 0)
    setLoaded(true)
  }

  const getPos = (e: React.MouseEvent) => {
    const rect = getCanvas().getBoundingClientRect()
    const scaleX = getCanvas().width  / rect.width
    const scaleY = getCanvas().height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = (e: React.MouseEvent) => {
    if (!loaded) return
    const ctx = getCtx()
    const pos = getPos(e)
    setStartPt(pos)
    setDrawing(true)
    // Save snapshot for shape preview
    setSnapshot(ctx.getImageData(0, 0, getCanvas().width, getCanvas().height))
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const draw = (e: React.MouseEvent) => {
    if (!drawing || !loaded) return
    const ctx = getCtx()
    const pos = getPos(e)

    if (tool === 'freehand') {
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    } else {
      // Restore snapshot so shapes don't accumulate
      if (snapshot) ctx.putImageData(snapshot, 0, 0)
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth   = size
      if (tool === 'rect') {
        ctx.strokeRect(startPt.x, startPt.y, pos.x - startPt.x, pos.y - startPt.y)
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - startPt.x) / 2
        const ry = Math.abs(pos.y - startPt.y) / 2
        ctx.ellipse(startPt.x + (pos.x - startPt.x) / 2, startPt.y + (pos.y - startPt.y) / 2, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (tool === 'arrow') {
        drawArrow(ctx, startPt.x, startPt.y, pos.x, pos.y)
      }
    }
  }

  const endDraw = (e: React.MouseEvent) => {
    if (!drawing) return
    const ctx = getCtx()
    draw(e) // finalize
    setDrawing(false)
    setHistory(h => [...h, ctx.getImageData(0, 0, getCanvas().width, getCanvas().height)])
  }

  const undo = () => {
    if (history.length === 0) return
    const newHistory = history.slice(0, -1)
    setHistory(newHistory)
    const ctx = getCtx()
    if (newHistory.length > 0) {
      ctx.putImageData(newHistory[newHistory.length - 1], 0, 0)
    } else {
      // Restore original image
      ctx.clearRect(0, 0, getCanvas().width, getCanvas().height)
      ctx.drawImage(imgRef.current!, 0, 0)
    }
  }

  const clear = () => {
    setHistory([])
    const ctx = getCtx()
    ctx.clearRect(0, 0, getCanvas().width, getCanvas().height)
    ctx.drawImage(imgRef.current!, 0, 0)
  }

  const exportPng = () => {
    const url = getCanvas().toDataURL('image/png')
    const a   = document.createElement('a')
    a.href     = url
    a.download = 'annotation.png'
    a.click()
  }

  return (
    <div className="annotation-wrap">
      {/* Hidden img to load the base64 */}
      <img
        ref={imgRef}
        src={`data:image/png;base64,${imageB64}`}
        alt={alt}
        style={{ display: 'none' }}
        onLoad={initCanvas}
      />

      {/* Toolbar */}
      <div className="annotation-toolbar">
        <div className="annotation-tools">
          {(['freehand', 'rect', 'circle', 'arrow'] as Tool[]).map(t => (
            <button
              key={t}
              className={`ann-tool-btn ${tool === t ? 'active' : ''}`}
              onClick={() => setTool(t)}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
              id={`ann-tool-${t}`}
            >
              {t === 'freehand' ? '✏️' : t === 'rect' ? '▭' : t === 'circle' ? '◯' : '↗'}
            </button>
          ))}
        </div>

        <div className="annotation-colors">
          {COLORS.map(c => (
            <button
              key={c}
              className={`ann-color-btn ${color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              id={`ann-color-${c.slice(1)}`}
            />
          ))}
        </div>

        <div className="annotation-size">
          <label>Size</label>
          <input type="range" min={1} max={12} value={size}
            onChange={e => setSize(Number(e.target.value))} />
          <span>{size}px</span>
        </div>

        <div className="annotation-actions">
          <button className="btn btn-ghost btn-xs" onClick={undo} disabled={history.length === 0} id="ann-undo">↩ Undo</button>
          <button className="btn btn-ghost btn-xs" onClick={clear} id="ann-clear">🗑 Clear</button>
          <button className="btn btn-primary btn-sm" onClick={exportPng} id="ann-export">⬇ Save PNG</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="annotation-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="annotation-canvas"
          style={{ cursor: tool === 'freehand' ? 'crosshair' : 'default' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
        {!loaded && (
          <div className="ann-placeholder">Loading image…</div>
        )}
      </div>

      <p className="ann-hint text-dim">Draw on the Grad-CAM overlay to mark regions of interest, then save.</p>
    </div>
  )
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const headLen = 14
  const angle   = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}
