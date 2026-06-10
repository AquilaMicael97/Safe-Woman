const CHAVE = 'sw_historico'
const LIMITE = 500

export function adicionarRegistro(entrada) {
  const lista = getHistorico()
  lista.unshift({ id: Date.now(), hora: new Date().toISOString(), ...entrada })
  localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, LIMITE)))
}

export function getHistorico() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || []
  } catch {
    return []
  }
}

export function limparHistorico() {
  localStorage.removeItem(CHAVE)
}
