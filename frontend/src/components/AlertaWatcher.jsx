import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { apiGet } from '../utils/api'

// Vigia de alertas: consulta /api/admin/alertas a cada 8s e exibe um toast
// no momento em que um conflito vítima×agressor é detectado na portaria.
export default function AlertaWatcher({ token }) {
  const [alertas, setAlertas] = useState([])
  const ultimoId = useRef(null)

  useEffect(() => {
    let ativo = true

    async function verificar() {
      try {
        // Primeira chamada só marca o ponteiro — não notifica alertas antigos
        if (ultimoId.current === null) {
          const data = await apiGet('/api/admin/alertas', token)
          ultimoId.current = data.alertas[0]?.id ?? 0
          return
        }
        const data = await apiGet(`/api/admin/alertas?apos_id=${ultimoId.current}`, token)
        if (!ativo || data.alertas.length === 0) return
        ultimoId.current = data.alertas[0].id
        setAlertas(prev => [...data.alertas, ...prev].slice(0, 5))
      } catch {
        // Silencioso: sem conexão ou sessão expirada — tenta de novo no próximo ciclo
      }
    }

    verificar()
    const id = setInterval(verificar, 8_000)
    return () => { ativo = false; clearInterval(id) }
  }, [token])

  function dispensar(id) {
    setAlertas(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-[360px] max-w-[calc(100vw-2rem)]">
      <AnimatePresence>
        {alertas.map(a => {
          const urgente = a.nivel.includes('urgente')
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 border shadow-2xl shadow-black/40 ${
                a.nivel.startsWith('vermelho')
                  ? 'bg-[#2a1216] border-danger/50'
                  : 'bg-[#2a2312] border-warn/50'
              }`}
            >
              <AlertTriangle
                size={16}
                className={`flex-shrink-0 mt-0.5 ${a.nivel.startsWith('vermelho') ? 'text-danger' : 'text-warn'} ${
                  urgente ? 'animate-pulse' : ''
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold mb-0.5 ${a.nivel.startsWith('vermelho') ? 'text-danger' : 'text-warn'}`}>
                  {urgente ? 'ALERTA URGENTE' : 'Alerta'}
                  {a.nome ? ` · ${a.nome}` : ''}
                </div>
                <div className="text-xs text-white/70 leading-relaxed">{a.mensagem}</div>
              </div>
              <button
                onClick={() => dispensar(a.id)}
                className="text-white/30 hover:text-white transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
