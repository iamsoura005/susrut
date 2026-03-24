import { Activity, Moon, Sun, User } from 'lucide-react'
import { memo } from 'react'
import { motion } from 'framer-motion'
import type { Tab } from '../App'

interface Props {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  darkMode: boolean
  toggleDarkMode: () => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'batch', label: 'Batch' },
  { id: 'history', label: 'History' },
  { id: 'status', label: 'Models' },
]

function Navbar({ activeTab, onTabChange, darkMode, toggleDarkMode }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-radiai-dark/80 backdrop-blur-xl transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-2 bg-radiai-cyan/10 rounded-lg text-radiai-cyan">
            <Activity size={24} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              Radi<span className="text-radiai-cyan">AI</span>
            </h1>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-1">
              Intelligence Platform
            </span>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'text-radiai-cyan'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute inset-0 bg-white dark:bg-slate-700 shadow-sm rounded-md"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">System Healthy</span>
          </div>

          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-radiai-cyan to-blue-500 flex items-center justify-center text-white shadow-md cursor-pointer hover:opacity-90 transition-opacity">
            <User size={16} />
          </div>
        </div>
      </div>
    </header>
  )
}

export default memo(Navbar)
