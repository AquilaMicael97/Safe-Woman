// Em produção (Vercel), define VITE_API_BASE com a URL do Railway.
// Em desenvolvimento, fica vazio e o proxy do Vite resolve /api/*.
export const API_BASE = import.meta.env.VITE_API_BASE || ''

// GET autenticado nos endpoints admin. Lança Error com a mensagem do servidor.
export async function apiGet(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.mensagem || `Erro ${res.status}`)
  return data
}

// POST/PATCH/DELETE autenticado com body JSON opcional.
export async function apiSend(method, path, token, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.mensagem || `Erro ${res.status}`)
  return data
}

// Baixa um arquivo autenticado (ex.: CSV) e dispara o download no navegador.
export async function apiDownload(path, token, nomeArquivo) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Erro ${res.status} ao exportar`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}
