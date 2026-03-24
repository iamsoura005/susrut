import { useState } from 'react'
import type { HistoryRecord } from '../api'
import { formatDate, severityBadgeClass, formatConfidence, MODALITY_ICONS, MODALITY_LABELS, reportDownloadUrl, clearHistory } from '../api'
import TrendChart from './TrendChart'

interface Props {
  records: HistoryRecord[]
  onRefresh: () => void
  loading: boolean
}

type SubTab = 'records' | 'trends'

export default function HistoryPage({ records, onRefresh, loading }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('records')

  const handleClear = async () => {
    if (!window.confirm('Clear all history records?')) return
    await clearHistory()
    onRefresh()
  }

  return (
    <div className="history-page fade-in">
      <div className="history-header">
        <div>
          <h2 className="section-title">Analysis History</h2>
          <p className="section-sub">{records.length} record{records.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Sub-tabs */}
          <div className="history-subtabs">
            {(['records', 'trends'] as SubTab[]).map(t => (
              <button
                key={t}
                className={`history-subtab ${subTab === t ? 'history-subtab--active' : ''}`}
                onClick={() => setSubTab(t)}
                id={`history-subtab-${t}`}
              >
                {t === 'records' ? '📋 Records' : '📈 Trends'}
              </button>
            ))}
          </div>
          <button id="refresh-history-btn" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loading}>
            🔄
          </button>
          {records.length > 0 && (
            <button id="clear-history-btn" className="btn btn-danger btn-sm" onClick={handleClear}>
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Records tab */}
      {subTab === 'records' && (
        <>
          {loading && (
            <div className="history-loading">
              <div className="spinner" />
              <span>Loading…</span>
            </div>
          )}

          {!loading && records.length === 0 && (
            <div className="history-empty glass">
              <span className="history-empty-icon">📋</span>
              <p>No analyses yet. Upload a file to get started.</p>
            </div>
          )}

          <div className="history-list">
            {records.map(r => (
              <div key={r.id} className="history-item glass">
                <div className="history-item-left">
                  <span className="history-modality-icon">
                    {MODALITY_ICONS[r.modality] ?? '🩻'}
                  </span>
                  <div>
                    <p className="history-filename">{r.filename}</p>
                    <p className="history-meta">
                      {MODALITY_LABELS[r.modality] ?? r.modality}
                      &nbsp;·&nbsp;
                      {formatDate(r.timestamp)}
                      {(r as any).patient_id && (
                        <span className="history-pid"> · PT: {(r as any).patient_id}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="history-item-right">
                  <span className={severityBadgeClass(r.severity_level)}>{r.severity_level}</span>
                  <div className="history-pred">
                    <p className="history-pred-label">{r.prediction}</p>
                    <p className="history-conf">{formatConfidence(r.confidence)}</p>
                  </div>
                  {r.is_uncertain && (
                    <span className="badge badge-medium" title="High uncertainty">⚠</span>
                  )}
                  {r.stub && (
                    <span className="badge badge-stub" title="Stub result">Stub</span>
                  )}
                  {r.report_path && r.id && (
                    <a
                      href={reportDownloadUrl(r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      📄
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trends tab */}
      {subTab === 'trends' && <TrendChart />}
    </div>
  )
}

