import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import './styles/app.css'
import { StoreProvider, useStore } from './store.jsx'
import Shell from './components/Shell.jsx'
import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Group from './pages/Group.jsx'
import Settings from './pages/Settings.jsx'

function App() {
  const { me } = useStore()
  const navigate = useNavigate()
  // Signed out: reset the address so the next login starts on the overview.
  useEffect(() => { if (!me) navigate('/', { replace: true }) }, [me, navigate])
  if (!me) return <Landing />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Dashboard />} />
        <Route path="groups/:id" element={<Group />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider><App /></StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
