import { useEffect, useState } from 'react'
import { API_BASE } from '../utils/api'
import { getSessao } from '../utils/auth'

// Busca a foto do documento apresentado na entrada (endpoint autenticado)
// e exibe para identificação visual do agressor. Não renderiza nada se a
// pessoa não passou pela verificação com foto (ex.: CPF digitado).
export default function FotoDocumento({ cpf, legenda }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let blobUrl = null
    const token = getSessao()?.token
    if (!cpf || !token) return

    fetch(`${API_BASE}/api/foto-documento?cpf=${encodeURIComponent(cpf)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.blob() : null))
      .then(blob => {
        if (blob) {
          blobUrl = URL.createObjectURL(blob)
          setUrl(blobUrl)
        }
      })
      .catch(() => {})

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [cpf])

  if (!url) return null

  return (
    <div className="rounded-xl overflow-hidden border border-danger/30 mt-2">
      <img
        src={url}
        alt={`Documento de ${legenda || cpf}`}
        className="w-full max-h-44 object-cover"
      />
      <div className="bg-danger/10 px-3 py-1.5 text-[10px] font-bold text-danger uppercase tracking-wider">
        Documento do agressor{legenda ? ` — ${legenda}` : ''}
      </div>
    </div>
  )
}
