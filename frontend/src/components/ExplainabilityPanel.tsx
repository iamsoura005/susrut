import type { Explainability, Modality } from '../api'
import { useState } from 'react'
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
      <div className="expl-empty">
        <span>🔍</span>
        <p>No explainability visualization available</p>
      </div>
    )
  }

  const typeLabel = {
    gradcam_overlay: 'Grad-CAM Heatmap',
    waveform: 'ECG Waveform',
    none: 'None',
  }[explainability.type]

  return (
    <div className={`expl-panel ${expanded ? 'expl-panel--expanded' : ''}`}>
      <button
        className="expl-toggle"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        id="expl-toggle-btn"
      >
        <span className="expl-type-label">
          {explainability.type === 'waveform' ? '📈' : '🗺️'} {typeLabel}
        </span>
        <span className="expl-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="expl-content fade-in">
          <p className="expl-desc">{explainability.description}</p>

          {!annotating ? (
            <div className={`expl-image-wrapper ${modality === 'brain_mri' ? 'expl-brain' : ''}`}>
              <img
                src={`data:image/png;base64,${explainability.image_b64}`}
                alt={`${typeLabel} visualization`}
                className="expl-image"
                loading="lazy"
              />
              {modality === 'brain_mri' && (
                <div className="expl-brain-label">
                  🎯 Tumor-Relevant Region Highlighted
                </div>
              )}
            </div>
          ) : (
            <AnnotationCanvas imageB64={explainability.image_b64} alt={typeLabel} />
          )}

          {/* Annotate toggle */}
          {explainability.type === 'gradcam_overlay' && (
            <button
              className="btn btn-ghost btn-sm ann-toggle-btn"
              onClick={() => setAnnotating(v => !v)}
              id="ann-toggle-btn"
            >
              {annotating ? '🖼 View Only' : '✏️ Annotate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

