import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, AlertTriangle, Activity, Clock, Trash2, Users, FileText, LogIn, LogOut } from 'lucide-react'
import { getSessao } from '../../utils/auth'
import { API_BASE, apiGet } from '../../utils/api'

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

// Gráfico de barras simples (sem dependência extra) — entradas por hora do dia
function GraficoEntradas({ dados }) {
  const max = Math.max(...dados.map(d => d.total), 1)
  const horas = Array.from({ length: 24 }, (_, h) => ({
    hora: h,
    total: dados.find(d => d.hora === h)?.total || 0,
  }))

  return (
    <div className="bg-surface border border-white/8 rounded-2xl p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-4">
        Entradas por hora · hoje
      </h3>
      <div className="flex items-end gap-1 h-28">
        {horas.map(({ hora, total }) => (
          <div key={hora} className="flex-1 flex flex-col items-center gap-1 group">
            <span className="text-[9px] text-white/0 group-hover:text-white/60 transition-colors">
              {total || ''}
            </span>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(total / max) * 80}px` }}
              transition={{ duration: 0.4, delay: hora * 0.015 }}
              className={`w-full rounded-t ${total > 0 ? 'bg-accent/70 group-hover:bg-accent' : 'bg-white/5'}`}
              style={{ minHeight: total > 0 ? 4 : 2 }}
            />
            <span className="text-[8px] text-white/20">{hora % 6 === 0 ? `${hora}h` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard({ token }) {
  const sessao = getSessao()

  const [stats, setStats] = useState(null)
  const [recentes, setRecentes] = useState([])
  const [erro, setErro] = useState(null)

  const [resetAberto, setResetAberto] = useState(false)
  const [resetSenha,  setResetSenha]  = useState('')
  const [resetando,   setResetando]   = useState(false)
  const [resetOk,     setResetOk]     = useState(null)
  const [resetErro,   setResetErro]   = useState(null)

  async function carregar() {
    try {
      const [s, h] = await Promise.all([
        apiGet('/api/admin/stats', token),
        apiGet('/api/admin/historico', token),
      ])
      setStats(s)
      setRecentes(h.historico.slice(0, 6))
      setErro(null)
    } catch (e) {
      setErro(e.message)
    }
  }

  // Atualização automática a cada 30s
  useEffect(() => {
    carregar()
    const id = setInterval(carregar, 30_000)
    return () => clearInterval(id)
  }, [token])

  async function resetarBanco() {
    if (!resetSenha) return
    setResetando(true)
    setResetErro(null)
    setResetOk(null)

    try {
      const res = await fetch(`${API_BASE}/api/admin/resetar-banco`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmar: true, senha: resetSenha }),
      })
      const data = await res.json()

      if (!res.ok) {
        setResetErro(data.detail || data.mensagem || 'Erro ao resetar o banco.')
        return
      }

      setResetOk('Banco resetado: medidas, vítimas, agressores, presenças, pré-cadastros e alertas apagados.')
      setResetAberto(false)
      setResetSenha('')
      await carregar()
    } catch {
      setResetErro('Erro de conexão com o servidor.')
    } finally {
      setResetando(false)
    }
  }

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

      {erro && (
        <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-4 py-2.5 mb-6">
          <AlertTriangle size={13} className="flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* Stats — dados reais do backend */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard
          label="Presentes agora"
          value={stats?.total_presentes ?? '—'}
          icon={Users}
          cor={{ bg: 'bg-accent/15', text: 'text-accent' }}
          delay={0.05}
        />
        <StatCard
          label="Agressores no local"
          value={stats?.agressores_presentes ?? '—'}
          icon={AlertTriangle}
          cor={{ bg: 'bg-danger/12', text: 'text-danger' }}
          delay={0.1}
        />
        <StatCard
          label="Vítimas no local"
          value={stats?.vitimas_presentes ?? '—'}
          icon={ShieldCheck}
          cor={{ bg: 'bg-vitima/12', text: 'text-vitima' }}
          delay={0.15}
        />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Medidas protetivas"
          value={stats?.total_medidas ?? '—'}
          icon={FileText}
          cor={{ bg: 'bg-safe/12', text: 'text-safe' }}
          delay={0.2}
        />
        <StatCard
          label="Entradas hoje"
          value={stats?.entradas_hoje ?? '—'}
          icon={LogIn}
          cor={{ bg: 'bg-accent/15', text: 'text-accent' }}
          delay={0.25}
        />
        <StatCard
          label="Saídas hoje"
          value={stats?.saidas_hoje ?? '—'}
          icon={LogOut}
          cor={{ bg: 'bg-white/8', text: 'text-white/60' }}
          delay={0.3}
        />
      </div>

      {/* Gráfico de entradas por hora */}
      <div className="mb-8">
        <GraficoEntradas dados={stats?.entradas_por_hora || []} />
      </div>

      {/* Atividade recente — direto do banco */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
          Atividade recente · hoje
        </h3>

        {recentes.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">
            Nenhum registro hoje.
          </div>
        ) : (
          <div className="space-y-2">
            {recentes.map((reg, i) => (
              <motion.div
                key={`${reg.cpf}-${reg.entrada_em}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 bg-surface border border-white/8 rounded-xl px-4 py-3"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  reg.tipo === 'agressor' ? 'bg-danger' : reg.tipo === 'vitima' ? 'bg-vitima' : 'bg-safe'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {reg.nome || 'Desconhecido'}
                  </div>
                  <div className="text-xs text-white/30 font-mono mt-0.5">{reg.cpf}</div>
                </div>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  reg.saida_em ? 'bg-white/8 text-white/35' : 'bg-safe/12 text-safe'
                }`}>
                  {reg.saida_em ? 'Saiu' : 'No local'}
                </span>
                <div className="text-[11px] text-white/20 flex items-center gap-1 flex-shrink-0">
                  <Clock size={10} />
                  {new Date(reg.entrada_em).toLocaleTimeString('pt-BR', {
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
          agressores, presenças, pré-cadastros e alertas. Ação irreversível — use apenas em testes
          ou ao encerrar o evento. Confirme com a <strong className="text-white/55">sua senha</strong>.
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
              type="password"
              value={resetSenha}
              onChange={e => setResetSenha(e.target.value)}
              placeholder="Confirme sua senha"
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
