import { useState } from 'react'

export interface PatientMeta {
  patient_id: string
  radiologist_name: string
  clinical_notes: string
}

interface Props {
  meta: PatientMeta
  onChange: (meta: PatientMeta) => void
}

export default function PatientMetaForm({ meta, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const set = (key: keyof PatientMeta) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...meta, [key]: e.target.value })

  const hasData = meta.patient_id || meta.radiologist_name || meta.clinical_notes

  return (
    <div className="patient-meta-form glass">
      <button
        className="patient-meta-toggle"
        onClick={() => setOpen(o => !o)}
        id="patient-meta-toggle-btn"
      >
        <span className="patient-meta-icon">📋</span>
        <span>Patient Information</span>
        {hasData && <span className="badge badge-accent meta-filled-badge">Filled</span>}
        <span className="patient-meta-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="patient-meta-fields fade-in">
          <div className="meta-row">
            <div className="meta-field">
              <label htmlFor="patient-id">Patient ID</label>
              <input
                id="patient-id"
                type="text"
                placeholder="e.g. PT-00123"
                value={meta.patient_id}
                onChange={set('patient_id')}
              />
            </div>
            <div className="meta-field">
              <label htmlFor="radiologist-name">Radiologist Name</label>
              <input
                id="radiologist-name"
                type="text"
                placeholder="e.g. Dr. Sharma"
                value={meta.radiologist_name}
                onChange={set('radiologist_name')}
              />
            </div>
          </div>
          <div className="meta-field">
            <label htmlFor="clinical-notes">Clinical Notes</label>
            <textarea
              id="clinical-notes"
              rows={3}
              placeholder="Symptoms, previous findings, reason for scan…"
              value={meta.clinical_notes}
              onChange={set('clinical_notes')}
            />
          </div>
          <p className="meta-hint">
            ℹ DICOM files will auto-populate Patient ID from embedded tags.
            Fields are included in the PDF report — never sent to any external server.
          </p>
        </div>
      )}
    </div>
  )
}
