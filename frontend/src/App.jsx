import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import PortariaPanel from './pages/PortariaPanel'
import VitimaPanel from './pages/VitimaPanel'
import { getSessao, getSessaoVitima } from './utils/auth'

function Protegida({ children, role }) {
  const sessao = getSessao()
  if (!sessao) return <Navigate to="/" replace />
  if (sessao.role !== role) {
    return <Navigate to={sessao.role === 'admin' ? '/admin' : '/portaria'} replace />
  }
  return children
}

function ProtegidaVitima({ children }) {
  if (!getSessaoVitima()) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/admin"
          element={<Protegida role="admin"><AdminPanel /></Protegida>}
        />
        <Route
          path="/portaria"
          element={<Protegida role="recepcao"><PortariaPanel /></Protegida>}
        />
        <Route
          path="/vitima"
          element={<ProtegidaVitima><VitimaPanel /></ProtegidaVitima>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
