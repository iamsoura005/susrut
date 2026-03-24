import { useState } from 'react'
import type { AnalysisResult, Modality } from '../api'
import { MODALITY_LABELS, MODALITY_ICONS, analyzeFile } from '../api'
import ResultCard from './ResultCard'

interface Props {
  file: File
  firstResult: AnalysisResult
  patientMeta?: { patient_id: string; radiologist_name: string; clinical_notes: string }
}

export default function SecondOpinionPanel({ file, firstResult, patientMeta }: Props) {
  const MODALITIES = Object.keys(MODALITY_LABELS) as Modality[]
  const [modality, setModality] = useState<Modality>(
    MODALITIES.find(m => m !== firstResult.modality) ?? MODALITIES[0]
  )
  const [secondResult, setSecondResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runSecondOpinion = async () => {
    setLoading(true)
    setError('')
    setSecondResult(null)
    try {
      const res = await analyzeFile(file, modality, patientMeta)
      setSecondResult(res)
    } catch (e: any) {
      setError(e.message ?? 'Second opinion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="second-opinion-panel glass fade-in">
      <div className="second-opinion-header">
        <span className="second-opinion-icon">🔄</span>
        <h3>Second Opinion</h3>
        <p className="text-dim">Re-run through a different specialist model</p>
      </div>

      <div className="second-opinion-controls">
        <select
          className="modality-select"
          value={modality}
          onChange={e => setModality(e.target.value as Modality)}
          id="second-opinion-modality"
        >
          {MODALITIES.map(m => (
            <option key={m} value={m}>
              {MODALITY_ICONS[m]} {MODALITY_LABELS[m]}
            </option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={runSecondOpinion}
          disabled={loading}
          id="second-opinion-btn"
        >
          {loading ? '⏳ Analyzing…' : '🔬 Get Second Opinion'}
        </button>
      </div>

      {error && (
        <div className="error-card glass fade-in">
          <span className="error-icon">⛔</span>
          <p>{error}</p>
        </div>
      )}

      {secondResult && !loading && (
        <div className="second-opinion-comparison fade-in">
          <div className="comparison-col">
            <div className="comparison-label badge badge-accent">Primary Opinion</div>
            <ResultCard result={firstResult} filename={file.name} compact />
          </div>
          <div className="comparison-divider">vs</div>
          <div className="comparison-col">
            <div className="comparison-label badge badge-medium">
              {MODALITY_ICONS[modality]} {MODALITY_LABELS[modality]} Opinion
            </div>
            <ResultCard result={secondResult} filename={file.name} compact />
          </div>
        </div>
      )}
    </div>
  )
}
