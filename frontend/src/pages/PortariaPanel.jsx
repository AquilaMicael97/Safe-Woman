import { useNavigate } from 'react-router-dom'
import { Shield, LogOut } from 'lucide-react'
import { getSessao, encerrarSessao } from '../utils/auth'
import Portaria from '../components/tabs/Portaria'

export default function PortariaPanel() {
  const navigate = useNavigate()
  const sessao = getSessao()

  function logout() {
    encerrarSessao()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header fixo */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
            <Shield size={15} className="text-accent" />
          </div>
          <span className="font-extrabold text-sm tracking-tight">
            <span className="text-white">Safe</span>
            <span className="text-accent">Woman</span>
          </span>
          <span className="text-[11px] font-semibold text-white/30 border border-white/10 rounded-full px-2.5 py-0.5">
            Portaria
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-safe" />
            <span className="text-xs text-white/45 font-medium">{sessao?.nome}</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-danger transition-colors"
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1">
        <Portaria operador={sessao?.nome} />
      </div>
    </div>
  )
}
