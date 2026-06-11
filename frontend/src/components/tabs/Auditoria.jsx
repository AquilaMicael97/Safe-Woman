import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { apiGet } from '../../utils/api'

const ACAO_ROTULO = {
  login:              { rotulo: 'Login',            cor: 'bg-white/8 text-white/45' },
  resetar_banco:      { rotulo: 'Reset do banco',   cor: 'bg-danger/15 text-danger' },
  entrada_negada:     { rotulo: 'Entrada negada',   cor: 'bg-danger/15 text-danger' },
  liberar_entrada:    { rotulo: 'Entrada liberada', cor: 'bg-safe/12 text-safe' },
  purgar_presencas:   { rotulo: 'Purga de dados',   cor: 'bg-warn/15 text-warn' },
  criar_usuario:      { rotulo: 'Usuário criado',   cor: 'bg-accent/15 text-accent' },
  editar_usuario:     { rotulo: 'Usuário editado',  cor: 'bg-accent/15 text-accent' },
  excluir_usuario:    { rotulo: 'Usuário excluído', cor: 'bg-danger/15 text-danger' },
  exportar_historico: { rotulo: 'Exportação CSV',   cor: 'bg-white/8 text-white/45' },
}

export default function Auditoria({ token }) {
  const [eventos, setEventos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  async function carregar() {
    setCarregando(true)
    try {
      const data = await apiGet('/api/admin/auditoria', token)
      setEventos(data.eventos)
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function fmt(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-7">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Auditoria</h2>
          <p className="text-sm text-white/35 mt-1">
            Quem fez o quê — ações sensíveis registradas pelo sistema
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

      {erro && <p className="text-xs text-danger mb-4">{erro}</p>}

      <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Quando', 'Usuário', 'Ação', 'Detalhe'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-bold text-white/25 uppercase tracking-widest whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={4} className="text-center py-14 text-white/20 text-sm">Carregando...</td></tr>
              ) : eventos.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-14 text-white/20 text-sm">Nenhum evento registrado ainda.</td></tr>
              ) : (
                eventos.map((ev, i) => {
                  const acao = ACAO_ROTULO[ev.acao] || { rotulo: ev.acao, cor: 'bg-white/8 text-white/45' }
                  return (
                    <motion.tr
                      key={ev.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3) }}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">{fmt(ev.criado_em)}</td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{ev.usuario || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${acao.cor}`}>
                          {acao.rotulo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/45 text-xs">{ev.detalhe || '—'}</td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
