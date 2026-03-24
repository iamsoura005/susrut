interface Props {
  active: 'analyze' | 'batch' | 'history' | 'status'
  onChange: (tab: 'analyze' | 'batch' | 'history' | 'status') => void
}

export default function Navbar({ active, onChange }: Props) {
  return (
    <nav className="navbar glass" role="navigation" aria-label="Main navigation">
      <div className="navbar-brand">
        <span className="navbar-logo">🩻</span>
        <span className="navbar-title">Radi<span className="accent">AI</span></span>
        <span className="badge badge-accent navbar-version">v1.1</span>
      </div>
      <div className="navbar-tabs" role="tablist">
        {[
          { id: 'analyze', label: '⬆ Analyze' },
          { id: 'batch',   label: '📂 Batch'   },
          { id: 'history', label: '📋 History' },
          { id: 'status',  label: '⚙ Models'  },
        ].map(tab => (
          <button
            key={tab.id}
            id={`nav-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            className={`navbar-tab ${active === tab.id ? 'navbar-tab--active' : ''}`}
            onClick={() => onChange(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
