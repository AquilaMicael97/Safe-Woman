import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessao, encerrarSessao } from '../utils/auth'
import Sidebar from '../components/Sidebar'
import Dashboard from '../components/tabs/Dashboard'
import Historico from '../components/tabs/Historico'

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

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar aba={aba} setAba={setAba} nome={sessao?.nome} onLogout={logout} />
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {aba === 'dashboard' && <Dashboard />}
        {aba === 'historico' && <Historico />}
      </main>
    </div>
  )
}
