import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './App.css'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Dashboard from './pages/Dashboard.jsx'
import SpaceBackground from './components/SpaceBackground.jsx'

function App() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('token'))
  useEffect(() => {
    const onStorage = (e) => { if (e.key === 'token') setAuthed(!!e.newValue) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const logout = () => {
    localStorage.removeItem('token')
    setAuthed(false)
    navigate('/')
  }
  return (
    <div className="min-h-screen relative">
      <SpaceBackground />
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/20 text-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white">Pliqo</Link>
          <nav className="flex gap-3">
            {authed ? (
              <>
                <Link to="/dashboard" className="btn btn-outline">Panel</Link>
                <button className="btn btn-primary" onClick={logout}>Cerrar sesión</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline">Iniciar sesión</Link>
                <Link to="/register" className="btn btn-primary">Crear cuenta</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 relative z-10">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <footer className="border-t border-white/20 bg-black/50 text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-300">
          © {new Date().getFullYear()} Pliqo. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}

export default App
