import { useState } from 'react'
import type { AnalysisResult, Modality } from '../api'
import { API_BASE, MODALITY_LABELS } from '../api'

const MODALITIES = Object.keys(MODALITY_LABELS) as Modality[]

interface Props {
  result: AnalysisResult
}

export default function FeedbackWidget({ result }: Props) {
  const [isExpanded,      setIsExpanded]      = useState(false)
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [isDone,          setIsDone]          = useState(false)
  const [isError,         setIsError]         = useState(false)
  const [correctModality, setCorrectModality] = useState<Modality>(result.modality)
  const [correctLabel,    setCorrectLabel]    = useState('')
  const [comment,         setComment]         = useState('')
  const [message,         setMessage]         = useState('')

  const submit = async (wasCorrect: boolean) => {
    if (!result.report_id) { setMessage('No report ID.'); setIsError(true); return }
    setIsSubmitting(true)
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
      setIsDone(true)
    } catch {
      setMessage('Failed to submit — try again.')
      setIsError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isDone) {
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
            disabled={isSubmitting}
            id="feedback-yes-btn"
          >
            ✅ Yes
          </button>
          <button
            className="feedback-btn fb-no"
            onClick={() => setIsExpanded(true)}
            disabled={isSubmitting}
            id="feedback-no-btn"
          >
            ❌ No
          </button>
        </div>
      </div>

      {isExpanded && (
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
            disabled={isSubmitting}
            id="feedback-submit-btn"
          >
            {isSubmitting ? '⏳ Submitting…' : '📤 Submit Feedback'}
          </button>
          {isError && <p className="text-error">{message}</p>}
        </div>
      )}
    </div>
  )
}
