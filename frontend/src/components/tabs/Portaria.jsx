import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, CheckCircle, AlertTriangle, AlertOctagon, RotateCcw } from 'lucide-react'
import { adicionarRegistro } from '../../utils/history'
import { API_BASE } from '../../utils/api'

const NIVEIS = {
  verde: {
    borda:  'border-safe/40',
    fundo:  'bg-safe/8',
    texto:  'text-safe',
    badge:  'bg-safe/15 text-safe',
    titulo: 'LIBERADO',
    Icon:   CheckCircle,
    pulsar: false,
  },
  amarelo: {
    borda:  'border-warn/40',
    fundo:  'bg-warn/8',
    texto:  'text-warn',
    badge:  'bg-warn/15 text-warn',
    titulo: 'ATENÇÃO — Vítima identificada',
    Icon:   AlertTriangle,
    pulsar: false,
  },
  'amarelo-urgente': {
    borda:  'border-warn/50',
    fundo:  'bg-warn/10',
    texto:  'text-warn',
    badge:  'bg-warn/15 text-warn',
    titulo: 'ATENÇÃO URGENTE — Agressor presente no local',
    Icon:   AlertTriangle,
    pulsar: false,
  },
  vermelho: {
    borda:  'border-danger/50',
    fundo:  'bg-danger/8',
    texto:  'text-danger',
    badge:  'bg-danger/15 text-danger',
    titulo: 'ALERTA — Agressor com medida protetiva ativa',
    Icon:   AlertOctagon,
    pulsar: false,
  },
  'vermelho-urgente': {
    borda:  'border-danger/60',
    fundo:  'bg-danger/10',
    texto:  'text-danger',
    badge:  'bg-danger/20 text-danger',
    titulo: 'ALERTA URGENTE — Vítima presente no local!',
    Icon:   AlertOctagon,
    pulsar: true,
  },
}

function InfoRow({ label, valor }) {
  if (!valor || valor === 'Não encontrado' || valor === 'Não encontrada') return null
  return (
    <div className="flex items-center justify-between bg-surface border border-white/8 rounded-xl px-4 py-3">
      <span className="text-xs text-white/40 font-medium">{label}</span>
      <span className="text-sm font-semibold text-white">{valor}</span>
    </div>
  )
}

export default function Portaria({ operador }) {
  const [arquivo, setArquivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState(null)
  const inputRef = useRef(null)

  function selecionar(file) {
    if (!file) return
    setArquivo(file)
    setPreview(URL.createObjectURL(file))
    setResultado(null)
    setErro(null)
  }

  function limpar() {
    setArquivo(null)
    setPreview(null)
    setResultado(null)
    setErro(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function verificar() {
    if (!arquivo) return
    setCarregando(true)
    setErro(null)

    try {
      const form = new FormData()
      form.append('foto', arquivo)

      const res  = await fetch(`${API_BASE}/api/verificar-cnh`, { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.mensagem || data.detail || 'Erro ao processar o documento.')
        setCarregando(false)
        return
      }

      setResultado(data)

      adicionarRegistro({
        operador: operador || 'Desconhecido',
        nome:     data.nome     || '',
        cpf:      data.cpf      || '',
        veredito: data.alerta   ? 'Alerta' : 'Liberado',
      })
    } catch {
      setErro('Erro de conexão com o servidor. Verifique se o backend está rodando.')
    } finally {
      setCarregando(false)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files[0]
    if (file) selecionar(file)
  }

  const cfg = resultado ? (NIVEIS[resultado.nivel] ?? NIVEIS.verde) : null

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <AnimatePresence mode="wait">

        {/* ── ESTADO: upload ── */}
        {!resultado && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-lg font-bold text-white mb-1">Verificar CNH</h2>
            <p className="text-sm text-white/35 mb-6">
              Fotografe ou faça upload do documento para verificar
            </p>

            {/* Zona de upload */}
            {!preview ? (
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-white/12 hover:border-accent/50 rounded-2xl p-12 text-center cursor-pointer transition-all bg-surface hover:bg-accent/5"
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => selecionar(e.target.files[0])}
                />
                <Camera size={36} className="mx-auto text-white/15 mb-3" />
                <p className="text-sm font-semibold text-white/45">
                  Toque para fotografar
                </p>
                <p className="text-xs text-white/22 mt-1">
                  ou arraste o arquivo aqui · JPG, PNG
                </p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-white/10 mb-4">
                <img
                  src={preview}
                  alt="Prévia"
                  className="w-full max-h-56 object-cover"
                />
                <button
                  onClick={limpar}
                  className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/65 hover:bg-black/85 rounded-full flex items-center justify-center text-white transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Erro */}
            <AnimatePresence>
              {erro && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3"
                >
                  {erro}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={verificar}
              disabled={!arquivo || carregando}
              className="w-full mt-4 bg-accent hover:bg-accent/85 active:scale-[0.98] disabled:opacity-30 text-white font-semibold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              {carregando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                'Verificar documento'
              )}
            </button>
          </motion.div>
        )}

        {/* ── ESTADO: resultado ── */}
        {resultado && (
          <motion.div
            key="resultado"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Card principal */}
            <motion.div
              className={`border-2 rounded-2xl p-6 mb-4 ${cfg.fundo} ${cfg.borda} ${
                cfg.pulsar ? 'animate-pulse-danger' : ''
              }`}
            >
              <cfg.Icon size={34} className={`${cfg.texto} mb-3`} />
              <span className={`inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-3 ${cfg.badge}`}>
                {cfg.titulo}
              </span>
              {resultado.mensagem && (
                <p className="text-sm text-white/65 mt-2 leading-relaxed">
                  {resultado.mensagem}
                </p>
              )}
            </motion.div>

            {/* Dados identificados */}
            <div className="space-y-2 mb-5">
              <InfoRow label="Nome"              valor={resultado.nome} />
              <InfoRow label="CPF"               valor={resultado.cpf} />
              <InfoRow label="Data de Nascimento" valor={resultado.data_nascimento} />
            </div>

            {/* Nova verificação */}
            <button
              onClick={limpar}
              className="w-full flex items-center justify-center gap-2 bg-surface border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-semibold py-3 rounded-xl transition-all text-sm"
            >
              <RotateCcw size={14} />
              Nova verificação
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
