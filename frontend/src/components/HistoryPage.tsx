import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, RefreshCw, Trash2, Search, ShieldAlert, FileOutput, Activity } from 'lucide-react'
import type { HistoryRecord } from '../api'
import { formatDate, formatConfidence, MODALITY_ICONS, MODALITY_LABELS, reportDownloadUrl, clearHistory } from '../api'
import TrendChart from './TrendChart'

interface Props {
  records: HistoryRecord[]
  onRefresh: () => void
  loading: boolean
}

type SubTab = 'records' | 'trends'

export default function HistoryPage({ records, onRefresh, loading }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('records')
  const [search, setSearch] = useState('')

  const handleClear = async () => {
    if (!window.confirm('Clear all history records?')) return
    await clearHistory()
    onRefresh()
  }

  const filtered = records.filter(r => 
    r.filename.toLowerCase().includes(search.toLowerCase()) || 
    r.prediction.toLowerCase().includes(search.toLowerCase()) ||
    ((r as any).patient_id || '').toLowerCase().includes(search.toLowerCase())
  )

  const severityColorInfo = {
    Low:      { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
    Medium:   { bg: 'bg-amber-100 dark:bg-amber-500/20',     text: 'text-amber-700 dark:text-amber-400'     },
    High:     { bg: 'bg-red-100 dark:bg-red-500/20',         text: 'text-red-700 dark:text-red-400'         },
    Critical: { bg: 'bg-purple-100 dark:bg-purple-500/20',   text: 'text-purple-700 dark:text-purple-400'   },
    Unknown:  { bg: 'bg-slate-100 dark:bg-slate-800',        text: 'text-slate-700 dark:text-slate-400'     },
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Analysis History</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {records.length} record{records.length !== 1 ? 's' : ''} • All time
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['records', 'trends'] as SubTab[]).map(t => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  subTab === t
                    ? 'text-slate-900 dark:text-white shadow-sm bg-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                {t === 'records' ? '📋 Records' : '📈 Trends'}
              </button>
            ))}
          </div>

          <button 
            onClick={onRefresh} 
            disabled={loading}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh history"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin cursor-wait' : ''} />
          </button>
          
          {records.length > 0 && (
            <button 
              onClick={handleClear}
              className="p-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              title="Clear all records"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {subTab === 'records' && (
        <div className="glass-panel flex flex-col overflow-hidden">
          
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search filenames, predictions, or patient ID..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-radiai-cyan focus:border-transparent transition-all"
              />
            </div>
          </div>

          {loading && records.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-4">
              <RefreshCw size={32} className="animate-spin text-radiai-cyan" />
              <p>Loading history...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center text-slate-500 dark:text-slate-400 gap-4">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                <FileText size={32} />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No records found</h3>
                <p className="text-sm">Upload a medical scan to see your analysis history here.</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No records match your search.</div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
              <AnimatePresence>
                {filtered.map(r => {
                  const sc = severityColorInfo[r.severity_level as keyof typeof severityColorInfo] || severityColorInfo.Unknown
                  const icon = MODALITY_ICONS[r.modality]

                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={r.id} 
                      className="group flex flex-col md:flex-row md:items-center justify-between p-4 px-6 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-xl shrink-0">
                          {typeof icon === 'string' ? icon : <Activity size={18} className="text-slate-400" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {r.filename}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-medium text-radiai-cyan bg-radiai-cyan/10 px-1.5 rounded">{MODALITY_LABELS[r.modality] ?? r.modality}</span>
                            <span>•</span>
                            <span>{formatDate(r.timestamp)}</span>
                            {(r as any).patient_id && (
                              <>
                                <span>•</span>
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 rounded text-slate-600 dark:text-slate-300">
                                  PT: {(r as any).patient_id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0 ml-14 md:ml-0">
                        <div className="flex flex-col items-end mr-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">{r.prediction.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-slate-500 font-mono">{formatConfidence(r.confidence)} conf</span>
                        </div>

                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border border-white/10 ${sc.bg} ${sc.text}`}>
                          {r.severity_level}
                        </span>

                        {r.is_uncertain && (
                          <span className="text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-1.5 rounded-md" title="High uncertainty">
                            <ShieldAlert size={14} />
                          </span>
                        )}

                        {r.stub && (
                          <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-100 px-2 py-1 rounded-md">Stub</span>
                        )}

                        {r.report_path && r.id && (
                          <a
                            href={reportDownloadUrl(r.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 ml-2 p-1.5 px-3 text-xs font-semibold text-radiai-cyan bg-radiai-cyan/5 hover:bg-radiai-cyan/10 rounded-lg transition-colors border border-radiai-cyan/20"
                          >
                            <FileOutput size={14} /> PDF
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {subTab === 'trends' && <TrendChart />}
    </motion.div>
  )
}
