import { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { API_BASE, MODALITY_LABELS, MODALITY_ICONS, type Modality } from '../api'

interface TrendPoint {
  timestamp:     string
  modality:      string
  prediction:    string
  confidence:    number   // already in % (0-100)
  severity_score: number  // 0–1
  severity_level: string
  filename:      string
}

interface TrendData {
  patient_id: string
  total:      number
  points:     TrendPoint[]
}

const SEVERITY_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f97316',
  Medium:   '#eab308',
  Low:      '#22c55e',
  Unknown:  '#6b7280',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as TrendPoint
  return (
    <div className="trend-tooltip glass">
      <p className="trend-tip-date">{new Date(p.timestamp).toLocaleString('en-IN')}</p>
      <p className="trend-tip-file">{p.filename}</p>
      <p className="trend-tip-mod">{MODALITY_ICONS[p.modality as Modality]} {MODALITY_LABELS[p.modality as Modality] ?? p.modality}</p>
      <p className="trend-tip-pred">{p.prediction}</p>
      <p className="trend-tip-conf" style={{ color: '#06b6d4' }}>Confidence: <strong>{p.confidence}%</strong></p>
      <p className="trend-tip-sev" style={{ color: SEVERITY_COLOR[p.severity_level] ?? '#fff' }}>
        Severity: <strong>{p.severity_level}</strong> ({(p.severity_score * 100).toFixed(0)}%)
      </p>
    </div>
  )
}

export default function TrendChart() {
  const [patientId, setPatientId] = useState('')
  const [query,     setQuery]     = useState('')
  const [data,      setData]      = useState<TrendData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const fetchTrends = useCallback(async (pid: string) => {
    setLoading(true)
    setError('')
    setData(null)
    try {
      const url = pid.trim()
        ? `${API_BASE}/api/history/trends?patient_id=${encodeURIComponent(pid.trim())}`
        : `${API_BASE}/api/history/trends`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch trends')
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = () => {
    setQuery(patientId)
    fetchTrends(patientId)
  }

  const chartData = (data?.points ?? []).map((p, i) => ({
    ...p,
    name:  formatDate(p.timestamp),
    index: i + 1,
    severity_pct: Math.round(p.severity_score * 100),
  }))

  return (
    <div className="trend-chart-wrap">
      {/* Search bar */}
      <div className="trend-search glass">
        <span className="trend-search-icon">📈</span>
        <input
          type="text"
          placeholder="Patient ID (leave blank for all records)"
          value={patientId}
          onChange={e => setPatientId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="trend-input"
          id="trend-patient-input"
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSearch}
          disabled={loading}
          id="trend-search-btn"
        >
          {loading ? '⏳' : '🔍 View Trends'}
        </button>
      </div>

      {error && <p className="text-error">{error}</p>}

      {data && (
        <>
          <div className="trend-meta">
            <span className="badge badge-accent">{data.total} record{data.total !== 1 ? 's' : ''}</span>
            <span className="text-dim">
              {query ? `Patient: ${query}` : 'All patients'}</span>
          </div>

          {chartData.length === 0 && (
            <div className="empty-state glass">
              <div className="empty-icon">📊</div>
              <p>No records found{query ? ` for patient "${query}"` : ''}.</p>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="trend-charts">
              {/* Confidence over time */}
              <div className="trend-chart-block glass">
                <h4 className="trend-chart-title">Confidence Over Time (%)</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={70} stroke="#eab308" strokeDasharray="4 4" label={{ value: '70%', fill: '#eab308', fontSize: 10 }} />
                    <Line
                      type="monotone" dataKey="confidence"
                      stroke="#06b6d4" strokeWidth={2}
                      dot={{ r: 4, fill: '#06b6d4' }}
                      activeDot={{ r: 6 }}
                      name="Confidence"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Severity score over time */}
              <div className="trend-chart-block glass">
                <h4 className="trend-chart-title">Severity Score Over Time (%)</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={60} stroke="#f97316" strokeDasharray="4 4" label={{ value: '60%', fill: '#f97316', fontSize: 10 }} />
                    <Line
                      type="monotone" dataKey="severity_pct"
                      stroke="#f97316" strokeWidth={2}
                      dot={({ cx, cy, payload }) => (
                        <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4}
                          fill={SEVERITY_COLOR[payload.severity_level] ?? '#f97316'}
                          stroke="none"
                        />
                      )}
                      activeDot={{ r: 6, fill: '#f97316' }}
                      name="Severity"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Record table */}
              <div className="trend-table-wrap glass">
                <table className="trend-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Date</th><th>File</th><th>Modality</th>
                      <th>Prediction</th><th>Conf.</th><th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((p, i) => (
                      <tr key={i}>
                        <td>{p.index}</td>
                        <td>{formatDate(p.timestamp)}</td>
                        <td className="trend-td-file">{p.filename}</td>
                        <td>{MODALITY_ICONS[p.modality as Modality]} {MODALITY_LABELS[p.modality as Modality] ?? p.modality}</td>
                        <td>{p.prediction}</td>
                        <td style={{ color: '#06b6d4' }}>{p.confidence}%</td>
                        <td style={{ color: SEVERITY_COLOR[p.severity_level] ?? '#fff' }}>
                          {p.severity_level}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
