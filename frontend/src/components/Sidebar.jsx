import { motion } from 'framer-motion'
import { LayoutDashboard, History, Shield, LogOut } from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'historico', label: 'Histórico',  icon: History },
]

export default function Sidebar({ aba, setAba, nome, onLogout }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface border-r border-white/8 flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-white/8">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
            <Shield size={15} className="text-accent" />
          </div>
          <span className="font-extrabold text-sm tracking-tight">
            <span className="text-white">Safe</span>
            <span className="text-accent">Woman</span>
          </span>
        </div>

        <div className="flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-safe flex-shrink-0" />
          <span className="text-xs text-white/60 font-medium truncate">{nome}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        {TABS.map(({ id, label, icon: Icon }) => {
          const ativo = aba === id
          return (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                ativo
                  ? 'text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {ativo && (
                <motion.div
                  layoutId="sidebar-pill"
                  className="absolute inset-0 bg-accent/15 rounded-xl border border-accent/20"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
                />
              )}
              <Icon size={15} className="relative z-10 flex-shrink-0" />
              <span className="relative z-10">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/8">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/35 hover:text-danger hover:bg-danger/8 transition-colors"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </aside>
  )
}
