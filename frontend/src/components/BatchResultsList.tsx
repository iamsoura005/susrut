import { useState } from 'react'
import type { AnalysisResult } from '../api'
import {
  MODALITY_ICONS, MODALITY_LABELS, severityBadgeClass,
  formatConfidence, reportDownloadUrl
} from '../api'

interface BatchSummary {
  total: number
  severity_counts: Record<string, number>
  results: (AnalysisResult & { filename?: string; error?: string })[]
}

interface Props {
  summary: BatchSummary
  onReset: () => void
}

export default function BatchResultsList({ summary, onReset }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(i) ? n.delete(i) : n.add(i)
      return n
    })

  const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Unknown']
  const sorted = [...summary.results].sort((a, b) => {
    const ai = severityOrder.indexOf(a.severity?.level ?? 'Unknown')
    const bi = severityOrder.indexOf(b.severity?.level ?? 'Unknown')
    return ai - bi
  })

  return (
    <div className="batch-results fade-in">
      {/* Aggregate banner */}
      <div className="batch-summary-banner glass">
        <div className="batch-summary-title">
          <span className="batch-summary-icon">📊</span>
          <span>Batch Analysis Complete — {summary.total} files</span>
        </div>
        <div className="batch-severity-counts">
          {Object.entries(summary.severity_counts).map(([level, count]) => (
            <span key={level} className={`${severityBadgeClass(level)} badge-lg`}>
              {level}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Individual results */}
      <div className="batch-result-items">
        {sorted.map((r, i) => {
          const isOpen = expanded.has(i)
          const hasError = !!r.error

          return (
            <div key={i} className={`batch-result-item glass ${hasError ? 'batch-error' : ''}`}>
              <div
                className="batch-result-header"
                onClick={() => toggle(i)}
                id={`batch-result-${i}`}
              >
                <div className="batch-result-meta">
                  <span className="batch-result-filename">{r.filename ?? `File ${i + 1}`}</span>
                  {!hasError && (
                    <>
                      <span className="batch-result-modality">
                        {MODALITY_ICONS[r.modality]} {MODALITY_LABELS[r.modality]}
                      </span>
                      <span className="batch-result-prediction">{r.prediction}</span>
                    </>
                  )}
                  {hasError && <span className="text-error">⛔ {r.error}</span>}
                </div>

                {!hasError && (
                  <div className="batch-result-badges">
                    <span className={severityBadgeClass(r.severity?.level ?? 'Unknown')}>
                      {r.severity?.level}
                    </span>
                    <span className="badge badge-accent">
                      {formatConfidence(r.confidence)}
                      {r.calibrated && ' 🌡'}
                    </span>
                    <span className="batch-chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                )}
              </div>

              {isOpen && !hasError && (
                <div className="batch-result-body fade-in">
                  <div className="batch-result-probs">
                    {Object.entries(r.class_probabilities ?? {}).map(([cls, prob]) => (
                      <div key={cls} className="prob-row">
                        <span className="prob-label">{cls}</span>
                        <div className="prob-bar-track">
                          <div className="prob-bar-fill" style={{ width: `${(prob as number) * 100}%` }} />
                        </div>
                        <span className="prob-value">{formatConfidence(prob as number)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="batch-result-desc">
                    <p>{r.severity?.description}</p>
                    {r.uncertainty?.is_uncertain && (
                      <p className="uncertainty-flag">⚠ Uncertain: {r.uncertainty.flag}</p>
                    )}
                  </div>

                  {r.report_id && (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={reportDownloadUrl(r.report_id)}
                      target="_blank"
                      rel="noreferrer"
                      id={`batch-report-${i}`}
                    >
                      📄 Download Report
                    </a>
                  )}

                  {r.explainability?.image_b64 && (
                    <div className="batch-heatmap">
                      <img
                        src={`data:image/png;base64,${r.explainability.image_b64}`}
                        alt="Grad-CAM heatmap"
                        className="heatmap-img"
                      />
                      <p className="text-dim">{r.explainability.description}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        className="btn btn-ghost reset-btn"
        onClick={onReset}
        id="batch-reset-btn"
      >
        ← New Batch
      </button>
    </div>
  )
}
