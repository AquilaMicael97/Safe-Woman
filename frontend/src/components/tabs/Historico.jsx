import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Search } from 'lucide-react'
import { getHistorico, limparHistorico } from '../../utils/history'

export default function Historico() {
  const [busca, setBusca] = useState('')
  const [historico, setHistorico] = useState(getHistorico)

  const filtrado = historico.filter(r => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      r.nome?.toLowerCase().includes(q) ||
      r.cpf?.includes(q) ||
      r.operador?.toLowerCase().includes(q)
    )
  })

  function handleLimpar() {
    if (!window.confirm('Limpar todo o histórico? Essa ação não pode ser desfeita.')) return
    limparHistorico()
    setHistorico([])
  }

  function fmt(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Histórico</h2>
          <p className="text-sm text-white/35 mt-1">
            {historico.length} {historico.length === 1 ? 'registro' : 'registros'} no total
          </p>
        </div>
        {historico.length > 0 && (
          <button
            onClick={handleLimpar}
            className="flex items-center gap-2 text-xs text-white/35 hover:text-danger transition-colors px-3 py-2 rounded-xl hover:bg-danger/8 border border-white/8"
          >
            <Trash2 size={12} />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou operador..."
          className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {/* Tabela */}
      <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Hora', 'Nome', 'CPF', 'Operador', 'Veredito'].map(h => (
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
              {filtrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-white/20 text-sm">
                    {busca ? 'Nenhum resultado.' : 'Nenhum registro no histórico.'}
                  </td>
                </tr>
              ) : (
                filtrado.map((reg, i) => (
                  <motion.tr
                    key={reg.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">
                      {fmt(reg.hora)}
                    </td>
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                      {reg.nome || '—'}
                    </td>
                    <td className="px-4 py-3 text-white/45 font-mono text-xs whitespace-nowrap">
                      {reg.cpf || '—'}
                    </td>
                    <td className="px-4 py-3 text-white/45 whitespace-nowrap">
                      {reg.operador}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        ['Alerta', 'Entrada negada'].includes(reg.veredito)
                          ? 'bg-danger/15 text-danger'
                          : reg.veredito === 'Em espera'
                            ? 'bg-warn/15 text-warn'
                            : 'bg-safe/12 text-safe'
                      }`}>
                        {reg.veredito}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
