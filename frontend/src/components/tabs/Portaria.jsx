import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, CheckCircle, AlertTriangle, AlertOctagon, RotateCcw, FileText, ShieldCheck, Ban } from 'lucide-react'
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

function ZonaCaptura({ etapa, titulo, subtitulo, Icone, preview, inputRef, onSelecionar, onLimpar, compacta }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-accent/15 text-accent text-[11px] font-bold flex items-center justify-center">
          {etapa}
        </span>
        <span className="text-sm font-semibold text-white/80">{titulo}</span>
      </div>

      {!preview ? (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer?.files[0]
            if (file) onSelecionar(file)
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed border-white/12 hover:border-accent/50 rounded-2xl text-center cursor-pointer transition-all bg-surface hover:bg-accent/5 ${
            compacta ? 'p-6' : 'p-9'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => onSelecionar(e.target.files[0])}
          />
          <Icone size={compacta ? 26 : 32} className="mx-auto text-white/15 mb-2" />
          <p className="text-sm font-semibold text-white/45">Toque para fotografar</p>
          <p className="text-xs text-white/22 mt-1">{subtitulo}</p>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-white/10">
          <img
            src={preview}
            alt={`Prévia — ${titulo}`}
            className={`w-full object-cover ${compacta ? 'max-h-40' : 'max-h-56'}`}
          />
          <span className="absolute bottom-2 left-2.5 text-[10px] font-bold bg-black/65 text-white/80 px-2 py-1 rounded-full">
            {titulo}
          </span>
          <button
            onClick={onLimpar}
            className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/65 hover:bg-black/85 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function Portaria({ operador }) {
  const [arquivoCnh,    setArquivoCnh]    = useState(null)
  const [previewCnh,    setPreviewCnh]    = useState(null)
  const [arquivoMedida, setArquivoMedida] = useState(null)
  const [previewMedida, setPreviewMedida] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [resultado,  setResultado]  = useState(null)
  const [medidaInfo, setMedidaInfo] = useState(null)
  const [erro,       setErro]       = useState(null)
  const [negandoEntrada, setNegandoEntrada] = useState(false)
  const [entradaNegada,  setEntradaNegada]  = useState(false)
  const [erroNegar,      setErroNegar]      = useState(null)
  const [saidasOk,        setSaidasOk]        = useState([])   // CPFs de agressores com saída registrada
  const [saindoCpf,       setSaindoCpf]       = useState(null)
  const [liberando,       setLiberando]       = useState(false)
  const [entradaLiberada, setEntradaLiberada] = useState(false)
  const [erroLiberar,     setErroLiberar]     = useState(null)
  const inputCnhRef    = useRef(null)
  const inputMedidaRef = useRef(null)

  function selecionarCnh(file) {
    if (!file) return
    setArquivoCnh(file)
    setPreviewCnh(URL.createObjectURL(file))
    setResultado(null)
    setErro(null)
  }

  function selecionarMedida(file) {
    if (!file) return
    setArquivoMedida(file)
    setPreviewMedida(URL.createObjectURL(file))
    setResultado(null)
    setErro(null)
  }

  function limparCnh() {
    setArquivoCnh(null)
    setPreviewCnh(null)
    if (inputCnhRef.current) inputCnhRef.current.value = ''
  }

  function limparMedida() {
    setArquivoMedida(null)
    setPreviewMedida(null)
    if (inputMedidaRef.current) inputMedidaRef.current.value = ''
  }

  function limpar() {
    limparCnh()
    limparMedida()
    setResultado(null)
    setMedidaInfo(null)
    setErro(null)
    setNegandoEntrada(false)
    setEntradaNegada(false)
    setErroNegar(null)
    setSaidasOk([])
    setSaindoCpf(null)
    setLiberando(false)
    setEntradaLiberada(false)
    setErroLiberar(null)
  }

  async function registrarSaidaAgressor(cpf) {
    setSaindoCpf(cpf)
    setErroLiberar(null)

    try {
      const res  = await fetch(`${API_BASE}/api/saida-cpf?cpf=${encodeURIComponent(cpf)}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setErroLiberar(data.mensagem || data.detail || 'Erro ao registrar a saída do agressor.')
        return
      }
      setSaidasOk(prev => [...prev, cpf])
    } catch {
      setErroLiberar('Erro de conexão com o servidor.')
    } finally {
      setSaindoCpf(null)
    }
  }

  async function liberarEntradaVitima() {
    if (!resultado?.cpf) return
    setLiberando(true)
    setErroLiberar(null)

    try {
      const params = new URLSearchParams({ cpf: resultado.cpf, nome: resultado.nome || '' })
      const res    = await fetch(`${API_BASE}/api/liberar-entrada?${params}`, { method: 'POST' })
      const data   = await res.json()

      if (!res.ok) {
        setErroLiberar(data.mensagem || data.detail || 'Erro ao liberar a entrada.')
        return
      }

      setEntradaLiberada(true)
      adicionarRegistro({
        operador: operador || 'Desconhecido',
        nome:     resultado.nome || '',
        cpf:      resultado.cpf  || '',
        veredito: 'Liberado',
      })
    } catch {
      setErroLiberar('Erro de conexão com o servidor.')
    } finally {
      setLiberando(false)
    }
  }

  async function negarEntrada() {
    if (!resultado?.cpf) return
    setNegandoEntrada(true)
    setErroNegar(null)

    try {
      const res  = await fetch(`${API_BASE}/api/entrada-negada?cpf=${encodeURIComponent(resultado.cpf)}`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setErroNegar(data.mensagem || data.detail || 'Erro ao registrar a negativa.')
        return
      }

      setEntradaNegada(true)
      adicionarRegistro({
        operador: operador || 'Desconhecido',
        nome:     resultado.nome || '',
        cpf:      resultado.cpf  || '',
        veredito: 'Entrada negada',
      })
    } catch {
      setErroNegar('Erro de conexão com o servidor.')
    } finally {
      setNegandoEntrada(false)
    }
  }

  async function verificar() {
    if (!arquivoCnh) return
    setCarregando(true)
    setErro(null)

    try {
      // Etapa 2 (se houver): cadastra a medida protetiva ANTES de verificar a CNH,
      // para que a vítima já entre sinalizada no resultado da verificação.
      let dadosMedida = null
      if (arquivoMedida) {
        const formMedida = new FormData()
        formMedida.append('foto', arquivoMedida)

        const resMedida  = await fetch(`${API_BASE}/api/cadastrar-medida`, { method: 'POST', body: formMedida })
        const dataMedida = await resMedida.json()

        if (!resMedida.ok || dataMedida.status === 'erro') {
          setErro(dataMedida.mensagem || 'Erro ao processar a medida protetiva. Refaça a foto.')
          setCarregando(false)
          return
        }
        dadosMedida = dataMedida
      }

      // Etapa 1: verificação OCR da CNH (obrigatória para todos)
      const form = new FormData()
      form.append('foto', arquivoCnh)

      const res  = await fetch(`${API_BASE}/api/verificar-cnh`, { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.mensagem || data.detail || 'Erro ao processar o documento.')
        setCarregando(false)
        return
      }

      setResultado(data)
      setMedidaInfo(dadosMedida)

      adicionarRegistro({
        operador: operador || 'Desconhecido',
        nome:     data.nome     || '',
        cpf:      data.cpf      || '',
        veredito: data.alerta ? 'Alerta' : (data.entrada_pendente ? 'Em espera' : 'Liberado'),
      })
    } catch {
      setErro('Erro de conexão com o servidor. Verifique se o backend está rodando.')
    } finally {
      setCarregando(false)
    }
  }

  const cfg = resultado ? (NIVEIS[resultado.nivel] ?? NIVEIS.verde) : null
  // Alerta detectado no cadastro da medida (ex.: agressor já presente no local)
  const medidaCfg = medidaInfo?.alerta ? (NIVEIS[medidaInfo.nivel] ?? NIVEIS.vermelho) : null

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
            <h2 className="text-lg font-bold text-white mb-1">Verificação de entrada</h2>
            <p className="text-sm text-white/35 mb-6">
              Fotografe a CNH de todos os clientes. A medida protetiva é apenas para vítimas.
            </p>

            <div className="space-y-5">
              {/* Etapa 1 — CNH (obrigatória) */}
              <ZonaCaptura
                etapa="1"
                titulo="CNH — obrigatória"
                subtitulo="Documento pessoal de todos os clientes · JPG, PNG"
                Icone={Camera}
                preview={previewCnh}
                inputRef={inputCnhRef}
                onSelecionar={selecionarCnh}
                onLimpar={limparCnh}
              />

              {/* Etapa 2 — Medida protetiva (apenas vítimas) */}
              <ZonaCaptura
                etapa="2"
                titulo="Medida protetiva — apenas vítimas"
                subtitulo="Fotografe somente se a cliente apresentar a medida"
                Icone={FileText}
                preview={previewMedida}
                inputRef={inputMedidaRef}
                onSelecionar={selecionarMedida}
                onLimpar={limparMedida}
                compacta
              />
            </div>

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
              disabled={!arquivoCnh || carregando}
              className="w-full mt-5 bg-accent hover:bg-accent/85 active:scale-[0.98] disabled:opacity-30 text-white font-semibold py-3.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              {carregando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                arquivoMedida ? 'Verificar CNH + Medida protetiva' : 'Verificar documento'
              )}
            </button>

            {!arquivoCnh && arquivoMedida && (
              <p className="mt-2 text-xs text-warn text-center">
                A foto da CNH é obrigatória para concluir a verificação.
              </p>
            )}
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

            {/* Alerta do cadastro da medida (ex.: agressor já presente no local) */}
            {medidaCfg && medidaInfo.mensagem_alerta && (
              <div
                className={`border-2 rounded-2xl p-4 mb-4 ${medidaCfg.fundo} ${medidaCfg.borda} ${
                  medidaCfg.pulsar ? 'animate-pulse-danger' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <medidaCfg.Icon size={20} className={`${medidaCfg.texto} mt-0.5 shrink-0`} />
                  <p className="text-sm font-semibold text-white/80 leading-relaxed">
                    {medidaInfo.mensagem_alerta}
                  </p>
                </div>
              </div>
            )}

            {/* Confirmação da medida protetiva cadastrada */}
            {medidaInfo && (
              <div className="flex items-start gap-3 bg-safe/8 border border-safe/25 rounded-xl px-4 py-3 mb-4">
                <ShieldCheck size={18} className="text-safe mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-safe">
                    {medidaInfo.ja_existia ? 'Medida protetiva já cadastrada' : 'Medida protetiva cadastrada'}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Processo {medidaInfo.numero_processo}
                  </p>
                </div>
              </div>
            )}

            {/* Dados identificados */}
            <div className="space-y-2 mb-5">
              <InfoRow label="Nome"              valor={resultado.nome} />
              <InfoRow label="CPF"               valor={resultado.cpf} />
              <InfoRow label="Data de Nascimento" valor={resultado.data_nascimento} />
              {medidaInfo && (
                <InfoRow label="Agressor (medida)" valor={medidaInfo.nome_agressor} />
              )}
            </div>

            {/* Entrada em espera — vítima aguarda a saída do agressor */}
            {resultado.entrada_pendente && (
              <div className="mb-4">
                {entradaLiberada ? (
                  <div className="flex items-center gap-2 bg-safe/10 border border-safe/30 rounded-xl px-4 py-3 text-xs font-semibold text-safe">
                    <CheckCircle size={14} className="shrink-0" />
                    Entrada da vítima liberada e registrada.
                  </div>
                ) : (
                  <div className="bg-surface border border-warn/25 rounded-2xl p-4">
                    <p className="text-xs font-bold text-warn mb-3">
                      Entrada em espera — acione a segurança para retirar o agressor antes de liberar.
                    </p>

                    <div className="space-y-2 mb-3">
                      {(resultado.agressores_dentro || []).map(a => (
                        <div
                          key={a.cpf}
                          className="flex items-center justify-between gap-3 bg-danger/8 border border-danger/20 rounded-xl px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{a.nome}</p>
                            <p className="text-[10px] text-white/40 font-mono">{a.cpf}</p>
                          </div>
                          {saidasOk.includes(a.cpf) ? (
                            <span className="text-[11px] font-bold text-safe whitespace-nowrap">
                              Saída registrada
                            </span>
                          ) : (
                            <button
                              onClick={() => registrarSaidaAgressor(a.cpf)}
                              disabled={saindoCpf === a.cpf}
                              className="text-[11px] font-bold text-danger border border-danger/35 hover:bg-danger/15 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                            >
                              {saindoCpf === a.cpf ? 'Registrando...' : 'Registrar saída'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={liberarEntradaVitima}
                      disabled={liberando}
                      className="w-full flex items-center justify-center gap-2 bg-safe/15 border border-safe/35 hover:bg-safe/25 disabled:opacity-50 text-safe font-semibold py-3 rounded-xl transition-all text-sm"
                    >
                      {liberando ? (
                        <>
                          <span className="w-4 h-4 border-2 border-safe/30 border-t-safe rounded-full animate-spin" />
                          Verificando local...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} />
                          Liberar entrada da vítima
                        </>
                      )}
                    </button>
                    {erroLiberar && (
                      <p className="mt-2 text-xs text-danger">{erroLiberar}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Entrada negada — desfaz o registro automático de presença */}
            {resultado.alerta && resultado.cpf && (
              <div className="mb-3">
                {entradaNegada ? (
                  <div className="flex items-center gap-2 bg-danger/10 border border-danger/25 rounded-xl px-4 py-3 text-xs font-semibold text-danger">
                    <Ban size={14} className="shrink-0" />
                    Entrada negada — registro de presença removido.
                  </div>
                ) : (
                  <button
                    onClick={negarEntrada}
                    disabled={negandoEntrada}
                    className="w-full flex items-center justify-center gap-2 bg-danger/12 border border-danger/35 hover:bg-danger/20 disabled:opacity-50 text-danger font-semibold py-3 rounded-xl transition-all text-sm"
                  >
                    {negandoEntrada ? (
                      <>
                        <span className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                        Removendo registro...
                      </>
                    ) : (
                      <>
                        <Ban size={14} />
                        Entrada negada
                      </>
                    )}
                  </button>
                )}
                {erroNegar && (
                  <p className="mt-2 text-xs text-danger">{erroNegar}</p>
                )}
              </div>
            )}

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
