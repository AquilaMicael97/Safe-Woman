import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, AlertTriangle, Activity, Clock } from 'lucide-react'
import { getHistorico } from '../../utils/history'
import { getSessao } from '../../utils/auth'

function StatCard({ label, value, icon: Icon, cor, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-surface border border-white/8 rounded-2xl p-5"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${cor.bg}`}>
        <Icon size={17} className={cor.text} />
      </div>
      <div className={`text-3xl font-extrabold mb-1 ${cor.text}`}>{value}</div>
      <div className="text-xs text-white/40 font-medium">{label}</div>
    </motion.div>
  )
}

export default function Dashboard() {
  const sessao = getSessao()
  const historico = getHistorico()

  const stats = useMemo(() => ({
    total:     historico.length,
    alertas:   historico.filter(h => h.veredito === 'Alerta').length,
    liberados: historico.filter(h => h.veredito === 'Liberado').length,
  }), [historico.length])

  const recentes = historico.slice(0, 6)

  return (
    <div className="p-7 max-w-3xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-7"
      >
        <h2 className="text-xl font-bold text-white">
          Olá, {sessao?.nome} 👋
        </h2>
        <p className="text-sm text-white/35 mt-1">Painel administrativo · Safe Woman</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Analisados"
          value={stats.total}
          icon={Activity}
          cor={{ bg: 'bg-accent/15', text: 'text-accent' }}
          delay={0.05}
        />
        <StatCard
          label="Alertas Gerados"
          value={stats.alertas}
          icon={AlertTriangle}
          cor={{ bg: 'bg-danger/12', text: 'text-danger' }}
          delay={0.1}
        />
        <StatCard
          label="Liberados"
          value={stats.liberados}
          icon={ShieldCheck}
          cor={{ bg: 'bg-safe/12', text: 'text-safe' }}
          delay={0.15}
        />
      </div>

      {/* Atividade recente */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
          Atividade recente
        </h3>

        {recentes.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">
            Nenhum registro ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {recentes.map((reg, i) => (
              <motion.div
                key={reg.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 bg-surface border border-white/8 rounded-xl px-4 py-3"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  reg.veredito === 'Alerta' ? 'bg-danger' : 'bg-safe'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {reg.nome || 'Desconhecido'}
                  </div>
                  <div className="text-xs text-white/30 mt-0.5">{reg.operador}</div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  reg.veredito === 'Alerta'
                    ? 'bg-danger/15 text-danger'
                    : 'bg-safe/12 text-safe'
                }`}>
                  {reg.veredito}
                </span>
                <div className="text-[11px] text-white/20 flex items-center gap-1 flex-shrink-0">
                  <Clock size={10} />
                  {new Date(reg.hora).toLocaleTimeString('pt-BR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
