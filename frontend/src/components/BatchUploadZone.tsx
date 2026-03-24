import { useState, useRef } from 'react'
import type { Modality } from '../api'
import { MODALITY_LABELS, MODALITY_ICONS } from '../api'

interface Props {
  onFiles: (files: File[], override?: Modality) => void
  loading: boolean
}

export default function BatchUploadZone({ onFiles, loading }: Props) {
  const [dragging, setDragging] = useState(false)
  const [queued, setQueued] = useState<File[]>([])
  const [override, setOverride] = useState<Modality | ''>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const MODALITIES = Object.keys(MODALITY_LABELS) as Modality[]

  const addFiles = (newFiles: File[]) => {
    setQueued(prev => {
      const names = new Set(prev.map(f => f.name))
      return [...prev, ...newFiles.filter(f => !names.has(f.name))]
    })
  }

  const removeFile = (name: string) =>
    setQueued(q => q.filter(f => f.name !== name))

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const handleAnalyze = () => {
    if (queued.length === 0 || loading) return
    onFiles(queued, override as Modality || undefined)
  }

  return (
    <div className="batch-zone">
      {/* Drop area */}
      <div
        className={`upload-drop-area glass ${dragging ? 'dragging' : ''} ${loading ? 'disabled' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
        id="batch-drop-area"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.bmp,.tiff,.dcm,.dicom,.csv"
          style={{ display: 'none' }}
          onChange={handleInput}
          id="batch-file-input"
        />
        <div className="upload-icon">{loading ? '⏳' : '📂'}</div>
        <p className="upload-title">
          {loading ? 'Analyzing batch…' : 'Drop multiple files or click to select'}
        </p>
        <p className="upload-sub">JPG · PNG · DICOM · CSV — up to 20 files</p>
      </div>

      {/* Queue list */}
      {queued.length > 0 && (
        <div className="batch-queue fade-in">
          <div className="batch-queue-header">
            <span className="text-dim">{queued.length} file{queued.length !== 1 ? 's' : ''} queued</span>
            <button className="btn btn-ghost btn-xs" onClick={() => setQueued([])}>Clear all</button>
          </div>
          <div className="batch-file-list">
            {queued.map(f => (
              <div key={f.name} className="batch-file-item glass">
                <span className="batch-file-name">{f.name}</span>
                <span className="text-dim batch-file-size">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  className="btn btn-ghost btn-xs batch-remove-btn"
                  onClick={() => removeFile(f.name)}
                  id={`remove-${f.name.replace(/\W/g,'_')}`}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      {queued.length > 0 && !loading && (
        <div className="batch-controls fade-in">
          <select
            className="modality-select"
            value={override}
            onChange={e => setOverride(e.target.value as Modality | '')}
            id="batch-modality-override"
          >
            <option value="">Auto-detect modality</option>
            {MODALITIES.map(m => (
              <option key={m} value={m}>{MODALITY_ICONS[m]} {MODALITY_LABELS[m]}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            id="batch-analyze-btn"
          >
            🔬 Analyze {queued.length} File{queued.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  )
}
