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
    'Abnormal':         'Imaging findings outside normal limits — clinical correlation required.',
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
    'Normal':            'Sinus rhythm within normal limits.',
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

  const top = sorted[0][1]  // for normalising the bar widths to 100%

  return (
    <div className="differential-panel">
      <div className="differential-title">
        <span className="differential-icon">🔬</span>
        <span>Differential Diagnosis</span>
        {result.calibrated && <span className="badge badge-accent diff-cal-badge">🌡 Calibrated</span>}
      </div>

      <div className="differential-list">
        {sorted.map(([cls, prob], i) => {
          const pct     = Math.round(prob * 100)
          const relW    = top > 0 ? (prob / top) * 100 : 0
          const isPrimary = i === 0
          const desc    = descs[cls] ?? 'Clinical correlation recommended.'

          return (
            <div key={cls} className={`diff-item ${isPrimary ? 'diff-primary' : ''}`}>
              <div className="diff-item-header">
                <div className="diff-rank-badge">{i + 1}</div>
                <span className="diff-label">{cls}</span>
                <span className={`diff-pct ${isPrimary ? 'diff-pct-primary' : ''}`}>{pct}%</span>
              </div>
              <div className="diff-bar-track">
                <div
                  className={`diff-bar-fill ${isPrimary ? 'diff-bar-primary' : ''}`}
                  style={{ width: `${relW}%` }}
                />
              </div>
              <p className="diff-desc text-dim">{desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
