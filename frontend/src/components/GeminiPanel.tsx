import type { GeminiReport } from '../api'

interface Props {
  gemini: GeminiReport
}

const riskConfig: Record<string, { cls: string; icon: string }> = {
  Low:     { cls: 'gemini-risk-low',     icon: '🟢' },
  Medium:  { cls: 'gemini-risk-medium',  icon: '🟡' },
  High:    { cls: 'gemini-risk-high',    icon: '🔴' },
  Unknown: { cls: 'gemini-risk-unknown', icon: '⚪' },
}

export default function GeminiPanel({ gemini }: Props) {
  const risk   = gemini.risk_level ?? 'Unknown'
  const rConf  = riskConfig[risk] ?? riskConfig['Unknown']

  // Don't render if Gemini failed / was unavailable
  const isUsable =
    gemini.detailed_explanation &&
    !gemini.detailed_explanation.toLowerCase().includes('failed') &&
    !gemini.detailed_explanation.toLowerCase().includes('unavailable') &&
    !gemini.detailed_explanation.toLowerCase().includes('not configured')

  if (!isUsable) return null

  return (
    <div className="gemini-panel fade-in">
      {/* ── AI Explanation card ── */}
      <div className="gemini-explanation-card glass">
        <div className="gemini-card-header">
          <span className="gemini-icon">✨</span>
          <h4 className="gemini-card-title">AI Explanation</h4>
          <span className={`gemini-risk-badge ${rConf.cls}`}>
            {rConf.icon} {risk} Risk
          </span>
        </div>

        <p className="gemini-explanation-text">
          {gemini.detailed_explanation}
        </p>

        {gemini.key_findings && gemini.key_findings.length > 0 && (
          <div className="gemini-findings">
            <p className="gemini-findings-title">Key Findings</p>
            <ul className="gemini-findings-list">
              {gemini.key_findings.map((f, i) => (
                <li key={i} className="gemini-finding-item">
                  <span className="gemini-bullet">◆</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Quick Summary card ── */}
      {gemini.short_summary && (
        <div className="gemini-summary-card">
          <div className="gemini-card-header">
            <span className="gemini-icon">💡</span>
            <h4 className="gemini-card-title">Quick Summary</h4>
          </div>
          <p className="gemini-summary-text">{gemini.short_summary}</p>
        </div>
      )}
    </div>
  )
}
