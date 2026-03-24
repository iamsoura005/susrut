import { motion } from 'framer-motion'
import { Microscope, ShieldCheck } from 'lucide-react'
import type { AnalysisResult, Modality } from '../api'

// Clinical one-line descriptions for each class per modality
const DESCRIPTIONS: Partial<Record<Modality, Record<string, string>>> = {
  brain_mri: {
    glioma:          'Malignant brain tumor arising from glial cells — requires urgent specialist referral.',
    meningioma:      'Usually benign meningeal tumor — monitoring and neurosurgery consult advised.',
    pituitary_tumor: 'Pituitary region mass — endocrine and ophthalmology evaluation recommended.',
    no_tumor:        'No tumor features detected in this MRI scan.',
  },
  chest_ct: {
    'COVID-19':         'Ground-glass opacities consistent with COVID-19 bilateral pneumonia pattern.',
    'Lung Opacity':     'Consolidation or opacity — differential includes pneumonia, fluid, or fibrosis.',
    'Normal':           'No significant pulmonary pathology identified.',
    'Viral Pneumonia':  'Diffuse interstitial changes consistent with viral respiratory infection.',
  },
  head_ct: {
    'Hemorrhage':    'Intracranial hemorrhage detected — emergent neurosurgical evaluation required.',
    'No Hemorrhage': 'No acute intracranial hemorrhage identified on this CT scan.',
  },
  bone_xray: {
    'Fractured': 'Cortical disruption consistent with bone fracture — orthopedic review advised.',
    'Normal':    'No acute fracture or dislocation identified on this X-ray.',
  },
  ecg: {
    'Normal':                'Sinus rhythm within normal limits.',
    'Myocardial Infarction': 'ST-segment changes suggestive of myocardial infarction — urgent cardiology consult.',
    'ST-Depression':         'ST depression noted — ischemia workup recommended.',
    'Abnormal Heartbeat':    'Arrhythmia or conduction abnormality detected.',
    'History of MI':         'Q-waves or changes consistent with remote myocardial infarction.',
  },
}

interface Props {
  result: AnalysisResult
}

export default function DifferentialDiagnosis({ result }: Props) {
  const probs = result.class_probabilities
  if (!probs || Object.keys(probs).length === 0) return null

  const descs = DESCRIPTIONS[result.modality] ?? {}

  const sorted = Object.entries(probs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  const top = sorted[0][1]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <Microscope size={16} /> Differential Diagnosis
        </h4>
        {result.calibrated && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-radiai-cyan bg-radiai-cyan/10 px-2.5 py-1 rounded-md">
            <ShieldCheck size={12} /> Calibrated
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {sorted.map(([cls, prob], i) => {
          const pct     = Math.round(prob * 100)
          const relW    = top > 0 ? (prob / top) * 100 : 0
          const isPrimary = i === 0
          const desc    = descs[cls] ?? 'Clinical correlation recommended.'

          return (
            <div 
              key={cls} 
              className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${
                isPrimary 
                  ? 'bg-radiai-cyan/5 border-radiai-cyan/30' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  isPrimary ? 'bg-radiai-cyan text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                  {i + 1}
                </div>
                <span className={`flex-1 text-sm font-semibold capitalize ${isPrimary ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                  {cls.replace(/_/g, ' ')}
                </span>
                <span className={`text-sm font-bold ${isPrimary ? 'text-radiai-cyan' : 'text-slate-400'}`}>
                  {pct}%
                </span>
              </div>
              
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${relW}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className={`h-full rounded-full ${isPrimary ? 'bg-radiai-cyan' : 'bg-slate-300 dark:bg-slate-600'}`}
                />
              </div>
              
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                {desc}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
