import React, { useCallback, useState } from 'react'
import type { Modality } from '../api'

interface Props {
  onFile: (file: File, override?: Modality) => void
  loading: boolean
}

const ACCEPT = '.jpg,.jpeg,.png,.bmp,.tiff,.tif,.dcm,.dicom,.csv,.txt,.dat,.edf'

const MODALITIES: { value: Modality; label: string; icon: string }[] = [
  { value: 'brain_mri', label: 'Brain MRI', icon: '🧠' },
  { value: 'chest_ct',  label: 'Chest CT',  icon: '🫁' },
  { value: 'head_ct',   label: 'Head CT',   icon: '💀' },
  { value: 'ecg',       label: 'ECG',       icon: '💓' },
  { value: 'bone_xray', label: 'Bone X-Ray',icon: '🦴' },
]

export default function UploadZone({ onFile, loading }: Props) {
  const [dragging, setDragging] = useState(false)
  const [override, setOverride] = useState<Modality | ''>('')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file, override || undefined)
  }, [onFile, override])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file, override || undefined)
    e.target.value = ''
  }

  return (
    <div className="upload-zone-wrapper fade-in">
      <h2 className="upload-heading">Upload Medical File</h2>
      <p className="upload-sub">Supports Brain MRI, Chest CT, Head CT, ECG (CSV), and Bone X-Ray images</p>

      {/* Drag-and-drop area */}
      <label
        id="upload-dropzone"
        className={`upload-zone glass ${dragging ? 'upload-zone--dragging' : ''} ${loading ? 'upload-zone--loading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        aria-label="Drop zone for medical image upload"
      >
        <input
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          disabled={loading}
          className="sr-only"
          id="file-input"
          aria-describedby="upload-hint"
        />
        {loading ? (
          <div className="upload-loading">
            <div className="spinner" />
            <span>Analyzing…</span>
          </div>
        ) : (
          <>
            <div className="upload-icon">
              {dragging ? '📂' : '🩻'}
            </div>
            <p className="upload-cta">
              {dragging ? 'Release to upload' : 'Drop file here or click to browse'}
            </p>
            <p id="upload-hint" className="upload-hint">
              Images: JPG, PNG, TIFF, DICOM &nbsp;|&nbsp; ECG: CSV, DAT, EDF
            </p>
          </>
        )}
      </label>

      {/* Modality override */}
      <div className="modality-override">
        <label className="override-label" htmlFor="modality-select">
          Override auto-detection
          <span className="override-optional">(optional)</span>
        </label>
        <div className="modality-pills" id="modality-select" role="group" aria-label="Modality override">
          <button
            type="button"
            className={`modality-pill ${override === '' ? 'modality-pill--active' : ''}`}
            onClick={() => setOverride('')}
          >
            🤖 Auto
          </button>
          {MODALITIES.map(m => (
            <button
              key={m.value}
              type="button"
              className={`modality-pill ${override === m.value ? 'modality-pill--active' : ''}`}
              onClick={() => setOverride(m.value)}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
