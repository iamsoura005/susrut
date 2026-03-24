import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, AlertTriangle, ChevronLeft, RefreshCw, UploadCloud, Stethoscope, SearchCode } from 'lucide-react'

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
  type PatientMeta, type BatchSummary, MODALITY_LABELS
} from './api'

export type Tab = 'analyze' | 'batch' | 'history' | 'status'

const BLANK_META: PatientMeta = { patient_id: '', radiologist_name: '', clinical_notes: '' }

export default function App() {
  const [tab,            setTab]            = useState<Tab>('analyze')
  const [darkMode,       setDarkMode]       = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  
  const [loading,        setLoading]        = useState(false)
  const [result,         setResult]         = useState<AnalysisResult | null>(null)
  const [file,           setFile]           = useState<File | null>(null)
  const [error,          setError]          = useState('')
  
  const [history,        setHistory]        = useState<HistoryRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [patientMeta,    setPatientMeta]    = useState<PatientMeta>(BLANK_META)
  
  const [batchSummary,   setBatchSummary]   = useState<BatchSummary | null>(null)
  const [batchError,     setBatchError]     = useState('')

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [darkMode])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const h = await fetchHistory()
      setHistory(h.records)
    } catch { /* ignore */ }
    finally { setHistoryLoading(false) }
  }

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab])

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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-radiai-dark transition-colors duration-300">
      <Navbar 
        activeTab={tab} 
        onTabChange={t => {
          setTab(t)
          if (t === 'analyze') handleReset()
          if (t === 'batch')   handleBatchReset()
        }} 
        darkMode={darkMode}
        toggleDarkMode={() => setDarkMode(!darkMode)}
      />

      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          
          {/* ── SINGLE ANALYZE TAB ── */}
          {tab === 'analyze' && (
            <motion.div
              key="analyze"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
                <div className="glass-panel p-5 flex flex-col gap-5">
                  <PatientMetaForm meta={patientMeta} onChange={setPatientMeta} />
                </div>
                
                <div className="glass-panel p-5">
                  <ImagePreprocessor
                    onPreprocessed={blob => {
                      const f = new File([blob], file?.name ?? 'preprocessed.jpg', { type: 'image/jpeg' })
                      handleFile(f)
                    }}
                  />
                </div>

                {!result && !loading && (
                  <UploadZone onFile={handleFile} loading={loading} />
                )}

                {result && !loading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  >
                    <div className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold uppercase tracking-wider">Detected Modality</span>
                      <strong className="text-sm">{MODALITY_LABELS[result.modality] ?? result.modality.toUpperCase()}</strong>
                    </div>
                    {result.modality_confidence && result.modality_confidence < 1 && (
                      <span className="ml-auto text-xs font-mono opacity-80">{(result.modality_confidence * 100).toFixed(0)}%</span>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
                {!result && !loading && !error && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center min-h-[500px] gap-6 p-8 lg:p-12 text-center glass-panel"
                  >
                    <div className="p-6 rounded-3xl bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500">
                      <Stethoscope size={64} strokeWidth={1} />
                    </div>
                    <div className="flex flex-col gap-2 max-w-lg">
                      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Awaiting Upload</h3>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                        Upload a medical image or ECG signal to receive an AI-powered diagnostic analysis including 
                        rapid predictions, confidence scoring, severity grading, and explainable AI heatmaps.
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                      {['🧠 Brain MRI', '🫁 Chest CT', '💀 Head CT', '💓 ECG', '🦴 Bone X-Ray'].map(c => (
                        <span key={c} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-radiai-cyan/10 text-radiai-cyan border border-radiai-cyan/20">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                      <Activity size={14} /> Full DICOM metadata support included.
                    </p>
                  </motion.div>
                )}

                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400">
                    <div className="flex items-start gap-4">
                      <AlertTriangle size={24} className="shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <h3 className="text-base font-bold">Analysis Failed</h3>
                        <p className="text-sm font-medium opacity-90">{error}</p>
                        <p className="text-xs opacity-75">Is the backend inference server running?</p>
                      </div>
                    </div>
                    <button onClick={handleReset} className="btn bg-white dark:bg-red-950/50 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm">
                      <RefreshCw size={16} /> Try Again
                    </button>
                  </motion.div>
                )}

                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[500px] gap-6 glass-panel">
                    <div className="relative">
                      <div className="absolute inset-0 border-4 border-radiai-cyan/20 rounded-full animate-ping" />
                      <SearchCode size={48} className="text-radiai-cyan relative z-10 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Running AI Inference...</h3>
                      <p className="text-slate-500 dark:text-slate-400">Extracting features and generating heatmaps</p>
                    </div>
                  </motion.div>
                )}

                {result && !loading && (
                  <div className="flex flex-col gap-6">
                    <button 
                      onClick={handleReset}
                      className="self-start flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors group"
                    >
                      <span className="p-1 rounded-full bg-slate-200 dark:bg-slate-800 group-hover:bg-slate-300 dark:group-hover:bg-slate-700 transition-colors">
                        <ChevronLeft size={16} />
                      </span>
                      Back to Upload
                    </button>
                    <ResultCard result={result} filename={file?.name ?? 'upload'} />
                    
                    <div className="glass-panel p-6">
                      <SecondOpinionPanel file={file!} firstResult={result} patientMeta={patientMeta} />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── BATCH ANALYZE TAB ── */}
          {tab === 'batch' && (
            <motion.div
              key="batch"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-panel p-5">
                  <PatientMetaForm meta={patientMeta} onChange={setPatientMeta} />
                </div>
                
                <div className="glass-panel p-5">
                  <BatchUploadZone onFiles={handleBatch} loading={loading} />
                </div>

                {batchError && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex flex-col gap-3">
                    <div className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> Batch Failed</div>
                    <p className="text-sm">{batchError}</p>
                    <button onClick={handleBatchReset} className="btn bg-white dark:bg-red-950/50 border border-red-200 dark:border-red-800 hover:bg-red-100 text-sm py-1.5 self-start">Try Again</button>
                  </div>
                )}
                
                {loading && (
                  <div className="flex items-center gap-4 p-5 rounded-xl bg-radiai-cyan/10 border border-radiai-cyan/20 text-radiai-cyan">
                    <RefreshCw size={24} className="animate-spin" />
                    <div className="flex flex-col">
                      <strong className="text-sm">Processing Batch queue</strong>
                      <span className="text-xs opacity-80">This may take a minute</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 flex flex-col gap-6">
                {!batchSummary && !loading && (
                  <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center glass-panel text-slate-500 dark:text-slate-400">
                    <UploadCloud size={64} className="opacity-50" strokeWidth={1} />
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Batch Processing</h3>
                    <p className="text-sm max-w-md leading-relaxed">
                      Drop up to 20 radiology files or ECG signals at once. Each file is analyzed independently. Results are sorted hierarchically by medical severity.
                    </p>
                  </div>
                )}
                
                {batchSummary && !loading && (
                  <BatchResultsList summary={batchSummary} onReset={handleBatchReset} />
                )}
              </div>
            </motion.div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <HistoryPage records={history} onRefresh={loadHistory} loading={historyLoading} />
            </motion.div>
          )}

          {/* ── MODELS STATUS TAB ── */}
          {tab === 'status' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <ModelsStatusPage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-6 text-center border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="font-bold text-radiai-cyan">RadiAI</span> &copy; 2026 &nbsp;·&nbsp;
          <span className="opacity-75">For research and educational use only. Not for clinical diagnosis.</span>
        </p>
      </footer>
    </div>
  )
}
