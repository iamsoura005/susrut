import { useState, useEffect } from 'react'
import './index.css'
import './App.css'
import Navbar from './components/Navbar'
import UploadZone from './components/UploadZone'
import ResultCard from './components/ResultCard'
import HistoryPage from './components/HistoryPage'
import ModelsStatusPage from './components/ModelsStatusPage'
import PatientMetaForm from './components/PatientMetaForm'
import BatchUploadZone from './components/BatchUploadZone'
import BatchResultsList from './components/BatchResultsList'
import SecondOpinionPanel from './components/SecondOpinionPanel'
import ImagePreprocessor from './components/ImagePreprocessor'
import {
  analyzeFile, analyzeBatch, fetchHistory,
  type AnalysisResult, type HistoryRecord, type Modality,
  type PatientMeta, type BatchSummary,
} from './api'

type Tab   = 'analyze' | 'batch' | 'history' | 'status'

const BLANK_META: PatientMeta = { patient_id: '', radiologist_name: '', clinical_notes: '' }

export default function App() {
  const [tab,            setTab]            = useState<Tab>('analyze')
  const [loading,        setLoading]        = useState(false)
  const [result,         setResult]         = useState<AnalysisResult | null>(null)
  const [file,           setFile]           = useState<File | null>(null)
  const [error,          setError]          = useState('')
  const [history,        setHistory]        = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [patientMeta,    setPatientMeta]    = useState<PatientMeta>(BLANK_META)
  const [batchSummary,   setBatchSummary]   = useState<BatchSummary | null>(null)
  const [batchError,     setBatchError]     = useState('')

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const h = await fetchHistory()
      setHistory(h.records)
    } catch { /* backend might not be up */ }
    finally { setHistoryLoading(false) }
  }

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab])

  // Single file analyze
  const handleFile = async (f: File, override?: Modality) => {
    setFile(f)
    setResult(null)
    setError('')
    setLoading(true)
    try {
      const res = await analyzeFile(f, override, patientMeta)
      setResult(res)
    } catch (e: any) {
      setError(e.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => { setResult(null); setFile(null); setError('') }

  // Batch analyze
  const handleBatch = async (files: File[], override?: Modality) => {
    setBatchSummary(null)
    setBatchError('')
    setLoading(true)
    try {
      const summary = await analyzeBatch(files, override, patientMeta)
      setBatchSummary(summary)
    } catch (e: any) {
      setBatchError(e.message ?? 'Batch analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBatchReset = () => { setBatchSummary(null); setBatchError('') }

  return (
    <div className="app">
      <Navbar active={tab} onChange={t => {
        setTab(t as Tab)
        if (t === 'analyze') handleReset()
        if (t === 'batch')   handleBatchReset()
      }} />

      <main className="main-content">

        {/* ── Single Analyze ── */}
        {tab === 'analyze' && (
          <div className="analyze-layout">
            <div className="analyze-left">
              <PatientMetaForm meta={patientMeta} onChange={setPatientMeta} />
              <ImagePreprocessor
                onPreprocessed={blob => {
                  const f = new File([blob], file?.name ?? 'preprocessed.jpg', { type: 'image/jpeg' })
                  handleFile(f)
                }}
              />
              <UploadZone onFile={handleFile} loading={loading} />

              {result && !loading && (
                <div className="modality-chip fade-in">
                  <span className="modality-chip-dot" />
                  <span className="modality-chip-text">
                    Detected: <strong>{result.modality.replace(/_/g, ' ').toUpperCase()}</strong>
                    {result.modality_confidence !== undefined && result.modality_confidence < 1 && (
                      <span className="text-dim"> ({(result.modality_confidence * 100).toFixed(0)}% confidence)</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="analyze-right">
              {!result && !loading && !error && (
                <div className="empty-state glass">
                  <div className="empty-icon">🩺</div>
                  <h3 className="empty-title">Awaiting Upload</h3>
                  <p className="empty-sub">
                    Upload a medical image or ECG signal to receive an AI-powered analysis including
                    prediction, confidence, severity assessment, and explainability visualization.
                  </p>
                  <div className="empty-capabilities">
                    {['🧠 Brain MRI', '🫁 Chest CT', '💀 Head CT', '💓 ECG', '🦴 Bone X-Ray'].map(c => (
                      <span key={c} className="badge badge-accent">{c}</span>
                    ))}
                  </div>
                  <p className="empty-sub" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                    Also supports <strong>DICOM (.dcm)</strong> — auto-reads patient metadata
                  </p>
                </div>
              )}

              {error && (
                <div className="error-card glass fade-in">
                  <span className="error-icon">⛔</span>
                  <div>
                    <h3>Analysis Failed</h3>
                    <p>{error}</p>
                    <p className="error-hint">Make sure the backend is running on port 8000.</p>
                  </div>
                  <button className="btn btn-ghost" onClick={handleReset}>Try Again</button>
                </div>
              )}

              {loading && (
                <div className="loading-card glass fade-in">
                  <div className="spinner" />
                  <div>
                    <h3>Analyzing…</h3>
                    <p>Running AI inference pipeline</p>
                  </div>
                </div>
              )}

              {result && !loading && (
                <>
                  <ResultCard result={result} filename={file?.name ?? 'upload'} />
                  <SecondOpinionPanel
                    file={file!}
                    firstResult={result}
                    patientMeta={patientMeta}
                  />
                  <button className="btn btn-ghost reset-btn" id="reset-btn" onClick={handleReset}>
                    ← New Analysis
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Batch Analyze ── */}
        {tab === 'batch' && (
          <div className="batch-layout">
            <div className="batch-left">
              <PatientMetaForm meta={patientMeta} onChange={setPatientMeta} />
              <BatchUploadZone onFiles={handleBatch} loading={loading} />
              {batchError && (
                <div className="error-card glass fade-in">
                  <span className="error-icon">⛔</span>
                  <div>
                    <h3>Batch Failed</h3>
                    <p>{batchError}</p>
                  </div>
                  <button className="btn btn-ghost" onClick={handleBatchReset}>Try Again</button>
                </div>
              )}
              {loading && (
                <div className="loading-card glass fade-in">
                  <div className="spinner" />
                  <div><h3>Processing batch…</h3><p>Running inference on all files</p></div>
                </div>
              )}
            </div>

            <div className="batch-right">
              {!batchSummary && !loading && (
                <div className="empty-state glass">
                  <div className="empty-icon">📂</div>
                  <h3 className="empty-title">Batch Analysis</h3>
                  <p className="empty-sub">
                    Drop up to 20 radiology files at once. Each file is analyzed independently —
                    results are sorted by severity with aggregate statistics.
                  </p>
                </div>
              )}
              {batchSummary && !loading && (
                <BatchResultsList summary={batchSummary} onReset={handleBatchReset} />
              )}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <HistoryPage records={history} onRefresh={loadHistory} loading={historyLoading} />
        )}
        {tab === 'status' && <ModelsStatusPage />}
      </main>

      <footer className="footer">
        <p>
          RadiAI &copy; 2025 &nbsp;·&nbsp;
          <span className="text-dim">For research and educational use only. Not for clinical diagnosis.</span>
        </p>
      </footer>
    </div>
  )
}
