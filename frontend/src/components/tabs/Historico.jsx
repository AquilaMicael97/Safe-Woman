import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Download, RefreshCw } from 'lucide-react'
import { apiGet, apiDownload } from '../../utils/api'

const TIPO_BADGE = {
  agressor: 'bg-danger/15 text-danger',
  vitima:   'bg-vitima/15 text-vitima',
  outro:    'bg-white/8 text-white/45',
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Historico({ token }) {
  const [busca, setBusca] = useState('')
  const [data, setData] = useState(hojeISO())
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [exportando, setExportando] = useState(false)

  async function carregar(dia = data) {
    setCarregando(true)
    try {
      const res = await apiGet(`/api/admin/historico?data=${dia}`, token)
      setHistorico(res.historico)
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [data])

  async function exportarCSV() {
    setExportando(true)
    try {
      await apiDownload(`/api/admin/historico/export?data=${data}`, token, `historico_${data}.csv`)
    } catch (e) {
      setErro(e.message)
    } finally {
      setExportando(false)
    }
  }

  const filtrado = historico.filter(r => {
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      r.nome?.toLowerCase().includes(q) ||
      r.cpf?.includes(q)
    )
  })

  function fmt(iso) {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Histórico</h2>
          <p className="text-sm text-white/35 mt-1">
            {historico.length} {historico.length === 1 ? 'registro' : 'registros'} em {data.split('-').reverse().join('/')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => carregar()}
            className="flex items-center gap-2 text-xs text-white/35 hover:text-white transition-colors px-3 py-2 rounded-xl border border-white/8 hover:border-white/20"
          >
            <RefreshCw size={12} />
            Atualizar
          </button>
          <button
            onClick={exportarCSV}
            disabled={exportando || historico.length === 0}
            className="flex items-center gap-2 text-xs font-bold text-accent border border-accent/35 hover:bg-accent/12 disabled:opacity-40 px-3 py-2 rounded-xl transition-all"
          >
            <Download size={12} />
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Filtros: data + busca */}
      <div className="flex gap-3 mb-5">
        <input
          type="date"
          value={data}
          max={hojeISO()}
          onChange={e => e.target.value && setData(e.target.value)}
          className="bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-accent/50 transition-colors [color-scheme:dark]"
        />
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full bg-surface border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {erro && <p className="text-xs text-danger mb-4">{erro}</p>}

      {/* Tabela */}
      <div className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Nome', 'CPF', 'Tipo', 'Entrada', 'Saída', 'Status', 'LGPD'].map(h => (
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
                    {busca ? 'Nenhum resultado.' : 'Nenhum registro nesse dia.'}
                  </td>
                </tr>
              ) : (
                filtrado.map((reg, i) => (
                  <motion.tr
                    key={`${reg.cpf}-${reg.entrada_em}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                      {reg.nome || '—'}
                    </td>
                    <td className="px-4 py-3 text-white/45 font-mono text-xs whitespace-nowrap">
                      {reg.cpf || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        TIPO_BADGE[reg.tipo] || TIPO_BADGE.outro
                      }`}>
                        {reg.tipo === 'agressor' ? 'Agressor' : reg.tipo === 'vitima' ? 'Vítima' : 'Comum'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">{fmt(reg.entrada_em) || '—'}</td>
                    <td className="px-4 py-3 text-white/35 text-xs whitespace-nowrap">{fmt(reg.saida_em) || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        reg.saida_em ? 'bg-white/8 text-white/35' : 'bg-safe/12 text-safe'
                      }`}>
                        {reg.saida_em ? 'Saiu' : 'No local'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                        reg.consentimento ? 'bg-safe/12 text-safe' : 'bg-warn/15 text-warn'
                      }`}>
                        {reg.consentimento ? 'Sim' : 'Não'}
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
