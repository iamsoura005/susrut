import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, Activity, AlertCircle, CheckCircle2, ChevronRight, Box, Cpu } from 'lucide-react'
import { fetchModelsStatus } from '../api'

interface ModelInfo {
  loaded: boolean
  file: string | null
  stub: boolean
  input_size: number[] | null
  description: string
}

const MODALITY_ICONS: Record<string, string> = {
  brain_mri: '🧠', chest_ct: '🫁', head_ct: '💀', ecg: '💓', bone_xray: '🦴',
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-8 w-full"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Server className="text-radiai-cyan" /> System Status
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time status of loaded AI inference modules and their underlying weights.
          </p>
        </div>
        
        {status?.tensorflow_version && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm">
            <Cpu size={16} className="text-slate-500" />
            TensorFlow {status.tensorflow_version}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-16 gap-4 text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-slate-100 dark:border-slate-800/50"
          >
            <Activity size={32} className="animate-pulse text-radiai-cyan" />
            <span className="text-sm font-medium">Pinging inference servers...</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-start gap-4 p-6 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
          >
            <AlertCircle size={24} className="shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold text-base">Connection Failed</h3>
              <p className="text-sm opacity-90">{error} — Is the RadiAI backend running?</p>
            </div>
          </motion.div>
        )}

        {status && !loading && !error && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 tracking-tight"
          >
            {Object.entries(status.models).map(([name, info], i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`group relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 hover:shadow-soft flex flex-col gap-4 ${
                  info.loaded 
                    ? 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/40' 
                    : info.stub 
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40' 
                      : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
                }`}
              >
                {/* Status Dot Ring Background */}
                <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none ${
                    info.loaded ? 'bg-emerald-500' : info.stub ? 'bg-amber-500' : 'bg-red-500'
                }`} />

                <div className="flex items-start justify-between">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-2xl z-10">
                    {MODALITY_ICONS[name] ?? <Box size={20} className="text-slate-400" />}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border backdrop-blur-sm z-10 ${
                    info.loaded 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                      : info.stub 
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' 
                        : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                  }`}>
                    {info.loaded ? <CheckCircle2 size={12} /> : info.stub ? <AlertCircle size={12} /> : <AlertCircle size={12} />}
                    {info.loaded ? 'Online' : info.stub ? 'Stub Mode' : 'Offline'}
                  </div>
                </div>

                <div className="flex flex-col gap-1 z-10">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 capitalize">
                    {name.replace(/_/g, ' ')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed h-8">
                    {info.description}
                  </p>
                </div>

                <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between text-xs z-10 text-slate-500 dark:text-slate-400">
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {info.input_size ? `${info.input_size[0]}×${info.input_size[1]} px` : 'dim unavail.'}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400 font-medium group-hover:text-radiai-cyan transition-colors">
                    Details <ChevronRight size={14} />
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
