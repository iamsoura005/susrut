import type { AnalysisResult } from '../api'
import {
  MODALITY_ICONS, MODALITY_LABELS,
  severityBadgeClass, formatConfidence, reportDownloadUrl,
} from '../api'
import ExplainabilityPanel from './ExplainabilityPanel'
import DifferentialDiagnosis from './DifferentialDiagnosis'
import FeedbackWidget from './FeedbackWidget'

interface Props {
  result: AnalysisResult
  filename: string
  compact?: boolean
}

export default function ResultCard({ result, filename, compact }: Props) {
  const modLabel = MODALITY_LABELS[result.modality] ?? result.modality
  const modIcon  = MODALITY_ICONS[result.modality]  ?? '🩻'
  const conf     = formatConfidence(result.confidence)
  const confNum  = result.confidence * 100

  // Confidence ring color
  const ringColor =
    confNum > 75 ? 'var(--success)' :
    confNum > 45 ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="result-card glass fade-in">
      {/* Header */}
      <div className="result-header">
        <div className="result-modality">
          <span className="result-modality-icon">{modIcon}</span>
          <div>
            <p className="result-modality-label">{modLabel}</p>
            <p className="result-filename">{filename}</p>
          </div>
        </div>
        {result.stub && (
          <span className="badge badge-stub">⚠ Stub</span>
        )}
        {result.uncertainty?.is_uncertain && !result.stub && (
          <span className="badge badge-medium">⚠ Uncertain</span>
        )}
      </div>

      {/* Error */}
      {result.error && (
        <div className="result-error">
          <span>⛔</span> {result.error}
        </div>
      )}

      {/* Main prediction row */}
      <div className="result-main">
        {/* Confidence ring */}
        <div className="conf-ring-wrap">
          <svg className="conf-ring" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
            <circle
              cx="30" cy="30" r="24"
              fill="none"
              stroke={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${150.8 * (result.confidence)} 150.8`}
              transform="rotate(-90 30 30)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div className="conf-ring-text">
            <span className="conf-value" style={{ color: ringColor }}>{conf}</span>
            <span className="conf-label">{result.calibrated ? '🌡 Cal.' : 'Conf.'}</span>
          </div>
        </div>

        {/* Prediction & Severity */}
        <div className="result-details">
          <h3 className="result-prediction">{result.prediction}</h3>
          {result.severity && (
            <>
              <span className={severityBadgeClass(result.severity.level)}>
                {result.severity.level} Risk
              </span>
              <p className="result-severity-desc">{result.severity.description}</p>
            </>
          )}
        </div>
      </div>

      {/* Uncertainty banner */}
      {result.uncertainty?.is_uncertain && (
        <div className="uncertainty-banner">
          <span>⚠️</span>
          <span>{result.uncertainty.flag}</span>
        </div>
      )}

      {/* Class probabilities */}
      {result.class_probabilities && Object.keys(result.class_probabilities).length > 0 && (
        <div className="prob-bars">
          <p className="prob-title">Class Probabilities</p>
          {Object.entries(result.class_probabilities)
            .sort(([, a], [, b]) => b - a)
            .map(([cls, prob]) => (
              <div key={cls} className="prob-bar-item">
                <span className="prob-label">{cls}</span>
                <div className="prob-track">
                  <div
                    className="prob-fill"
                    style={{
                      width: `${prob * 100}%`,
                      background: prob > 0.5 ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                  />
                </div>
                <span className="prob-pct">{formatConfidence(prob)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Differential Diagnosis — hidden in compact mode */}
      {!compact && (
        <DifferentialDiagnosis result={result} />
      )}

      {/* Explainability — hidden in compact mode */}
      {!compact && result.explainability && (
        <ExplainabilityPanel explainability={result.explainability} modality={result.modality} />
      )}

      {/* Report download */}
      {result.report_id && (
        <a
          href={reportDownloadUrl(result.report_id)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary report-btn"
          id="download-report-btn"
        >
          📄 Download PDF Report
        </a>
      )}

      {/* Stub TODO */}
      {result.todo && (
        <div className="stub-todo">
          <strong>TODO:</strong> {result.todo}
        </div>
      )}

      {/* Feedback — hidden in compact mode */}
      {!compact && !result.stub && result.report_id && (
        <FeedbackWidget result={result} />
      )}
    </div>
  )
}
