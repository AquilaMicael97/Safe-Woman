// Mock credentials — password = username (lowercase)
const USUARIOS = {
  joao:    { nome: 'João',    role: 'admin' },
  aquila:  { nome: 'Aquila', role: 'admin' },
  nathaly: { nome: 'Nathaly', role: 'recepcao' },
  herb:    { nome: 'Herb',   role: 'recepcao' },
  ruan:     { nome: 'Ruan',    role: 'recepcao' },
}

export function validarLogin(usuario, senha) {
  const u = usuario.trim().toLowerCase()
  const s = senha.trim().toLowerCase()
  const user = USUARIOS[u]
  if (!user || s !== u) return null
  return { username: u, nome: user.nome, role: user.role }
}

export function salvarSessao(dados) {
  localStorage.setItem('sw_user', JSON.stringify(dados))
}

export function getSessao() {
  try {
    return JSON.parse(localStorage.getItem('sw_user'))
  } catch {
    return null
  }
}

export function encerrarSessao() {
  localStorage.removeItem('sw_user')
}

export function salvarSessaoVitima(dados) {
  sessionStorage.setItem('sw_vitima', JSON.stringify(dados))
}

export function getSessaoVitima() {
  try {
    return JSON.parse(sessionStorage.getItem('sw_vitima'))
  } catch {
    return null
  }
}

export function encerrarSessaoVitima() {
  sessionStorage.removeItem('sw_vitima')
}
