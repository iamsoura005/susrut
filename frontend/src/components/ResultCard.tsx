import { motion } from 'framer-motion'
import { FileType, AlertTriangle, FileText, Activity } from 'lucide-react'
import type { AnalysisResult } from '../api'
import { MODALITY_ICONS, MODALITY_LABELS, formatConfidence, reportDownloadUrl } from '../api'
import ExplainabilityPanel from './ExplainabilityPanel'
import DifferentialDiagnosis from './DifferentialDiagnosis'
import FeedbackWidget from './FeedbackWidget'

interface Props {
  result: AnalysisResult
  filename: string
  compact?: boolean
}

export default function ResultCard({ result, filename, compact }: Props) {
  const modLabel = MODALITY_LABELS[result.modality] ?? result.modality
  const modIcon  = MODALITY_ICONS[result.modality]  ?? <Activity size={24} />
  const conf     = formatConfidence(result.confidence)
  const confNum  = result.confidence * 100

  const severityColorInfo = {
    Low:      { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400', ring: 'stroke-emerald-500' },
    Medium:   { bg: 'bg-amber-100 dark:bg-amber-500/20',     text: 'text-amber-700 dark:text-amber-400',     ring: 'stroke-amber-500' },
    High:     { bg: 'bg-red-100 dark:bg-red-500/20',         text: 'text-red-700 dark:text-red-400',         ring: 'stroke-red-500' },
    Critical: { bg: 'bg-purple-100 dark:bg-purple-500/20',   text: 'text-purple-700 dark:text-purple-400',   ring: 'stroke-purple-500' },
    Unknown:  { bg: 'bg-slate-100 dark:bg-slate-800',        text: 'text-slate-700 dark:text-slate-400',     ring: 'stroke-slate-400' },
  }
  
  const sevLevel = result.severity?.level as keyof typeof severityColorInfo || 'Unknown'
  const sc = severityColorInfo[sevLevel] || severityColorInfo.Unknown

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel w-full overflow-hidden p-6 md:p-8 flex flex-col gap-8"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-2xl shadow-sm">
            {typeof modIcon === 'string' ? modIcon : <Activity size={24} className="text-radiai-cyan" />}
          </div>
          <div className="flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">{modLabel}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <FileType size={14} className="text-slate-400" />
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">{filename}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {result.stub && (
            <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-amber-100/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
              <AlertTriangle size={14} /> Stub Mode
            </span>
          )}
          {result.report_id && (
            <a
              href={reportDownloadUrl(result.report_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm flex items-center gap-2 px-4 py-2 text-sm shadow-radiai-cyan border border-transparent hover:border-cyan-400/50"
            >
              <FileText size={16} /> Download PDF
            </a>
          )}
        </div>
      </div>

      {result.error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{result.error}</p>
        </div>
      )}

      {/* ── Main Split Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Prediction & Probabilities */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* Main Prediction Block */}
          <div className="flex items-start gap-6">
            <div className="relative flex shrink-0 items-center justify-center w-24 h-24">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="45" fill="none"
                  className={sc.ring}
                  strokeWidth="8"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 283" }}
                  animate={{ strokeDasharray: `${(confNum / 100) * 283} 283` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-xl font-bold ${sc.text}`}>{conf}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Conf</span>
              </div>
            </div>
            
            <div className="flex flex-col pt-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">AI Diagnosis</span>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white leading-tight capitalize">
                {result.prediction.replace(/_/g, ' ')}
              </h2>
              {result.severity && (
                <div className="mt-3 flex flex-col items-start gap-2">
                  <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border border-white/10 ${sc.bg} ${sc.text}`}>
                    {result.severity.level} Risk
                  </span>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {result.severity.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Probabilities Chart */}
          {result.class_probabilities && Object.keys(result.class_probabilities).length > 0 && (
            <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Class Probabilities</h4>
              <div className="flex flex-col gap-3">
                {Object.entries(result.class_probabilities)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cls, prob]) => (
                    <div key={cls} className="flex items-center gap-3">
                      <span className="w-28 text-sm font-medium text-slate-700 dark:text-slate-300 truncate capitalize" title={cls}>
                        {cls.replace(/_/g, ' ')}
                      </span>
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${prob * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${prob > 0.5 ? 'bg-radiai-cyan' : 'bg-slate-400 dark:bg-slate-600'}`}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-mono font-medium text-slate-500">
                        {formatConfidence(prob)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Explainability & Second Opinion */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!compact && result.explainability && (
            <ExplainabilityPanel explainability={result.explainability} modality={result.modality} />
          )}

          {/* Uncertainty banner */}
          {result.uncertainty?.is_uncertain && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={20} className="shrink-0" />
              <div>
                <p className="text-sm font-bold">High Uncertainty Detected ({result.uncertainty.flag})</p>
                <p className="text-xs opacity-80 mt-0.5">The model is not highly confident in a single clear diagnosis. Manual review strongly advised.</p>
              </div>
            </div>
          )}

          {!compact && (
            <DifferentialDiagnosis result={result} />
          )}
        </div>

      </div>

      {/* Footer / Feedback */}
      {!compact && !result.stub && result.report_id && (
        <div className="mt-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
          <FeedbackWidget result={result} />
        </div>
      )}
    </motion.div>
  )
}
