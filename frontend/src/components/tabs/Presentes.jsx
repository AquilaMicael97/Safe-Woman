import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, LogOut as LogOutIcon, Clock } from 'lucide-react'
import { API_BASE } from '../../utils/api'
import FotoDocumento from '../FotoDocumento'

const TIPO_ESTILO = {
  agressor: { rotulo: 'Agressor', badge: 'bg-danger/15 text-danger',  ponto: 'bg-danger' },
  vitima:   { rotulo: 'Vítima',   badge: 'bg-vitima/15 text-vitima',  ponto: 'bg-vitima' },
  outro:    { rotulo: 'Comum',    badge: 'bg-white/8 text-white/45',  ponto: 'bg-safe' },
}

export default function Presentes() {
  const [presentes, setPresentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [baixando, setBaixando] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/presentes`)
      const data = await res.json()
      if (data.status === 'ok') {
        setPresentes(data.presentes)
        setErro(null)
      } else {
        setErro(data.mensagem || 'Erro ao carregar presentes.')
      }
    } catch {
      setErro('Erro de conexão com o servidor.')
    } finally {
      setCarregando(false)
    }
  }, [])

  // Atualização automática a cada 10s — visão ao vivo do local
  useEffect(() => {
    carregar()
    const id = setInterval(carregar, 10_000)
    return () => clearInterval(id)
  }, [carregar])

  async function registrarSaida(p) {
    if (!window.confirm(`Registrar saída de ${p.nome || p.cpf}?`)) return
    setBaixando(p.cpf)
    try {
      const res = await fetch(`${API_BASE}/api/saida-cpf?cpf=${encodeURIComponent(p.cpf)}`, { method: 'POST' })
      if (res.ok) await carregar()
    } finally {
      setBaixando(null)
    }
  }

  const agressores = presentes.filter(p => p.tipo === 'agressor')
  const vitimas    = presentes.filter(p => p.tipo === 'vitima')
  const conflito   = agressores.length > 0 && vitimas.length > 0

  return (
    <div className="p-7 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Presentes agora</h2>
          <p className="text-sm text-white/35 mt-1">
            {presentes.length} {presentes.length === 1 ? 'pessoa' : 'pessoas'} no local · atualiza a cada 10s
          </p>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-2 text-xs text-white/35 hover:text-white transition-colors px-3 py-2 rounded-xl border border-white/8 hover:border-white/20"
        >
          <RefreshCw size={12} />
          Atualizar
        </button>
      </div>

      {conflito && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-danger/12 border border-danger/35 rounded-2xl px-5 py-4 mb-6"
        >
          <AlertTriangle size={18} className="text-danger flex-shrink-0" />
          <div className="text-sm text-danger font-semibold">
            Agressor e vítima estão AMBOS no local — acione a segurança imediatamente.
          </div>
        </motion.div>
      )}

      {erro && <p className="text-xs text-danger mb-4">{erro}</p>}

      {carregando ? (
        <div className="text-center py-16 text-white/20 text-sm">Carregando...</div>
      ) : presentes.length === 0 ? (
        <div className="text-center py-16 text-white/20 text-sm">Ninguém no local no momento.</div>
      ) : (
        <div className="space-y-2">
          {presentes.map((p, i) => {
            const estilo = TIPO_ESTILO[p.tipo] || TIPO_ESTILO.outro
            return (
              <motion.div
                key={p.cpf}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className={`bg-surface border rounded-xl px-4 py-3 ${
                  p.tipo === 'agressor' ? 'border-danger/35' : 'border-white/8'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${estilo.ponto}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.nome || 'Desconhecido'}</div>
                    <div className="text-xs text-white/30 font-mono mt-0.5">{p.cpf}</div>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${estilo.badge}`}>
                    {estilo.rotulo}
                  </span>
                  <div className="text-[11px] text-white/20 flex items-center gap-1 flex-shrink-0">
                    <Clock size={10} />
                    {new Date(p.entrada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <button
                    onClick={() => registrarSaida(p)}
                    disabled={baixando === p.cpf}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-white/35 hover:text-danger disabled:opacity-40 px-2.5 py-1.5 rounded-lg border border-white/8 hover:border-danger/30 transition-all flex-shrink-0"
                  >
                    <LogOutIcon size={11} />
                    Saída
                  </button>
                </div>
                {/* Documento do agressor — identificação visual para a segurança */}
                {p.tipo === 'agressor' && <FotoDocumento cpf={p.cpf} legenda={p.nome} />}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
