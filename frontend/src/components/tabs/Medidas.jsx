import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, RefreshCw } from 'lucide-react'
import { apiGet } from '../../utils/api'

export default function Medidas({ token }) {
  const [medidas, setMedidas] = useState([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  async function carregar() {
    setCarregando(true)
    try {
      const data = await apiGet('/api/admin/medidas', token)
      setMedidas(data.medidas)
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const filtrado = medidas.filter(m => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      m.numero_processo?.toLowerCase().includes(q) ||
      m.nome_vitima?.toLowerCase().includes(q) ||
      m.nome_agressor?.toLowerCase().includes(q) ||
      m.cpf_agressor?.includes(q)
    )
  })

  return (
    <div className="p-7">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Medidas Protetivas</h2>
          <p className="text-sm text-white/35 mt-1">
            {medidas.length} {medidas.length === 1 ? 'medida cadastrada' : 'medidas cadastradas'}
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

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por processo, vítima, agressor ou CPF..."
          className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      {erro && <p className="text-xs text-danger mb-4">{erro}</p>}

      <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Processo', 'Vítima', 'Agressor', 'CPF Agressor', 'Emissão', 'Vara', 'Status'].map(h => (
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
                <tr><td colSpan={7} className="text-center py-14 text-white/20 text-sm">Carregando...</td></tr>
              ) : filtrado.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-white/20 text-sm">
                    {busca ? 'Nenhum resultado.' : 'Nenhuma medida protetiva cadastrada.'}
                  </td>
                </tr>
              ) : (
                filtrado.map((m, i) => (
                  <motion.tr
                    key={m.numero_processo}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white/45 font-mono text-xs whitespace-nowrap">{m.numero_processo}</td>
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{m.nome_vitima || '—'}</td>
                    <td className="px-4 py-3 text-white/70 whitespace-nowrap">{m.nome_agressor || '—'}</td>
                    <td className="px-4 py-3 text-white/45 font-mono text-xs whitespace-nowrap">{m.cpf_agressor || '—'}</td>
                    <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">{m.data_emissao || '—'}</td>
                    <td className="px-4 py-3 text-white/35 text-xs max-w-[200px] truncate">{m.vara || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        m.ativa ? 'bg-safe/12 text-safe' : 'bg-white/8 text-white/35'
                      }`}>
                        {m.ativa ? 'Ativa' : 'Inativa'}
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
