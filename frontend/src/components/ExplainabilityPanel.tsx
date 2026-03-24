import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Microscope, Activity, ChevronDown, ChevronUp, Edit3, Image as ImageIcon } from 'lucide-react'
import type { Explainability, Modality } from '../api'
import AnnotationCanvas from './AnnotationCanvas'

interface Props {
  explainability: Explainability
  modality: Modality
}

export default function ExplainabilityPanel({ explainability, modality }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [annotating, setAnnotating] = useState(false)

  if (!explainability || explainability.type === 'none' || !explainability.image_b64) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-slate-400">
        <ImageIcon size={32} className="opacity-50" />
        <p className="text-sm font-medium">No explainability visualization available</p>
      </div>
    )
  }

  const isGradCam = explainability.type === 'gradcam_overlay'
  const typeLabel = isGradCam ? 'Grad-CAM Heatmap' : 'ECG Waveform'
  const Icon = isGradCam ? Microscope : Activity

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-radiai-cyan/10 text-radiai-cyan">
            <Icon size={18} />
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight">{typeLabel}</span>
        </div>
        <div className="flex flex-col items-center text-slate-400">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 p-5 border-t border-slate-100 dark:border-slate-800/50">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {explainability.description || 'AI activation regions highlighted on the original scan.'}
              </p>

              <div className="relative rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center p-1 border border-slate-200 dark:border-slate-700/80 pattern-grid-lg text-slate-800/20 dark:text-white/5">
                {!annotating ? (
                  <>
                    <img
                      src={`data:image/png;base64,${explainability.image_b64}`}
                      alt={`${typeLabel} visualization`}
                      className="w-full max-h-[400px] object-contain rounded-lg relative z-10"
                      loading="lazy"
                    />
                    {modality === 'brain_mri' && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-radiai-cyan text-xs font-bold tracking-wide whitespace-nowrap">
                        🎯 Tumor-Relevant Region Highlighted
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full relative z-10 bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
                    <AnnotationCanvas imageB64={explainability.image_b64} alt={typeLabel} />
                  </div>
                )}
              </div>

              {isGradCam && (
                <button
                  onClick={() => setAnnotating(!annotating)}
                  className={`self-start flex items-center gap-2 px-4 py-2 mt-1 rounded-lg text-sm font-medium transition-colors ${
                    annotating 
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-transparent'
                  }`}
                >
                  {annotating ? (
                    <>
                      <ImageIcon size={16} /> Exit Annotation Mode
                    </>
                  ) : (
                    <>
                      <Edit3 size={16} /> Add Manual Annotations
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
