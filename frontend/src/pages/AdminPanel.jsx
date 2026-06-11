import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessao, encerrarSessao } from '../utils/auth'
import Sidebar from '../components/Sidebar'
import AlertaWatcher from '../components/AlertaWatcher'
import Dashboard from '../components/tabs/Dashboard'
import Portaria from '../components/tabs/Portaria'
import Presentes from '../components/tabs/Presentes'
import Medidas from '../components/tabs/Medidas'
import Historico from '../components/tabs/Historico'
import Usuarios from '../components/tabs/Usuarios'
import Auditoria from '../components/tabs/Auditoria'

export default function AdminPanel() {
  const navigate = useNavigate()
  const sessao = getSessao()

  const [aba, setAba] = useState(
    () => localStorage.getItem('sw_aba_admin') || 'dashboard'
  )

  useEffect(() => {
    localStorage.setItem('sw_aba_admin', aba)
  }, [aba])

  function logout() {
    encerrarSessao()
    navigate('/', { replace: true })
  }

  const token = sessao?.token

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar aba={aba} setAba={setAba} nome={sessao?.nome} onLogout={logout} />
      <AlertaWatcher token={token} />
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {aba === 'dashboard' && <Dashboard token={token} />}
        {aba === 'portaria'  && <Portaria operador={sessao?.nome} />}
        {aba === 'presentes' && <Presentes />}
        {aba === 'medidas'   && <Medidas token={token} />}
        {aba === 'historico' && <Historico token={token} />}
        {aba === 'usuarios'  && <Usuarios token={token} />}
        {aba === 'auditoria' && <Auditoria token={token} />}
      </main>
    </div>
  )
}
