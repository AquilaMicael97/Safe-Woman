import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, KeyRound, Trash2, Power } from 'lucide-react'
import { apiGet, apiSend } from '../../utils/api'

const ROLE_ESTILO = {
  admin:    'bg-accent/15 text-accent',
  recepcao: 'bg-white/8 text-white/45',
}

export default function Usuarios({ token }) {
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [ok, setOk] = useState(null)

  // Form de criação
  const [formAberto, setFormAberto] = useState(false)
  const [fUsuario, setFUsuario] = useState('')
  const [fNome, setFNome] = useState('')
  const [fSenha, setFSenha] = useState('')
  const [fRole, setFRole] = useState('recepcao')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setCarregando(true)
    try {
      const data = await apiGet('/api/admin/usuarios', token)
      setUsuarios(data.usuarios)
      setErro(null)
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function feedback(msg) {
    setOk(msg)
    setErro(null)
    setTimeout(() => setOk(null), 4000)
  }

  async function criar(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await apiSend('POST', '/api/admin/usuarios', token, {
        usuario: fUsuario, nome: fNome, senha: fSenha, role: fRole,
      })
      setFUsuario(''); setFNome(''); setFSenha(''); setFRole('recepcao')
      setFormAberto(false)
      feedback('Usuário criado com sucesso.')
      await carregar()
    } catch (e2) {
      setErro(e2.message)
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(u) {
    try {
      await apiSend('PATCH', `/api/admin/usuarios/${u.id}`, token, { ativo: !u.ativo })
      feedback(`Usuário '${u.usuario}' ${u.ativo ? 'desativado' : 'ativado'}.`)
      await carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  async function redefinirSenha(u) {
    const senha = window.prompt(`Nova senha para '${u.usuario}' (mín. 6 caracteres):`)
    if (!senha) return
    try {
      await apiSend('PATCH', `/api/admin/usuarios/${u.id}`, token, { senha })
      feedback(`Senha de '${u.usuario}' redefinida.`)
    } catch (e) {
      setErro(e.message)
    }
  }

  async function excluir(u) {
    if (!window.confirm(`Excluir o usuário '${u.usuario}'? Essa ação não pode ser desfeita.`)) return
    try {
      await apiSend('DELETE', `/api/admin/usuarios/${u.id}`, token)
      feedback(`Usuário '${u.usuario}' excluído.`)
      await carregar()
    } catch (e) {
      setErro(e.message)
    }
  }

  return (
    <div className="p-7 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Usuários do Sistema</h2>
          <p className="text-sm text-white/35 mt-1">
            Operadores de portaria e administradores
          </p>
        </div>
        <button
          onClick={() => setFormAberto(v => !v)}
          className="flex items-center gap-2 text-xs font-bold text-accent border border-accent/35 hover:bg-accent/12 px-4 py-2.5 rounded-xl transition-all"
        >
          <UserPlus size={13} />
          Novo usuário
        </button>
      </div>

      <AnimatePresence>
        {formAberto && (
          <motion.form
            onSubmit={criar}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-white/8 rounded-2xl p-5 mb-6 grid grid-cols-2 gap-3">
              <input
                type="text" value={fUsuario} onChange={e => setFUsuario(e.target.value)}
                placeholder="Usuário (login)" required autoCapitalize="none"
                className="bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 transition-colors"
              />
              <input
                type="text" value={fNome} onChange={e => setFNome(e.target.value)}
                placeholder="Nome completo" required
                className="bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 transition-colors"
              />
              <input
                type="password" value={fSenha} onChange={e => setFSenha(e.target.value)}
                placeholder="Senha (mín. 6 caracteres)" required minLength={6}
                className="bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-accent/50 transition-colors"
              />
              <select
                value={fRole} onChange={e => setFRole(e.target.value)}
                className="bg-bg border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-accent/50 transition-colors"
              >
                <option value="recepcao">Recepção</option>
                <option value="admin">Administrador</option>
              </select>
              <button
                type="submit" disabled={salvando}
                className="col-span-2 bg-accent hover:bg-accent/85 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-all"
              >
                {salvando ? 'Salvando...' : 'Criar usuário'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {erro && <p className="text-xs text-danger mb-4">{erro}</p>}
      {ok && <p className="text-xs text-safe font-semibold mb-4">{ok}</p>}

      {carregando ? (
        <div className="text-center py-16 text-white/20 text-sm">Carregando...</div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-16 text-white/20 text-sm">
          Nenhum usuário cadastrado. As credenciais de ambiente (admin/portaria) continuam valendo.
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className={`flex items-center gap-4 bg-surface border border-white/8 rounded-xl px-4 py-3 ${
                u.ativo ? '' : 'opacity-50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.ativo ? 'bg-safe' : 'bg-white/20'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{u.nome}</div>
                <div className="text-xs text-white/30 mt-0.5">@{u.usuario}</div>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${ROLE_ESTILO[u.role]}`}>
                {u.role === 'admin' ? 'Admin' : 'Recepção'}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => alternarAtivo(u)}
                  title={u.ativo ? 'Desativar' : 'Ativar'}
                  className="p-2 rounded-lg text-white/35 hover:text-warn hover:bg-warn/8 border border-white/8 transition-all"
                >
                  <Power size={12} />
                </button>
                <button
                  onClick={() => redefinirSenha(u)}
                  title="Redefinir senha"
                  className="p-2 rounded-lg text-white/35 hover:text-accent hover:bg-accent/8 border border-white/8 transition-all"
                >
                  <KeyRound size={12} />
                </button>
                <button
                  onClick={() => excluir(u)}
                  title="Excluir"
                  className="p-2 rounded-lg text-white/35 hover:text-danger hover:bg-danger/8 border border-white/8 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
