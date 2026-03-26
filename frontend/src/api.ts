// API base URL — change via VITE_API_URL env var
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ── Types ────────────────────────────────────────────────────────────────────

export type Modality = 'brain_mri' | 'chest_ct' | 'head_ct' | 'ecg' | 'bone_xray'

export interface Severity {
  level: 'Low' | 'Medium' | 'High' | 'Critical' | 'Unknown'
  score: number
  description: string
}

export interface Uncertainty {
  entropy?: number
  normalized_entropy: number
  is_uncertain: boolean
  flag: string
}

export interface Explainability {
  type: 'gradcam_overlay' | 'waveform' | 'none'
  image_b64: string
  description: string
}

export interface GeminiReport {
  detailed_explanation: string
  short_summary: string
  risk_level: 'Low' | 'Medium' | 'High' | 'Unknown'
  key_findings: string[]
}

export interface AnalysisResult {
  modality: Modality
  prediction: string
  confidence: number
  class_probabilities?: Record<string, number>
  severity: Severity
  uncertainty: Uncertainty
  explainability: Explainability
  stub: boolean
  todo?: string
  report_id?: string
  report_url?: string
  error?: string
  // calibration
  calibrated?: boolean
  calibration_temperature?: number
  modality_confidence?: number
  // ecg specific
  prediction_code?: string
  // head_ct specific
  hemorrhage_probability?: number
  threshold_used?: number
  // gemini AI explanation
  gemini?: GeminiReport
}

export interface HistoryRecord {
  id: string
  timestamp: string
  filename: string
  modality: Modality
  prediction: string
  confidence: number
  severity_level: string
  is_uncertain: boolean
  stub: boolean
  report_path: string
}

export interface HistoryResponse {
  total: number
  records: HistoryRecord[]
}

// ── API helpers ───────────────────────────────────────────────────────────────

export interface PatientMeta {
  patient_id: string
  radiologist_name: string
  clinical_notes: string
}

export interface BatchSummary {
  total: number
  severity_counts: Record<string, number>
  results: (AnalysisResult & { filename?: string; error?: string })[]
}

export async function analyzeFile(
  file: File,
  modalityOverride?: Modality,
  patientMeta?: PatientMeta,
): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', file)
  if (modalityOverride)           form.append('modality_override', modalityOverride)
  if (patientMeta?.patient_id)    form.append('patient_id', patientMeta.patient_id)
  if (patientMeta?.radiologist_name) form.append('radiologist_name', patientMeta.radiologist_name)
  if (patientMeta?.clinical_notes)   form.append('clinical_notes', patientMeta.clinical_notes)

  const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Analysis failed')
  }
  return res.json()
}

export async function analyzeBatch(
  files: File[],
  modalityOverride?: Modality,
  patientMeta?: PatientMeta,
): Promise<BatchSummary> {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  if (modalityOverride)               form.append('modality_override', modalityOverride)
  if (patientMeta?.patient_id)        form.append('patient_id', patientMeta.patient_id)
  if (patientMeta?.radiologist_name)  form.append('radiologist_name', patientMeta.radiologist_name)

  const res = await fetch(`${API_BASE}/api/analyze/batch`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Batch analysis failed')
  }
  return res.json()
}

export async function fetchHistory(): Promise<HistoryResponse> {
  const res = await fetch(`${API_BASE}/api/history`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function fetchModelsStatus(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/models/status`)
  if (!res.ok) throw new Error('Failed to fetch model status')
  return res.json()
}

export async function clearHistory(): Promise<void> {
  await fetch(`${API_BASE}/api/history`, { method: 'DELETE' })
}

export const reportDownloadUrl = (reportId: string): string =>
  `${API_BASE}/api/report/${reportId}`

// ── Utilities ─────────────────────────────────────────────────────────────────

export const MODALITY_LABELS: Record<Modality, string> = {
  brain_mri: 'Brain MRI',
  chest_ct: 'Chest CT',
  head_ct: 'Head CT',
  ecg: 'ECG',
  bone_xray: 'Bone X-Ray',
}

export const MODALITY_ICONS: Record<Modality, string> = {
  brain_mri: '🧠',
  chest_ct: '🫁',
  head_ct: '💀',
  ecg: '💓',
  bone_xray: '🦴',
}

export function severityBadgeClass(level: string): string {
  const l = level.toLowerCase()
  if (l === 'critical') return 'badge badge-critical'
  if (l === 'high')     return 'badge badge-high'
  if (l === 'medium')   return 'badge badge-medium'
  if (l === 'low')      return 'badge badge-low'
  return 'badge badge-unknown'
}

export function formatConfidence(c: number): string {
  return `${(c * 100).toFixed(1)}%`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  })
}
