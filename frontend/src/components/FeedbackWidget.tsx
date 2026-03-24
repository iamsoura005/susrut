import { useState } from 'react'
import type { AnalysisResult, Modality } from '../api'
import { API_BASE, MODALITY_LABELS } from '../api'

const MODALITIES = Object.keys(MODALITY_LABELS) as Modality[]

interface Props {
  result: AnalysisResult
}

type FeedbackState = 'idle' | 'expanding' | 'submitting' | 'done' | 'error'

export default function FeedbackWidget({ result }: Props) {
  const [state,           setState]           = useState<FeedbackState>('idle')
  const [correctModality, setCorrectModality] = useState<Modality>(result.modality)
  const [correctLabel,    setCorrectLabel]    = useState('')
  const [comment,         setComment]         = useState('')
  const [message,         setMessage]         = useState('')

  const submit = async (wasCorrect: boolean) => {
    if (!result.report_id) { setMessage('No report ID.'); setState('error'); return }
    setState('submitting')
    try {
      const form = new FormData()
      form.append('report_id',           result.report_id)
      form.append('was_correct',         String(wasCorrect))
      form.append('original_modality',   result.modality)
      form.append('original_prediction', result.prediction)
      form.append('correct_modality',    correctModality)
      form.append('correct_label',       correctLabel)
      form.append('comment',             comment)

      const res = await fetch(`${API_BASE}/api/feedback`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setMessage(data.message)
      setState('done')
    } catch {
      setMessage('Failed to submit — try again.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="feedback-widget feedback-done glass fade-in">
        <span className="feedback-done-icon">🙏</span>
        <span>{message}</span>
      </div>
    )
  }

  return (
    <div className="feedback-widget glass">
      <div className="feedback-header">
        <span className="feedback-question">Was this prediction correct?</span>
        <div className="feedback-buttons">
          <button
            className="feedback-btn fb-yes"
            onClick={() => { void submit(true) }}
            disabled={state === 'submitting'}
            id="feedback-yes-btn"
          >
            ✅ Yes
          </button>
          <button
            className="feedback-btn fb-no"
            onClick={() => setState('expanding')}
            disabled={state === 'submitting'}
            id="feedback-no-btn"
          >
            ❌ No
          </button>
        </div>
      </div>

      {state === 'expanding' && (
        <div className="feedback-details fade-in">
          <div className="feedback-row">
            <label>Correct Modality</label>
            <select
              value={correctModality}
              onChange={e => setCorrectModality(e.target.value as Modality)}
              className="modality-select"
              id="feedback-modality-select"
            >
              {MODALITIES.map(m => (
                <option key={m} value={m}>{MODALITY_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div className="feedback-row">
            <label>Correct Label</label>
            <input
              type="text"
              placeholder="e.g. glioma, pneumonia…"
              value={correctLabel}
              onChange={e => setCorrectLabel(e.target.value)}
              className="feedback-input"
              id="feedback-label-input"
            />
          </div>
          <div className="feedback-row">
            <label>Comment (optional)</label>
            <textarea
              rows={2}
              placeholder="Any additional context…"
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="feedback-input"
              id="feedback-comment"
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { void submit(false) }}
            disabled={state === 'submitting'}
            id="feedback-submit-btn"
          >
            {state === 'submitting' ? '⏳ Submitting…' : '📤 Submit Feedback'}
          </button>
          {state === 'error' && <p className="text-error">{message}</p>}
        </div>
      )}
    </div>
  )
}
