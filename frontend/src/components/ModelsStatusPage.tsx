import { useEffect, useState } from 'react'
import { fetchModelsStatus } from '../api'

interface ModelInfo {
  loaded: boolean
  file: string | null
  stub: boolean
  input_size: number[] | null
  description: string
}

export default function ModelsStatusPage() {
  const [status, setStatus] = useState<{ models: Record<string, ModelInfo>; tensorflow_version?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchModelsStatus()
      .then(setStatus)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const MODALITY_ICONS: Record<string, string> = {
    brain_mri: '🧠', chest_ct: '🫁', head_ct: '💀', ecg: '💓', bone_xray: '🦴',
  }

  return (
    <div className="models-page fade-in">
      <h2 className="section-title">Model Status</h2>
      <p className="section-sub">Loaded inference modules and their weights</p>

      {loading && <div className="history-loading"><div className="spinner" /><span>Checking…</span></div>}
      {error   && <div className="result-error">⛔ {error} — Is the backend running?</div>}

      {status && (
        <>
          <div className="models-grid">
            {Object.entries(status.models).map(([name, info]) => (
              <div key={name} className={`model-card glass ${info.loaded ? 'model-card--loaded' : 'model-card--stub'}`}>
                <div className="model-card-header">
                  <span className="model-icon">{MODALITY_ICONS[name] ?? '🩻'}</span>
                  <div>
                    <p className="model-name">{name.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="model-file mono">{info.input_size ? `${info.input_size[0]}×${info.input_size[1]} px` : 'not loaded'}</p>
                    <p className="model-file" style={{marginTop:2, fontSize:10, opacity:0.6}}>{info.description}</p>
                  </div>
                  <span className={`badge ${info.loaded ? 'badge-low' : info.stub ? 'badge-stub' : 'badge-medium'}`}>
                    {info.loaded ? '✅ Loaded' : info.stub ? '⚠ Stub' : '❌ Error'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {status.tensorflow_version && (
            <p className="model-tf-version">TensorFlow {status.tensorflow_version}</p>
          )}
        </>
      )}
    </div>
  )
}
