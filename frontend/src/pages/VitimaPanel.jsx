import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Upload, X, FileText, CheckCircle, Clock } from 'lucide-react'
import { getSessaoVitima, encerrarSessaoVitima } from '../utils/auth'
import { API_BASE } from '../utils/api'
import logo from '../assets/logo.png'

function Toast({ msg, tipo, visivel }) {
  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-2xl border whitespace-nowrap ${
            tipo === 'sucesso'
              ? 'bg-surface2 border-safe/30 text-safe'
              : 'bg-surface2 border-danger/30 text-danger'
          }`}
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function VitimaPanel() {
  const navigate = useNavigate()
  const sessao = getSessaoVitima()

  const [arquivo, setArquivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [medidas, setMedidas] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [toast, setToast] = useState({ msg: '', tipo: '', visivel: false })
  const inputRef = useRef(null)

  function authHeader() {
    return { Authorization: `Bearer ${sessao?.token}` }
  }

  function mostrarToast(msg, tipo = 'sucesso') {
    setToast({ msg, tipo, visivel: true })
    setTimeout(() => setToast(t => ({ ...t, visivel: false })), 3500)
  }

  async function carregarMedidas() {
    try {
      const res = await fetch(`${API_BASE}/api/vitima/status`, { headers: authHeader() })
      if (res.status === 401) { logout(); return }
      const data = await res.json()
      setMedidas(data.medidas || [])
    } catch {
      // sem conexão — mantém lista vazia
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarMedidas()
  }, [])

  function logout() {
    encerrarSessaoVitima()
    navigate('/', { replace: true })
  }

  function selecionarArquivo(file) {
    if (!file) return
    setArquivo(file)
    setPreview(URL.createObjectURL(file))
  }

  function limpar() {
    setArquivo(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files[0]
    if (file) selecionarArquivo(file)
  }

  async function enviarMedida() {
    if (!arquivo) return
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('foto', arquivo)
      const res = await fetch(`${API_BASE}/api/vitima/pre-cadastro-medida`, {
        method: 'POST',
        headers: authHeader(),
        body: form,
      })
      const data = await res.json()
      if (res.ok) {
        limpar()
        mostrarToast('✅ Medida cadastrada! Será ativada na entrada.', 'sucesso')
        await carregarMedidas()
      } else {
        mostrarToast('❌ ' + (data.mensagem || data.detail || 'Erro ao cadastrar'), 'erro')
      }
    } catch {
      mostrarToast('❌ Erro de conexão. Tente novamente.', 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-surface border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1 shadow shadow-black/20">
            <img src={logo} alt="Safe Woman" className="h-7 w-auto" />
          </div>
          <span className="text-[11px] font-semibold text-white/30 border border-white/10 rounded-full px-2.5 py-0.5">
            Área Protegida
          </span>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-danger transition-colors"
        >
          <LogOut size={13} />
          Sair
        </button>
      </header>

      <div className="max-w-md mx-auto w-full px-5 py-7 flex-1">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-vitima/8 border border-vitima/20 rounded-2xl px-5 py-5 mb-6 text-center"
        >
          <div className="text-3xl mb-2">🛡️</div>
          <p className="text-sm font-bold text-white mb-1">Área de Proteção</p>
          <p className="text-xs text-white/45 leading-relaxed">
            Cadastre sua medida protetiva aqui com segurança.<br />
            Ela será <span className="text-vitima font-semibold">ativada automaticamente</span> quando você apresentar sua CNH na entrada do evento.
          </p>
        </motion.div>

        {/* Upload */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
        >
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
            Cadastrar medida protetiva
          </p>

          {!preview ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-white/12 hover:border-vitima/50 rounded-2xl p-10 text-center cursor-pointer transition-all bg-surface hover:bg-vitima/5 mb-4"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => selecionarArquivo(e.target.files[0])}
              />
              <Upload size={32} className="mx-auto text-white/15 mb-3" />
              <p className="text-sm font-semibold text-white/45">Fotografe ou selecione o documento</p>
              <p className="text-xs text-white/22 mt-1">Medida Protetiva · JPG, PNG, PDF</p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-white/10 mb-4">
              <img src={preview} alt="Prévia" className="w-full max-h-52 object-cover" />
              <button
                onClick={limpar}
                className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/65 hover:bg-black/85 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <button
            onClick={enviarMedida}
            disabled={!arquivo || enviando}
            className="w-full bg-vitima hover:bg-vitima/85 active:scale-[0.98] disabled:opacity-30 text-white font-semibold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2 mb-8"
          >
            {enviando ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cadastrando...
              </>
            ) : (
              <>
                <FileText size={15} />
                Cadastrar medida protetiva
              </>
            )}
          </button>
        </motion.div>

        {/* Lista de medidas */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
            Minhas medidas cadastradas
          </p>

          {carregando ? (
            <div className="text-center py-8">
              <span className="w-6 h-6 border-2 border-white/20 border-t-vitima rounded-full animate-spin inline-block" />
            </div>
          ) : medidas.length === 0 ? (
            <div className="text-center py-8 text-white/25">
              <FileText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma medida cadastrada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {medidas.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-surface border border-white/8 rounded-xl px-4 py-4"
                >
                  <p className="text-[10px] font-mono text-white/25 mb-1">{m.numero_processo || '—'}</p>
                  <p className="text-sm font-bold text-white">{m.nome_vitima || '—'}</p>
                  {m.nome_agressor && (
                    <p className="text-xs text-white/40 mt-0.5">Agressor: {m.nome_agressor}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    {m.ativada ? (
                      <>
                        <CheckCircle size={12} className="text-safe" />
                        <span className="text-[11px] font-semibold text-safe">Ativa</span>
                      </>
                    ) : (
                      <>
                        <Clock size={12} className="text-warn" />
                        <span className="text-[11px] font-semibold text-warn">Pendente — aguardando CNH na entrada</span>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

      </div>

      <Toast msg={toast.msg} tipo={toast.tipo} visivel={toast.visivel} />
    </div>
  )
}
