import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Avatar } from '../components/ui.jsx'

export default function Settings() {
  const { me, theme, setTheme, updateProfile, logout, reset } = useStore()
  const [name, setName] = useState(me.name)
  const [saved, setSaved] = useState(false)

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    await updateProfile(name.trim())
    setSaved(true)
  }
  return (
    <>
      <header className="page-head"><h1>Settings</h1></header>
      <div className="settings">
        <form onSubmit={save} style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar user={{ ...me, name: name || me.name }} large />
            <span className="soft">{me.email || 'No email on this account'}</span>
          </div>
          <label className="field"><span>Name shown to your groups</span>
            <input className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary" disabled={!name.trim() || name.trim() === me.name}>Save name</button>
            {saved && <span className="soft small" role="status">Name saved.</span>}
          </div>
        </form>

        <div className="field"><span>Appearance</span>
          <div className="switch" style={{ justifySelf: 'start' }}>
            <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
            <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          </div>
        </div>

        <div className="field"><span>Sample data</span>
          <p className="soft small">Puts the sample groups and expenses back the way they were. Anything you added is removed, and you are logged out.</p>
          <button className="btn" style={{ justifySelf: 'start' }} onClick={() => reset().catch((err) => window.alert(err.message))}>Restore sample data</button>
        </div>

        <button className="btn" style={{ justifySelf: 'start' }} onClick={logout}>Log out</button>
      </div>
    </>
  )
}
