import React, { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, FileType, CheckCircle2, Loader2, Activity } from 'lucide-react'
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
    if (loading) return
    const file = e.dataTransfer.files[0]
    if (file) onFile(file, override ? override : undefined)
  }, [onFile, override, loading])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (loading) return
    const file = e.target.files?.[0]
    if (file) onFile(file, override ? override : undefined)
    e.target.value = ''
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">New Analysis</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Upload a single medical scan or ECG file for immediate AI diagnostics.</p>
      </div>

      <div className="relative group">
        <div className={`absolute -inset-0.5 rounded-[2rem] blur opacity-40 transition-all duration-500 ${dragging ? 'bg-radiai-cyan opacity-100' : 'bg-transparent'}`} />
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center w-full min-h-[320px] 
            p-10 rounded-[2rem] border-2 border-dashed transition-all duration-300
            ${loading ? 'cursor-wait bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800' 
              : dragging 
                ? 'cursor-copy bg-cyan-50 dark:bg-cyan-950/30 border-radiai-cyan shadow-glow' 
                : 'cursor-pointer bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 hover:border-radiai-cyan/50'}
          `}
        >
          <input
            type="file"
            accept={ACCEPT}
            onChange={handleChange}
            disabled={loading}
            className="sr-only"
          />

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4 text-radiai-cyan"
              >
                <div className="relative">
                  <div className="absolute inset-0 border-4 border-cyan-500/30 rounded-full animate-ping" />
                  <Loader2 size={48} className="animate-spin text-radiai-cyan relative z-10" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-semibold tracking-wide">Processing Scan...</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Running inference pipelines</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-5 text-center"
              >
                <div className={`p-5 rounded-3xl transition-colors duration-300 ${dragging ? 'bg-radiai-cyan text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-950/50 group-hover:text-radiai-cyan'}`}>
                  <UploadCloud size={48} strokeWidth={1.5} />
                </div>
                
                <div className="flex flex-col gap-2 relative z-10">
                  <span className="text-xl font-semibold text-slate-700 dark:text-slate-200">
                    {dragging ? 'Drop to analyze instantly' : 'Drag & drop file here'}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    or <span className="text-radiai-cyan font-medium group-hover:underline">browse files</span>
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full shadow-sm">
                    <FileType size={14} /> Images (DICOM, JPG, PNG)
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full shadow-sm">
                    <Activity size={14} /> Signals (CSV, EDF)
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </label>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">
          Force Modality (Optional)
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOverride('')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 border ${
              override === '' 
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {override === '' && <CheckCircle2 size={16} />}
            🤖 Auto-detect
          </button>
          
          {MODALITIES.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setOverride(m.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 border ${
                override === m.value 
                  ? 'bg-radiai-cyan/10 text-radiai-cyan border-radiai-cyan shadow-sm shadow-cyan-500/10' 
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-radiai-cyan/30 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30'
              }`}
            >
              <span className="text-lg">{m.icon}</span> {m.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
