import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, AlertTriangle, Activity, Clock, Trash2 } from 'lucide-react'
import { getHistorico } from '../../utils/history'
import { getSessao } from '../../utils/auth'
import { API_BASE } from '../../utils/api'

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

  const [resetAberto, setResetAberto] = useState(false)
  const [resetUsuario, setResetUsuario] = useState('admin')
  const [resetSenha,   setResetSenha]   = useState('')
  const [resetando,  setResetando]  = useState(false)
  const [resetOk,    setResetOk]    = useState(null)
  const [resetErro,  setResetErro]  = useState(null)

  async function resetarBanco() {
    if (!resetSenha) return
    setResetando(true)
    setResetErro(null)
    setResetOk(null)

    try {
      // Login real no backend para obter o token de admin
      const login = await fetch(`${API_BASE}/api/admin/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usuario: resetUsuario, senha: resetSenha }),
      })
      const dataLogin = await login.json()

      if (!login.ok) {
        setResetErro(dataLogin.detail || 'Usuário ou senha do sistema incorretos.')
        return
      }

      const res = await fetch(`${API_BASE}/api/admin/resetar-banco`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${dataLogin.token}`,
        },
        body: JSON.stringify({ confirmar: true, senha: resetSenha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResetErro(data.detail || data.mensagem || 'Erro ao resetar o banco.')
        return
      }

      setResetOk('Banco resetado: medidas, vítimas, agressores, presenças e pré-cadastros apagados.')
      setResetAberto(false)
      setResetSenha('')
    } catch {
      setResetErro('Erro de conexão com o servidor.')
    } finally {
      setResetando(false)
    }
  }

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

      {/* Zona de perigo — reset completo do banco */}
      <div className="mt-10 border border-danger/20 rounded-2xl p-5">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-danger/70 mb-2">
          Zona de perigo
        </h3>
        <p className="text-xs text-white/35 mb-4 leading-relaxed">
          Apaga <strong className="text-white/55">todas</strong> as medidas protetivas, vítimas,
          agressores, presenças e pré-cadastros. Ação irreversível — use apenas em testes
          ou ao encerrar o evento.
        </p>

        {!resetAberto ? (
          <button
            onClick={() => { setResetAberto(true); setResetOk(null); setResetErro(null) }}
            className="flex items-center gap-2 text-xs font-bold text-danger border border-danger/35 hover:bg-danger/12 px-4 py-2.5 rounded-xl transition-all"
          >
            <Trash2 size={13} />
            Resetar banco de dados
          </button>
        ) : (
          <div className="space-y-3 max-w-sm">
            <input
              type="text"
              value={resetUsuario}
              onChange={e => setResetUsuario(e.target.value)}
              placeholder="Usuário do sistema"
              className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-danger/50 transition-colors"
            />
            <input
              type="password"
              value={resetSenha}
              onChange={e => setResetSenha(e.target.value)}
              placeholder="Senha do sistema"
              className="w-full bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-danger/50 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={resetarBanco}
                disabled={!resetSenha || resetando}
                className="flex-1 flex items-center justify-center gap-2 bg-danger/15 border border-danger/40 hover:bg-danger/25 disabled:opacity-40 text-danger text-xs font-bold py-2.5 rounded-xl transition-all"
              >
                {resetando ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                    Resetando...
                  </>
                ) : (
                  'Confirmar reset'
                )}
              </button>
              <button
                onClick={() => { setResetAberto(false); setResetSenha(''); setResetErro(null) }}
                className="flex-1 text-xs font-semibold text-white/45 hover:text-white border border-white/10 hover:border-white/20 py-2.5 rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {resetErro && (
          <p className="mt-3 text-xs text-danger">{resetErro}</p>
        )}
        {resetOk && (
          <p className="mt-3 text-xs text-safe font-semibold">{resetOk}</p>
        )}
      </div>
    </div>
  )
}
