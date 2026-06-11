import { API_BASE } from './api'

// Login real no backend (tabela usuarios_sistema + fallback de ambiente).
// Retorna { token, nome, role } ou lança Error com a mensagem do servidor.
export async function loginSistema(usuario, senha) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: usuario.trim().toLowerCase(), senha }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Usuário ou senha incorretos.')
  return { username: usuario.trim().toLowerCase(), nome: data.nome, role: data.role, token: data.token }
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
  const sessao = getSessao()
  if (sessao?.token) {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessao.token}` },
    }).catch(() => {})
  }
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
