import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { loginSistema, salvarSessao, getSessao, salvarSessaoVitima, getSessaoVitima } from '../utils/auth'
import { API_BASE } from '../utils/api'
import logo from '../assets/logo.png'

export default function Login() {
  const navigate = useNavigate()
  const [aba, setAba] = useState('portaria')
  const [telaVitima, setTelaVitima] = useState('login')

  // Portaria
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erroPortaria, setErroPortaria] = useState('')
  const [loadingPortaria, setLoadingPortaria] = useState(false)

  // Vítima — login
  const [vEmail, setVEmail] = useState('')
  const [vSenha, setVSenha] = useState('')
  const [mostrarVSenha, setMostrarVSenha] = useState(false)
  const [erroVitima, setErroVitima] = useState('')
  const [loadingVitima, setLoadingVitima] = useState(false)

  // Vítima — cadastro
  const [rEmail, setREmail] = useState('')
  const [rSenha, setRSenha] = useState('')
  const [rSenha2, setRSenha2] = useState('')
  const [mostrarRSenha, setMostrarRSenha] = useState(false)
  const [erroRegistro, setErroRegistro] = useState('')
  const [loadingRegistro, setLoadingRegistro] = useState(false)
  const [cadastroOk, setCadastroOk] = useState(false)

  useEffect(() => {
    const s = getSessao()
    if (s) {
      navigate(s.role === 'admin' ? '/admin' : '/portaria', { replace: true })
    } else if (getSessaoVitima()) {
      navigate('/vitima', { replace: true })
    }
  }, [])

  // ── Portaria ──
  async function handlePortaria(e) {
    e.preventDefault()
    setErroPortaria('')
    setLoadingPortaria(true)
    try {
      const dados = await loginSistema(usuario, senha)
      salvarSessao(dados)
      navigate(dados.role === 'admin' ? '/admin' : '/portaria', { replace: true })
    } catch (err) {
      setErroPortaria(err.message || 'Erro de conexão. Tente novamente.')
      setLoadingPortaria(false)
    }
  }

  // ── Vítima login ──
  async function handleVitima(e) {
    e.preventDefault()
    setErroVitima('')
    setLoadingVitima(true)
    try {
      const res = await fetch(`${API_BASE}/api/vitima/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: vEmail.trim(), senha: vSenha }),
      })
      const data = await res.json()
      if (res.ok) {
        salvarSessaoVitima({ token: data.token, email: vEmail.trim() })
        navigate('/vitima', { replace: true })
      } else {
        setErroVitima(data.detail || 'E-mail ou senha incorretos.')
      }
    } catch {
      setErroVitima('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingVitima(false)
    }
  }

  // ── Vítima cadastro ──
  async function handleRegistro(e) {
    e.preventDefault()
    setErroRegistro('')
    if (rSenha !== rSenha2) {
      setErroRegistro('As senhas não coincidem.')
      return
    }
    setLoadingRegistro(true)
    try {
      const res = await fetch(`${API_BASE}/api/vitima/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rEmail.trim(), senha: rSenha }),
      })
      const data = await res.json()
      if (res.ok) {
        setCadastroOk(true)
      } else {
        setErroRegistro(data.detail || 'Erro ao criar conta.')
      }
    } catch {
      setErroRegistro('Erro de conexão. Tente novamente.')
    } finally {
      setLoadingRegistro(false)
    }
  }

  function irParaLogin() {
    setCadastroOk(false)
    setREmail(''); setRSenha(''); setRSenha2('')
    setErroRegistro('')
    setTelaVitima('login')
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-[380px]"
      >
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl p-3 shadow-lg shadow-black/30 mb-1">
            <img src={logo} alt="Safe Woman" className="h-28 w-auto" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-surface2 rounded-xl p-1 mb-5 gap-1">
          <button
            onClick={() => setAba('portaria')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              aba === 'portaria'
                ? 'bg-surface text-white shadow'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            Recepcionista
          </button>
          <button
            onClick={() => setAba('vitima')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              aba === 'vitima'
                ? 'bg-surface text-vitima shadow'
                : 'text-white/35 hover:text-vitima/70'
            }`}
          >
            💜 Sou uma vítima
          </button>
        </div>

        <div className="bg-surface border border-white/8 rounded-2xl p-6 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── ABA PORTARIA ── */}
            {aba === 'portaria' && (
              <motion.div
                key="portaria"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-bold text-white mb-1">Acesso da Portaria</p>
                <p className="text-xs text-white/35 mb-5">Entre com suas credenciais de recepcionista.</p>

                <form onSubmit={handlePortaria} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Usuário</label>
                    <input
                      type="text"
                      value={usuario}
                      onChange={e => { setUsuario(e.target.value); setErroPortaria('') }}
                      placeholder="Digite seu usuário"
                      autoComplete="username"
                      autoCapitalize="none"
                      className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Senha</label>
                    <div className="relative">
                      <input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={e => { setSenha(e.target.value); setErroPortaria('') }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                        required
                      />
                      <button type="button" onClick={() => setMostrarSenha(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {erroPortaria && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-4 py-2.5">
                          <AlertCircle size={13} className="flex-shrink-0" />{erroPortaria}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={loadingPortaria}
                    className="w-full bg-accent hover:bg-accent/85 active:scale-[0.98] disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 mt-1">
                    {loadingPortaria
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : 'Entrar no sistema'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── ABA VÍTIMA — LOGIN ── */}
            {aba === 'vitima' && telaVitima === 'login' && (
              <motion.div
                key="vitima-login"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-bold text-white mb-1">Área da Vítima</p>
                <p className="text-xs text-white/35 mb-4 leading-relaxed">
                  Acesse para pré-cadastrar sua medida protetiva antes de ir ao evento.
                </p>

                <div className="bg-vitima/8 border border-vitima/20 rounded-xl px-4 py-3 text-xs text-vitima/90 leading-relaxed mb-5">
                  💡 Cadastre de casa com segurança. Sua proteção só será <strong>ativada</strong> quando você apresentar o documento na entrada.
                </div>

                <form onSubmit={handleVitima} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">E-mail</label>
                    <input
                      type="email"
                      value={vEmail}
                      onChange={e => { setVEmail(e.target.value); setErroVitima('') }}
                      placeholder="seu@email.com"
                      autoComplete="email"
                      className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-vitima/50 focus:ring-1 focus:ring-vitima/20 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Senha</label>
                    <div className="relative">
                      <input
                        type={mostrarVSenha ? 'text' : 'password'}
                        value={vSenha}
                        onChange={e => { setVSenha(e.target.value); setErroVitima('') }}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none focus:border-vitima/50 focus:ring-1 focus:ring-vitima/20 transition-all"
                        required
                      />
                      <button type="button" onClick={() => setMostrarVSenha(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                        {mostrarVSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {erroVitima && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-4 py-2.5">
                          <AlertCircle size={13} className="flex-shrink-0" />{erroVitima}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={loadingVitima}
                    className="w-full bg-vitima hover:bg-vitima/85 active:scale-[0.98] disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                    {loadingVitima
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : 'Entrar'}
                  </button>
                </form>

                <p className="text-center text-xs text-white/30 mt-4">
                  Não tem conta?{' '}
                  <button onClick={() => { setTelaVitima('cadastro'); setErroVitima('') }}
                    className="text-vitima font-semibold hover:underline">
                    Criar agora
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── ABA VÍTIMA — CADASTRO ── */}
            {aba === 'vitima' && telaVitima === 'cadastro' && (
              <motion.div
                key="vitima-cadastro"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm font-bold text-white mb-1">Criar Conta — Vítima</p>
                <p className="text-xs text-white/35 mb-5 leading-relaxed">
                  Crie sua conta para cadastrar sua medida protetiva com segurança.
                </p>

                <AnimatePresence mode="wait">
                  {cadastroOk ? (
                    <motion.div
                      key="sucesso"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-4"
                    >
                      <div className="text-3xl mb-3">✅</div>
                      <p className="text-sm font-bold text-safe mb-1">Conta criada!</p>
                      <p className="text-xs text-white/40 mb-5">Agora faça login para cadastrar sua medida protetiva.</p>
                      <button onClick={irParaLogin}
                        className="w-full bg-vitima hover:bg-vitima/85 text-white font-semibold py-3 rounded-xl transition-all text-sm">
                        Fazer login
                      </button>
                    </motion.div>
                  ) : (
                    <motion.form key="form" onSubmit={handleRegistro} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">E-mail</label>
                        <input
                          type="email"
                          value={rEmail}
                          onChange={e => { setREmail(e.target.value); setErroRegistro('') }}
                          placeholder="seu@email.com"
                          autoComplete="email"
                          className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-vitima/50 focus:ring-1 focus:ring-vitima/20 transition-all"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Senha (mín. 6 caracteres)</label>
                        <div className="relative">
                          <input
                            type={mostrarRSenha ? 'text' : 'password'}
                            value={rSenha}
                            onChange={e => { setRSenha(e.target.value); setErroRegistro('') }}
                            placeholder="••••••••"
                            autoComplete="new-password"
                            minLength={6}
                            className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none focus:border-vitima/50 focus:ring-1 focus:ring-vitima/20 transition-all"
                            required
                          />
                          <button type="button" onClick={() => setMostrarRSenha(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                            {mostrarRSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Confirmar senha</label>
                        <input
                          type="password"
                          value={rSenha2}
                          onChange={e => { setRSenha2(e.target.value); setErroRegistro('') }}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="w-full bg-surface2 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-vitima/50 focus:ring-1 focus:ring-vitima/20 transition-all"
                          required
                        />
                      </div>

                      <AnimatePresence>
                        {erroRegistro && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="flex items-center gap-2 text-danger text-xs bg-danger/10 border border-danger/20 rounded-xl px-4 py-2.5">
                              <AlertCircle size={13} className="flex-shrink-0" />{erroRegistro}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button type="submit" disabled={loadingRegistro}
                        className="w-full bg-vitima hover:bg-vitima/85 active:scale-[0.98] disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                        {loadingRegistro
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : 'Criar conta'}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {!cadastroOk && (
                  <p className="text-center text-xs text-white/30 mt-4">
                    Já tem conta?{' '}
                    <button onClick={irParaLogin} className="text-vitima font-semibold hover:underline">
                      Entrar
                    </button>
                  </p>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
